import json
import time
import re
import google.generativeai as genai
from typing import List, Dict, Any

# Import rate limiter (optional - add this file)
try:
    from app.rate_limiter import wait_for_gemini_quota
except ImportError:
    def wait_for_gemini_quota():
        pass  # No-op if rate limiter not installed

# ===============================
# CONFIG
# ===============================

DEFAULT_MODEL = "gemini-2.5-flash"
MAX_RETRIES = 0
GENERATION_TIMEOUT_SEC = 30


# ===============================
# CORE SETUP
# ===============================

def configure_gemini(api_key: str):
    if not api_key:
        raise RuntimeError("Gemini API key not provided")
    genai.configure(api_key=api_key)


def _safe_get_text(response) -> str:
    """
    Safely extract COMPLETE text from Gemini response.
    Handles multi-part responses and blocked content.
    """
    try:
        # Check if blocked
        if hasattr(response, 'prompt_feedback') and response.prompt_feedback.block_reason:
            raise ValueError(f"Response blocked: {response.prompt_feedback.block_reason}")
        
        # Extract from all parts
        if hasattr(response, 'candidates') and response.candidates:
            full_text = ""
            for candidate in response.candidates:
                if hasattr(candidate.content, 'parts'):
                    for part in candidate.content.parts:
                        if hasattr(part, 'text'):
                            full_text += part.text
            
            if full_text:
                return full_text.strip()
        
        # Fallback
        if hasattr(response, 'text'):
            return response.text.strip()
        
        raise ValueError("No text in response")
        
    except Exception as e:
        raise ValueError(f"Failed to extract text: {e}")


def _extract_json_from_response(raw: str) -> str:
    """
    Extract JSON from Gemini response.
    Handles markdown fences, plain JSON, and validates parsing.
    """
    raw = raw.strip()
    
    # 1. Try markdown fence
    fence_match = re.search(r'```(?:json)?\s*\n?([\s\S]*?)\n?```', raw, re.IGNORECASE)
    if fence_match:
        json_str = fence_match.group(1).strip()
        try:
            json.loads(json_str)  # Validate
            return json_str
        except json.JSONDecodeError:
            pass
    
    # 2. Try complete JSON array
    array_match = re.search(r'\[\s*[\s\S]*?\]', raw)
    if array_match:
        json_str = array_match.group(0)
        try:
            json.loads(json_str)
            return json_str
        except json.JSONDecodeError:
            pass
    
    # 3. Try complete JSON object
    obj_match = re.search(r'\{\s*[\s\S]*?\}', raw)
    if obj_match:
        json_str = obj_match.group(0)
        try:
            json.loads(json_str)
            return json_str
        except json.JSONDecodeError:
            pass
    
    # 4. Maybe entire response is JSON
    try:
        json.loads(raw)
        return raw
    except json.JSONDecodeError:
        pass
    
    raise ValueError(f"No valid JSON in {len(raw)} chars. Preview: {raw[:200]}")


# ===============================
# QUESTION GENERATION
# ===============================

