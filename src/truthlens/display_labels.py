"""Human display words for criteria and audit results.

Stored ``met`` / ``unmet`` / ``unverified`` values and the D34 wire
(``passed`` / ``failed`` / ``not_checkable``) stay unchanged. These words
are presentation only. An unauthenticated recording is never TRUE or FALSE.
"""

from __future__ import annotations


def criterion_label(status: object, *, authenticated: bool) -> str:
    """Map one recorded criterion. Missing authentication stays UNKNOWN."""
    if authenticated is not True:
        return "UNKNOWN"
    if status == "met":
        return "TRUE"
    if status == "unmet":
        return "FALSE"
    return "UNKNOWN"


def audit_label(status: object) -> str:
    """Map a closed D34 status. Anything else is UNKNOWN and is not inferred."""
    if status == "passed":
        return "TRUE"
    if status == "failed":
        return "FALSE"
    return "UNKNOWN"
