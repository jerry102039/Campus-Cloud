from __future__ import annotations

from app.ai.pve_advisor.config import settings
from app.infrastructure.ai.vllm_client import VLLMClient

client = VLLMClient(
    base_url=settings.vllm_base_url,
    api_key=settings.vllm_api_key,
    default_timeout=float(settings.vllm_timeout),
)
