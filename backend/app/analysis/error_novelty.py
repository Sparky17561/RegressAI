def analyze_error_novelty(deterministic_flags, risk_flags):
    inherited = []
    introduced = []

    for f in risk_flags:
        if f in deterministic_flags:
            inherited.append(f)
        else:
            introduced.append(f)

    return {
        "introduced_errors": introduced,
        "inherited_errors": inherited,
        "has_new_risk": len(introduced) > 0
    }
