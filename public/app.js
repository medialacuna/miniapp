const API_BASE = ""; // same origin

let authToken = null;
let currentUser = null;
let wheelSpinning = false;
let currentQuiz = null;
let quizAnswered = false;

// энергия для фонового узла
window.hwEnergy = 0;
// энергия для узла внутри кнопки
let clickerEnergy = 0;
// последний touch внутри кнопки (0..1)
let lastTouch = { x: 0.5, y: 0.5 };

const SUTRAS = [
  "Замечать свои автоматические реакции — уже первый шаг к свободе.",
  "Осознанность не отменяет боль. Она учит быть с ней честно.",
  "Там, где ты хочешь убежать, часто спрятан твой рост.",
  "Настоящее уважение — позволить другому быть не таким, как ты ожидаешь.",
  "Иногда самый смелый поступок — сказать себе: «я не знаю» и остаться.",
  "Дух развивается, когда ты способен увидеть свою тень и не отвернуться.",
  "Глубина дыхания часто показывает глубину доверия миру.",
  "Скорость — не всегда движение. Иногда это способ не чувствовать.",
  "Осознанность — это не быть идеальным, а быть живым и внимательным."
];

const QUIZ_QUESTIONS = [
  {
    id: 1,
    quote: "«Когда я раздражён, это не значит, что мир плохой. Это значит, что во мне что-то хочет быть услышанным.»",
    question: "Какой шаг ближе всего к осознанности в такой момент?",
    options: [
      "Сразу написать гневное сообщение, чтобы стало легче.",
      "На минуту остановиться, почувствовать тело и назвать своё чувство.",
      "Сделать вид, что ничего не происходит и продолжать как ни в чём не бывало.",
      "Обвинить другого в том, что ты чувствуешь."
    ],
    correctIndex: 1,
    reward: 2
  },
  {
    id: 2,
    quote: "«Уважение — это не соглашаться, а признавать, что другой видит мир по-своему.»",
    question: "Какой вариант ближе к этому принципу?",
    options: [
      "Слушать до конца и переспрашивать, правильно ли ты понял.",
      "Разрешать говорить только тогда, когда ты согласен.",
      "Сразу доказывать, почему другой неправ.",
      "Избегать любых сложных тем, чтобы не было конфликтов."
    ],
    correctIndex: 0,
    reward: 1
  },
  {
    id: 3,
    quote: "«Осознанность в деньгах — это не отсутствие желаний, а честность с тем, зачем тебе то, что ты хочешь.»",
    question: "Какой шаг наиболее осознанный перед спонтанной покупкой?",
    options: [
      "Купить сразу, пока не передумал.",
      "Сравнить цену и понять, удачная ли скидка.",
      "Спросить себя: «Какое состояние я пытаюсь купить?» и сделать пару дыханий.",
      "Взять кредит, чтобы точно не упустить возможность."
    ],
    correctIndex: 2,
    reward: 2
  },
  {
    id: 4,
    quote: "«Духовный рост — это не полёт над людьми, а способность встречаться с собой без масок.»",
    question: "Какой вариант ближе к этому подходу?",
    options: [
      "Считать себя более осознанным, чем остальные.",
      "Признавать свои слабости и, по возможности, говорить о них честно.",
      "Избегать людей, которые вызывают неудобные чувства.",
      "Ждать, когда другие начнут меняться первыми."
    ],
    correctIndex: 1,
    reward: 2
  },
  {
    id: 5,
    quote: "«Пауза между стимулом и реакцией — пространство, где рождается свобода.»",
    question: "Как можно развивать эту паузу в обычной жизни?",
    options: [
      "Отвечать быстрее, чтобы не потерять контроль над ситуацией.",
      "Приучать себя хотя бы один раз в день делать несколько осознанных вдохов перед важным действием.",
      "По максимуму избегать любых решений.",
      "Стараться вообще ничего не чувствовать, чтобы не мешало."
    ],
    correctIndex: 1,
    reward: 1
  }
];

/* DOM */
const profileGreeting = document.getElementById("profileGreeting");
const profileMeta = document.getElementById("profileMeta");
const statKarma = document.getElementById("statKarma");
const statAwareness = document.getElementById("statAwareness");
const statQuiz = document.getElementById("statQuiz");
const karmaClickBtn = document.getElementById("karmaClickBtn");
const wheelVisual = document.getElementById("wheelVisual");
const spinBtn = document.getElementById("spinBtn");
const wheelResultEl = document.getElementById("wheelResult");
const sutraBox = document.getElementById("sutraBox");
const quizQuoteEl = document.getElementById("quizQuote");
const quizQuestionEl = document.getElementById("quizQuestion");
const quizOptionsEl = document.getElementById("quizOptions");
const quizStatusEl = document.getElementById("quizStatus");
const newQuestionBtn = document.getElementById("newQuestionBtn");
const logoutBtn = document.getElementById("logoutBtn");
const platformLabel = document.getElementById("platformLabel");
const advancedSection = document.getElementById("advancedSection");
const clickerCanvas = document.getElementById("clickerCanvas");
const logoCanvas = document.getElementById("logoCanvas");

/* HELPERS */

function setToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem("hw_awareness_token", token);
  } else {
    localStorage.removeItem("hw_awareness_token");
  }
}

async function api(path, opts = {}) {
  const headers = opts.headers || {};
  if (authToken) headers["Authorization"] = "Bearer " + authToken;
  if (!(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(API_BASE + path, {
    ...opts,
    headers,
    body: opts.body && !(opts.body instanceof FormData)
      ? JSON.stringify(opts.body)
      : opts.body
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || "Ошибка запроса");
  }
  return data;
}

function maybeUnlockAdvanced() {
  if (!currentUser || !advancedSection) return;
  const karma = currentUser.karma ?? 0;
  if (karma >= 10) {
    advancedSection.classList.add("visible");
  }
}

function updateUserUI() {
  if (!currentUser) return;
  let name = "гость";
  let meta = "";

  if (currentUser.telegramName || currentUser.telegramUsername) {
    name = currentUser.telegramName || currentUser.telegramUsername || "tg user";
    meta = "Telegram miniapp";
  } else if (currentUser.vkName || currentUser.vkUsername) {
    name = currentUser.vkName || currentUser.vkUsername || "vk user";
    meta = "VK miniapp";
  } else if (currentUser.guestName) {
    name = currentUser.guestName;
    meta = "standalone guest";
  }

  profileGreeting.textContent = "Привет, " + name + "!";
  profileMeta.textContent = meta;

  statKarma.textContent = currentUser.karma ?? 0;
  statAwareness.textContent = currentUser.awareness ?? 0;
  statQuiz.textContent = currentUser.quizCorrect ?? 0;

  maybeUnlockAdvanced();
}

function spawnClickParticles(containerEl, count = 7) {
  if (!containerEl) return;
  for (let i = 0; i < count; i++) {
    const span = document.createElement("span");
    const isHeart = Math.random() < 0.6;
    span.className = "click-particle " + (isHeart ? "heart" : "dot");
    span.textContent = isHeart ? "❤" : "•";

    const dx = (Math.random() - 0.5) * 80;
    const dy = (Math.random() - 0.5) * 60;
    span.style.setProperty("--dx", dx + "px");
    span.style.setProperty("--dy", dy + "px");

    containerEl.appendChild(span);
    setTimeout(() => span.remove(), 650);
  }
}

/* Platform detection */

function isTelegramWebApp() {
  return typeof window.Telegram !== "undefined" && window.Telegram.WebApp;
}

function isVKMiniApp() {
  return typeof window.vkBridge !== "undefined";
}

/* AUTH FLOWS */

async function telegramAutoLogin() {
  if (!isTelegramWebApp()) return false;
  const tg = window.Telegram.WebApp;
  const user = tg.initDataUnsafe && tg.initDataUnsafe.user;
  if (!user) return false;

  platformLabel.textContent = "telegram";
  try {
    const data = await api("/api/auth/telegram", {
      method: "POST",
      body: {
        telegramId: user.id,
        firstName: user.first_name,
        username: user.username
      }
    });
    setToken(data.token);
    currentUser = data.user;
    updateUserUI();
    if (logoutBtn) logoutBtn.style.display = "none";
    return true;
  } catch (e) {
    console.error("Ошибка Telegram логина", e);
    return false;
  }
}

async function vkAutoLogin() {
  if (!isVKMiniApp()) return false;

  const bridge = window.vkBridge;
  try {
    await bridge.send("VKWebAppInit");
    const userInfo = await bridge.send("VKWebAppGetUserInfo");

    platformLabel.textContent = "vk miniapp";

    const data = await api("/api/auth/vk", {
      method: "POST",
      body: {
        vkId: userInfo.id,
        firstName: userInfo.first_name,
        lastName: userInfo.last_name,
        username: userInfo.screen_name || null
      }
    });

    setToken(data.token);
    currentUser = data.user;
    updateUserUI();
    if (logoutBtn) logoutBtn.style.display = "none";
    return true;
  } catch (e) {
    console.error("Ошибка VK логина", e);
    return false;
  }
}

// Standalone guest
async function guestAutoLogin() {
  platformLabel.textContent = "standalone";
  if (logoutBtn) logoutBtn.style.display = "inline-flex";

  let guestId = localStorage.getItem("hw_guest_id");
  if (!guestId) {
    guestId = "g_" + Math.random().toString(36).slice(2);
    localStorage.setItem("hw_guest_id", guestId);
  }

  let nickname = localStorage.getItem("hw_guest_name") || "гость";

  try {
    const data = await api("/api/auth/guest", {
      method: "POST",
      body: { guestId, nickname }
    });
    setToken(data.token);
    currentUser = data.user;
    updateUserUI();
  } catch (e) {
    console.error("guest auth failed, using local user only", e);
    currentUser = {
      id: guestId,
      guestId,
      guestName: nickname,
      karma: 0,
      awareness: 0,
      quizCorrect: 0
    };
    updateUserUI();
  }
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("hw_guest_id");
    localStorage.removeItem("hw_guest_name");
    setToken(null);
    currentUser = null;
    guestAutoLogin();
  });
}

