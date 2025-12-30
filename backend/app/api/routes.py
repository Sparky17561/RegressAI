import json
import uuid
import asyncio
from datetime import datetime
import logging
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
from app.deep_dive_analyzer import (
    analyze_deep_dive_metrics,
    generate_visualization_data
)
logger = logging.getLogger(__name__)

from app.db_service import upgrade_user_to_pro, decrement_deep_dive

from app.adapters.request_adapter import call_llm_api
from app.deterministic_diff import analyze_deterministic
from app.scoring import compute_cookedness
from app.groq_client import groq_generate_questions  # 🚀 Using Groq now!
from app.analysis.behavioral import analyze_behavior_shift
from app.analysis.error_novelty import analyze_error_novelty
from app.analysis.tradeoff import analyze_tradeoff
import os
from app.config import REGRESSAI_GROQ_KEY
from app.schemas import SubscriptionTier


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

# Add this to routes.py after the /versions/get endpoint:

@router.post("/versions/debug")
async def debug_version(request: VersionRequest):
    """Debug endpoint to check deep dive data integrity"""
    from app.db_service import verify_deep_dive_data
    
    user_id = get_user_id_from_payload(request.user_id)
    version = get_version_for_user(request.version_id, user_id)
    
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    debug_info = verify_deep_dive_data(request.version_id)
    
    return {
        "version_id": request.version_id,
        "version_number": version.version_number,
        "debug_info": debug_info,
        "frontend_will_see": {
            "is_deep_dive": version.analysis_response.get("is_deep_dive", False),
            "has_deep_dive_metrics": "deep_dive_metrics" in version.analysis_response,
            "has_visualization_data": "visualization_data" in version.analysis_response
        }
    }


# Also ensure /versions/get returns the FULL version with all nested data:
# (Replace existing /versions/get endpoint)

@router.post("/versions/get")
async def get_version_endpoint(request: VersionRequest):
    """
    Get specific version snapshot with FULL data including deep dive metrics
    """
    user_id = get_user_id_from_payload(request.user_id)
    version = get_version_for_user(request.version_id, user_id)
    
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    # Convert to dict and ensure all nested data is included
    version_dict = version.model_dump()
    
    # 🔥 DEBUG: Log what we're sending
    analysis_response = version_dict.get("analysis_response", {})
    print(f"[GET VERSION] Sending version {version.version_id}")
    print(f"[GET VERSION] is_deep_dive: {analysis_response.get('is_deep_dive', False)}")
    print(f"[GET VERSION] has deep_dive_metrics: {'deep_dive_metrics' in analysis_response}")
    print(f"[GET VERSION] has visualization_data: {'visualization_data' in analysis_response}")
    
    return version_dict

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

# routes_analyze.py (snippet to paste into your existing APIRouter module)
import json
import uuid
import asyncio
from datetime import datetime
from fastapi import HTTPException
from app.schemas import AnalyzeRequest, SubscriptionTier
from app.db_service import (
    get_user, get_case, create_case, create_version, get_case_with_versions,
    get_user_stats, update_user_api_key
)
from app.adapters.request_adapter import call_llm_api
from app.deterministic_diff import analyze_deterministic
from app.scoring import compute_cookedness
from app.analysis.behavioral import analyze_behavior_shift
from app.analysis.error_novelty import analyze_error_novelty
from app.analysis.tradeoff import analyze_tradeoff
from app.groq_client import groq_generate_questions
from app.unified_analyzer import unified_analysis
from app.config import REGRESSAI_GROQ_KEY

REQUEST_THROTTLE_SECONDS = 1.2

