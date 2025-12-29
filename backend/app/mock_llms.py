import os
from fastapi import APIRouter
from pydantic import BaseModel
from groq import Groq
from app.config import OLD_GROQ_KEY_ENV, NEW_GROQ_KEY_ENV

# ============================================================
# ROUTER
# ============================================================

router = APIRouter(prefix="/mock")

# ============================================================
# REQUEST MODEL
# ============================================================

class PromptRequest(BaseModel):
    prompt: str  # USER QUESTION ONLY


# ============================================================
# GROQ CLIENTS (TWO KEYS)
# ============================================================

OLD_GROQ_KEY = OLD_GROQ_KEY_ENV
NEW_GROQ_KEY = NEW_GROQ_KEY_ENV

if not OLD_GROQ_KEY or not NEW_GROQ_KEY:
    raise RuntimeError("Both GROQ_OLD_API_KEY and GROQ_NEW_API_KEY must be set")

old_client = Groq(api_key=OLD_GROQ_KEY)
new_client = Groq(api_key=NEW_GROQ_KEY)

MODEL_NAME = "llama-3.3-70b-versatile"

# ============================================================
# SYSTEM PROMPTS (SEPARATED FROM USER QUESTIONS)
# ============================================================

OLD_LEGAL_SYSTEM = """You are a cautious legal-information assistant for Indian income tax.

You MUST:
- Clearly list assumptions
- Explain before concluding
- Mention relevant edge cases
- Avoid giving direct advice
- Include a legal disclaimer

Provide helpful, accurate information while being appropriately cautious about legal matters."""

NEW_LEGAL_SYSTEM = """You are an Indian income tax information assistant providing general guidance only.
You are NOT a legal advisor or tax consultant.

Core Principles:
- State key assumptions clearly before answering
- Use conditional language ("generally", "may", "depends on", "subject to")
- Mention relevant exceptions or edge cases when applicable
- Never invent specific rules, rates, section numbers, or time periods unless you are confident
- If uncertain about any detail, explicitly acknowledge it

Response Structure (follow this format):

Assumptions:
- List only what is strictly necessary to understand the context

High-Level Explanation:
- Provide conceptual explanation of the tax treatment
- Focus on principles rather than absolute specifics

What Depends on Facts:
- Note the key variables that would change the answer
- Mention any thresholds or conditions that matter

Important Considerations:
- Highlight 1-2 common misunderstandings if relevant
- Note any edge cases or exceptions

Next Steps:
- Suggest what the user should do (typically: consult a tax professional for personalized advice)

Disclaimer:
- One brief line noting this is general information, not professional advice

Remember: If you're uncertain about a specific rule, rate, or timeframe, say so explicitly. Clarity and accuracy matter more than completeness."""

# ============================================================
# GROQ INFERENCE HELPER (FIXED)
# ============================================================

def run_groq(client: Groq, system_prompt: str, user_question: str) -> str:
    """
    Properly structured API call with system/user message separation.
    
    Args:
        client: Groq client instance
        system_prompt: Instructions on how the assistant should behave
        user_question: The actual user's question
    
    Returns:
        The model's response as a string
    """
    completion = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_question}
        ],
        temperature=0.5,  # Higher for natural variation in responses
        max_tokens=2000,  # Sufficient for detailed legal explanations
    )
    
    return completion.choices[0].message.content.strip()


# ============================================================
# OLD API
# ============================================================

@router.post("/old-legal-ai")
def old_legal_ai(req: PromptRequest):
    """
    Old legal AI endpoint using the original prompt style.
    """
    answer = run_groq(
        client=old_client,
        system_prompt=OLD_LEGAL_SYSTEM,
        user_question=req.prompt
    )
    
    return {
        "choices": [
            {
                "message": {
                    "content": answer
                }
            }
        ]
    }


# ============================================================
# NEW API
# ============================================================

@router.post("/new-legal-ai")
def new_legal_ai(req: PromptRequest):
    """
    New legal AI endpoint using the improved prompt style.
    """
    answer = run_groq(
        client=new_client,
        system_prompt=NEW_LEGAL_SYSTEM,
        user_question=req.prompt
    )
    
    return {
        "choices": [
            {
                "message": {
                    "content": answer
                }
            }
        ]
    }


# ============================================================
# DIAGNOSTIC ENDPOINT (FOR TESTING)
# ============================================================

@router.get("/test-apis")
def test_apis():
    """
    Quick sanity check to verify both APIs are responding properly.
    Visit: http://localhost:8000/mock/test-apis
    """
    test_question = "What is the basic income tax rate for individuals in India?"
    
    try:
        old_response = run_groq(old_client, OLD_LEGAL_SYSTEM, test_question)
        new_response = run_groq(new_client, NEW_LEGAL_SYSTEM, test_question)
        
        return {
            "status": "success",
            "test_question": test_question,
            "old_api": {
                "response": old_response,
                "length": len(old_response),
                "responding": len(old_response) > 100
            },
            "new_api": {
                "response": new_response,
                "length": len(new_response),
                "responding": len(new_response) > 100
            },
            "both_working": len(old_response) > 100 and len(new_response) > 100
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }