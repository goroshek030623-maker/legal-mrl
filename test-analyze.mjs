import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.MOONSHOT_API_KEY,
  baseURL: "https://api.moonshot.ai/v1"
});

async function test() {
  try {
    const completion = await openai.chat.completions.create({
      model: "kimi-k2.5",
      messages: [
        { role: "system", content: "Ты юридический консультант. Даёшь конкретные рекомендации." },
        { role: "user", content: "Проанализируй дело: Тестовое дело. Описание: Тест. Документы: 0. Дай 3 пункта анализа и 4 действия. Формат: ANALYSIS: [текст] ACTIONS: 1. [действие] 2. [действие]" }
      ],
      temperature: 1,
      max_tokens: 1000
    });
    console.log("LENGTH:", completion.choices[0].message.content.length);
    console.log("CONTENT:", completion.choices[0].message.content.substring(0, 500));
  } catch (err) {
    console.error("ERROR:", err.message);
  }
}
test();
