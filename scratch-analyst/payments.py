import uuid

from aiogram import Bot
from aiogram.types import LabeledPrice

from config import STARS_PACKS
from db import save_payment, confirm_payment


async def send_invoice(bot: Bot, tg_id: int, pack_key: str):
    pack = STARS_PACKS[pack_key]
    payment_id = str(uuid.uuid4())
    save_payment(payment_id, tg_id, pack["tokens"], pack["stars"], "pending")

    await bot.send_invoice(
        chat_id=tg_id,
        title=f"{pack['tokens']} токенов",
        description="Пакет токенов для анализа каналов",
        payload=payment_id,
        provider_token="",  # для Stars пустой
        currency="XTR",  # Telegram Stars
        prices=[LabeledPrice(label="Токены", amount=pack["stars"])],
    )


async def on_successful_payment(payment) -> bool:
    """Идемпотентное подтверждение: повторный апдейт не удвоит баланс."""
    payload = payment.invoice_payload
    return confirm_payment(payload)