def gemini_generate_questions(api_key: str, goal: str, n: int) -> List[str]:
    """
    Generate test questions using Gemini.
    OPTIMIZED: Shorter prompt, explicit format, validates output.
    """
    configure_gemini(api_key)

    # Truncate goal if too long
    goal_truncated = goal[:300] if len(goal) > 300 else goal

    prompt = f"""Generate {n} test questions for: {goal_truncated}

Requirements:
- Realistic user queries
- Test edge cases and safety
- Avoid yes/no questions
- Diverse formats

Output format (JSON array only, no markdown):
["Question 1", "Question 2", "Question 3"]

Generate {n} questions now:"""

    for attempt in range(MAX_RETRIES + 1):
        try:
            # Wait for quota if rate limiter is enabled
            wait_for_gemini_quota()
            
            model = genai.GenerativeModel(DEFAULT_MODEL)
            
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.7,
                    max_output_tokens=2048,
                    candidate_count=1,
                ),
                request_options={"timeout": GENERATION_TIMEOUT_SEC}
            )

            raw = _safe_get_text(response)
            print(f"[QGen] Got {len(raw)} chars")
            
            json_str = _extract_json_from_response(raw)
            parsed = json.loads(json_str)

            if not isinstance(parsed, list):
                raise ValueError(f"Expected list, got {type(parsed)}")

            questions = [str(q).strip() for q in parsed if q]
            
            # Ensure we got enough questions
            if len(questions) < n:
                print(f"[WARN] Got {len(questions)}/{n} questions")
                # Pad with generic fallbacks
                while len(questions) < n:
                    questions.append(f"What are the implications of {goal_truncated[:50]}?")
            
            return questions[:n]

        except Exception as e:
            print(f"[QGen Attempt {attempt+1}/{MAX_RETRIES+1}] {type(e).__name__}: {str(e)[:200]}")
            if attempt < MAX_RETRIES:
                wait = 2 ** attempt
                print(f"[Retry] Waiting {wait}s...")
                time.sleep(wait)

    # Fallback questions (never fail the pipeline)
    print("[FALLBACK] Using default questions")
    return [
        f"What are the key considerations for {goal_truncated[:50]}?",
        f"How should edge cases be handled?",
        f"What are potential risks or limitations?"
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
    """Validate and normalize judge output."""
    for key, typ in EXPECTED_JUDGE_KEYS.items():
        if key not in data:
            raise ValueError(f"Missing key: '{key}'")
        if not isinstance(data[key], typ):
            raise ValueError(f"Wrong type for '{key}': expected {typ.__name__}, got {type(data[key]).__name__}")

    # Normalize verdict
    valid = {"Improved", "Regression", "Neutral", "Unknown"}
    if data["verdict"] not in valid:
        print(f"[WARN] Invalid verdict '{data['verdict']}' -> Unknown")
        data["verdict"] = "Unknown"

    # Ensure risk_flags is list[str]
    data["risk_flags"] = [str(f).strip() for f in data.get("risk_flags", []) if f]

    return data


def gemini_judge(api_key: str, prompt: str) -> Dict[str, Any]:
    """
    Run Gemini as a judge.
    OPTIMIZED: Better error handling, rate limit detection.
    """
    configure_gemini(api_key)

    for attempt in range(MAX_RETRIES + 1):
        try:
            # Wait for quota if rate limiter is enabled
            wait_for_gemini_quota()
            
            model = genai.GenerativeModel(DEFAULT_MODEL)
            
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.0,
                    max_output_tokens=2048,
                    candidate_count=1,
                ),
                request_options={"timeout": GENERATION_TIMEOUT_SEC}
            )

            raw = _safe_get_text(response)
            print(f"[Judge] Got {len(raw)} chars")
            
            json_str = _extract_json_from_response(raw)
            parsed = json.loads(json_str)

            return _validate_judge_output(parsed)

        except Exception as e:
            error_str = str(e)
            print(f"[Judge Attempt {attempt+1}/{MAX_RETRIES+1}] {type(e).__name__}: {error_str[:200]}")
            
            # Detect rate limit
            is_rate_limit = "429" in error_str or "quota" in error_str.lower()
            
            if is_rate_limit:
                print("[RATE LIMIT] Gemini quota exceeded")
                if attempt < MAX_RETRIES:
                    print("[Retry] Waiting 60s for quota reset...")
                    time.sleep(60)
            elif attempt < MAX_RETRIES:
                wait = 2 ** attempt
                print(f"[Retry] Waiting {wait}s...")
                time.sleep(wait)

    # Safe fallback (never crash the pipeline)
    print("[ERROR] Judge failed completely")
    return {
        "verdict": "Unknown",
        "summary": "LLM judge failed after all retries. Analysis incomplete.",
        "risk_flags": ["JUDGE_FAILURE", "EVALUATION_INCOMPLETE"]
    }