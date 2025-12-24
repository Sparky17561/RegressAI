# app/prompt_fixer.py
import json
from typing import List, Dict, Any

from app.gemini_client import gemini_judge


# ============================================
# LAYER 2C — ROOT CAUSE CLASSIFICATION
# ============================================

def classify_root_causes(issues: List[str]) -> List[str]:
    """
    Map low-level flags to high-level root causes.
    Used for arbitration-aware suggestions.
    """
    mapping = {
        "SAFETY": ["SAFETY_COMPROMISE"],
        "HALLUCINATION": ["HALLUCINATION", "LEGAL_HALLUCINATION"],
        "STRUCTURE": ["DETAIL_LOSS", "ASSUMPTION_LOSS", "EDGE_CASE_LOSS"],
        "CONFIDENCE": ["CONFIDENCE_INFLATION"],
    }

    root_causes = set()
    for issue in issues:
        for root, flags in mapping.items():
            if any(f in issue for f in flags):
                root_causes.add(root)

    return sorted(root_causes)


# ============================================
# DETERMINISTIC FALLBACK (SCHEMA-SAFE)
# ============================================

def _heuristic_fallback(
    old_text: str,
    new_text: str,
    issues: List[str],
    goal: str
) -> Dict[str, Any]:
    """
    Architecture-aligned deterministic fallback.
    Guaranteed schema completeness.
    """

    root_causes = classify_root_causes(issues)

    findings = []
    suggestions = []
    quick_tests = []
    metrics = []

    # --- Root-cause aware guidance ---

    if "HALLUCINATION" in root_causes:
        findings.append("Model output shows signs of hallucinated or unverifiable claims.")
        suggestions.append({
            "scope": "rag",
            "severity": "critical",
            "change_type": "grounding",
            "suggested_text": "Introduce retrieval grounding with authoritative sources and require citation-backed claims.",
            "explanation": "Hallucinations typically arise from ungrounded generation. Retrieval constraints reduce fabrication risk."
        })
        quick_tests.append("Ask a fact-specific question and verify that sources are cited.")
        metrics.append("Hallucination rate per 100 responses")

    if "STRUCTURE" in root_causes:
        findings.append("Responses lack consistent structure (assumptions, edge cases, disclaimers).")
        suggestions.append({
            "scope": "prompt",
            "severity": "medium",
            "change_type": "response-structure",
            "suggested_text": "Enforce a strict response template: Assumptions → Explanation → Edge Cases → Disclaimer.",
            "explanation": "Structured prompts reduce omission-related regressions."
        })
        quick_tests.append("Verify all required sections appear in output.")
        metrics.append("Response structure adherence rate")

    if "CONFIDENCE" in root_causes:
        findings.append("Model exhibits overconfident or definitive language.")
        suggestions.append({
            "scope": "system",
            "severity": "high",
            "change_type": "tone-guardrail",
            "suggested_text": "Require conditional language ('may', 'depends on') and uncertainty acknowledgment.",
            "explanation": "Overconfidence increases safety risk, especially in legal and medical domains."
        })
        quick_tests.append("Check for modal verbs and uncertainty markers.")
        metrics.append("Overconfidence flag frequency")

    # --- Generic safety baseline ---
    suggestions.append({
        "scope": "system",
        "severity": "low",
        "change_type": "safety-preamble",
        "suggested_text": "Add a short safety preamble and a mandatory disclaimer at the end of each response.",
        "explanation": "Provides baseline protection even when other guardrails fail."
    })

    revised_prompt = (
        "You are a cautious domain-specific assistant.\n"
        "Always state assumptions, use conditional language, mention at least one edge case, "
        "and end with a clear disclaimer.\n\nUser Question:\n{question}"
    )

    return {
        "change_type": "mixed",
        "short_summary": "Heuristic fallback generated regression-aware corrective suggestions.",
        "detailed_review": (
            "The system detected a regression driven primarily by the following root causes: "
            f"{', '.join(root_causes) if root_causes else 'Unknown'}. "
            "Since the LLM-based fixer was unavailable or unreliable, a deterministic "
            "architecture-aligned fallback was applied to recommend guardrails and prompt fixes."
        ),
        "findings": findings,
        "suggestions": suggestions,
        "revised_prompt": revised_prompt,
        "quick_tests": quick_tests,
        "metrics_to_watch": metrics,
    }


# ============================================
# LAYER 3 — PROMPT / ARCHITECTURE FIXER
# ============================================

def improve_prompt(
    api_key: str,
    old_text: str,
    new_text: str,
    issues: List[str],
    goal: str
) -> Dict[str, Any]:
    """
    Post-arbitration prompt / architecture improvement engine.
    Operates AFTER regression verdict is determined.
    """

    root_causes = classify_root_causes(issues)

    gemini_prompt = f"""
You are a Layer-3 AI systems repair agent.

CONTEXT:
- A regression has already been detected.
- Deterministic + semantic evaluation identified issues.
- Your task is to propose PREVENTIVE fixes.

SYSTEM GOAL:
{goal}

ROOT CAUSES:
{json.dumps(root_causes)}

OLD STATE:
{old_text}

NEW STATE:
{new_text}

STRICT OUTPUT CONTRACT:
You MUST return exactly ONE JSON object with the schema below.
No extra text. No markdown. No commentary.

SCHEMA (EXACT KEYS):

{{
  "change_type": "prompt | arch | rag | system | mixed",
  "short_summary": "string",
  "detailed_review": "string",
  "findings": ["string"],
  "suggestions": [
    {{
      "scope": "prompt | rag | system | data | policy | ops",
      "severity": "low | medium | high | critical",
      "change_type": "string",
      "suggested_text": "string or null",
      "explanation": "string"
    }}
  ],
  "revised_prompt": "string or null",
  "quick_tests": ["string"],
  "metrics_to_watch": ["string"]
}}

RULES:
- Be regression-aware.
- Prioritize SAFETY over creativity if in conflict.
- If uncertain, say so explicitly in findings.
"""

    try:
        raw = gemini_judge(api_key, gemini_prompt)

        if isinstance(raw, dict):
            return raw

        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1:
            return json.loads(raw[start:end + 1])

        return _heuristic_fallback(old_text, new_text, issues, goal)

    except Exception:
        return _heuristic_fallback(old_text, new_text, issues, goal)
