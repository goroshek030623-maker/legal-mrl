import OpenAI from 'openai';
const client = new OpenAI({ 
  apiKey: 'sk-J91RCPbHcmnAZQL3Y3e8NKFQLmeTnuCfIEBiatEeJdB4o2pn', 
  baseURL: 'https://api.moonshot.ai/v1' 
});

const r = await client.chat.completions.create({
  model: 'kimi-k2.5',
  messages: [
    {role: 'system', content: 'Ты юрист'},
    {role: 'user', content: 'Напиши претензию в 2 предложения'}
  ],
  max_tokens: 200,
  temperature: 1
});
console.log('Content:', JSON.stringify(r.choices[0].message.content));
console.log('Finish:', r.choices[0].finish_reason);
