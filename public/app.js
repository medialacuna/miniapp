const API_BASE = ""; // same origin

let authToken = null;
let currentUser = null;
let wheelSpinning = false;
let currentQuiz = null;
let quizAnswered = false;

// "Энергия" для фонового облака
window.hwEnergy = 0;
// "Энергия" для облака в кликере
let clickerEnergy = 0;
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
    logoutBtn.style.display = "none";
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
    logoutBtn.style.display = "none";
    return true;
  } catch (e) {
    console.error("Ошибка VK логина", e);
    return false;
  }
}

// Standalone guest
async function guestAutoLogin() {
  platformLabel.textContent = "standalone";
  logoutBtn.style.display = "inline-flex";

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
    // локальный пользователь, если бэкенд вдруг недоступен
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
    // 1) Telegram Mini App
    if (await telegramAutoLogin()) return;

    // 2) VK Mini App
    if (await vkAutoLogin()) return;

    // 3) Если есть сохранённый токен — пробуем
    const savedToken = localStorage.getItem("hw_awareness_token");
    if (savedToken) {
      setToken(savedToken);
      try {
        const user = await api("/api/user/me");
        currentUser = user;
        updateUserUI();
        if (user.telegramId || user.vkId) {
          logoutBtn.style.display = "none";
        } else {
          logoutBtn.style.display = "inline-flex";
        }
        return;
      } catch (e) {
        setToken(null);
      }
    }

    // 4) Standalone guest
    await guestAutoLogin();
  } catch (e) {
    console.error("init error", e);
  }
})();

/* Кликер кармы */

