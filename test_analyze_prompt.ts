import OpenAI from "openai";

(async () => {
  const openai = new OpenAI({
    apiKey: process.env.MOONSHOT_API_KEY || "sk-J91RCPbHcmnAZQL3Y3e8NKFQLmeTnuCfIEBiatEeJdB4o2pn",
    baseURL: "https://api.moonshot.ai/v1"
  });

  const c = { title: "Трудовой договор", description: null };
  const docs = [{ name: "Труд.договор (1).docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }];
  const documentsText = "";

  const prompt = `Проанализируй юридическую ситуацию:
Название: ${c.title}
Описание: ${c.description || "Не указано"}
Документов: ${docs.length}
${documentsText ? "Содержание документов:" + documentsText : "Документы приложены, но текст не извлечён."}
Дай краткий анализ (3-5 пунктов)...
`;

  console.log("Prompt length:", prompt.length);
  console.log("Starting AI call...");
  const start = Date.now();
  try {
    const completion = await openai.chat.completions.create({
      model: "kimi-k2.5",
      messages: [
        { role: "system", content: "Ты юридический консультант. Даёшь конкретные рекомендации." },
        { role: "user", content: prompt }
      ],
      temperature: 1,
      max_tokens: 1000
    });
    const elapsed = Date.now() - start;
    console.log("Elapsed:", elapsed, "ms");
    const generatedText = completion.choices[0].message.content;
    console.log("Generated text length:", generatedText ? generatedText.length : 0);
    console.log("Generated text:", generatedText);
  } catch (e: any) {
    console.log("Error:", e.message);
  }
})();
