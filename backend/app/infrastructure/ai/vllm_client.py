from __future__ import annotations

from typing import Any

import httpx


class VLLMClient:
    def __init__(
        self,
        base_url: str,
        api_key: str,
        default_timeout: float = 30.0,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._default_timeout = default_timeout

    async def create_chat_completion(
        self,
        payload: dict[str, Any],
        *,
        timeout: float | None = None,
    ) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        effective_timeout = timeout if timeout is not None else self._default_timeout
        async with httpx.AsyncClient(timeout=effective_timeout) as http_client:
            response = await http_client.post(
                f"{self._base_url}/chat/completions",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            return response.json()
