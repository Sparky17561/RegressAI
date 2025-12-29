from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime

# ============================================
# USER SCHEMA
# ============================================
from enum import Enum

class SubscriptionTier(str, Enum):
    FREE = "free"
    PRO = "pro"

class User(BaseModel):
    user_id: str
    email: str
    display_name: Optional[str] = None
    api_key: Optional[str] = None
    subscription_tier: SubscriptionTier = SubscriptionTier.FREE
    deep_dives_remaining: int = 0
    deep_dive_reset_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        use_enum_values = True  # ← Add this line to serialize enums as their values


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

# In schemas.py - Update VersionMetadata class

class VersionMetadata(BaseModel):
    """Lightweight version info for list views"""
    version_id: str
    case_id: str
    version_number: int
    cookedness_score: int
    verdict: str
    created_at: datetime
    is_deep_dive: bool = False  # 🔥 ADD THIS

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


# Add to schemas.py - Extend Version schema

from enum import Enum

class VerdictType(str, Enum):
    """Possible verdict outcomes"""
    IMPROVED = "Improved"
    SAFETY_HARDENING = "Safety Hardening"  # 🔥 NEW
    NEUTRAL = "Neutral"
    REGRESSION = "Regression"
    UNKNOWN = "Unknown"

class TradeoffType(str, Enum):
    """Types of legitimate tradeoffs"""
    SAFETY_VS_HELPFULNESS = "Safety_vs_Helpfulness"
    EFFICIENCY_VS_DETAIL = "Efficiency_vs_Detail"
    NONE = "None"

class DirectionAnalysis(BaseModel):
    """Direction of change analysis"""
    safety_direction: str = Field(
        default="unknown",
        description="improved | neutral | degraded"
    )
    helpfulness_direction: str = Field(
        default="unknown",
        description="improved | neutral | degraded"
    )
    specificity_direction: str = Field(
        default="unknown",
        description="increased | neutral | decreased"
    )
    reasoning: str = Field(
        default="",
        description="Explanation for direction assessment"
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

    # 🔥 SINGLE SOURCE OF TRUTH
    analysis_response: Dict[str, Any] = Field(
        ..., description="Complete canonical /analyze response"
    )

    # 🔥 Indexed / list-view fields ONLY
    cookedness_score: int = Field(default=0)
    verdict: str = Field(default="Unknown")
    deterministic_score: int = Field(default=0)
    test_case_count: int = Field(default=0)

    # 🔥 Lightweight extracted fields
    root_causes: List[str] = Field(default_factory=list)

    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        exclude_none = True  # 🔥 critical



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


# Add these new models to your existing schemas.py

from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum

# ============================================
# COLLABORATION ENUMS
# ============================================

class InvitationStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CANCELLED = "cancelled"

class TeamRole(str, Enum):
    OWNER = "owner"
    EDITOR = "editor"
    VIEWER = "viewer"

class NotificationType(str, Enum):
    INVITATION = "invitation"
    COMMENT = "comment"
    VERSION_CREATED = "version_created"
    CASE_SHARED = "case_shared"

# ============================================
# TEAM MEMBER MODELS
# ============================================

class TeamMember(BaseModel):
    member_id: str
    case_id: str
    user_id: str
    email: str
    display_name: Optional[str] = None
    role: TeamRole
    added_by: str
    added_at: datetime
    
    class Config:
        from_attributes = True

class TeamMemberResponse(BaseModel):
    member_id: str
    user_id: str
    email: str
    display_name: Optional[str] = None
    role: TeamRole
    added_at: datetime
    is_active: bool = True

# ============================================
# INVITATION MODELS
# ============================================

class Invitation(BaseModel):
    invitation_id: str
    case_id: str
    case_name: str
    invited_by: str
    invited_by_email: str
    invited_by_name: Optional[str] = None
    invited_email: EmailStr
    role: TeamRole
    status: InvitationStatus
    created_at: datetime
    responded_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class InvitationCreate(BaseModel):
    case_id: str
    invited_email: EmailStr
    role: TeamRole = TeamRole.VIEWER
    invited_by: str  # user_id

class InvitationResponse(BaseModel):
    invitation_id: str
    action: str  # "accept" or "reject"
    user_id: str

# ============================================
# COMMENT MODELS
# ============================================

class Comment(BaseModel):
    comment_id: str
    version_id: str
    case_id: str
    user_id: str
    user_email: str
    user_name: Optional[str] = None
    text: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class CommentCreate(BaseModel):
    version_id: str
    case_id: str
    user_id: str
    text: str

class CommentUpdate(BaseModel):
    comment_id: str
    user_id: str
    text: str

# ============================================
# NOTIFICATION MODELS
# ============================================

class Notification(BaseModel):
    notification_id: str
    user_id: str
    type: NotificationType
    title: str
    message: str
    link: Optional[str] = None
    read: bool = False
    created_at: datetime
    metadata: Optional[dict] = None
    
    class Config:
        from_attributes = True

class NotificationResponse(BaseModel):
    notification_id: str
    type: NotificationType
    title: str
    message: str
    link: Optional[str] = None
    read: bool
    created_at: datetime
    metadata: Optional[dict] = None

# ============================================
# REQUEST MODELS
# ============================================

class AddTeamMemberRequest(BaseModel):
    user_id: str
    case_id: str
    invited_email: EmailStr
    role: TeamRole = TeamRole.VIEWER

class RemoveTeamMemberRequest(BaseModel):
    user_id: str
    case_id: str
    member_id: str

class UpdateMemberRoleRequest(BaseModel):
    user_id: str
    case_id: str
    member_id: str
    new_role: TeamRole

class GetNotificationsRequest(BaseModel):
    user_id: str
    unread_only: bool = False

class MarkNotificationReadRequest(BaseModel):
    user_id: str
    notification_id: str

    # Add to schemas.py



class DeepDiveMetrics(BaseModel):
    """Advanced metrics for premium deep dive analysis"""
    adversarial_robustness: Dict[str, Any] = {}
    instruction_adherence: Dict[str, Any] = {}
    consistency_score: int = 0
    hallucination_rate: float = 0.0
    response_quality_distribution: Dict[str, int] = {}
    safety_breakdown: Dict[str, Any] = {}
    edge_case_handling: List[Dict[str, Any]] = []
    performance_degradation: Dict[str, Any] = {}
    token_efficiency: Dict[str, Any] = {}
    response_time_analysis: Dict[str, Any] = {}

class DeepDiveVersion(BaseModel):
    """Premium version with deep analytics"""
    version_id: str
    case_id: str
    user_id: str
    version_number: int
    is_deep_dive: bool = True
    
    # All standard version fields
    request_payload: Dict[str, Any]
    analysis_response: Dict[str, Any]
    
    # Premium metrics
    deep_dive_metrics: DeepDiveMetrics
    
    # Visualization data
    visualization_data: Dict[str, Any] = {}
    
    # Quick access
    cookedness_score: int = 0
    verdict: str = "Unknown"
    deterministic_score: int = 0
    test_case_count: int = 0
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DeepDiveRequest(BaseModel):
    """Request for premium deep dive analysis"""
    user_id: str
    case_id: Optional[str] = None
    case_name: Optional[str] = None
    
    # Same inputs as regular analyze
    mode: str
    old_api: str
    new_api: str
    env: str
    body_template: str
    response_path: str
    goal: str
    old_prompt: str
    new_prompt: str
    n_cases: int = 10  # More test cases for deep dive
    manual_questions: List[str] = []
    
    # Deep dive specific
    include_adversarial: bool = True
    include_edge_cases: bool = True
    include_stress_tests: bool = True