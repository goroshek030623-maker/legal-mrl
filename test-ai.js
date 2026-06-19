const { OpenAI } = require('openai');
const openai = new OpenAI({
  apiKey: process.env.MOONSHOT_API_KEY,
  baseURL: 'https://api.moonshot.ai/v1'
});

async function test() {
  const completion = await openai.chat.completions.create({
    model: 'kimi-k2.5',
    messages: [
      { role: 'system', content: 'Ты юридический консультант.' },
      { role: 'user', content: 'Проанализируй: Дело о взыскании долга. Документы: договор, расписка.' }
    ],
    temperature: 1,
    max_tokens: 1000
  });
  console.log('RESPONSE:', completion.choices[0].message.content);
}

test().catch(console.error);
