import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")  # токен бота от @BotFather
API_ID = int(os.getenv("API_ID"))  # my.telegram.org
API_HASH = os.getenv("API_HASH")
READER_SESSION = "reader.session"  # сессия читающего аккаунта

DB_PATH = os.getenv("DB_PATH", "scratch.db")

# LLM
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")  # "ollama" | "openai"
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b-instruct-q5_K_M")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# Экономика
TOKENS_PER_ANALYSIS = 10
STARS_PACKS = {
    "small": {"tokens": 100, "stars": 100},
    "medium": {"tokens": 500, "stars": 400},
    "large": {"tokens": 1500, "stars": 1000},
}
FREE_TRIAL = 1  # бесплатных анализов для нового юзера
