import json
import uuid
import asyncio

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
from app.adapters.request_adapter import call_llm_api
from app.deterministic_diff import analyze_deterministic
from app.scoring import compute_cookedness
from app.judge import judge_run
from app.prompt_fixer import improve_prompt
from app.gemini_client import gemini_generate_questions
from app.analysis.behavioral import analyze_behavior_shift
from app.analysis.error_novelty import analyze_error_novelty
from app.analysis.tradeoff import analyze_tradeoff

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
        "has_api_key": bool(user.gemini_api_key),
        "api_key_preview": f"{user.gemini_api_key[:8]}..." if user.gemini_api_key else None
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
    case_with_versions = get_case_with_versions(request.case_id, user_id)
    if not case_with_versions:
        raise HTTPException(status_code=404, detail="Case not found")
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
    version = get_version(request.version_id, user_id)
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
# ANALYZE ENDPOINT (Enhanced with Versioning)
# ============================================

@router.post("/analyze")
async def analyze(req: AnalyzeRequest):
    """
    Run analysis and save as new version.
    
    Flow:
    1. If case_id provided -> add version to existing case
    2. If case_id is None -> create new case first
    3. Run analysis
    4. Save as immutable version
    """
    user_id = get_user_id_from_payload(req.user_id)
    
    # Get user's API key
    user = get_user(user_id)
    if not user or not user.gemini_api_key:
        raise HTTPException(
            status_code=400, 
            detail="Gemini API key not configured. Please add your API key in Settings."
        )
    
    # Handle case creation
    if req.case_id:
        case = get_case(req.case_id, user_id)
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
    else:
        # Create new case
        case_name = req.case_name or "Untitled Case"
        case = create_case(user_id, case_name, description=f"Goal: {req.goal[:100]}")
    
    run_id = f"run_{uuid.uuid4().hex[:8]}"

    # Parse inputs
    try:
        env_vars = json.loads(req.env)
        body_template = json.loads(req.body_template)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON input: {str(e)}")

    # Generate questions (Layer 0)
    if req.manual_questions:
        questions = req.manual_questions
    else:
        questions = gemini_generate_questions(
            api_key=user.gemini_api_key,
            goal=req.goal,
            n=req.n_cases,
        )

    # Run Old vs New APIs (Layer 1)
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

    # Deterministic Diff (Layer 2A)
    deterministic = analyze_deterministic(old_results, new_results)

    # LLM Judge (Layer 2B)
    try:
        jury = judge_run(
            api_key=user.gemini_api_key,
            old_results=old_results,
            new_results=new_results,
            goal=req.goal,
            deterministic=deterministic,
        )
    except Exception as e:
        jury = {
            "verdict": "Unknown",
            "summary": "Judge failed",
            "risk_flags": [],
            "error": str(e),
        }

    # Cookedness (Aggregation)
    cookedness = compute_cookedness(
        deterministic["deterministic_score"],
        jury.get("risk_flags", []),
    )

    # Advanced Analysis (Layer 2C)
    behavioral = analyze_behavior_shift(old_results, new_results)
    error_novelty = analyze_error_novelty(
        deterministic["deterministic_flags"],
        jury.get("risk_flags", [])
    )
    tradeoff = analyze_tradeoff(
        old_results,
        new_results,
        cookedness["cookedness_score"]
    )

    # Insight Engine (Layer 3)
    try:
        insight = improve_prompt(
            api_key=user.gemini_api_key,
            old_text=req.old_prompt,
            new_text=req.new_prompt,
            issues=deterministic["deterministic_flags"] + jury.get("risk_flags", []),
            goal=req.goal,
        )
    except Exception as e:
        insight = {
            "short_summary": "Insight engine failed",
            "detailed_review": str(e),
            "suggestions": [],
        }

    # ✅ Build analysis response (FIXED INDENTATION)
    analysis_response = {
        "run_id": run_id,
        "test_cases": questions,
        "old_api_results": old_results,
        "new_api_results": new_results,
        "deterministic": deterministic,
        "analysis": jury,
        "cookedness": cookedness,
        "behavioral_shift": behavioral,
        "error_novelty": error_novelty,
        "tradeoff": tradeoff,
        "insight": insight,
    }
    
    # Save as version
    version = create_version(
        case_id=case.case_id,
        user_id=user_id,
        request_payload=req.model_dump(),
        analysis_response=analysis_response
    )
    
    # ✅ Return response with version metadata
    return {
        **analysis_response,
        "version_id": version.version_id,
        "version_number": version.version_number,
        "case_id": case.case_id,
        "case_name": case.name
    }

# ============================================
# LEGACY ENDPOINT (for backward compatibility)
# ============================================

@router.post("/suggest")
async def get_suggestions_legacy(req: dict):
    """
    Legacy prompt-fixer endpoint.
    This is now baked into /analyze but kept for compatibility.
    """
    user_id = req.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="user_id required")
    
    user = get_user(user_id)
    if not user or not user.gemini_api_key:
        raise HTTPException(
            status_code=400,
            detail="Gemini API key not configured"
        )
    
    try:
        insight = improve_prompt(
            api_key=user.gemini_api_key,
            old_text=req.get("old_prompt", ""),
            new_text=req.get("new_prompt", ""),
            issues=req.get("deterministic_flags", []) + req.get("risk_flags", []),
            goal=req.get("goal", ""),
        )
        return {"insight": insight}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))