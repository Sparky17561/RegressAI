from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

from app.config import get_db
from app.schemas import (
    User,
    Case,
    Version,
    VersionMetadata,
    CaseWithVersions
)

# ==========================================================
# USER OPERATIONS
# ==========================================================

def get_or_create_user(
    user_id: str,
    email: str,
    display_name: Optional[str] = None
) -> User:
    """
    Fetch an existing user or create a new one.
    """
    db = get_db()
    existing = db.users.find_one({"user_id": user_id})

    now = datetime.utcnow()

    if existing:
        db.users.update_one(
            {"user_id": user_id},
            {"$set": {"last_login": now}}
        )
        return User(**existing)

    user = User(
        user_id=user_id,
        email=email,
        display_name=display_name,
        created_at=now,
        updated_at=now,
    )

    db.users.insert_one(user.model_dump())
    return user


def update_user_api_key(user_id: str, api_key: str) -> Optional[User]:
    """
    Update user's Gemini API key.
    """
    db = get_db()
    result = db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "gemini_api_key": api_key,
            "updated_at": datetime.utcnow()
        }}
    )
    if result.modified_count:
        return get_user(user_id)
    return None


def get_user(user_id: str) -> Optional[User]:
    """
    Fetch a user by ID.
    """
    db = get_db()
    doc = db.users.find_one({"user_id": user_id})
    return User(**doc) if doc else None


def get_user_stats(user_id: str) -> Dict[str, Any]:
    """
    Aggregate user statistics.
    """
    db = get_db()
    return {
        "total_cases": db.cases.count_documents({"user_id": user_id}),
        "total_versions": db.versions.count_documents({"user_id": user_id}),
    }

# ==========================================================
# CASE OPERATIONS
# ==========================================================

def create_case(
    user_id: str,
    name: str,
    description: Optional[str] = None
) -> Case:
    """
    Create a new analysis case.
    """
    db = get_db()

    case = Case(
        case_id=f"case_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        name=name,
        description=description,
    )

    db.cases.insert_one(case.model_dump())
    return case


def get_case(case_id: str, user_id: str) -> Optional[Case]:
    """
    Fetch case by ID with ownership check.
    """
    db = get_db()
    doc = db.cases.find_one({"case_id": case_id, "user_id": user_id})
    return Case(**doc) if doc else None


def list_cases(user_id: str) -> List[Case]:
    """
    List all cases for a user.
    """
    db = get_db()
    docs = db.cases.find({"user_id": user_id}).sort("updated_at", -1)
    return [Case(**doc) for doc in docs]


def update_case(
    case_id: str,
    user_id: str,
    name: Optional[str] = None,
    description: Optional[str] = None
) -> Optional[Case]:
    """
    Update case metadata.
    """
    db = get_db()

    update_fields = {"updated_at": datetime.utcnow()}
    if name:
        update_fields["name"] = name
    if description is not None:
        update_fields["description"] = description

    doc = db.cases.find_one_and_update(
        {"case_id": case_id, "user_id": user_id},
        {"$set": update_fields},
        return_document=True
    )

    return Case(**doc) if doc else None


def delete_case(case_id: str, user_id: str) -> bool:
    """
    Delete case and all its versions.
    """
    db = get_db()
    db.versions.delete_many({"case_id": case_id, "user_id": user_id})
    result = db.cases.delete_one({"case_id": case_id, "user_id": user_id})
    return result.deleted_count > 0

# ==========================================================
# VERSION OPERATIONS
# ==========================================================

