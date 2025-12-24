from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime

# ============================================
# USER SCHEMA
# ============================================

class User(BaseModel):
    user_id: str
    email: str
    display_name: Optional[str] = None
    gemini_api_key: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================
# CASE SCHEMA
# ============================================

class Case(BaseModel):
    """Case = A test scenario (e.g., 'Legal AI - Tax Bot')"""
    case_id: str = Field(..., description="Unique case identifier")
    user_id: str = Field(..., description="Owner Firebase UID")
    name: str = Field(..., description="Human-readable case name")
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    version_count: int = Field(default=0, description="Total versions")
    latest_version: Optional[int] = None


# ============================================
# VERSION SCHEMAS
# ============================================

class VersionMetadata(BaseModel):
    """Lightweight version info for list views"""
    version_id: str
    case_id: str
    version_number: int
    cookedness_score: int
    verdict: str
    created_at: datetime


class AnalysisSummary(BaseModel):
    """
    Human-readable explanation layer (Layer 2C output)
    """
    verdict_reason: str
    primary_root_cause: Optional[str] = None
    secondary_root_causes: List[str] = []
    confidence_level: Optional[str] = Field(
        default="medium",
        description="How confident the system is in the verdict"
    )


class QualitySafetySplit(BaseModel):
    """
    Explains why low cookedness may still be a regression
    """
    quality_score: Optional[int] = None
    safety_score: Optional[int] = None


class RegressionDelta(BaseModel):
    """
    Relative change vs previous version
    """
    direction: Optional[str] = Field(
        default=None,
        description="up | down | neutral"
    )
    magnitude: Optional[int] = Field(
        default=None,
        description="Percentage delta vs previous version"
    )


class Version(BaseModel):
    """Version = Immutable snapshot of one analysis run"""
    version_id: str = Field(..., description="Unique version identifier")
    case_id: str = Field(..., description="Parent case ID")
    user_id: str = Field(..., description="Owner Firebase UID")
    version_number: int = Field(..., description="Sequential version (1, 2, 3...)")

    # Request payload (for reproducibility)
    request_payload: Dict[str, Any] = Field(
        ..., description="Original /analyze request"
    )

    # Full analysis response (raw)
    analysis_response: Dict[str, Any] = Field(
        ..., description="Complete /analyze response"
    )

    # Quick access fields (denormalized)
    cookedness_score: int = Field(default=0)
    verdict: str = Field(default="Unknown")
    deterministic_score: int = Field(default=0)
    test_case_count: int = Field(default=0)

    # 🔥 NEW — Layer 2C outputs
    root_causes: List[str] = Field(
        default_factory=list,
        description="High-level causes of regression/improvement"
    )
    analysis_summary: Optional[AnalysisSummary] = None
    quality_safety_split: Optional[QualitySafetySplit] = None
    regression_delta: Optional[RegressionDelta] = None

    # Timestamp
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================
# API REQUEST / RESPONSE MODELS
# ============================================

class AnalyzeRequest(BaseModel):
    """Enhanced analyze request with user context"""
    user_id: str = Field(..., description="Firebase UID")
    case_id: Optional[str] = None
    case_name: Optional[str] = None

    mode: str
    old_api: str
    new_api: str
    env: str
    body_template: str
    response_path: str
    goal: str
    old_prompt: str
    new_prompt: str
    n_cases: int
    manual_questions: List[str] = []


class CreateCaseRequest(BaseModel):
    user_id: str
    name: str
    description: Optional[str] = None


class UpdateCaseRequest(BaseModel):
    user_id: str
    case_id: str
    name: Optional[str] = None
    description: Optional[str] = None


class CaseWithVersions(BaseModel):
    """Case with version list for frontend"""
    case_id: str
    user_id: str
    name: str
    description: Optional[str] = None
    version_count: int
    created_at: datetime
    updated_at: datetime
    versions: List[VersionMetadata]


# ============================================
# LEGACY MODELS (keep untouched)
# ============================================

class RunSummary(BaseModel):
    run_id: str
    cookedness: int
    verdict: str


class UseCase(BaseModel):
    id: str
    name: str
    runs: List[RunSummary]


class Report(BaseModel):
    cookedness: int
    verdict: str
    removed: List[str]
    added: List[str]
    risks: List[str]
    keywords: List[str]
