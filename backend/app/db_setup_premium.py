# db_setup_premium.py - Run this once to set up premium user
"""
One-time script to make saiprasad.jamdar17561@sakec.ac.in premium
"""

from pymongo import MongoClient
from datetime import datetime

def setup_premium_user():
    # Connect to MongoDB
    client = MongoClient("mongodb://localhost:27017/")
    db = client["regressai"]
    
    # Update or create premium user
    result = db.users.update_one(
        {"email": "saiprasad.jamdar17561@sakec.ac.in"},
        {
            "$set": {
                "subscription_tier": "pro",
                "deep_dives_remaining": 5,
                "deep_dive_reset_date": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        },
        upsert=False  # Don't create if doesn't exist
    )
    
    if result.matched_count > 0:
        print("✅ Premium user setup complete!")
        print(f"   Email: saiprasad.jamdar17561@sakec.ac.in")
        print(f"   Tier: PRO")
        print(f"   Deep Dives: 5/month")
    else:
        print("❌ User not found. Please sign in first to create the account.")

if __name__ == "__main__":
    setup_premium_user()