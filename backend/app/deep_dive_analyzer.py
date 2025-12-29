"""
app/deep_dive_analyzer.py

Premium Deep Dive Analysis Engine (FIXED)

- Uses a composite quality metric (not raw length)
- Clear hallucination / refusal detection
- Deterministic, explainable metrics for visualizations
- Produces both backward-compatible keys and enhanced payloads
- Marks premium-only features in the viz payload

Author: ChatGPT (edited for your stack)
"""
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import math

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


# -------------------------------------------------
# Helpers
# -------------------------------------------------

def _is_refusal(text: str) -> bool:
    if not text:
        return True
    t = text.lower()
    return any(x in t for x in [
        "cannot", "unable", "not allowed", "i can't", "i am not able", "i'm not able", "i do not"
    ])


def _hallucination_markers(text: str) -> bool:
    if not text:
        return False
    t = text.lower()
    # strong signals of overconfident claims
    return any(x in t for x in [
        "definitely", "guaranteed", "100%", "always", "never", "i'm sure", "no doubt"
    ])


def _contains_bullets(text: str) -> bool:
    if not text:
        return False
    return ("\n- " in text) or ("\n• " in text) or ("\n1." in text) or ("\n2." in text) or ("- " in text and text.count("- ") > 1)


def _safe_div(a, b):
    return a / b if b else 0


def _clamp(v, lo=0, hi=100):
    return max(lo, min(hi, int(round(v))))


# -------------------------------------------------
# Composite quality metric (explainable)
# -------------------------------------------------
# Rationale: simple length-only metric gets gamed (verbosity / "cookedness").
# Composite score = length-based base + bonuses - penalties for refusal/hallucination/instruction-mismatch.
#
def _composite_quality_score(text: str, question: Optional[str] = None) -> int:
    """
    Return 0-100 quality estimate using explainable heuristics:
      - base from length (but saturates)
      - penalty for refusal
      - penalty for hallucination language
      - small bonus for list-format when question asks for lists
      - slight reward for structure (presence of paragraphs)
    """
    if not text or not text.strip():
        return 0

    txt = text.strip()
    length = len(txt)

    # base length-based score (non-linear, saturating)
    # maps 0..2000 chars -> 20..90
    base = 20 + (min(length, 2000) / 2000) * 70

    # structure bonus (paragraphs, line breaks)
    paragraphs = txt.count("\n")
    structure_bonus = min(6, paragraphs) * 1.5

    # bullet/list bonus heuristic
    list_bonus = 0
    if question and ("list" in question.lower() or "give me" in question.lower() or "steps" in question.lower()):
        if _contains_bullets(txt):
            list_bonus = 6
        else:
            list_bonus = -8  # asked for list but not given

    # refusal/hallucination penalties
    refusal_pen = -40 if _is_refusal(txt) else 0
    halluc_pen = -30 if _hallucination_markers(txt) else 0

    # verbosity penalty (if extremely long but low info density) -> detect repeated punctuation or many short sentences
    sentences = [s for s in txt.split('.') if s.strip()]
    avg_sent_len = (sum(len(s) for s in sentences) / len(sentences)) if sentences else 0
    verbosity_pen = 0
    if length > 1500 and avg_sent_len < 30:
        verbosity_pen = -8

    # compute and clamp
    score = base + structure_bonus + list_bonus + refusal_pen + halluc_pen + verbosity_pen
    return _clamp(score)


# -------------------------------------------------
# Deep Dive Metrics
# -------------------------------------------------