/* INIT */

(async function init() {
  try {
    if (await telegramAutoLogin()) return;
    if (await vkAutoLogin()) return;

    const savedToken = localStorage.getItem("hw_awareness_token");
    if (savedToken) {
      setToken(savedToken);
      try {
        const user = await api("/api/user/me");
        currentUser = user;
        updateUserUI();
        if (user.telegramId || user.vkId) {
          if (logoutBtn) logoutBtn.style.display = "none";
        } else {
          if (logoutBtn) logoutBtn.style.display = "inline-flex";
        }
        return;
      } catch (e) {
        setToken(null);
      }
    }

    await guestAutoLogin();
  } catch (e) {
    console.error("init error", e);
  }
})();

/* Кликер кармы */

if (karmaClickBtn) {
  const clickerContainer = karmaClickBtn.closest(".panel-card") || karmaClickBtn.parentElement;

  function registerTouch(ev) {
    const rect = karmaClickBtn.getBoundingClientRect();
    let clientX, clientY;
    if (ev.touches && ev.touches[0]) {
      clientX = ev.touches[0].clientX;
      clientY = ev.touches[0].clientY;
    } else {
      clientX = ev.clientX;
      clientY = ev.clientY;
    }
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    lastTouch = {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y))
    };
  }

  karmaClickBtn.addEventListener("mousedown", registerTouch);
  karmaClickBtn.addEventListener("touchstart", registerTouch);

  karmaClickBtn.addEventListener("click", async (ev) => {
    if (!currentUser) return;

    registerTouch(ev);

    try {
      const data = await api("/api/actions/karma-click", { method: "POST" });
      currentUser.karma = data.karma;
      updateUserUI();
    } catch (e) {
      console.error(e);
    }

    window.hwEnergy = Math.min(1, (window.hwEnergy || 0) + 0.08);
    document.body.classList.add("bg-awake");

    clickerEnergy = Math.min(1, clickerEnergy + 0.2);

    karmaClickBtn.style.transform = "scale(0.97)";
    setTimeout(() => {
      karmaClickBtn.style.transform = "";
    }, 80);

    spawnClickParticles(clickerContainer, 7);
  });
}

/* Колесо */

if (spinBtn) {
  spinBtn.addEventListener("click", async () => {
    if (!currentUser || wheelSpinning) return;
    if ((currentUser.karma ?? 0) < 10) {
      wheelResultEl.textContent = "Сначала набери немного кармы кликером.";
      return;
    }

    wheelSpinning = true;
    wheelResultEl.textContent = "Колесо крутится...";

    const extraTurns = Math.floor(Math.random() * 3) + 2;
    const finalDeg = extraTurns * 360 + Math.floor(Math.random() * 360);
    if (wheelVisual) {
      wheelVisual.style.transform = `rotate(${finalDeg}deg)`;
    }

    try {
      const data = await api("/api/actions/wheel-spin", { method: "POST" });
      setTimeout(() => {
        currentUser.karma = data.user.karma;
        currentUser.awareness = data.user.awareness;
        currentUser.quizCorrect = data.user.quizCorrect;
        updateUserUI();

        wheelResultEl.textContent = data.message || "Спин завершён.";
        const sutra = SUTRAS[Math.floor(Math.random() * SUTRAS.length)];
        sutraBox.textContent = sutra;

        wheelSpinning = false;
      }, 900);
    } catch (e) {
      wheelSpinning = false;
      wheelResultEl.textContent = e.message || "Ошибка спина";
    }
  });
}

