def analyze_behavior_shift(old_results, new_results):
    """
    Detects behavioral changes between OLD and NEW outputs.
    """
    shift = {
        "confidence_shift": "unchanged",
        "specificity_shift": "unchanged",
        "citation_behavior": "unchanged",
        "advice_tone": "unchanged",
        "risk_posture": "unchanged",
    }

    old_text = " ".join(r["response"] for r in old_results)
    new_text = " ".join(r["response"] for r in new_results)

    # Heuristics (simple, deterministic)
    if len(new_text) > len(old_text) * 1.2:
        shift["specificity_shift"] = "increased"

    if "Section" in new_text and "Section" not in old_text:
        shift["citation_behavior"] = "introduced"

    if any(w in new_text.lower() for w in ["must", "should", "required"]):
        shift["advice_tone"] = "introduced"

    if any(w in new_text.lower() for w in ["may", "depends", "subject to"]):
        shift["confidence_shift"] = "more cautious"
    else:
        shift["confidence_shift"] = "more assertive"

    if shift["citation_behavior"] == "introduced" and shift["confidence_shift"] == "more assertive":
        shift["risk_posture"] = "worsened"

    return shift
