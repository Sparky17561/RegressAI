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
# INTERNAL UTILITIES
# ==========================================================

def clean_doc(doc: Optional[Dict]) -> Optional[Dict]:
    """
    Removes the MongoDB internal _id (ObjectId) which is not 
    JSON serializable by FastAPI's default encoder.
    """
    if doc and "_id" in doc:
        del doc["_id"]
    return doc

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
        return User(**clean_doc(existing))

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
            "api_key": api_key,
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
    return User(**clean_doc(doc)) if doc else None


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
    return Case(**clean_doc(doc)) if doc else None

def get_case_for_user(case_id: str, user_id: str) -> Optional[Case]:
    db = get_db()

    # 1️⃣ Owner access
    doc = db.cases.find_one({"case_id": case_id, "user_id": user_id})
    if doc:
        return Case(**clean_doc(doc))

    # 2️⃣ Team member access
    is_member = db.team_members.find_one({
        "case_id": case_id,
        "user_id": user_id
    })

    if is_member:
        doc = db.cases.find_one({"case_id": case_id})
        if doc:
            return Case(**clean_doc(doc))

    return None


def list_cases(user_id: str) -> List[Case]:
    """
    List all cases a user owns OR is a collaborator on.
    """
    db = get_db()

    # 1️⃣ Own cases
    owned = list(
        db.cases.find({"user_id": user_id})
    )

    # 2️⃣ Case IDs where user is a collaborator
    team_case_ids = db.team_members.distinct(
        "case_id",
        {"user_id": user_id}
    )

    collaborated = []
    if team_case_ids:
        collaborated = list(
            db.cases.find({"case_id": {"$in": team_case_ids}})
        )

    # 3️⃣ Merge + dedupe
    seen = set()
    all_cases = []

    for doc in owned + collaborated:
        cid = doc.get("case_id")
        if cid not in seen:
            seen.add(cid)
            all_cases.append(doc)

    # 4️⃣ Sort by updated_at DESC
    all_cases.sort(
        key=lambda d: d.get("updated_at"),
        reverse=True
    )

    return [Case(**clean_doc(doc)) for doc in all_cases]

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

    return Case(**clean_doc(doc)) if doc else None


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

# In db_service.py - Update create_version function
def create_version(
    case_id: str,
    user_id: str,
    request_payload: Dict[str, Any],
    analysis_response: Dict[str, Any]
) -> Version:
    """
    Create an immutable version snapshot.
    FIXED:
    - Correct deterministic flag extraction
    - Correct root cause extraction from cookedness
    - Safe defaults (no silent nulls)
    - Compatible with unified + deep dive analysis
    """
    db = get_db()

    case = get_case_for_user(case_id, user_id)
    if not case:
        raise ValueError("Case not found")

    next_version = case.version_count + 1

    # -------------------------------
    # Canonical extraction
    # -------------------------------
    evaluation = analysis_response.get("evaluation", {})
    scores = analysis_response.get("scores", {})
    verdict_obj = analysis_response.get("verdict", {})

    cookedness_obj = scores.get("cookedness", {})

    cookedness_score = cookedness_obj.get("cookedness_score", 0)
    deterministic_score = scores.get("deterministic_score", 0)
    verdict = verdict_obj.get("final", "Unknown")
    test_case_count = len(analysis_response.get("test_cases", []))

    # -------------------------------
    # Root cause extraction (FIXED)
    # -------------------------------
    root_causes: List[str] = []

    # Primary root cause comes from cookedness now
    primary_root = cookedness_obj.get("primary_root_cause")
    if primary_root:
        root_causes.append(primary_root)

    # Deterministic flags (FIXED KEY)
    deterministic_flags = (
        evaluation
        .get("deterministic", {})
        .get("deterministic_flags", [])
    )

    # Add up to 3 deterministic flags as secondary causes
    for flag in deterministic_flags[:3]:
        if flag not in root_causes:
            root_causes.append(flag)

    # -------------------------------
    # Build Version object
    # -------------------------------
    version = Version(
        version_id=f"ver_{uuid.uuid4().hex[:12]}",
        case_id=case_id,
        user_id=user_id,
        version_number=next_version,

        request_payload=request_payload,
        analysis_response=analysis_response,  # FULL canonical payload

        cookedness_score=cookedness_score,
        verdict=verdict,
        deterministic_score=deterministic_score,
        test_case_count=test_case_count,
        root_causes=root_causes
    )

    # -------------------------------
    # Persist
    # -------------------------------
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
    return Version(**clean_doc(doc)) if doc else None

def get_version_for_user(version_id: str, user_id: str) -> Optional[Version]:
    db = get_db()

    # 1️⃣ Owner access
    doc = db.versions.find_one({
        "version_id": version_id,
        "user_id": user_id
    })
    if doc:
        return Version(**clean_doc(doc))

    # 2️⃣ Team member access
    version_doc = db.versions.find_one({"version_id": version_id})
    if not version_doc:
        return None

    case_id = version_doc["case_id"]

    is_member = db.team_members.find_one({
        "case_id": case_id,
        "user_id": user_id
    })

    if is_member:
        return Version(**clean_doc(version_doc))

    return None


