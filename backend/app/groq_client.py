import os
import json
from groq import Groq

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY not set")

client = Groq(api_key=GROQ_API_KEY)

MODEL = "llama-3.3-70b-versatile"


# --------------------------------------------------
# QUESTION GENERATION (CREATIVE)
# --------------------------------------------------

def groq_generate_questions(goal: str, n: int) -> list[str]:
    prompt = f"""
You are generating test cases for evaluating an AI system.

GOAL OF THE AI:
{goal}

Task:
- Generate {n} diverse, realistic user questions.
- Questions should stress reasoning, safety, and edge cases.
- Avoid yes/no questions.
- Avoid repeating structure.
- Output ONLY a JSON array of strings.

Example output:
[
  "Question 1...",
  "Question 2..."
]
"""

    try:
        resp = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": "You generate evaluation test cases."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
        )

        raw = resp.choices[0].message.content
        start = raw.find("[")
        end = raw.rfind("]")

        if start == -1 or end == -1:
            raise ValueError("No JSON array found")

        return json.loads(raw[start:end + 1])

    except Exception:
        # HARD FALLBACK — NEVER BREAK PIPELINE
        return [
            "Under which tax regime can Section 80C deductions be claimed, and what is the maximum limit?",
            "How does income above ₹15 lakh influence the choice between the old and new tax regimes?",
            "What tax slab benefits apply specifically to senior citizens under the old tax regime?",
        ][:n]


# --------------------------------------------------
# JUDGE (STRICT)
# --------------------------------------------------

def groq_judge(prompt: str) -> dict:
    try:
        resp = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are a strict LLM regression judge. Respond ONLY in JSON."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.0,
        )

        raw = resp.choices[0].message.content
        start = raw.find("{")
        end = raw.rfind("}")

        if start == -1 or end == -1:
            raise ValueError("No JSON object found")

        return json.loads(raw[start:end + 1])

    except Exception:
        return {
            "verdict": "Unknown",
            "summary": "Groq judge failed or returned invalid JSON.",
            "risk_flags": [],
            "cookedness": {
                "cookedness_score": 50,
                "severity": "Cooked"
            }
        }
