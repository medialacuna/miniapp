"""Высокоуровневый API токенов поверх db.py.

Всё списание/зачисление идёт через эту обёртку, чтобы бизнес-логика
(handlers/payments) не трогала SQL напрямую.
"""

from config import TOKENS_PER_ANALYSIS, FREE_TRIAL
import db


def balance(tg_id: int) -> dict:
    """Текущий баланс и остатки бесплатных разборов."""
    u = db.get_user(tg_id)
    if not u:
        return {"tokens": 0, "free_left": FREE_TRIAL}
    return {
        "tokens": u["tokens"],
        "free_left": max(FREE_TRIAL - u["free_used"], 0),
    }


def charge_analysis(tg_id: int) -> tuple[bool, int]:
    """Списать оплату за один анализ.

    Сначала атомарно потребляется бесплатный trial, затем — токены.
    Возвращает (успех, стоимость): стоимость 0, если сработал триал.
    При неудаче ничего не списано.
    """
    if db.use_free_trial(tg_id):
        return True, 0
    if db.spend_tokens(tg_id, TOKENS_PER_ANALYSIS):
        return True, TOKENS_PER_ANALYSIS
    return False, 0


def refund(tg_id: int, cost: int):
    """Возврат списания при неудачном анализе."""
    if cost == 0:
        db.refund_free_trial(tg_id)
    else:
        db.add_tokens(tg_id, cost)


def credit(tg_id: int, amount: int):
    """Зачисление токенов (например, вручную администратором)."""
    db.add_tokens(tg_id, amount)