# In db_service.py - Update list_versions function
# In db_service.py - Replace the list_versions function with this:

def list_versions(case_id: str, user_id: str) -> List[VersionMetadata]:
    """
    List all versions for a case.
    🔥 FIXED: Now properly extracts is_deep_dive from analysis_response
    """
    db = get_db()

    # 1️⃣ Check if user is owner
    case = db.cases.find_one({"case_id": case_id, "user_id": user_id})

    if case:
        # Owner → fetch normally
        query = {"case_id": case_id}
    else:
        # 2️⃣ Check team membership
        is_member = db.team_members.find_one({
            "case_id": case_id,
            "user_id": user_id
        })

        if not is_member:
            return []  # 🚫 no access

        # 3️⃣ Collaborator → fetch ALL versions of case
        query = {"case_id": case_id}

    # 🔥 FIX: Fetch full analysis_response to check is_deep_dive
    docs = db.versions.find(
        query,
        {
            "_id": 0,
            "version_id": 1,
            "case_id": 1,
            "version_number": 1,
            "cookedness_score": 1,
            "verdict": 1,
            "created_at": 1,
            "analysis_response": 1  # 🔥 FETCH FULL OBJECT
        }
    ).sort("version_number", -1)

    result = []
    for doc in docs:
        # 🔥 CRITICAL FIX: Check is_deep_dive in analysis_response
        analysis_response = doc.get("analysis_response", {})
        is_deep_dive = analysis_response.get("is_deep_dive", False)
        
        # Also check if deep_dive_metrics exist (backup check)
        if not is_deep_dive and "deep_dive_metrics" in analysis_response:
            is_deep_dive = True
        
        # Also check if visualization_data exists (backup check)
        if not is_deep_dive and "visualization_data" in analysis_response:
            is_deep_dive = True
        
        version_meta = {
            "version_id": doc["version_id"],
            "case_id": doc["case_id"],
            "version_number": doc["version_number"],
            "cookedness_score": doc["cookedness_score"],
            "verdict": doc["verdict"],
            "created_at": doc["created_at"],
            "is_deep_dive": is_deep_dive  # 🔥 NOW PROPERLY SET
        }
        
        result.append(VersionMetadata(**version_meta))
    
    print(f"[DB] Returning {len(result)} versions, {sum(1 for v in result if v.is_deep_dive)} are deep dives")
    return result


# Also add this helper function to verify deep dive data integrity:

def verify_deep_dive_data(version_id: str) -> Dict[str, Any]:
    """Debug helper to check what data exists for a version"""
    db = get_db()
    doc = db.versions.find_one({"version_id": version_id})
    
    if not doc:
        return {"error": "Version not found"}
    
    analysis_response = doc.get("analysis_response", {})
    
    return {
        "version_id": version_id,
        "has_is_deep_dive_flag": "is_deep_dive" in analysis_response,
        "is_deep_dive_value": analysis_response.get("is_deep_dive", False),
        "has_deep_dive_metrics": "deep_dive_metrics" in analysis_response,
        "has_visualization_data": "visualization_data" in analysis_response,
        "deep_dive_metrics_keys": list(analysis_response.get("deep_dive_metrics", {}).keys()),
        "visualization_data_keys": list(analysis_response.get("visualization_data", {}).keys())
    }


def get_case_with_versions(case_id: str, user_id: str) -> Optional[CaseWithVersions]:
    """
    Fetch case with version metadata.
    """
    case = get_case_for_user(case_id, user_id)
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
# ANALYTICS HELPERS
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
    return Version(**clean_doc(doc)) if doc else None


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


# ==========================================================
# COLLABORATION: TEAM MEMBERS
# ==========================================================

def add_team_member(case_id, user_id, email, display_name, role, added_by):
    db = get_db()
    member = {
        "member_id": f"mem_{uuid.uuid4().hex[:10]}",
        "case_id": case_id,
        "user_id": user_id,
        "email": email,
        "display_name": display_name,
        "role": role,
        "added_by": added_by,
        "added_at": datetime.utcnow()
    }
    db.team_members.insert_one(member)
    return clean_doc(member)


def get_case_members(case_id):
    db = get_db()
    
    # Get the case to find the owner
    case = db.cases.find_one({"case_id": case_id})
    if not case:
        return []
    
    owner_id = case["user_id"]
    
    # Get owner details
    owner = db.users.find_one({"user_id": owner_id})
    
    # Build owner member object
    members = []
    if owner:
        members.append({
            "member_id": f"owner_{owner_id}",
            "case_id": case_id,
            "user_id": owner_id,
            "email": owner.get("email", ""),
            "display_name": owner.get("display_name"),
            "role": "OWNER",
            "added_by": owner_id,
            "added_at": case["created_at"],
            "is_owner": True  # Flag to identify owner
        })
    
    # Get collaborators from team_members
    collaborators = db.team_members.find({"case_id": case_id})
    for member in collaborators:
        member_data = clean_doc(member)
        member_data["is_owner"] = False
        members.append(member_data)
    
    return members


