import json
import uuid
import asyncio
from datetime import datetime

from fastapi import APIRouter, HTTPException, Header, Body
from typing import Optional
from pydantic import BaseModel

from app.schemas import (
    AnalyzeRequest, CreateCaseRequest, UpdateCaseRequest,
    Case, Version, CaseWithVersions
)
from app.db_service import (
    create_case, get_case, list_cases, update_case, delete_case,
    create_version, get_version, list_versions, get_case_with_versions,
    get_or_create_user, get_user_stats, update_user_api_key, get_user
)
from app.db_service import (
    add_team_member, get_case_members, remove_team_member, update_member_role,
    is_user_member, get_user_role,
    create_invitation, get_invitation, get_user_invitations, update_invitation_status,
    cancel_invitation,
    create_comment, get_version_comments, update_comment, delete_comment,
    create_notification, get_user_notifications, mark_notification_read,
    mark_all_notifications_read, get_unread_count, get_case_for_user, get_version_for_user
)

from app.adapters.request_adapter import call_llm_api
from app.deterministic_diff import analyze_deterministic
from app.scoring import compute_cookedness
from app.groq_client import groq_generate_questions  # 🚀 Using Groq now!
from app.analysis.behavioral import analyze_behavior_shift
from app.analysis.error_novelty import analyze_error_novelty
from app.analysis.tradeoff import analyze_tradeoff

# 🚀 NEW: Import unified analyzer (replaces judge + prompt_fixer)
from app.unified_analyzer import unified_analysis

router = APIRouter()

REQUEST_THROTTLE_SECONDS = 1.2

# ============================================
# REQUEST MODELS
# ============================================

class UserInitRequest(BaseModel):
    user_id: str
    email: str
    display_name: Optional[str] = None

class ApiKeyRequest(BaseModel):
    user_id: str
    api_key: str

class ApiKeyStatusRequest(BaseModel):
    user_id: str

class UserIdRequest(BaseModel):
    user_id: str

class CaseIdRequest(BaseModel):
    user_id: str
    case_id: str

# ============================================
# HELPER: Extract user_id from request
# ============================================

def get_user_id_from_payload(user_id: Optional[str]) -> str:
    """
    In production, you'd verify Firebase ID token here.
    For now, we trust the frontend.
    """
    if not user_id:
        raise HTTPException(status_code=401, detail="user_id required")
    return user_id

# ============================================
# USER ENDPOINTS
# ============================================

@router.post("/user/init")
async def init_user(request: UserInitRequest):
    """Initialize or update user on first login"""
    user = get_or_create_user(request.user_id, request.email, request.display_name)
    stats = get_user_stats(request.user_id)
    return {
        "user": user.model_dump(),
        "stats": stats
    }

@router.post("/user/api-key")
async def save_api_key(request: ApiKeyRequest):
    """Save user's Gemini API key"""
    user_id = get_user_id_from_payload(request.user_id)
    user = update_user_api_key(user_id, request.api_key)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "API key saved successfully"}

@router.post("/user/api-key/status")
async def get_api_key_status(request: ApiKeyStatusRequest):
    """Check if user has API key configured"""
    user_id = get_user_id_from_payload(request.user_id)
    user = get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "has_api_key": bool(user.api_key),
        "api_key_preview": f"{user.api_key[:8]}..." if user.api_key else None
    }

# ============================================
# CASE ENDPOINTS
# ============================================

@router.post("/cases", response_model=Case)
async def create_case_endpoint(req: CreateCaseRequest):
    """Create a new case"""
    user_id = get_user_id_from_payload(req.user_id)
    case = create_case(user_id, req.name, req.description)
    return case

@router.post("/cases/list")
async def list_cases_endpoint(request: UserIdRequest):
    """List all cases for user"""
    user_id = get_user_id_from_payload(request.user_id)
    cases = list_cases(user_id)
    return {"cases": [c.model_dump() for c in cases]}

