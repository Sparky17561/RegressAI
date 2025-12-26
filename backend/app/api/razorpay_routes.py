import os
import hmac
import hashlib
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import razorpay
from app.config import get_db

# ============================================================
# CONFIG
# ============================================================

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")

if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
    raise RuntimeError("Razorpay keys not set")

client = razorpay.Client(
    auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)
)

router = APIRouter(prefix="/api/payments")

db = get_db()
users = db.users
payments = db.payments

PLAN_AMOUNT = 39900  # ₹399 in paise
CURRENCY = "INR"


# ============================================================
# MODELS
# ============================================================

class CreateOrderRequest(BaseModel):
    user_id: str


class VerifyPaymentRequest(BaseModel):
    user_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


# ============================================================
# CREATE ORDER
# ============================================================

@router.post("/create-order")
def create_order(req: CreateOrderRequest):
    try:
        order = client.order.create({
            "amount": PLAN_AMOUNT,
            "currency": CURRENCY,
            "payment_capture": 1
        })

        payments.insert_one({
            "user_id": req.user_id,
            "order_id": order["id"],
            "status": "created"
        })

        return {
            "order_id": order["id"],
            "key_id": RAZORPAY_KEY_ID,
            "amount": PLAN_AMOUNT,
            "currency": CURRENCY
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# VERIFY PAYMENT
# ============================================================

@router.post("/verify")
def verify_payment(req: VerifyPaymentRequest):
    body = f"{req.razorpay_order_id}|{req.razorpay_payment_id}"

    expected_signature = hmac.new(
        RAZORPAY_KEY_SECRET.encode(),
        body.encode(),
        hashlib.sha256
    ).hexdigest()

    if expected_signature != req.razorpay_signature:
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    # Mark payment successful
    payments.update_one(
        {"order_id": req.razorpay_order_id},
        {"$set": {"status": "paid", "payment_id": req.razorpay_payment_id}}
    )

    # Upgrade user
    users.update_one(
        {"user_id": req.user_id},
        {"$set": {
            "subscription_tier": "pro",
            "is_premium": True,
            "deep_dives_remaining": 5
        }},
        upsert=True
    )

    return {
        "success": True,
        "subscription_tier": "pro",
        "deep_dives_remaining": 5
    }
