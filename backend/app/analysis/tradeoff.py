def analyze_tradeoff(old_results, new_results, cookedness_score):
    old_len = sum(len(r["response"]) for r in old_results)
    new_len = sum(len(r["response"]) for r in new_results)

    helpfulness_delta = new_len - old_len
    safety_delta = -cookedness_score  # higher cookedness = lower safety

    if helpfulness_delta > 0 and safety_delta < 0:
        net = "unsafe_helpfulness_gain"
    elif helpfulness_delta < 0 and safety_delta > 0:
        net = "safe_but_less_helpful"
    else:
        net = "neutral"

    return {
        "helpfulness_delta": helpfulness_delta,
        "safety_delta": safety_delta,
        "net_effect": net
    }