def remove_team_member(case_id, member_id):
    db = get_db()
    res = db.team_members.delete_one({
        "case_id": case_id,
        "member_id": member_id
    })
    return res.deleted_count > 0


def update_member_role(case_id, member_id, new_role):
    db = get_db()
    doc = db.team_members.find_one_and_update(
        {"case_id": case_id, "member_id": member_id},
        {"$set": {"role": new_role}},
        return_document=True
    )
    return clean_doc(doc)


def is_user_member(case_id, user_id):
    db = get_db()
    return db.team_members.find_one({
        "case_id": case_id,
        "user_id": user_id
    }) is not None


def get_user_role(case_id, user_id):
    db = get_db()
    m = db.team_members.find_one({
        "case_id": case_id,
        "user_id": user_id
    })
    return m["role"] if m else None


# ==========================================================
# COLLABORATION: INVITATIONS
# ==========================================================

def create_invitation(**data):
    db = get_db()
    invitation = {
        "invitation_id": f"inv_{uuid.uuid4().hex[:10]}",
        "status": "PENDING",
        "created_at": datetime.utcnow(),
        **data
    }
    db.invitations.insert_one(invitation)
    return clean_doc(invitation)


def get_invitation(invitation_id):
    db = get_db()
    return clean_doc(db.invitations.find_one({"invitation_id": invitation_id}))


def get_user_invitations(email, status):
    db = get_db()
    return [clean_doc(i) for i in db.invitations.find({
        "invited_email": email,
        "status": status
    })]


def update_invitation_status(invitation_id, status):
    db = get_db()
    db.invitations.update_one(
        {"invitation_id": invitation_id},
        {"$set": {"status": status}}
    )


def cancel_invitation(invitation_id):
    db = get_db()
    res = db.invitations.delete_one({"invitation_id": invitation_id})
    return res.deleted_count > 0


# ==========================================================
# COLLABORATION: COMMENTS
# ==========================================================

def create_comment(version_id, case_id, user_id, user_email, user_name, text):
    db = get_db()
    comment = {
        "comment_id": f"cmt_{uuid.uuid4().hex[:10]}",
        "version_id": version_id,
        "case_id": case_id,
        "user_id": user_id,
        "user_email": user_email,
        "user_name": user_name,
        "text": text,
        "created_at": datetime.utcnow()
    }
    db.comments.insert_one(comment)
    return clean_doc(comment)


def get_version_comments(version_id):
    db = get_db()
    return [clean_doc(c) for c in db.comments.find({"version_id": version_id})]


def get_case_comments(case_id):
    db = get_db()
    return [clean_doc(c) for c in db.comments.find({"case_id": case_id})]


def update_comment(comment_id, text):
    db = get_db()
    doc = db.comments.find_one_and_update(
        {"comment_id": comment_id},
        {"$set": {"text": text}},
        return_document=True
    )
    return clean_doc(doc)


def delete_comment(comment_id, user_id):
    db = get_db()
    res = db.comments.delete_one({
        "comment_id": comment_id,
        "user_id": user_id
    })
    return res.deleted_count > 0


# ==========================================================
# COLLABORATION: NOTIFICATIONS
# ==========================================================

def create_notification(user_id, type, title, message, link=None, metadata=None):
    db = get_db()
    notif = {
        "notification_id": f"ntf_{uuid.uuid4().hex[:10]}",
        "user_id": user_id,
        "type": type,
        "title": title,
        "message": message,
        "link": link,
        "metadata": metadata or {},
        "read": False,
        "created_at": datetime.utcnow()
    }
    db.notifications.insert_one(notif)
    return clean_doc(notif)


def get_user_notifications(user_id, unread_only=False):
    db = get_db()
    q = {"user_id": user_id}
    if unread_only:
        q["read"] = False
    return [clean_doc(n) for n in db.notifications.find(q).sort("created_at", -1)]


def mark_notification_read(notification_id, user_id):
    db = get_db()
    res = db.notifications.update_one(
        {"notification_id": notification_id, "user_id": user_id},
        {"$set": {"read": True}}
    )
    return res.modified_count > 0


def mark_all_notifications_read(user_id):
    db = get_db()
    res = db.notifications.update_many(
        {"user_id": user_id, "read": False},
        {"$set": {"read": True}}
    )
    return res.modified_count


def get_unread_count(user_id):
    db = get_db()
    return db.notifications.count_documents({
        "user_id": user_id,
        "read": False
    })

from datetime import datetime
from app.schemas import SubscriptionTier

def upgrade_user_to_pro(user_id: str):
    db = get_db()
    return db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "subscription_tier": "pro",  # ✅ Store as lowercase string
            "deep_dives_remaining": 20,
            "deep_dive_reset_date": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }}
    )

def decrement_deep_dive(user_id: str):
    db = get_db()
    return db.users.update_one(
        {"user_id": user_id, "deep_dives_remaining": {"$gt": 0}},
        {"$inc": {"deep_dives_remaining": -1}}
    )