@router.post("/analyze")
async def analyze(req: AnalyzeRequest):
    """
    Run analysis and save as new version.
    Uses:
      - RegressAI Groq key for PRO users
      - User Groq key for FREE users
    Returns canonical snapshot.
    """
    print("\n" + "="*60)
    print("🔍 ANALYZE ENDPOINT - START")
    print("="*60)

    user_id = req.user_id
    if not user_id:
        raise HTTPException(status_code=401, detail="user_id required")

    run_id = f"run_{uuid.uuid4().hex[:8]}"
    print(f"[ANALYZE] user_id={user_id}")
    print(f"[ANALYZE] run_id={run_id} case={req.case_id}")

    user = get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # API key selection
    is_premium = user.subscription_tier == SubscriptionTier.PRO
    if is_premium:
        api_key = REGRESSAI_GROQ_KEY
        api_source = "regressai"
        if not api_key:
            raise HTTPException(status_code=500, detail="RegressAI API key missing")
    else:
        if not user.api_key:
            raise HTTPException(status_code=400, detail="Groq API key not configured. Add your API key in Settings.")
        api_key = user.api_key
        api_source = "user"

    # Case handling
    if req.case_id:
        case = get_case(req.case_id, user_id)
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
    else:
        case = create_case(user_id, req.case_name or "Untitled Case", description=f"Goal: {req.goal[:120]}")
    
    # parse env & body_template
    try:
        env_vars = json.loads(req.env) if isinstance(req.env, str) else (req.env or {})
        body_template = json.loads(req.body_template) if isinstance(req.body_template, str) else (req.body_template or {})
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON input: {e}")

    # Question generation (Groq)
    if req.manual_questions and len(req.manual_questions) > 0:
        questions = req.manual_questions
    else:
        try:
            questions = groq_generate_questions(api_key=api_key, goal=req.goal, n=req.n_cases or 5)
        except Exception as e:
            print(f"[ANALYZE] QGen failed: {e}")
            raise HTTPException(status_code=500, detail=f"Question generation failed: {e}")

    # Run old/new APIs (throttled)
    headers = {"Content-Type": "application/json"}
    old_results, new_results = [], []
    for q in questions:
        vars_map = {**env_vars, "question": q}
        try:
            old_resp = await call_llm_api(req.old_api, headers, body_template, vars_map, req.response_path)
        except Exception as e:
            old_resp = f"ERROR: {e}"
        try:
            new_resp = await call_llm_api(req.new_api, headers, body_template, vars_map, req.response_path)
        except Exception as e:
            new_resp = f"ERROR: {e}"
        old_results.append({"question": q, "response": old_resp})
        new_results.append({"question": q, "response": new_resp})
        await asyncio.sleep(REQUEST_THROTTLE_SECONDS)

    # Deterministic analysis
    deterministic = analyze_deterministic(old_results, new_results)

    # Unified analysis (free semantics if user is free; ensure we pass context)
    try:
        full_analysis = unified_analysis(
            api_key=api_key,
            old_results=old_results,
            new_results=new_results,
            goal=req.goal,
            deterministic=deterministic,
            old_prompt=req.old_prompt,
            new_prompt=req.new_prompt,
            context={"key_source": "platform" if is_premium else "byok", "tier": user.subscription_tier}
        )
    except Exception as e:
        print(f"[ANALYZE] unified_analysis failed: {e}")
        full_analysis = {
            "verdict": "Unknown",
            "summary": "Unified analysis failed",
            "risk_flags": ["ANALYSIS_FAILURE"],
            "confidence": "low"
        }

    # Scores & derived metrics
    cookedness = compute_cookedness(deterministic.get("deterministic_score", 0), full_analysis.get("risk_flags", []))
    behavioral = analyze_behavior_shift(old_results, new_results)
    error_novelty = analyze_error_novelty(deterministic.get("deterministic_flags", []), full_analysis.get("risk_flags", []))
    tradeoff = analyze_tradeoff(old_results, new_results, cookedness["cookedness_score"])
    quality_score = deterministic.get("deterministic_score", 0)
    safety_score = max(0, 100 - quality_score)

    final_verdict = full_analysis.get("verdict", "Unknown")
    ship_recommendation = (
        "DO_NOT_SHIP" if final_verdict == "Regression"
        else "REVIEW" if final_verdict == "Neutral"
        else "SAFE_TO_SHIP"
    )

    canonical_response = {
        "run_id": run_id,
        "case_id": case.case_id,
        "case_name": case.name,
        "version_id": None,
        "version_number": None,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "inputs": req.model_dump(),
        "test_cases": questions,
        "results": {"old": old_results, "new": new_results},
        "evaluation": {"deterministic": deterministic, "llm_judge": full_analysis},
        "scores": {
            "deterministic_score": quality_score,
            "quality_score": quality_score,
            "safety_score": safety_score,
            "cookedness": cookedness
        },
        "verdict": {
            "final": final_verdict,
            "reason": full_analysis.get("summary", ""),
            "ship_recommendation": ship_recommendation
        },
        "behavioral_shift": behavioral,
        "error_novelty": error_novelty,
        "tradeoff": tradeoff,
        "api_calls_used": 2,
        "provider": "groq",
        "api_source": api_source
    }

    # Save version
    version = create_version(case_id=case.case_id, user_id=user_id, request_payload=req.model_dump(), analysis_response=canonical_response)
    canonical_response["version_id"] = version.version_id
    canonical_response["version_number"] = version.version_number

    print("\n" + "="*60)
    print("✅ ANALYZE: complete")
    print(f"  - run_id: {run_id}")
    print(f"  - version_id: {version.version_id}")
    print("="*60 + "\n")

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


