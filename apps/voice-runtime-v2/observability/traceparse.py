"""W3C traceparent parsing."""

from __future__ import annotations

import re
from typing import Optional, Tuple

_TRACEPARENT_RE = re.compile(
    r"^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$",
    re.IGNORECASE,
)


def parse_traceparent(header: Optional[str]) -> Optional[Tuple[str, str]]:
    if not header or not isinstance(header, str):
        return None
    m = _TRACEPARENT_RE.match(header.strip())
    if not m:
        return None
    return m.group(1).lower(), m.group(2).lower()
