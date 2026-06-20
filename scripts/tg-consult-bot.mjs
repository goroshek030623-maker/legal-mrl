import fs from "fs";

const TOKEN = "7672594324:AAERXd3Jsd5qGKeeV8IDSJkQpL1iqY1UPuQ";
const API_URL = `https://api.telegram.org/bot${TOKEN}`;
const REF_FILE = "/var/www/legal-mrl/data/referrals.json";
const USER_STATE_FILE = "/var/www/legal-mrl/data/user_states.json";

// Ensure data dir exists
fs.mkdirSync("/var/www/legal-mrl/data", { recursive: true });

let MOONSHOT_API_KEY = "";
const envPath = "/var/www/legal-mrl/.env";
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, "utf-8");
  const match = env.match(/MOONSHOT_API_KEY=(.+)/);
  if (match) MOONSHOT_API_KEY = match[1].trim();
}
if (!MOONSHOT_API_KEY) {
  console.error("❌ MOONSHOT_API_KEY not found");
  process.exit(1);
}

let offset = 0;
const processing = new Set();

// Load state
function loadJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf-8")); }
  catch { return {}; }
}
function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const referrals = loadJSON(REF_FILE);
const userStates = loadJSON(USER_STATE_FILE);

async function api(method, body = null) {
  const url = `${API_URL}/${method}`;
  const opts = body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : {};
  const res = await fetch(url, opts);
  return res.json();
}

async function sendMessage(chatId, text, replyTo = null, buttons = null) {
  const body = { chat_id: chatId, text: text.substring(0, 4096), parse_mode: "Markdown" };
  if (replyTo) body.reply_to_message_id = replyTo;
  if (buttons) body.reply_markup = { inline_keyboard: buttons };
  return api("sendMessage", body);
}

async function sendTyping(chatId) {
  return api("sendChatAction", { chat_id: chatId, action: "typing" });
}

async function getAIResponse(question, systemPrompt) {
  const res = await fetch("https://api.moonshot.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${MOONSHOT_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "kimi-k2.5",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question }
      ],
      temperature: 1,
      max_tokens: 1500,
    })
  });
  if (!res.ok) throw new Error(`AI error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "Не удалось получить ответ.";
}

// ─── Referral Logic ─────────────────────────────────────────

function generateRefCode(userId) {
  return `REF${userId}`;
}

function getRefLink(userId) {
  return `https://t.me/DokIQ_bot?start=${generateRefCode(userId)}`;
}

function trackReferral(newUserId, refCode) {
  if (!refCode || !refCode.startsWith("REF")) return;
  const referrerId = refCode.replace("REF", "");
  if (referrerId === String(newUserId)) return;
  
  if (!referrals[referrerId]) referrals[referrerId] = { count: 0, users: [] };
  if (!referrals[referrerId].users.includes(String(newUserId))) {
    referrals[referrerId].count++;
    referrals[referrerId].users.push(String(newUserId));
    saveJSON(REF_FILE, referrals);
    console.log(`[REF] ${referrerId} invited ${newUserId}`);
  }
}

// ─── Free Tips Flow ─────────────────────────────────────────

const TIP_QUESTIONS = [
  "Опишите вашу ситуацию: с кем спор (контрагент, работодатель, сосед)?",
  "Что уже пробовали сделать для решения?",
  "Какой результат вам нужен (взыскать деньги, расторгнуть договор, другое)?"
];

