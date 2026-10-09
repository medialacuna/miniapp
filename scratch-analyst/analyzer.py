import httpx
from config import (
    LLM_PROVIDER,
    OLLAMA_URL,
    OLLAMA_MODEL,
    OPENAI_API_KEY,
    OPENAI_MODEL,
)
from prompts import SYSTEM_PROMPT, build_prompt


async def analyze(channel: str, messages: list[str]) -> str:
    prompt = build_prompt(channel, messages)

    if LLM_PROVIDER == "ollama":
        async with httpx.AsyncClient(timeout=180) as client:
            r = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": OLLAMA_MODEL,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    "stream": False,
                    "options": {"temperature": 0.8, "num_predict": 800},
                },
            )
            r.raise_for_status()
            data = r.json()
            return data["message"]["content"]

    if LLM_PROVIDER == "openai":
        async with httpx.AsyncClient(timeout=180) as client:
            r = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
                json={
                    "model": OPENAI_MODEL,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.8,
                    "max_tokens": 900,
                },
            )
            r.raise_for_status()
            data = r.json()
            return data["choices"][0]["message"]["content"]

    raise RuntimeError(f"LLM provider не поддерживается: {LLM_PROVIDER}")
