import os
from pymongo import MongoClient
from typing import Optional

# ============================================
# MONGODB CONNECTION
# ============================================

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "regressai")

class MongoDB:
    """Singleton MongoDB client"""
    _client: Optional[MongoClient] = None
    _db = None
    
    @classmethod
    def get_client(cls):
        if cls._client is None:
            cls._client = MongoClient(MONGO_URI)
            cls._db = cls._client[MONGO_DB_NAME]
            print(f"✅ MongoDB connected: {MONGO_DB_NAME}")
        return cls._client
    
    @classmethod
    def get_db(cls):
        if cls._db is None:
            cls.get_client()
        return cls._db
    
    @classmethod
    def close(cls):
        if cls._client:
            cls._client.close()
            cls._client = None
            cls._db = None
            print("🔌 MongoDB disconnected")

# Helper to get database instance
def get_db():
    return MongoDB.get_db()

# ============================================
# FIREBASE ADMIN (for backend auth verification)
# ============================================

# If you want to verify Firebase tokens on backend:
# import firebase_admin
# from firebase_admin import credentials, auth
# 
# cred = credentials.Certificate("path/to/serviceAccountKey.json")
# firebase_admin.initialize_app(cred)

# For now, we'll trust the frontend sends user_id from Firebase Auth
# In production, you'd verify the ID token on backend