/* Викторина */

function renderQuiz(questionObj) {
  quizQuoteEl.textContent = questionObj.quote;
  quizQuestionEl.textContent = questionObj.question;
  quizOptionsEl.innerHTML = "";
  quizStatusEl.textContent = "";
  quizAnswered = false;

  questionObj.options.forEach((opt, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn ghost full";
    btn.textContent = opt;

    btn.addEventListener("click", async () => {
      if (!currentUser || quizAnswered) return;
      quizAnswered = true;

      if (index === questionObj.correctIndex) {
        quizStatusEl.textContent = "✅ Да. Это направление ближе к осознанности.";
        quizStatusEl.style.color = "#8cffb0";

        try {
          const reward = questionObj.reward ?? 1;
          const data = await api("/api/actions/quiz-correct", {
            method: "POST",
            body: { awarenessReward: reward }
          });
          currentUser.karma = data.karma;
          currentUser.awareness = data.awareness;
          currentUser.quizCorrect = data.quizCorrect;
          updateUserUI();
        } catch (e) {
          console.error("Ошибка отправки результата викторины", e);
        }
      } else {
        quizStatusEl.textContent = "🙂 Не совсем. Попробуй посмотреть на цитату ещё глубже.";
        quizStatusEl.style.color = "#ffd48f";
      }
    });

    quizOptionsEl.appendChild(btn);
  });
}

if (newQuestionBtn) {
  newQuestionBtn.addEventListener("click", () => {
    if (!currentUser || (currentUser.karma ?? 0) < 10) {
      quizStatusEl.textContent = "Сначала наработай немного кармы кликером.";
      quizStatusEl.style.color = "#ffd48f";
      return;
    }
    const q = QUIZ_QUESTIONS[Math.floor(Math.random() * QUIZ_QUESTIONS.length)];
    currentQuiz = q;
    renderQuiz(q);
  });
}

/* ОБЩАЯ ГЕОМЕТРИЯ УЗЛА (примерно в форме твоего золотого узла) */

function knotPoint(t, scale, cx, cy) {
  // модифицированная лемниската / “∞-узел”,
  // не идеальная копия, но похожий силуэт
  const a = 1;
  const x = (Math.cos(t) * (2 + Math.cos(2 * t))) / 3;
  const y = (Math.sin(t) * (2 - Math.cos(2 * t))) / 3;
  return {
    x: x * scale + cx,
    y: y * scale + cy
  };
}

/* Фоновый узел */