async function handlePrivateMessage(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text || "";
  const firstName = msg.from.first_name || "";
  
  // Start command or ref link
  if (text.startsWith("/start")) {
    const refCode = text.split(" ")[1] || "";
    if (refCode) trackReferral(userId, refCode);
    
    const refLink = getRefLink(userId);
    const invitedCount = referrals[String(userId)]?.count || 0;
    
    await sendMessage(chatId, 
      `⚖️ *Добро пожаловать в DokIQ, ${firstName}!*\n\n` +
      `Я ваш юридический ассистент. Могу:\n` +
      `• Дать 3 бесплатных совета по вашей ситуации\n` +
      `• Составить документ на [dokiq.ru](https://dokiq.ru)\n\n` +
      `🎁 *Реферальная программа:*\n` +
      `Пригласите друга — получите скидку 20%!\n` +
      `Уже приглашено: ${invitedCount}\n\n` +
      `Ваша ссылка:\n\`${refLink}\`\n\n` +
      `Хотите получить 3 бесплатных совета? Напишите "Советы"`
    );
    return;
  }
  
  // Tips flow
  if (text.toLowerCase() === "советы" || text.toLowerCase() === "/tips") {
    userStates[String(userId)] = { step: 0, answers: [] };
    saveJSON(USER_STATE_FILE, userStates);
    await sendMessage(chatId, `💡 *Бесплатная консультация*\n\n${TIP_QUESTIONS[0]}`);
    return;
  }
  
  const state = userStates[String(userId)];
  if (state && state.step < 3) {
    state.answers.push(text);
    state.step++;
    saveJSON(USER_STATE_FILE, userStates);
    
    if (state.step < 3) {
      await sendMessage(chatId, `✅ Принято!\n\n${TIP_QUESTIONS[state.step]}`);
    } else {
      // All answers collected, generate tips
      await sendTyping(chatId);
      const situation = state.answers.join("\n");
      const prompt = `Дай 3 конкретных юридических совета по ситуации:\n${situation}\n\nКаждый совет — 2-3 предложения, с ссылкой на статью закона где уместно.`;
      
      try {
        const answer = await getAIResponse(prompt, "Ты — юрист. Кратко, по делу.");
        await sendMessage(chatId, 
          `⚖️ *Ваши 3 совета:*\n\n${answer}\n\n` +
          `---\n` +
          `💼 *Нужен документ?* Сформируйте на [dokiq.ru](https://dokiq.ru) — от 499 ₽\n\n` +
          `🎁 Промокод на скидку 10%: *DOKIQ10*\n\n` +
          `Пригласите друга и получите ещё 20% скидки!`
        );
      } catch (e) {
        await sendMessage(chatId, "❌ Ошибка генерации. Попробуйте позже.");
      }
      
      delete userStates[String(userId)];
      saveJSON(USER_STATE_FILE, userStates);
    }
    return;
  }
  
  // Default help
  await sendMessage(chatId, 
    `⚖️ *DokIQ — Юридический помощник*\n\n` +
    `Команды:\n` +
    `• /start — главное меню + реферальная ссылка\n` +
    `• Советы — 3 бесплатных совета по вашему делу\n` +
    `• Консультация — в группе канала (для всех)\n\n` +
    `👉 Составить документ: [dokiq.ru](https://dokiq.ru)`
  );
}

// ─── Group Consultation ─────────────────────────────────────

async function handleGroupMessage(msg) {
  const text = msg.text;
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const messageId = msg.message_id;
  
  const lowerText = text.toLowerCase();
  const isTrigger = lowerText.includes("консультация") || lowerText === "/consult" || lowerText.startsWith("/consult@");
  
  if (!isTrigger) return;
  
  const dedupKey = `${chatId}:${userId}`;
  if (processing.has(dedupKey)) return;
  processing.add(dedupKey);
  setTimeout(() => processing.delete(dedupKey), 30000);
  
  let question = text.replace(/консультация/i, "").replace(/\/consult\S*/i, "").trim();
  
  console.log(`[CONSULT] User ${userId}: "${question || "(empty)"}"`);
  
  if (!question) {
    await sendMessage(chatId, 
      `⚖️ *Юридическая консультация*\n\nОпишите ситуацию после слова *Консультация*.\n\n` +
      `Пример: «Консультация: контрагент не платит, что делать?»`, 
      messageId
    );
    return;
  }
  
  await sendTyping(chatId);
  
  try {
    const systemPrompt = "Ты — опытный юрист с 20-летней практикой. Отвечай кратко, по существу, с конкретными рекомендациями. Указывай статьи ГК РФ, ТК РФ, КоАП РФ, ГПК РФ где уместно. Максимум 2500 символов.";
    const answer = await getAIResponse(question, systemPrompt);
    await sendMessage(chatId, 
      answer + "\n\n---\n💼 *Нужен документ?* Сформируйте на [dokiq.ru](https://dokiq.ru) — от 499 ₽\n\n⚠️ Консультация носит информационный характер.", 
      messageId
    );
    console.log("[CONSULT] ✅ Success");
  } catch (e) {
    console.error("[CONSULT] ❌ Error:", e.message);
    await sendMessage(chatId, "❌ Ошибка. Попробуйте позже или [dokiq.ru](https://dokiq.ru)", messageId);
  }
}

// ─── Main Loop ──────────────────────────────────────────────

async function handleUpdate(update) {
  const msg = update.message;
  if (!msg || !msg.text) return;
  
  const chatType = msg.chat.type;
  
  if (chatType === "private") {
    await handlePrivateMessage(msg);
  } else if (chatType === "group" || chatType === "supergroup") {
    await handleGroupMessage(msg);
  }
}

async function poll() {
  try {
    const data = await api(`getUpdates?offset=${offset}&limit=100`);
    if (data.ok && data.result.length > 0) {
      for (const update of data.result) {
        offset = update.update_id + 1;
        await handleUpdate(update).catch(e => console.error("Handle error:", e.message));
      }
    }
  } catch (e) {
    console.error("Poll error:", e.message);
  }
  setTimeout(poll, 1000);
}

console.log("🤖 DokIQ Bot started — Group + Private");
poll();
