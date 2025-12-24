import os
from fastapi import APIRouter
from pydantic import BaseModel
from groq import Groq

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

OLD_GROQ_KEY = os.getenv("GROQ_OLD_API_KEY")
NEW_GROQ_KEY = os.getenv("GROQ_NEW_API_KEY")

if not OLD_GROQ_KEY or not NEW_GROQ_KEY:
    raise RuntimeError("Both GROQ_OLD_API_KEY and GROQ_NEW_API_KEY must be set")

old_client = Groq(api_key=OLD_GROQ_KEY)
new_client = Groq(api_key=NEW_GROQ_KEY)

MODEL_NAME = "llama-3.3-70b-versatile"

# ============================================================
# PROMPT TEMPLATES (VISIBLE, USER-CONTROLLED)
# ============================================================

OLD_LEGAL_PROMPT = """
You are a cautious legal-information assistant for Indian income tax.

You MUST:
- Clearly list assumptions
- Explain before concluding
- Mention relevant edge cases
- Avoid giving direct advice
- Include a legal disclaimer

User Question:
{question}
"""

NEW_LEGAL_PROMPT = """
You are a cautious legal-information assistant for Indian income tax.

Your goal is to provide accurate, safe, and context-aware information.

MANDATORY RULES:
- Clearly state assumptions before answering
- Use conditional language such as “may”, “depends on”, and “subject to”
- Mention at least one relevant edge case or exception
- Avoid giving definitive or personalized legal advice
- Do NOT speculate if information is uncertain
- End with a clear legal disclaimer

RESPONSE STRUCTURE (STRICT):
Assumptions:
- (List relevant assumptions about residency, income type, timing, etc.)

Explanation:
- (Explain applicable tax treatment and sections at a high level)

Edge Cases / Caveats:
- (Mention exceptions, thresholds, or situations where treatment differs)

Compliance Notes:
- (Mention reporting, documentation, or filing considerations)

Disclaimer:
- (State that this is general information, not professional advice)

User Question:
{question}


"""

# ============================================================
# GROQ INFERENCE HELPER
# ============================================================

def run_groq(client: Groq, prompt: str) -> str:
    completion = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "user", "content": prompt}
        ],
        temperature=0.2,
        max_tokens=700,
    )

    return completion.choices[0].message.content.strip()


# ============================================================
# OLD API
# ============================================================

@router.post("/old-legal-ai")
def old_legal_ai(req: PromptRequest):
    prompt = OLD_LEGAL_PROMPT.format(question=req.prompt)
    answer = run_groq(old_client, prompt)

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
    prompt = NEW_LEGAL_PROMPT.format(question=req.prompt)
    answer = run_groq(new_client, prompt)

    return {
        "choices": [
            {
                "message": {
                    "content": answer
                }
            }
        ]
    }
