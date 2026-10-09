from telethon import TelegramClient
from config import API_ID, API_HASH, READER_SESSION

_client = None


async def get_client():
    global _client
    if _client is None:
        _client = TelegramClient(READER_SESSION, API_ID, API_HASH)
        await _client.start()
    return _client


async def fetch_messages(channel: str, limit: int = 100):
    """
    Возвращает список текстов последних постов канала.
    channel — @username или https://t.me/username
    """
    channel = channel.replace("https://t.me/", "").replace("@", "").strip()
    client = await get_client()
    messages = []
    try:
        async for msg in client.iter_messages(channel, limit=limit):
            if msg.text:
                messages.append(msg.text)
    except Exception as e:
        return None, f"Не удалось прочитать канал: {e}"
    if not messages:
        return None, "Канал пуст или закрыт."
    return messages, None