# Add these endpoints to your routes.py file
# Place them after the USER ENDPOINTS section

# ============================================
# PREMIUM / SUBSCRIPTION ENDPOINTS
# ============================================


class SubscriptionCheckRequest(BaseModel):
    user_id: str

class SubscriptionUpgradeRequest(BaseModel):
    user_id: str

# In routes.py - Replace the /subscription/check endpoint with this fixed version

# In routes.py - Replace the /subscription/check endpoint

@router.post("/subscription/check")
async def check_subscription(request: SubscriptionCheckRequest):
    """Check user's subscription status - FIXED"""
    user_id = request.user_id 
    user = get_user(user_id)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # 🔥 FIX: Properly convert enum to string
    tier_raw = user.subscription_tier
    
    # Handle both enum and string values
    if hasattr(tier_raw, 'value'):
        tier_value = tier_raw.value
    else:
        tier_value = str(tier_raw).lower()
    
    # Ensure it's a valid tier
    if tier_value not in ["free", "pro"]:
        tier_value = "free"
    
    is_premium = (tier_value == "pro")
    
    print(f"[SUBSCRIPTION CHECK] User: {user.email}")
    print(f"[SUBSCRIPTION CHECK] Tier (raw): {tier_raw}")
    print(f"[SUBSCRIPTION CHECK] Tier (normalized): {tier_value}")
    print(f"[SUBSCRIPTION CHECK] Is Premium: {is_premium}")
    print(f"[SUBSCRIPTION CHECK] Deep Dives: {user.deep_dives_remaining}")
    
    return {
        "tier": tier_value,  # Always return lowercase string
        "is_premium": is_premium,
        "deep_dives_remaining": int(user.deep_dives_remaining or 0),
        "deep_dive_reset_date": user.deep_dive_reset_date.isoformat() if user.deep_dive_reset_date else None
    }

@router.post("/subscription/upgrade")
async def upgrade_subscription(request: SubscriptionUpgradeRequest):
    """Upgrade user to PRO tier (demo - no payment)"""
    user_id = get_user_id_from_payload(request.user_id)
    user = get_user(user_id)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.subscription_tier == SubscriptionTier.PRO:
        return {
            "message": "Already a PRO user",
            "tier": "pro",
            "is_premium": True,
            "deep_dives_remaining": user.deep_dives_remaining
        }
    
    print(f"[UPGRADE] Upgrading user {user.email} to PRO")
    
    # Upgrade in database
    result = upgrade_user_to_pro(user_id)
    
    if result.modified_count > 0:
        # Fetch updated user
        updated_user = get_user(user_id)
        print(f"[UPGRADE] ✅ Upgrade successful")
        
        return {
            "message": "Successfully upgraded to PRO",
            "tier": "pro",
            "is_premium": True,
            "deep_dives_remaining": updated_user.deep_dives_remaining
        }
    else:
        raise HTTPException(status_code=500, detail="Upgrade failed")



REQUEST_THROTTLE_SECONDS = 1.2