@router.post("/cases/get")
async def get_case_endpoint(request: CaseIdRequest):
    """Get case with all versions"""
    user_id = get_user_id_from_payload(request.user_id)
    case = get_case_for_user(request.case_id, user_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    case_with_versions = get_case_with_versions(request.case_id, case.user_id)
    return case_with_versions


@router.post("/cases/update")
async def update_case_endpoint(request: UpdateCaseRequest):
    """Update case metadata (rename)"""
    user_id = get_user_id_from_payload(request.user_id)
    case = update_case(request.case_id, user_id, request.name, request.description)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case

@router.post("/cases/delete")
async def delete_case_endpoint(request: CaseIdRequest):
    """Delete case and all versions"""
    user_id = get_user_id_from_payload(request.user_id)
    success = delete_case(request.case_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"message": "Case deleted", "case_id": request.case_id}

# ============================================
# VERSION ENDPOINTS
# ============================================

class VersionRequest(BaseModel):
    user_id: str
    version_id: str

class VersionsListRequest(BaseModel):
    user_id: str
    case_id: str

@router.post("/versions/get")
async def get_version_endpoint(request: VersionRequest):
    """Get specific version snapshot"""
    user_id = get_user_id_from_payload(request.user_id)
    version = get_version_for_user(request.version_id, user_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return version


@router.post("/versions/list")
async def list_versions_endpoint(request: VersionsListRequest):
    """List all versions for a case"""
    user_id = get_user_id_from_payload(request.user_id)
    versions = list_versions(request.case_id, user_id)
    return {"versions": [v.model_dump() for v in versions]}

# ============================================
# ANALYZE ENDPOINT (🚀 OPTIMIZED TO 2 CALLS)
# ============================================

# In routes.py - Update the /analyze endpoint

@router.post("/analyze")
async def analyze(req: AnalyzeRequest):
    """
    Run analysis and save as new version.
    Returns data in CANONICAL snapshot format.
    """
    user_id = get_user_id_from_payload(req.user_id)
    
    # Get user's API key
    user = get_user(user_id)
    if not user or not user.api_key:
        raise HTTPException(
            status_code=400, 
            detail="Groq API key not configured. Please add your API key in Settings."
        )
    
    # Handle case creation
    if req.case_id:
        case = get_case(req.case_id, user_id)
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
    else:
        case_name = req.case_name or "Untitled Case"
        case = create_case(user_id, case_name, description=f"Goal: {req.goal[:100]}")
    
    run_id = f"run_{uuid.uuid4().hex[:8]}"

    # Parse inputs
    try:
        env_vars = json.loads(req.env)
        body_template = json.loads(req.body_template)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON input: {str(e)}")

    # ============================================
    # 🚀 API CALL #1: Generate questions (Groq)
    # ============================================
    print(f"[API CALL 1/2] Generating questions...")
    if req.manual_questions:
        questions = req.manual_questions
    else:
        questions = groq_generate_questions(
            api_key=user.api_key,
            goal=req.goal,
            n=req.n_cases,
        )
    print(f"[API CALL 1/2] ✓ Generated {len(questions)} questions")

    # Run Old vs New APIs
    headers = {"Content-Type": "application/json"}
    old_results, new_results = [], []

    for q in questions:
        vars_map = {**env_vars, "question": q}

        old_resp = await call_llm_api(
            req.old_api, headers, body_template, vars_map, req.response_path
        )
        new_resp = await call_llm_api(
            req.new_api, headers, body_template, vars_map, req.response_path
        )

        old_results.append({"question": q, "response": old_resp})
        new_results.append({"question": q, "response": new_resp})

        await asyncio.sleep(REQUEST_THROTTLE_SECONDS)

    # Deterministic Diff
    deterministic = analyze_deterministic(old_results, new_results)

    # ============================================
    # 🚀 API CALL #2: Unified analysis (Groq)
    # ============================================
    print(f"[API CALL 2/2] Running unified analysis...")
    try:
        full_analysis = unified_analysis(
            api_key=user.api_key,
            old_results=old_results,
            new_results=new_results,
            goal=req.goal,
            deterministic=deterministic,
            old_prompt=req.old_prompt,
            new_prompt=req.new_prompt
        )
        print(f"[API CALL 2/2] ✓ Complete")
        
    except Exception as e:
        print(f"[API CALL 2/2] ✗ Failed: {e}")
        full_analysis = {
            "verdict": "Unknown",
            "summary": "Unified analysis failed",
            "risk_flags": ["ANALYSIS_FAILURE"],
            "change_type": "unknown",
            "change_summary": "Analysis engine unavailable",
            "findings": [],
            "suggestions": [],
            "confidence": "low"
        }

    # Cookedness
    cookedness = compute_cookedness(
        deterministic["deterministic_score"],
        full_analysis.get("risk_flags", []),
    )

    # Advanced Analysis
    behavioral = analyze_behavior_shift(old_results, new_results)
    error_novelty = analyze_error_novelty(
        deterministic["deterministic_flags"],
        full_analysis.get("risk_flags", [])
    )
    tradeoff = analyze_tradeoff(
        old_results,
        new_results,
        cookedness["cookedness_score"]
    )

    # ============================================
    # 🎯 BUILD CANONICAL SNAPSHOT FORMAT
    # ============================================
    
    # Calculate quality and safety scores
    quality_score = deterministic["deterministic_score"]
    safety_score = max(0, 100 - deterministic["deterministic_score"])
    
    # Determine if safety override triggered
    hard_safety_flags = {"SAFETY_COMPROMISE", "LEGAL_HALLUCINATION", "CONFIDENCE_INFLATION"}
    has_hard_safety = any(f in deterministic["deterministic_flags"] for f in hard_safety_flags)
    safety_override_triggered = has_hard_safety and deterministic["deterministic_score"] >= 60
    
    # Final verdict (with safety override logic)
    if safety_override_triggered:
        final_verdict = "Regression"
        primary_root_cause = next((f for f in deterministic["deterministic_flags"] if f in hard_safety_flags), "SAFETY_COMPROMISE")
    else:
        final_verdict = full_analysis.get("verdict", "Unknown")
        primary_root_cause = deterministic["deterministic_flags"][0] if deterministic["deterministic_flags"] else None
    
    # Ship recommendation
    ship_recommendation = "DO_NOT_SHIP" if final_verdict == "Regression" else "REVIEW" if final_verdict == "Neutral" else "SAFE_TO_SHIP"
    
    # Build canonical response
    canonical_response = {
        # Top level metadata
        "run_id": run_id,
        "case_id": case.case_id,
        "case_name": case.name,
        "version_id": None,  # Will be set after version creation
        "version_number": None,  # Will be set after version creation
        "created_at": datetime.utcnow().isoformat() + "Z",
        
        # 1️⃣ INPUTS (Reproducibility Layer)
        "inputs": {
            "mode": req.mode,
            "old_api": req.old_api,
            "new_api": req.new_api,
            "env": env_vars,
            "body_template": body_template,
            "response_path": req.response_path,
            "goal": req.goal,
            "old_prompt": req.old_prompt,
            "new_prompt": req.new_prompt,
            "n_cases": req.n_cases,
            "manual_questions": req.manual_questions
        },
        
        # 2️⃣ TEST CASES
        "test_cases": questions,
        
        # 3️⃣ RAW MODEL OUTPUTS (Evidence Layer)
        "results": {
            "old": old_results,
            "new": new_results
        },
        
        # 4️⃣ EVALUATION (Layered Judgment System)
        "evaluation": {
            # 🟨 2A — Deterministic (Rule Engine)
            "deterministic": {
                "score": deterministic["deterministic_score"],
                "flags": deterministic["deterministic_flags"],
                "explanations": {
                    flag: f"Detected: {flag}" for flag in deterministic["deterministic_flags"]
                }
            },
            
            # 🟨 2B — LLM Judge (Advisory Only)
            "llm_judge": {
                "model": "llama-3.3-70b-versatile",
                "verdict": full_analysis.get("verdict", "Unknown"),
                "summary": full_analysis.get("summary", ""),
                "risk_flags": full_analysis.get("risk_flags", []),
                "confidence": full_analysis.get("confidence", "medium")
            },
            
            # 🟥 2C — Safety Override (Authoritative)
            "safety_override": {
                "triggered": safety_override_triggered,
                "primary_root_cause": primary_root_cause,
                "escalation_reason": f"Deterministic {primary_root_cause} with score ≥ 60" if safety_override_triggered else None,
                "overridden_verdict": final_verdict if safety_override_triggered else None
            }
        },
        
        # 5️⃣ SCORES (Orthogonal Metrics)
        "scores": {
            "deterministic_score": deterministic["deterministic_score"],
            "quality_score": quality_score,
            "safety_score": safety_score,
            "cookedness": {
                "score": cookedness["cookedness_score"],
                "severity": cookedness["severity"]
            }
        },
        
        # 6️⃣ FINAL VERDICT (What CI / Humans Read)
        "verdict": {
            "final": final_verdict,
            "reason": full_analysis.get("summary", "Analysis complete"),
            "compared_to": "OLD",
            "ship_recommendation": ship_recommendation
        },
        
        # 7️⃣ BEHAVIORAL SHIFT (Model Personality Diff)
        "behavioral_shift": behavioral,
        
        # 8️⃣ ERROR NOVELTY (Regression Intelligence)
        "error_novelty": error_novelty,
        
        # 9️⃣ TRADEOFF ANALYSIS (Why This Is Tricky)
        "tradeoff": tradeoff,
        
        # 🔟 INSIGHT ENGINE (Fix, Don't Judge)
        "insight": {
            "change_type": full_analysis.get("change_type", "unknown"),
            "short_summary": full_analysis.get("change_summary", ""),
            "detailed_review": full_analysis.get("summary", ""),
            "findings": full_analysis.get("findings", []),
            "suggestions": full_analysis.get("suggestions", []),
            "revised_prompt": full_analysis.get("revised_prompt"),
            "quick_tests": full_analysis.get("quick_tests", []),
            "metrics_to_watch": full_analysis.get("metrics_to_watch", [])
        },
        
        # Metadata
        "api_calls_used": 2,
        "provider": "groq"
    }
    
    # Save as version
    version = create_version(
        case_id=case.case_id,
        user_id=user_id,
        request_payload=req.model_dump(),
        analysis_response=canonical_response
    )
    
    # Update version metadata in response
    canonical_response["version_id"] = version.version_id
    canonical_response["version_number"] = version.version_number
    
    print(f"[COMPLETE] Total Groq API calls: 2")
    
    return canonical_response

# ============================================
# LEGACY ENDPOINT (for backward compatibility)
# ============================================

@router.post("/suggest")
async def get_suggestions_legacy(req: dict):
    """
    Legacy prompt-fixer endpoint.
    Now uses unified analyzer with Groq.
    """
    user_id = req.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="user_id required")
    
    user = get_user(user_id)
    if not user or not user.api_key:
        raise HTTPException(
            status_code=400,
            detail="Groq API key not configured"
        )
    
    try:
        # Use unified analyzer in prompt-fixer mode
        deterministic = {
            "deterministic_flags": req.get("deterministic_flags", []) + req.get("risk_flags", []),
            "deterministic_score": 50
        }
        
        full_analysis = unified_analysis(
            api_key=user.api_key,
            old_results=[{"question": "N/A", "response": req.get("old_prompt", "")}],
            new_results=[{"question": "N/A", "response": req.get("new_prompt", "")}],
            goal=req.get("goal", ""),
            deterministic=deterministic,
            old_prompt=req.get("old_prompt", ""),
            new_prompt=req.get("new_prompt", "")
        )
        
        insight = {
            "change_type": full_analysis.get("change_type"),
            "short_summary": full_analysis.get("change_summary"),
            "detailed_review": full_analysis.get("summary"),
            "findings": full_analysis.get("findings", []),
            "suggestions": full_analysis.get("suggestions", []),
            "revised_prompt": full_analysis.get("revised_prompt"),
            "quick_tests": full_analysis.get("quick_tests", []),
            "metrics_to_watch": full_analysis.get("metrics_to_watch", [])
        }
        
        return {"insight": insight}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    


@router.post("/team/members")
async def get_team_members(req: dict):
    case = get_case(req["case_id"], req["user_id"])
    if not case and not is_user_member(req["case_id"], req["user_id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    members = get_case_members(req["case_id"])
    return {"members": members}


@router.post("/team/invite")
async def invite_member(req: dict):
    role = get_user_role(req["case_id"], req["user_id"])
    case = get_case(req["case_id"], req["user_id"])

    if not case and role == "VIEWER":
        raise HTTPException(status_code=403, detail="Not allowed")

    inviter = get_user(req["user_id"])
    if not inviter:
        raise HTTPException(status_code=404, detail="User not found")

    invitation = create_invitation(
        case_id=req["case_id"],
        case_name=case.name,
        invited_by=req["user_id"],
        invited_by_email=inviter.email,
        invited_by_name=inviter.display_name,
        invited_email=req["invited_email"],
        role=req["role"]
    )

    return {"message": "Invitation sent", "invitation": invitation}


@router.post("/team/remove")
async def remove_member_route(req: dict):
    case = get_case(req["case_id"], req["user_id"])
    if not case:
        raise HTTPException(status_code=403, detail="Only owner can remove")

    if not remove_team_member(req["case_id"], req["member_id"]):
        raise HTTPException(status_code=404, detail="Member not found")

    return {"message": "Member removed"}


@router.post("/invitations/pending")
async def pending_invitations(req: dict):
    user = get_user(req["user_id"])
    return {
        "invitations": get_user_invitations(user.email, "PENDING")
    }


@router.post("/invitations/respond")
async def respond_invitation(req: dict):
    invitation = get_invitation(req["invitation_id"])
    user = get_user(req["user_id"])

    if not invitation or user.email != invitation["invited_email"]:
        raise HTTPException(status_code=403)

    if req["action"] == "accept":
        add_team_member(
            invitation["case_id"],
            user.user_id,
            user.email,
            user.display_name,
            invitation["role"],
            invitation["invited_by"]
        )
        update_invitation_status(invitation["invitation_id"], "ACCEPTED")
        return {"message": "Accepted"}

    if req["action"] == "reject":
        update_invitation_status(invitation["invitation_id"], "REJECTED")
        return {"message": "Rejected"}

    raise HTTPException(status_code=400, detail="Invalid action")


@router.post("/invitations/cancel")
async def cancel_invitation_route(req: dict):
    invitation = get_invitation(req["invitation_id"])
    if invitation["invited_by"] != req["user_id"]:
        raise HTTPException(status_code=403)

    cancel_invitation(req["invitation_id"])
    return {"message": "Invitation cancelled"}



@router.post("/comments/list")
async def list_comments(req: dict):
    return {
        "comments": get_version_comments(req["version_id"])
    }


@router.post("/comments/create")
async def create_comment_route(req: dict):
    if not is_user_member(req["case_id"], req["user_id"]):
        if not get_case(req["case_id"], req["user_id"]):
            raise HTTPException(status_code=403)

    user = get_user(req["user_id"])

    comment = create_comment(
        req["version_id"],
        req["case_id"],
        req["user_id"],
        user.email,
        user.display_name,
        req["text"]
    )

    return {"comment": comment}


@router.post("/comments/update")
async def update_comment_route(req: dict):
    comment = update_comment(req["comment_id"], req["text"])
    if not comment or comment["user_id"] != req["user_id"]:
        raise HTTPException(status_code=403)
    return {"comment": comment}


@router.post("/comments/delete")
async def delete_comment_route(req: dict):
    if not delete_comment(req["comment_id"], req["user_id"]):
        raise HTTPException(status_code=404)
    return {"message": "Deleted"}


@router.post("/notifications/list")
async def list_notifications(req: dict):
    return {
        "notifications": get_user_notifications(req["user_id"], req.get("unread_only")),
        "unread_count": get_unread_count(req["user_id"])
    }


@router.post("/notifications/read")
async def read_notification(req: dict):
    mark_notification_read(req["notification_id"], req["user_id"])
    return {"message": "Marked as read"}


@router.post("/notifications/read-all")
async def read_all_notifications(req: dict):
    count = mark_all_notifications_read(req["user_id"])
    return {"message": f"{count} marked read"}


