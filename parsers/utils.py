from __future__ import annotations

import json


def decode_api_urls(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        decoded = json.loads(value)
        if isinstance(decoded, list):
            return [str(u) for u in decoded]
    except (json.JSONDecodeError, TypeError):
        pass
    return []
