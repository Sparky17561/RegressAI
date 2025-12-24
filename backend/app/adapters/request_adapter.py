import httpx
import json
from typing import Dict, Any

def apply_template(template: Dict[str, Any], variables: Dict[str, Any]) -> Dict[str, Any]:
    raw = json.dumps(template)
    for k, v in variables.items():
        raw = raw.replace(f"{{{{{k}}}}}", str(v))
    return json.loads(raw)

async def call_llm_api(
    url: str,
    headers: Dict[str, str],
    body_template: Dict[str, Any],
    variables: Dict[str, Any],
    response_path: str
):
    body = apply_template(body_template, variables)

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(url, json=body, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    cur = data
    for part in response_path.replace("]", "").split("."):
        if "[" in part:
            key, idx = part.split("[")
            cur = cur[key][int(idx)]
        else:
            cur = cur[part]

    return cur
