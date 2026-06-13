from typing import Literal

from pydantic import BaseModel, Field, field_validator


class SafetyOptions(BaseModel):
    prevent_writes: bool = True
    prevent_sensitive_input: bool = True
    prevent_downloads: bool = True
    require_final_verification: bool = True


class RunRequest(BaseModel):
    target_url: str = Field(min_length=8, max_length=2048)
    task: str = Field(min_length=1, max_length=20_000)
    allowed_domains: list[str]
    provider: Literal["google", "openai", "anthropic", "browser-use"] = "google"
    model: str = Field(default="gemini-2.5-flash", min_length=1, max_length=200)
    conversation_id: str | None = Field(default=None, max_length=64)
    request_id: str | None = Field(default=None, max_length=64)
    headless: bool = True
    max_steps: int = Field(default=30, ge=1, le=100)
    safety: SafetyOptions = Field(default_factory=SafetyOptions)

    @field_validator("target_url")
    @classmethod
    def validate_target_url(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized.startswith(("http://", "https://")):
            raise ValueError("target_url must start with http:// or https://")
        return normalized

    @field_validator("allowed_domains")
    @classmethod
    def normalize_domains(cls, values: list[str]) -> list[str]:
        normalized = list(dict.fromkeys(value.strip() for value in values if value.strip()))
        if not normalized:
            raise ValueError("at least one allowed domain is required")
        return normalized


class RunCreated(BaseModel):
    id: str
    conversation_id: str
    status: str
