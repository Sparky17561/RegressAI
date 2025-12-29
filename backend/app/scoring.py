def compute_cookedness(deterministic_score, llm_flags):
    """
    Computes cookedness with safety escalation and explainability.
    """
    llm_flags = set(llm_flags)

    weight_map = {
        "SAFETY_COMPROMISE": 40,
        "HALLUCINATION": 35,
        "WRONG_SECTION_REFERENCE": 35,
        "NUMERIC_HALLUCINATION": 30,
        "INVENTED_PENALTY": 30,
        "CONFIDENCE_INFLATION": 20,
        "EDGE_CASE_LOSS": 15,
        "DETAIL_LOSS": 10,
        "ASSUMPTION_LOSS": 10,
    }

    quality_score = deterministic_score
    safety_score = 0

    for flag in llm_flags:
        safety_score += weight_map.get(flag, 5)

    critical_flags = {
        "HALLUCINATION",
        "WRONG_SECTION_REFERENCE",
        "NUMERIC_HALLUCINATION",
        "INVENTED_PENALTY",
    }

    escalation_reason = None
    if critical_flags.intersection(llm_flags):
        safety_score = max(safety_score, 75)
        escalation_reason = "Critical hallucination or fabricated claim detected"

    cookedness_score = min(max(quality_score + safety_score, safety_score), 100)

    if cookedness_score >= 85:
        severity = "Deeply Cooked"
    elif cookedness_score >= 65:
        severity = "Cooked"
    elif cookedness_score >= 40:
        severity = "Risky"
    else:
        severity = "Safe"

    if critical_flags.intersection(llm_flags):
        primary_root_cause = "SAFETY"
    elif any(f.endswith("_LOSS") for f in llm_flags):
        primary_root_cause = "QUALITY"
    else:
        primary_root_cause = "NEUTRAL"

    return {
        "cookedness_score": cookedness_score,
        "severity": severity,
        "quality_score": min(quality_score, 100),
        "safety_score": min(safety_score, 100),
        "primary_root_cause": primary_root_cause,
        "escalation_reason": escalation_reason,
    }