def create_version(
    case_id: str,
    user_id: str,
    request_payload: Dict[str, Any],
    analysis_response: Dict[str, Any]
) -> Version:
    """
    Create an immutable version snapshot.
    """
    db = get_db()

    case = get_case(case_id, user_id)
    if not case:
        raise ValueError("Case not found")

    next_version = case.version_count + 1

    cookedness_score = analysis_response.get("cookedness", {}).get("cookedness_score", 0)
    verdict = analysis_response.get("analysis", {}).get("verdict", "Unknown")
    deterministic_score = analysis_response.get("deterministic", {}).get("deterministic_score", 0)
    test_case_count = len(analysis_response.get("test_cases", []))

    # Extended analytics (safe optional fields)
    behavioral_shift = analysis_response.get("behavioral_shift", {})
    tradeoff = analysis_response.get("tradeoff", {})
    error_novelty = analysis_response.get("error_novelty", {})

    version = Version(
        version_id=f"ver_{uuid.uuid4().hex[:12]}",
        case_id=case_id,
        user_id=user_id,
        version_number=next_version,
        request_payload=request_payload,
        analysis_response=analysis_response,
        cookedness_score=cookedness_score,
        verdict=verdict,
        deterministic_score=deterministic_score,
        test_case_count=test_case_count,
        behavioral_shift=behavioral_shift,
        tradeoff=tradeoff,
        error_novelty=error_novelty,
    )

    db.versions.insert_one(version.model_dump())

    db.cases.update_one(
        {"case_id": case_id},
        {"$set": {
            "updated_at": datetime.utcnow(),
            "version_count": next_version,
            "latest_version": next_version
        }}
    )

    return version


def get_version(version_id: str, user_id: str) -> Optional[Version]:
    """
    Fetch a full version snapshot.
    """
    db = get_db()
    doc = db.versions.find_one({"version_id": version_id, "user_id": user_id})
    return Version(**doc) if doc else None


def list_versions(case_id: str, user_id: str) -> List[VersionMetadata]:
    """
    List all versions for a case with metadata only.
    """
    db = get_db()

    docs = db.versions.find(
        {"case_id": case_id, "user_id": user_id},
        {
            "_id": 0,
            "version_id": 1,
            "case_id": 1,  # ✅ Include in projection
            "version_number": 1,
            "cookedness_score": 1,
            "verdict": 1,
            "created_at": 1
        }
    ).sort("version_number", -1)

    return [VersionMetadata(**doc) for doc in docs]



def get_case_with_versions(case_id: str, user_id: str) -> Optional[CaseWithVersions]:
    """
    Fetch case with version metadata.
    """
    case = get_case(case_id, user_id)
    if not case:
        return None

    versions = list_versions(case_id, user_id)

    return CaseWithVersions(
        case_id=case.case_id,
        user_id=case.user_id,
        name=case.name,
        description=case.description,
        version_count=case.version_count,
        created_at=case.created_at,
        updated_at=case.updated_at,
        versions=versions,
    )

# ==========================================================
# ANALYTICS HELPERS (NEW)
# ==========================================================

def get_latest_version(case_id: str, user_id: str) -> Optional[Version]:
    """
    Fetch most recent version.
    """
    db = get_db()
    doc = db.versions.find_one(
        {"case_id": case_id, "user_id": user_id},
        sort=[("version_number", -1)]
    )
    return Version(**doc) if doc else None


def get_cookedness_trend(case_id: str, user_id: str) -> List[int]:
    """
    Return cookedness trend over versions.
    """
    db = get_db()
    docs = db.versions.find(
        {"case_id": case_id, "user_id": user_id},
        {"cookedness_score": 1}
    ).sort("version_number", 1)

    return [d.get("cookedness_score", 0) for d in docs]


def get_regression_history(case_id: str, user_id: str) -> List[Dict[str, Any]]:
    """
    Track regression vs improvement across versions.
    """
    db = get_db()
    docs = db.versions.find(
        {"case_id": case_id, "user_id": user_id},
        {
            "version_number": 1,
            "verdict": 1,
            "error_novelty": 1
        }
    ).sort("version_number", 1)

    history = []
    for d in docs:
        history.append({
            "version": d.get("version_number"),
            "verdict": d.get("verdict"),
            "introduced_errors": d.get("error_novelty", {}).get("introduced_errors", [])
        })
    return history


def get_helpfulness_safety_tradeoff(case_id: str, user_id: str) -> List[Dict[str, Any]]:
    """
    Track safety vs helpfulness over time.
    """
    db = get_db()
    docs = db.versions.find(
        {"case_id": case_id, "user_id": user_id},
        {
            "version_number": 1,
            "tradeoff": 1,
            "cookedness_score": 1
        }
    ).sort("version_number", 1)

    return [
        {
            "version": d.get("version_number"),
            "net_effect": d.get("tradeoff", {}).get("net_effect"),
            "cookedness": d.get("cookedness_score")
        }
        for d in docs
    ]
