const { OpenAI } = require('openai');
const moonshot = new OpenAI({ apiKey: 'sk-J91RCPbHcmnAZQL3Y3e8NKFQLmeTnuCfIEBiatEeJdB4o2pn', baseURL: 'https://api.moonshot.ai/v1' });

async function test() {
  const start = Date.now();
  try {
    const completion = await moonshot.chat.completions.create({
      model: 'kimi-k2.5',
      messages: [
        { role: 'system', content: 'Ты юрист.\n\nТы профессиональный юрист.' },
        { role: 'user', content: 'Напиши короткую претензию (500 слов)' }
      ],
      temperature: 1,
      max_tokens: 4000,
    });
    const end = Date.now();
    console.log('SUCCESS! Time:', (end - start) / 1000, 's');
    console.log('Content length:', completion.choices[0].message.content?.length);
    console.log('First 200 chars:', completion.choices[0].message.content?.substring(0, 200));
  } catch (e) {
    console.log('ERROR:', e.message);
    console.log('Full error:', e);
  }
}

test();
