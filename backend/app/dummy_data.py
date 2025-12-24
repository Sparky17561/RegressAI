USE_CASES = [
    {
        "id": "legal-ai",
        "name": "Legal AI – Tax Bot",
        "runs": [
            {"run_id": "v1", "cookedness": 12, "verdict": "Safe"},
            {"run_id": "v2", "cookedness": 41, "verdict": "Risky"},
            {"run_id": "v3", "cookedness": 67, "verdict": "Cooked"},
        ]
    }
]

REPORTS = {
    "v3": {
        "cookedness": 67,
        "verdict": "Risky",
        "removed": [
            "Assumption about tax slab knowledge",
            "Edge case for income > ₹15L"
        ],
        "added": [
            "More confident tone"
        ],
        "risks": [
            "Confidence inflation",
            "Missing justification"
        ],
        "keywords": [
            "keep it concise",
            "answer confidently"
        ]
    }
}