if (karmaClickBtn) {
  const clickerContainer = karmaClickBtn.closest(".panel-card") || karmaClickBtn.parentElement;

  karmaClickBtn.addEventListener("click", async (ev) => {
    if (!currentUser) {
      // если по какой-то причине ещё не успели авторизоваться
      return;
    }

    // координаты внутри кнопки (0..1)
    const rect = karmaClickBtn.getBoundingClientRect();
    const x = (ev.clientX - rect.left) / rect.width;
    const y = (ev.clientY - rect.top) / rect.height;
    lastTouch = { x, y };

    try {
      const data = await api("/api/actions/karma-click", { method: "POST" });
      currentUser.karma = data.karma;
      updateUserUI();
    } catch (e) {
      console.error(e);
    }

    // оживляем фон
    window.hwEnergy = Math.min(1, (window.hwEnergy || 0) + 0.08);
    document.body.classList.add("bg-awake");

    // энергия кликера
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
    // не даём крутить колесо до 10 кармы
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

/* Фон — облако точек / сердец, чувствительное к hwEnergy */

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

  function heartPointBase(t, scale, cx, cy) {
    let x = 16 * Math.pow(Math.sin(t), 3);
    let y = 13 * Math.cos(t)
          - 5 * Math.cos(2 * t)
          - 2 * Math.cos(3 * t)
          - Math.cos(4 * t);
    return {
      x: x * scale + cx,
      y: -y * scale + cy
    };
  }

  function heartPointDouble(t, scale, cx, cy, branch) {
    const p = heartPointBase(t, scale, cx, cy);
    if (branch === 0) return p;
    const reflectedY = 2 * cy - p.y;
    return { x: p.x, y: reflectedY + 12 * scale };
  }

  const particles = [];
  const PARTICLE_COUNT = 350;

  function createParticle() {
    return {
      t: Math.random() * Math.PI * 2,
      speed: 0.00007 + Math.random() * 0.00015,
      branch: Math.random() < 0.5 ? 0 : 1,
      size: 0.25 + Math.random() * 0.45,
      life: Math.random(),
      offsetX: (Math.random() - 0.5) * 0.8,
      offsetY: (Math.random() - 0.5) * 0.8,
      prevX: null,
      prevY: null
    };
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(createParticle());

  let lastTime = performance.now();
  let startTime = lastTime;

  const CYCLE_DURATION = 120000;
  const MAX_ANGULAR_SPEED_Y = 0.008;
  const MAX_ANGULAR_SPEED_X = 0.006;
  const MIN_SPEED_START = 0.4;
  const MIN_SPEED_END   = 0.02;

  let angleY = 0;
  let angleX = 0;

  function animate(now) {
    const dt = now - lastTime;
    lastTime = now;
    const cx = width / 2;
    const cy = height / 2;

    const R = 30;
    const scale = Math.min(width, height) * 0.9 / (2 * R);
    const Rpx = R * scale;

    const elapsed = (now - startTime) % CYCLE_DURATION;
    const phase = elapsed / CYCLE_DURATION;

    let speedFactor;
    if (phase <= 0.5) {
      speedFactor = MIN_SPEED_START + (1 - MIN_SPEED_START) * (phase / 0.5);
    } else {
      speedFactor = 1 - (1 - MIN_SPEED_END) * ((phase - 0.5) / 0.5);
    }

    const angularSpeedY = MAX_ANGULAR_SPEED_Y * speedFactor;
    const angularSpeedX = MAX_ANGULAR_SPEED_X * speedFactor;

    const energy = Math.max(0, Math.min(1, window.hwEnergy || 0));

    let trailAlpha;
    if (phase <= 0.5) {
      const u = phase / 0.5;
      trailAlpha = 0.018 - 0.01 * u;
    } else {
      const u = (phase - 0.5) / 0.5;
      trailAlpha = 0.008 + (0.8 - 0.008) * u;
    }
    trailAlpha *= 0.3 + 0.7 * energy;

    ctx.fillStyle = `rgba(0,0,0,${trailAlpha})`;
    ctx.fillRect(0, 0, width, height);

    let dustFactor = phase <= 0.5 ? 1 : 1 - 0.8 * ((phase - 0.5) / 0.5);
    dustFactor *= 0.2 + 0.8 * energy;

    angleY += angularSpeedY * dt;
    angleX += angularSpeedX * dt;

    const cosY = Math.cos(angleY), sinY = Math.sin(angleY);
    const cosX = Math.cos(angleX), sinX = Math.sin(angleX);

    for (let p of particles) {
      p.t += p.speed * dt;
      if (p.t > Math.PI * 2) p.t -= Math.PI * 2;

      p.life += 0.0004 * dt;
      if (p.life > 1) Object.assign(p, createParticle());

      const base = heartPointDouble(p.t, scale, cx, cy, p.branch);
      let dx = (base.x + p.offsetX * scale) - cx;
      let dy = (base.y + p.offsetY * scale) - cy;
      let dz = 0;

      let x1 = dx * cosY + dz * sinY;
      let z1 = -dx * sinY + dz * cosY;

      let y2 = dy * cosX - z1 * sinX;
      let z2 = dy * sinX + z1 * cosX;

      let depth = (z2 + Rpx) / (2 * Rpx);
      depth = Math.max(0, Math.min(1, depth));

      const persp = 0.7 + 0.6 * depth;
      const sizeDepth = 0.5 + 0.9 * depth;
      const alphaDepth = 0.2 + 0.8 * depth;

      const xF = cx + x1 * persp;
      const yF = cy + y2 * persp;

      let r,g,b;
      if (p.branch === 0) {
        r = 255; g = 215; b = 0;
      } else {
        r = 255; g = 150; b = 180;
      }

      if (p.prevX != null) {
        ctx.beginPath();
        const tailA = 0.25 * alphaDepth * dustFactor;
        ctx.strokeStyle = `rgba(${r},${g},${b},${tailA})`;
        ctx.lineWidth = p.size * 2 * sizeDepth * dustFactor;
        ctx.moveTo(p.prevX, p.prevY);
        ctx.lineTo(xF, yF);
        ctx.stroke();
      }

      p.prevX = xF;
      p.prevY = yF;

      const alpha = (1 - p.life) * 0.9 * dustFactor * alphaDepth;
      const radius = p.size * sizeDepth * dustFactor;

      ctx.beginPath();
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.arc(xF, yF, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
})();

/* Облако точек прямо внутри кнопки кликера */

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

  function heartPointBase(t, scale, cx, cy) {
    let x = 16 * Math.pow(Math.sin(t), 3);
    let y = 13 * Math.cos(t)
          - 5 * Math.cos(2 * t)
          - 2 * Math.cos(3 * t)
          - Math.cos(4 * t);
    return {
      x: x * scale + cx,
      y: -y * scale + cy
    };
  }

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

    const cx = width / 2 + (lastTouch.x - 0.5) * width * 0.2;
    const cy = height / 2 + (lastTouch.y - 0.5) * height * 0.2;
    const R = 30;
    const scale = Math.min(width, height) * 0.55 / R;

    // затухание энергии
    clickerEnergy = Math.max(0, clickerEnergy - dt * 0.0004);
    const energy = Math.max(0.1, clickerEnergy);

    ctx.fillStyle = `rgba(12, 4, 24, ${0.22 + 0.3 * energy})`;
    ctx.fillRect(0, 0, width, height);

    for (let p of particles) {
      p.t += p.speed * dt;
      if (p.t > Math.PI * 2) p.t -= Math.PI * 2;

      p.life += 0.0006 * dt;
      if (p.life > 1) {
        Object.assign(p, createParticle());
      }

      const base = heartPointBase(p.t, scale, cx, cy);

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