@router.post("/deep-dive")
async def deep_dive_analysis(req: AnalyzeRequest):
    """
    Premium Deep Dive Analysis (platform Groq key required).
    Enforces PRO subscription and deep dive quota.
    """
    user_id = req.user_id
    if not user_id:
        raise HTTPException(status_code=401, detail="user_id required")

    user = get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.subscription_tier != SubscriptionTier.PRO:
        raise HTTPException(status_code=403, detail="Deep Dive requires PRO subscription")

    if (user.deep_dives_remaining or 0) <= 0:
        raise HTTPException(status_code=429, detail="No deep dives remaining")

    if decrement_deep_dive(user_id).modified_count == 0:
        raise HTTPException(status_code=429, detail="Failed to decrement deep dive count")

    api_key = REGRESSAI_GROQ_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="RegressAI API key missing")

    # case handling
    if req.case_id:
        case = get_case(req.case_id, user_id)
        if not case:
            raise HTTPException(status_code=400, detail="Case not found")  # Changed from 404 to 400
    else:
        case = create_case(user_id, req.case_name or "Deep Dive", description=f"Deep Dive: {req.goal[:120]}")

    run_id = f"deep_{uuid.uuid4().hex[:8]}"

    # parse inputs
    try:
        env_vars = json.loads(req.env) if isinstance(req.env, str) else (req.env or {})
        body_template = json.loads(req.body_template) if isinstance(req.body_template, str) else (req.body_template or {})
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON input: {e}")

    # generate test cases - ensure min 10
    n_cases = max(req.n_cases or 0, 10)
    if req.manual_questions and len(req.manual_questions) > 0:
        questions = req.manual_questions
    else:
        questions = groq_generate_questions(api_key=api_key, goal=req.goal, n=n_cases)

    # run old vs new
    headers = {"Content-Type": "application/json"}
    old_results, new_results = [], []
    for q in questions:
        vars_map = {**env_vars, "question": q}
        old_resp = await call_llm_api(req.old_api, headers, body_template, vars_map, req.response_path)
        new_resp = await call_llm_api(req.new_api, headers, body_template, vars_map, req.response_path)
        old_results.append({"question": q, "response": old_resp})
        new_results.append({"question": q, "response": new_resp})
        await asyncio.sleep(REQUEST_THROTTLE_SECONDS)

    deterministic = analyze_deterministic(old_results, new_results)

    try:
        unified = unified_analysis(
            api_key=api_key,
            old_results=old_results,
            new_results=new_results,
            goal=req.goal,
            deterministic=deterministic,
            old_prompt=req.old_prompt,
            new_prompt=req.new_prompt,
            context={"key_source": "platform", "tier": SubscriptionTier.PRO}
        )
    except Exception as e:
        print(f"[DEEP DIVE] unified_analysis failed: {e}")
        unified = {
            "verdict": "Unknown",
            "summary": "Unified analysis failed",
            "risk_flags": ["ANALYSIS_FAILURE"],
            "confidence": "low"
        }

    cookedness = compute_cookedness(deterministic.get("deterministic_score", 0), unified.get("risk_flags", []))
    behavioral = analyze_behavior_shift(old_results, new_results)
    error_novelty = analyze_error_novelty(deterministic.get("deterministic_flags", []), unified.get("risk_flags", []))
    tradeoff = analyze_tradeoff(old_results, new_results, cookedness["cookedness_score"])
    quality_score = deterministic.get("deterministic_score", 0)
    safety_score = max(0, 100 - quality_score)

    # deep dive metrics & visualizations (premium-only)
    deep_dive_metrics = analyze_deep_dive_metrics(old_results=old_results, new_results=new_results, adversarial_results=None)
    visualization_data = generate_visualization_data(old_results=old_results, new_results=new_results, metrics=deep_dive_metrics)

    final_verdict = unified.get("verdict", "Unknown")
    ship_recommendation = (
        "DO_NOT_SHIP" if final_verdict == "Regression"
        else "REVIEW" if final_verdict == "Neutral"
        else "SAFE_TO_SHIP"
    )

    canonical_response = {
        "run_id": run_id,
        "case_id": case.case_id,
        "case_name": case.name,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "is_deep_dive": True,
        "inputs": req.model_dump(),
        "test_cases": questions,
        "results": {"old": old_results, "new": new_results},
        "evaluation": {"deterministic": deterministic, "llm_judge": unified},
        "scores": {
            "deterministic_score": quality_score,
            "quality_score": quality_score,
            "safety_score": safety_score,
            "cookedness": cookedness
        },
        "verdict": {
            "final": final_verdict,
            "reason": unified.get("summary", ""),
            "ship_recommendation": ship_recommendation
        },
        "behavioral_shift": behavioral,
        "error_novelty": error_novelty,
        "tradeoff": tradeoff,
        # premium-only blobs
        "deep_dive_metrics": deep_dive_metrics,
        "visualization_data": visualization_data,
        "api_calls_used": 2,
        "provider": "groq",
        "api_source": "regressai"
    }

    version = create_version(case_id=case.case_id, user_id=user_id, request_payload=req.model_dump(), analysis_response=canonical_response)
    canonical_response["version_id"] = version.version_id
    canonical_response["version_number"] = version.version_number
    canonical_response["deep_dives_remaining"] = get_user(user_id).deep_dives_remaining

    print("\n" + "="*60)
    print("✅ DEEP DIVE: complete")
    print(f"  - run_id: {run_id}")
    print(f"  - version_id: {version.version_id}")
    print("="*60 + "\n")

    return canonical_response