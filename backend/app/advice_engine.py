def generate_architecture_advice(deterministic_flags, risk_flags):
    advice = []

    if "HALLUCINATION" in risk_flags:
        advice.append(
            "Introduce numeric validation or retrieval-based grounding for tax limits."
        )

    if "CONFIDENCE_INFLATION" in risk_flags:
        advice.append(
            "Enforce a disclaimer or uncertainty layer when facts are inferred."
        )

    if "EDGE_CASE_LOSS" in deterministic_flags:
        advice.append(
            "Add explicit edge-case handling (e.g., senior citizens, regime choice)."
        )

    if "DETAIL_LOSS" in deterministic_flags:
        advice.append(
            "Separate direct answer from explanation to preserve completeness."
        )

    if not advice:
        advice.append("No major architectural issues detected.")

    return advice