def analyze_deep_dive_metrics(
    old_results: List[Dict[str, str]],
    new_results: List[Dict[str, str]],
    adversarial_results: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Compute a deterministic set of deep-dive metrics.
    Returns a dict designed for visualization and further analysis.
    """

    n = max(len(new_results), 1)

    # -----------------------------
    # Response quality distribution using composite score
    # -----------------------------
    def quality_dist(results):
        d = {"excellent": 0, "good": 0, "acceptable": 0, "poor": 0, "failed": 0}
        for r in results:
            q = _composite_quality_score(r.get("response", ""), r.get("question"))
            if q >= 85:
                d["excellent"] += 1
            elif q >= 70:
                d["good"] += 1
            elif q >= 55:
                d["acceptable"] += 1
            elif q > 0:
                d["poor"] += 1
            else:
                d["failed"] += 1
        return d

    old_quality = quality_dist(old_results)
    new_quality = quality_dist(new_results)

    # -----------------------------
    # Hallucination rate
    # -----------------------------
    def hallucination_rate(results):
        return round(sum(1 for r in results if _hallucination_markers(r.get("response", ""))) / max(len(results), 1), 3)

    old_halluc = hallucination_rate(old_results)
    new_halluc = hallucination_rate(new_results)

    # -----------------------------
    # Consistency
    # -----------------------------
    def consistency(results):
        scores = []
        for i in range(len(results) - 1):
            a = len(results[i].get("response", ""))
            b = len(results[i + 1].get("response", ""))
            if a > 100 and b > 100:
                scores.append((1 - abs(a - b) / max(a, b)) * 100)
        return int(sum(scores) / len(scores)) if scores else 50

    old_consistency = consistency(old_results)
    new_consistency = consistency(new_results)

    # -----------------------------
    # Instruction adherence (more robust)
    # -----------------------------
    def instruction_adherence(results):
        failures = 0
        total = 0
        for r in results:
            q = (r.get("question") or "").lower()
            resp = (r.get("response") or "")
            if not q:
                continue
            total += 1
            # heuristic: if they asked for "list" / "steps" but response lacks bullets/numbering -> fail
            if ("list" in q or "steps" in q or q.strip().startswith("give") or "how to" in q) and not _contains_bullets(resp):
                failures += 1
            # if asked for short answer (contains "in one line" / "brief") but response is very long -> mild fail
            if ("one line" in q or "brief" in q) and len(resp) > 350:
                failures += 1
        score = max(0, 100 - int(_safe_div(failures, total) * 100) * 1) if total else 100
        return score, failures

    old_instr, old_instr_fail = instruction_adherence(old_results)
    new_instr, new_instr_fail = instruction_adherence(new_results)

    # -----------------------------
    # Adversarial robustness
    # -----------------------------
    adv_failed = []
    if adversarial_results:
        for q, pair in adversarial_results.items():
            # pair expected to be {"old": "...", "new":"..."}
            resp = pair.get("new", "") or ""
            # fail small or hallucination
            if len(resp.strip()) < 50 or _hallucination_markers(resp) or _is_refusal(resp):
                adv_failed.append(q)
    adv_score = max(0, 100 - len(adv_failed) * 12)

    # -----------------------------
    # Token (character) efficiency
    # -----------------------------
    # NOTE: we use characters as a proxy to tokens (deterministic, reproducible)
    avg_old = _safe_div(sum(len(r.get("response", "")) for r in old_results), max(len(old_results), 1))
    avg_new = _safe_div(sum(len(r.get("response", "")) for r in new_results), max(len(new_results), 1))
    efficiency_delta = round(_safe_div((avg_new - avg_old), max(avg_old, 1)) * 100, 1)

    # -----------------------------
    # Regression severity (quality drop)
    # -----------------------------
    degraded = 0
    for o_res, n_res in zip(old_results, new_results):
        o_q = _composite_quality_score(o_res.get("response", ""), o_res.get("question"))
        n_q = _composite_quality_score(n_res.get("response", ""), n_res.get("question"))
        if n_q + 10 < o_q:  # significant drop
            degraded += 1

    ratio_degraded = _safe_div(degraded, n)
    if ratio_degraded > 0.3:
        severity = "high"
    elif ratio_degraded > 0.1:
        severity = "medium"
    else:
        severity = "low"

    # -----------------------------
    # Per-case quality list (useful in UI)
    # -----------------------------
    per_case = []
    for i, (o, n) in enumerate(zip(old_results, new_results)):
        o_q = _composite_quality_score(o.get("response", ""), o.get("question"))
        n_q = _composite_quality_score(n.get("response", ""), n.get("question"))
        per_case.append({
            "case": i + 1,
            "question": (n.get("question") or "")[:400],
            "old_quality": o_q,
            "new_quality": n_q,
            "old_len": len(o.get("response", "")),
            "new_len": len(n.get("response", ""))
        })

    return {
        "adversarial_robustness": {
            "score": adv_score,
            "failed_cases": adv_failed[:10]
        },
        "instruction_adherence": {
            "old_score": old_instr,
            "new_score": new_instr,
            "drift_cases": new_instr_fail
        },
        "consistency_score": {
            "old": old_consistency,
            "new": new_consistency
        },
        "hallucination_rate": {
            "old": old_halluc,
            "new": new_halluc
        },
        "response_quality_distribution": {
            "old": old_quality,
            "new": new_quality
        },
        "performance_degradation": {
            "degraded_cases": degraded,
            "severity": severity,
            "ratio": round(ratio_degraded, 3)
        },
        "token_efficiency": {
            "avg_tokens_old": int(avg_old),
            "avg_tokens_new": int(avg_new),
            "efficiency_delta_pct": efficiency_delta
        },
        "per_case_quality": per_case,
        "generated_at": datetime.utcnow().isoformat() + "Z"
    }


# -------------------------------------------------
# Visualization Data (OLD vs NEW)
# -------------------------------------------------

def generate_visualization_data(
    old_results: List[Dict[str, str]],
    new_results: List[Dict[str, str]],
    metrics: Dict[str, Any],
    premium_features: bool = False
) -> Dict[str, Any]:
    """
    Create visualization-friendly payload. Returns keys expected by frontend:
      - metrics_comparison
      - test_case_performance
      - hallucination_trend
      - token_efficiency
      - response_quality_distribution
      - (premium_features metadata)
    """

    # test case performance (trim to frontend-safe fields)
    test_case_perf = []
    for i, (o, n) in enumerate(zip(old_results, new_results)):
        test_case_perf.append({
            "case": i + 1,
            "old_quality": metrics.get("per_case_quality", [])[i]["old_quality"] if metrics.get("per_case_quality") and i < len(metrics["per_case_quality"]) else _clamp(_composite_quality_score(o.get("response", ""), o.get("question"))),
            "new_quality": metrics.get("per_case_quality", [])[i]["new_quality"] if metrics.get("per_case_quality") and i < len(metrics["per_case_quality"]) else _clamp(_composite_quality_score(n.get("response", ""), n.get("question"))),
            "question": (n.get("question") or "")[:160]
        })

    # metrics summary for radar chart
    instr_old = metrics.get("instruction_adherence", {}).get("old_score", 50)
    instr_new = metrics.get("instruction_adherence", {}).get("new_score", 50)


    # build comparison scores
    metrics_comparison = {
        "labels": [
            "Instruction Adherence",
            "Adversarial Robustness",
            "Consistency",
            "Hallucination (↓)",
            "Efficiency"
        ],
        "old_scores": [
            instr_old,
            100,  # baseline (adversarial tests usually target NEW) -- keep high so new_score shows drop if any
            metrics.get("consistency_score", {}).get("old", 50),
            int((1 - metrics.get("hallucination_rate", {}).get("old", 0)) * 100),
            50  # neutral baseline for efficiency in old
        ],
        "new_scores": [
            instr_new,
            metrics.get("adversarial_robustness", {}).get("score", 100),
            metrics.get("consistency_score", {}).get("new", 50),
            int((1 - metrics.get("hallucination_rate", {}).get("new", 0)) * 100),
            max(0, min(100, 50 + (metrics.get("token_efficiency", {}).get("efficiency_delta_pct") or 0)))
        ]
    }

    # hallucination_trend for doughnut chart (old/new)
    hallucination_trend = {
        "old": metrics.get("hallucination_rate", {}).get("old", 0),
        "new": metrics.get("hallucination_rate", {}).get("new", 0)
    }

    viz = {
        "metrics_comparison": metrics_comparison,
        "test_case_performance": test_case_perf,
        "hallucination_trend": hallucination_trend,
        "token_efficiency": metrics.get("token_efficiency", {}),
        "response_quality_distribution": metrics.get("response_quality_distribution", {}),
        # backward-compatible short keys used in earlier frontend code
        "quality_distribution": metrics.get("response_quality_distribution", {}).get("new", metrics.get("response_quality_distribution", {}).get("old", {})),
        # premium metadata (UI can use this to gray out or show upgrade prompt)
        "premium_features": {
            "adversarial_details": {
                "available": bool(premium_features),
                "reason": "Adversarial robustness detail is premium" if not premium_features else None
            },
            "per_case_quality": {
                "available": bool(premium_features),
                "reason": "Per-case drilldown is premium" if not premium_features else None
            }
        }
    }

    return viz
