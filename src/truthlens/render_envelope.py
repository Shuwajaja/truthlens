"""Authoritative, bounded presentation projection; never a new evidence record."""

from __future__ import annotations

import json
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Kind = Literal[
    "plain",
    "markdown",
    "diff",
    "json",
    "table",
    "chart",
    "timeline",
    "story",
    "graph",
    "html",
    "media",
    "evidence-board",
    "search-results",
    "artifact-gallery",
]
Ref = Annotated[str, Field(min_length=1, max_length=400)]
KINDS = set(Kind.__args__) - {"story", "evidence-board", "search-results", "artifact-gallery"}
ALIASES = {
    "text": "plain",
    "code": "plain",
    "file": "plain",
    "md": "markdown",
    "patch": "diff",
    "csv": "table",
    "image": "media",
    "audio": "media",
    "video": "media",
    "pdf": "media",
}
MAX_PAYLOAD = 262144


class ClosedModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Presentation(ClosedModel):
    preferred_renderer: Kind
    supported_renderers: Annotated[list[Kind], Field(min_length=1, max_length=16)]

    @model_validator(mode="after")
    def coherent(self):
        if any(renderer not in KINDS for renderer in self.supported_renderers):
            raise ValueError("Unknown artifact renderer.")
        if self.preferred_renderer not in self.supported_renderers or len(
            set(self.supported_renderers)
        ) != len(self.supported_renderers):
            raise ValueError("Inconsistent renderer selection.")
        return self


class Provenance(ClosedModel):
    source_id: Ref
    source_run_id: Ref | None = None
    event_refs: Annotated[list[Ref], Field(max_length=200)] = Field(default_factory=list)

    @model_validator(mode="after")
    def unique_refs(self):
        if len(set(self.event_refs)) != len(self.event_refs):
            raise ValueError("Duplicate event reference.")
        return self


class Trust(ClosedModel):
    origin: Literal["NATIVE", "IMPORTED"]
    integrity: Literal["hmac", "hash-only", "failed", "unknown"]
    verification: Literal["VERIFIED", "FAILED", "UNKNOWN"]
    review: Literal["REQUIRED", "UNKNOWN"]
    acceptance: Literal["UNKNOWN"]

    @model_validator(mode="after")
    def coherent(self):
        if self.origin == "IMPORTED" and (self.integrity == "hmac" or self.verification == "VERIFIED"):
            raise ValueError("Imported claims cannot become verified evidence.")
        if self.verification == "VERIFIED" and self.integrity != "hmac":
            raise ValueError("Verified checks require witnessed integrity.")
        return self


class RenderEnvelope(ClosedModel):
    schema_version: Literal["truthlens.render/1"] = "truthlens.render/1"
    project_id: Annotated[str, Field(min_length=1, max_length=200)]
    workspace_id: Annotated[str | None, Field(max_length=200)] = None
    run_id: Ref
    artifact_id: Ref
    kind: Kind
    payload_ref: Ref
    presentation: Presentation
    provenance: Provenance
    trust: Trust
    limitations: Annotated[list[Annotated[str, Field(max_length=500)]], Field(max_length=20)] = Field(
        default_factory=list
    )
    data_status: Literal["available", "missing", "malformed", "isolated", "unauthorized"]

    @model_validator(mode="after")
    def coherent(self):
        if self.payload_ref != self.artifact_id:
            raise ValueError("Payload must reference the canonical artifact.")
        if self.trust.integrity == "failed" and self.data_status != "isolated":
            raise ValueError("Failed integrity requires isolation.")
        return self


def artifact_view(
    run: dict, artifact_id: str, renderer: str | None = None
) -> tuple[RenderEnvelope, str | None]:
    """Resolve references only from the caller's already scoped authoritative run."""
    artifact = next((a for a in run.get("artifacts", []) if a["id"] == artifact_id), None)
    if artifact is None:
        raise ValueError("Artifact unavailable or access denied.")
    kind = str(artifact.get("kind", "plain")).lower()
    kind = ALIASES.get(kind, kind)
    kind = kind if kind in KINDS else "plain"
    payload = artifact.get("content")
    status, limits = "available", []
    if run["integrity"] == "failed":
        payload, status = None, "isolated"
        limits.append("Failed-integrity content is isolated; it is not evidence.")
    elif payload is None:
        status = "missing"
        limits.append("Content was not recorded in this snapshot.")
    elif not isinstance(payload, str) or len(payload.encode()) > MAX_PAYLOAD:
        payload, status = None, "malformed"
        limits.append("Payload exceeds the bounded presentation contract.")
    elif kind in {"json", "graph", "chart", "timeline"}:
        try:
            parsed = json.loads(payload, parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
            if kind != "json" and not isinstance(parsed, (dict, list)):
                raise ValueError()
        except (ValueError, RecursionError):
            status = "malformed"
            limits.append("Malformed structured content; plain text only.")
    supported = [kind, "plain"] if kind != "plain" and status == "available" else ["plain"]
    if renderer is not None and renderer not in supported:
        raise ValueError("Renderer unavailable for this artifact.")
    event_ids = {e["id"] for e in run.get("events", [])}
    ref = artifact.get("evidence_ref")
    envelope = RenderEnvelope(
        project_id=run["project_id"],
        workspace_id=run.get("workspace_id"),
        run_id=run["id"],
        artifact_id=artifact_id,
        kind=kind,
        payload_ref=artifact_id,
        presentation=Presentation(preferred_renderer=renderer or supported[0], supported_renderers=supported),
        provenance=Provenance(
            source_id=run["source_id"],
            source_run_id=run.get("source_run_id"),
            event_refs=[ref] if ref in event_ids else [],
        ),
        trust=Trust(**{k: run[k] for k in Trust.model_fields}),
        limitations=limits,
        data_status=status,
    )
    return envelope, payload
