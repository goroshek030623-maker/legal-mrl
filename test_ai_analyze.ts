import OpenAI from "openai";

(async () => {
  const openai = new OpenAI({
    apiKey: process.env.MOONSHOT_API_KEY || "sk-J91RCPbHcmnAZQL3Y3e8NKFQLmeTnuCfIEBiatEeJdB4o2pn",
    baseURL: "https://api.moonshot.ai/v1"
  });

  const prompt = `Проанализируй: Трудовой договор. Дай 3 пункта анализа.`;

  console.log("Starting AI test...");
  const start = Date.now();
  try {
    const completion = await openai.chat.completions.create({
      model: "kimi-k2.5",
      messages: [
        { role: "system", content: "Ты юридический консультант." },
        { role: "user", content: prompt }
      ],
      temperature: 1,
      max_tokens: 1000
    });
    const elapsed = Date.now() - start;
    console.log("Elapsed:", elapsed, "ms");
    console.log("Response:", completion.choices[0].message.content);
  } catch (e: any) {
    console.log("Error:", e.message);
    console.log("Full error:", JSON.stringify(e, null, 2));
  }
})();
