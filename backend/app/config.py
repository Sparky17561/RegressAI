import os
from pymongo import MongoClient
from typing import Optional
from dotenv import load_dotenv

# ============================================
# LOAD ENVIRONMENT VARIABLES
# ============================================

# Load from .env if present
load_dotenv()

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
# REGRESSAI / GROQ CONFIGURATION
# ============================================

# 🔐 RegressAI-owned Groq API key (PREMIUM USERS ONLY)
REGRESSAI_GROQ_KEY = os.getenv("REGRESSAI_GROQ_KEY")

if not REGRESSAI_GROQ_KEY:
    print("⚠️  REGRESSAI_GROQ_KEY not set. Premium features will be disabled.")



OLD_GROQ_KEY_ENV = os.getenv("OLD_GROQ_KEY")
NEW_GROQ_KEY_ENV = os.getenv("NEW_GROQ_KEY")

if not OLD_GROQ_KEY_ENV or not NEW_GROQ_KEY_ENV:
    raise RuntimeError("Groq API keys missing in .env")
# ============================================
# OPTIONAL: FIREBASE ADMIN (BACKEND AUTH)
# ============================================

# Uncomment if you want backend verification of Firebase tokens
#
# import firebase_admin
# from firebase_admin import credentials, auth
#
# cred = credentials.Certificate("path/to/serviceAccountKey.json")
# firebase_admin.initialize_app(cred)

# NOTE:
# For now, backend trusts `user_id` coming from frontend Firebase Auth.
# In production, verify Firebase ID tokens here.
