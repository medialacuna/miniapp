import sqlite3
from config import DB_PATH, FREE_TRIAL as FREE_TRIAL_LIMIT


def get_conn():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def init():
    con = sqlite3.connect(DB_PATH)
    con.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        tg_id INTEGER PRIMARY KEY,
        username TEXT,
        tokens INTEGER DEFAULT 0,
        free_used INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS analyses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tg_id INTEGER,
        channel TEXT,
        result TEXT,
        cost INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        tg_id INTEGER,
        tokens INTEGER,
        stars INTEGER,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    con.commit()
    con.close()


def get_user(tg_id):
    con = get_conn()
    u = con.execute("SELECT * FROM users WHERE tg_id=?", (tg_id,)).fetchone()
    con.close()
    return u


def upsert_user(tg_id, username=None):
    con = get_conn()
    con.execute(
        "INSERT INTO users(tg_id, username) VALUES(?,?) "
        "ON CONFLICT(tg_id) DO UPDATE SET username=excluded.username",
        (tg_id, username),
    )
    con.commit()
    con.close()


def add_tokens(tg_id, amount):
    con = get_conn()
    con.execute("UPDATE users SET tokens = tokens + ? WHERE tg_id=?", (amount, tg_id))
    con.commit()
    con.close()


def spend_tokens(tg_id, amount):
    """Атомарное списание: только если токенов хватает. Возвращает True/False."""
    con = get_conn()
    cur = con.execute(
        "UPDATE users SET tokens = tokens - ? WHERE tg_id=? AND tokens >= ?",
        (amount, tg_id, amount),
    )
    con.commit()
    ok = cur.rowcount > 0
    con.close()
    return ok


def use_free_trial(tg_id):
    """Потребить бесплатный анализ. Возвращает True, если был доступен."""
    con = get_conn()
    cur = con.execute(
        "UPDATE users SET free_used = free_used + 1 "
        "WHERE tg_id=? AND free_used < ?",
        (tg_id, FREE_TRIAL_LIMIT),
    )
    con.commit()
    ok = cur.rowcount > 0
    con.close()
    return ok


def refund_free_trial(tg_id):
    """Вернуть потреблённый бесплатный анализ (при ошибке разбора)."""
    con = get_conn()
    con.execute(
        "UPDATE users SET free_used = free_used - 1 WHERE tg_id=? AND free_used > 0",
        (tg_id,),
    )
    con.commit()
    con.close()


def save_analysis(tg_id, channel, result, cost):
    con = get_conn()
    con.execute(
        "INSERT INTO analyses(tg_id, channel, result, cost) VALUES(?,?,?,?)",
        (tg_id, channel, result, cost),
    )
    con.commit()
    con.close()


def save_payment(payment_id, tg_id, tokens, stars, status="pending"):
    con = get_conn()
    con.execute(
        "INSERT INTO payments(id, tg_id, tokens, stars, status) VALUES(?,?,?,?,?)",
        (payment_id, tg_id, tokens, stars, status),
    )
    con.commit()
    con.close()


def confirm_payment(payment_id):
    """Подтверждение оплаты с защитой от двойного зачисления.

    Статус меняется условным UPDATE (pending -> paid), поэтому повторный
    pre_checkout/successful_payment не начислит токены дважды.
    """
    con = get_conn()
    row = con.execute("SELECT * FROM payments WHERE id=?", (payment_id,)).fetchone()
    if not row:
        con.close()
        return False
    cur = con.execute(
        "UPDATE payments SET status='paid' WHERE id=? AND status='pending'",
        (payment_id,),
    )
    if cur.rowcount > 0:
        con.execute(
            "UPDATE users SET tokens = tokens + ? WHERE tg_id=?",
            (row["tokens"], row["tg_id"]),
        )
        con.commit()
        con.close()
        return True
    con.close()
    return False

