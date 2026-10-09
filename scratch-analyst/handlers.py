import asyncio
import time

from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.types import CallbackQuery, Message, PreCheckoutQuery
from aiogram.utils.keyboard import InlineKeyboardBuilder

from config import TOKENS_PER_ANALYSIS, STARS_PACKS, FREE_TRIAL
from db import get_user, upsert_user, save_analysis
import tokens as token_api
from reader import fetch_messages
from analyzer import analyze
from payments import send_invoice, on_successful_payment

router = Router()

# Простейший rate-limit: не чаще одного анализа в N секунд на юзера.
LAST_ANALYSIS: dict[int, float] = {}
ANALYSIS_COOLDOWN = 30  # секунд
IN_PROGRESS: set[int] = set()  # один одновременный анализ на юзера


def split_message(text: str, limit: int = 4000) -> list[str]:
    """Режет длинный текст на части по границам строк (лимит Telegram — 4096)."""
    parts = []
    while text:
        if len(text) <= limit:
            parts.append(text)
            break
        cut = text.rfind("\n", 0, limit)
        if cut == -1:
            cut = limit
        parts.append(text[:cut])
        text = text[cut:].lstrip("\n")
    return parts


@router.message(CommandStart())
async def cmd_start(msg: Message):
    upsert_user(msg.from_user.id, msg.from_user.username)
    await msg.answer(
        "Привет. Я — злой аналитик каналов.\n\n"
        f"Один разбор канала = {TOKENS_PER_ANALYSIS} токенов.\n"
        f"Первый разбор — бесплатно.\n\n"
        "Команды:\n"
        "/analyze @channel — разобрать канал\n"
        "/balance — баланс\n"
        "/buy — купить токены\n"
    )


@router.message(Command("balance"))
async def cmd_balance(msg: Message):
    bal = token_api.balance(msg.from_user.id)
    if not get_user(msg.from_user.id):
        await msg.answer("Ты ещё не знаком. /start")
        return
    await msg.answer(
        f"У тебя {bal['tokens']} токенов. "
        f"Бесплатных разборов осталось: {bal['free_left']}"
    )


@router.message(Command("buy"))
async def cmd_buy(msg: Message):
    kb = InlineKeyboardBuilder()
    for key, pack in STARS_PACKS.items():
        kb.button(
            text=f"{pack['tokens']} токенов — {pack['stars']} ⭐",
            callback_data=f"buy:{key}",
        )
    kb.adjust(1)
    await msg.answer("Выбери пакет:", reply_markup=kb.as_markup())


@router.callback_query(F.data.startswith("buy:"))
async def cb_buy(cb: CallbackQuery):
    pack_key = cb.data.split(":")[1]
    if pack_key not in STARS_PACKS:
        await cb.answer("Нет такого пакета.", show_alert=True)
        return
    await send_invoice(cb.bot, cb.from_user.id, pack_key)
    await cb.answer()


@router.pre_checkout_query()
async def pre_checkout(q: PreCheckoutQuery):
    await q.answer(ok=True)


@router.message(F.successful_payment)
async def on_paid(msg: Message):
    credited = await on_successful_payment(msg.successful_payment)
    if credited:
        await msg.answer("Оплата прошла. Токены зачислены.")
    else:
        await msg.answer("Эта оплата уже была обработана ранее.")


def refund_charge(tg_id: int, cost: int):
    """Возврат списания при неудачном анализе."""
    token_api.refund(tg_id, cost)


@router.message(Command("analyze"))
async def cmd_analyze(msg: Message):
    args = (msg.text or "").split(maxsplit=1)
    if len(args) < 2:
        await msg.answer("Использование: /analyze @channel")
        return

    tg_id = msg.from_user.id

    # Античит: частота и одновременные запросы.
    now = time.monotonic()
    if tg_id in IN_PROGRESS:
        await msg.answer("У тебя уже идёт анализ. Подожди.")
        return
    last = LAST_ANALYSIS.get(tg_id, 0)
    if now - last < ANALYSIS_COOLDOWN:
        await msg.answer(
            f"Слишком часто. Попробуй через "
            f"{int(ANALYSIS_COOLDOWN - (now - last)) + 1} сек."
        )
        return

    channel = args[1].strip().replace("@", "").replace("https://t.me/", "")
    u = get_user(tg_id)
    if not u:
        await msg.answer("Нажми /start для знакомства.")
        return

    # Сначала пробуем потребить бесплатный анализ (атомарно),
    # иначе — атомарно списываем токены ДО долгого запроса к LLM.
    ok, cost = token_api.charge_analysis(tg_id)
    if not ok:
        await msg.answer(
            f"Недостаточно токенов. Нужно {TOKENS_PER_ANALYSIS}. "
            "/buy — пополнить."
        )
        return

    status = await msg.answer(f"Читаю @{channel}...")
    IN_PROGRESS.add(tg_id)
    LAST_ANALYSIS[tg_id] = now

    try:
        messages, err = await fetch_messages(channel, limit=100)
        if err:
            # Откатываем списание — анализ не состоялся.
            refund_charge(tg_id, cost)
            await status.edit_text(err)
            return

        await status.edit_text("Анализирую... Это может занять до 2 минут.")

        result = await analyze(channel, messages)
        save_analysis(tg_id, channel, result, cost)

        await status.delete()
        for part in split_message(result):
            await msg.answer(part)
            await asyncio.sleep(0.3)  # уважение к flood-control Telegram
    except Exception as e:
        # Любая ошибка — откатываем оплату, чтобы не сжигать токены зря.
        refund_charge(tg_id, cost)
        await status.edit_text(f"Ошибка анализа: {e}. Токены не списаны.")
    finally:
        IN_PROGRESS.discard(tg_id)
