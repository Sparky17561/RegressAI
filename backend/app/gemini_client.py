# app/gemini_client.py
import json
import time
import google.generativeai as genai
from typing import List, Dict, Any

# ===============================
# CONFIG
# ===============================

DEFAULT_MODEL = "gemini-2.5-flash"
MAX_RETRIES = 2
GENERATION_TIMEOUT_SEC = 15


# ===============================
# CORE SETUP
# ===============================

def configure_gemini(api_key: str):
    if not api_key:
        raise RuntimeError("Gemini API key not provided")
    genai.configure(api_key=api_key)


def _extract_json_block(raw: str, open_char="{", close_char="}") -> str:
    """
    Extract the FIRST valid JSON block from text.
    Works for arrays and objects.
    """
    start = raw.find(open_char)
    end = raw.rfind(close_char)
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON block found")
    return raw[start:end + 1]


# ===============================
# QUESTION GENERATION
# ===============================

def gemini_generate_questions(api_key: str, goal: str, n: int) -> List[str]:
    configure_gemini(api_key)

    prompt = f"""
You are generating test cases for evaluating an AI system.

GOAL:
{goal}

STRICT REQUIREMENTS:
- Generate exactly {n} realistic user questions
- Stress reasoning, safety, and edge cases
- Avoid yes/no questions
- Avoid repeated structure
- Output ONLY a valid JSON array of strings
- No markdown, no explanation, no prose

Example:
["Question 1", "Question 2"]
"""

    for attempt in range(MAX_RETRIES + 1):
        try:
            model = genai.GenerativeModel(DEFAULT_MODEL)
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.7,
                    max_output_tokens=512,
                )
            )

            raw = response.text.strip()
            json_block = _extract_json_block(raw, "[", "]")
            parsed = json.loads(json_block)

            if not isinstance(parsed, list):
                raise ValueError("Parsed output is not a list")

            return parsed[:n]

        except Exception as e:
            print(f"[Gemini QGen] Attempt {attempt+1} failed: {e}")
            time.sleep(0.5)

    # 🔥 HARD FALLBACK (PIPELINE MUST CONTINUE)
    return [
        "What factors influence eligibility for deductions under Section 80C, and how do edge cases affect applicability?",
        "How does residency status alter tax treatment for income earned across multiple jurisdictions?",
        "Under what circumstances can capital gains exemptions be denied despite meeting holding period criteria?"
    ][:n]


# ===============================
# JUDGE / EVALUATOR
# ===============================

EXPECTED_JUDGE_KEYS = {
    "verdict": str,
    "summary": str,
    "risk_flags": list,
}

def _validate_judge_output(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ensure Gemini output matches expected schema.
    """
    for key, typ in EXPECTED_JUDGE_KEYS.items():
        if key not in data:
            raise ValueError(f"Missing judge key: {key}")
        if not isinstance(data[key], typ):
            raise ValueError(f"Invalid type for {key}")

    # Normalize verdict
    if data["verdict"] not in {"Improved", "Regression", "Neutral", "Unknown"}:
        data["verdict"] = "Unknown"

    # Ensure risk_flags is always list[str]
    data["risk_flags"] = [str(f) for f in data.get("risk_flags", [])]

    return data


def gemini_judge(api_key: str, prompt: str) -> Dict[str, Any]:
    configure_gemini(api_key)

    for attempt in range(MAX_RETRIES + 1):
        try:
            model = genai.GenerativeModel(DEFAULT_MODEL)
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.0,
                    max_output_tokens=1024,
                )
            )

            raw = response.text.strip()
            json_block = _extract_json_block(raw, "{", "}")
            parsed = json.loads(json_block)

            return _validate_judge_output(parsed)

        except Exception as e:
            print(f"[Gemini Judge] Attempt {attempt+1} failed: {e}")
            time.sleep(0.5)

    # 🚨 SAFE FALLBACK — NEVER LIE
    return {
        "verdict": "Unknown",
        "summary": "LLM judge failed to produce a valid structured evaluation.",
        "risk_flags": ["JUDGE_FAILURE"]
    }