(function () {
  const canvas = document.getElementById("heartwins");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let width = window.innerWidth;
  let height = window.innerHeight;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  const particles = [];
  const COUNT = 380;

  function createParticle() {
    return {
      t: Math.random() * Math.PI * 2,
      speed: 0.00005 + Math.random() * 0.00012,
      size: 0.3 + Math.random() * 0.6,
      life: Math.random(),
      prevX: null,
      prevY: null
    };
  }

  for (let i = 0; i < COUNT; i++) particles.push(createParticle());

  let lastTime = performance.now();

  function animate(now) {
    const dt = now - lastTime;
    lastTime = now;

    const cx = width / 2;
    const cy = height / 2;
    const scale = Math.min(width, height) * 0.35;

    const energy = Math.max(0, Math.min(1, window.hwEnergy || 0));

    ctx.fillStyle = `rgba(0,0,0,${0.16 + 0.3 * energy})`;
    ctx.fillRect(0, 0, width, height);

    for (let p of particles) {
      p.t += p.speed * dt;
      if (p.t > Math.PI * 2) p.t -= Math.PI * 2;

      p.life += 0.0004 * dt;
      if (p.life > 1) Object.assign(p, createParticle());

      const base = knotPoint(p.t, scale, cx, cy);

      const depth = 0.4 + 0.6 * Math.abs(Math.sin(p.t * 2));
      const radius = p.size * (0.6 + energy) * depth;
      const alpha = (1 - p.life) * (0.25 + 0.55 * energy) * depth;

      const r = 255;
      const g = 215;
      const b = 0;

      if (p.prevX != null) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha * 0.5})`;
        ctx.lineWidth = radius * 0.7;
        ctx.moveTo(p.prevX, p.prevY);
        ctx.lineTo(base.x, base.y);
        ctx.stroke();
      }

      p.prevX = base.x;
      p.prevY = base.y;

      ctx.beginPath();
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.arc(base.x, base.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
})();

/* Узел внутри кнопки (реагирует на касание) */

(function () {
  if (!clickerCanvas) return;
  const ctx = clickerCanvas.getContext("2d");

  let width = 0;
  let height = 0;

  function resize() {
    const rect = clickerCanvas.getBoundingClientRect();
    width = rect.width || 320;
    height = rect.height || 140;
    clickerCanvas.width = width * window.devicePixelRatio;
    clickerCanvas.height = height * window.devicePixelRatio;
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  const particles = [];
  const COUNT = 260;

  function createParticle() {
    return {
      t: Math.random() * Math.PI * 2,
      speed: 0.00015 + Math.random() * 0.00025,
      size: 0.4 + Math.random() * 0.6,
      life: Math.random()
    };
  }
  for (let i = 0; i < COUNT; i++) particles.push(createParticle());

  let lastTime = performance.now();

  function animate(now) {
    const dt = now - lastTime;
    lastTime = now;

    const cx = width * (0.5 + (lastTouch.x - 0.5) * 0.2);
    const cy = height * (0.5 + (lastTouch.y - 0.5) * 0.2);
    const scale = Math.min(width, height) * 0.45;

    clickerEnergy = Math.max(0, clickerEnergy - dt * 0.0004);
    const energy = Math.max(0.1, clickerEnergy);

    ctx.fillStyle = `rgba(12, 4, 24, ${0.22 + 0.4 * energy})`;
    ctx.fillRect(0, 0, width, height);

    for (let p of particles) {
      p.t += p.speed * dt;
      if (p.t > Math.PI * 2) p.t -= Math.PI * 2;

      p.life += 0.0006 * dt;
      if (p.life > 1) Object.assign(p, createParticle());

      const base = knotPoint(p.t, scale, cx, cy);

      const depth = 0.3 + 0.7 * Math.abs(Math.sin(p.t * 2));
      const radius = p.size * (0.5 + energy) * depth;
      const alpha = (1 - p.life) * (0.25 + 0.6 * energy) * depth;

      const r = 255;
      const g = 215;
      const b = 0;

      ctx.beginPath();
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.arc(base.x, base.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
})();

/* Маленький узел в логотипе */

(function () {
  if (!logoCanvas) return;
  const ctx = logoCanvas.getContext("2d");

  let size = 0;

  function resize() {
    const rect = logoCanvas.getBoundingClientRect();
    size = Math.min(rect.width || 32, rect.height || 32);
    logoCanvas.width = size * window.devicePixelRatio;
    logoCanvas.height = size * window.devicePixelRatio;
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  const particles = [];
  const COUNT = 120;

  function createParticle() {
    return {
      t: Math.random() * Math.PI * 2,
      speed: 0.0002 + Math.random() * 0.00035,
      size: 0.25 + Math.random() * 0.4,
      life: Math.random()
    };
  }
  for (let i = 0; i < COUNT; i++) particles.push(createParticle());

  let lastTime = performance.now();

  function animate(now) {
    const dt = now - lastTime;
    lastTime = now;

    const cx = size / 2;
    const cy = size / 2;
    const scale = size * 0.32;

    ctx.clearRect(0, 0, size, size);

    for (let p of particles) {
      p.t += p.speed * dt;
      if (p.t > Math.PI * 2) p.t -= Math.PI * 2;

      p.life += 0.0007 * dt;
      if (p.life > 1) Object.assign(p, createParticle());

      const base = knotPoint(p.t, scale, cx, cy);

      const depth = 0.4 + 0.6 * Math.abs(Math.sin(p.t * 2));
      const radius = p.size * depth;
      const alpha = (1 - p.life) * 0.85 * depth;

      const r = 255;
      const g = 215;
      const b = 0;

      ctx.beginPath();
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.arc(base.x, base.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
})();
