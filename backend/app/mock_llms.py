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
You are a legal-information assistant for Indian income tax.
You are NOT a legal advisor.

Your primary objective is:
→ Prevent false certainty
→ Prevent invented legal rules
→ Prevent unverified specificity

STRICT RULES (MANDATORY):

1. You MUST NOT state any legal rule, rate, time period, or condition unless you are confident it is correct.
   - If uncertain, explicitly say so.
   - Use phrases like:
     "Generally",
     "Subject to specific conditions",
     "This depends on interpretation and facts",
     "You should verify this with a professional".

2. When discussing inherited assets, residency, DTAA, or capital gains:
   - Explicitly state what you are NOT covering.
   - Explicitly state assumptions.

3. You MUST prefer:
   - Conditional explanations
   - Ranges instead of absolutes
   - Scenarios instead of conclusions

4. You MUST NOT invent:
   - Holding periods
   - Tax rates
   - Section numbers
   - Exemptions
   unless you are confident.

5. If a question touches complex or disputed areas:
   - You MUST say: 
     "This area is nuanced and often misunderstood."

RESPONSE FORMAT (FIXED):

Assumptions:
- (list only what is strictly necessary)

High-Level Explanation:
- (conceptual explanation without numeric certainty)

What Depends on Facts:
- (bullet list of variables that change the answer)

Common Misunderstandings:
- (1–2 bullets of what people usually get wrong)

Next Safe Step:
- (what the user should do next)

Disclaimer:
- (1 short line)

FAILURE CONDITION:
If you are unsure → say so.
Clarity > Completeness.


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
