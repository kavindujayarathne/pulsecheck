from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlparse, urlunparse

import httpx

from .base import ParsedStatusPage
from .summary import merge, parse

# Each entry pairs a path with the role it plays in the source-of-truth split.
# - "components" role: authoritative components list (full, untruncated)
# - "summary" role: active incidents and scheduled maintenances; components
#   here are a fallback only when no "components" endpoint is available
# Adding a new standard endpoint is a one-line append. No discover changes.
ENDPOINTS: list[tuple[str, str]] = [
    ("/api/v2/components.json", "components"),
    ("/api/v2/summary.json", "summary"),
]


@dataclass
class DiscoveryResult:
    api_urls: list[str]
    parsed: ParsedStatusPage


def _fetch(url: str) -> dict | None:
    try:
        r = httpx.get(
            url,
            timeout=8.0,
            follow_redirects=True,
            headers={"Accept": "application/json", "User-Agent": "PulseCheck/1.0"},
        )
        if r.status_code != 200:
            return None
        ctype = r.headers.get("content-type", "")
        if "json" not in ctype:
            return None
        return r.json()
    except (httpx.RequestError, ValueError):
        return None


def discover_status_page(user_url: str) -> DiscoveryResult | None:
    parsed_url = urlparse(user_url.strip())
    if not parsed_url.scheme or not parsed_url.netloc:
        return None

    base = urlunparse((parsed_url.scheme, parsed_url.netloc, "", "", "", ""))

    fetched: list[tuple[str, str, ParsedStatusPage]] = []
    for path, role in ENDPOINTS:
        url = f"{base}{path}"
        payload = _fetch(url)
        if payload is None:
            continue
        fetched.append((url, role, parse(payload)))

    if not fetched:
        return None

    api_urls: list[str] = []
    components = []
    incidents = None
    scheduled = None

    # Components: prefer any endpoint tagged "components". Fall back to a
    # "summary" endpoint only when no components-role source returned data.
    for url, role, page in fetched:
        if role == "components" and page.components:
            components = page.components
            api_urls.append(url)
            break
    if not components:
        for url, role, page in fetched:
            if role == "summary" and page.components:
                components = page.components
                break

    # Incidents and scheduled maintenances: from "summary" role only.
    for url, role, page in fetched:
        if role != "summary":
            continue
        if incidents is None:
            incidents = page.incidents
        if scheduled is None:
            scheduled = page.scheduled_maintenances
        contributed = bool(page.components) or page.incidents is not None or page.scheduled_maintenances is not None
        if contributed and url not in api_urls:
            api_urls.append(url)

    if not components:
        return None

    return DiscoveryResult(
        api_urls=api_urls,
        parsed=ParsedStatusPage(
            components=components,
            incidents=incidents,
            scheduled_maintenances=scheduled,
        ),
    )


def fetch_and_parse(api_urls: list[str]) -> ParsedStatusPage:
    pages = []
    for url in api_urls:
        payload = _fetch(url)
        if payload is not None:
            pages.append(parse(payload))
    return merge(pages)


def parse_user_url(user_url: str) -> ParsedStatusPage | None:
    """Fetch a user-supplied JSON URL and parse it. Returns None if the URL
    can't be fetched or returns a non-JSON / unparseable payload."""
    payload = _fetch(user_url.strip())
    if payload is None:
        return None
    return parse(payload)
