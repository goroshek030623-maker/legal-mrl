import OpenAI from 'openai';
const client = new OpenAI({ 
  apiKey: 'sk-J91RCPbHcmnAZQL3Y3e8NKFQLmeTnuCfIEBiatEeJdB4o2pn', 
  baseURL: 'https://api.moonshot.ai/v1' 
});

const r = await client.chat.completions.create({
  model: 'kimi-k2.5',
  messages: [
    {role: 'system', content: 'Ты профессиональный юрист. Пиши развёрнуто.'},
    {role: 'user', content: 'Напиши претензию о невыплате зарплаты в 5 предложениях'}
  ],
  max_tokens: 4000,
  temperature: 1
});
console.log('Content length:', r.choices[0].message.content?.length);
console.log('Finish:', r.choices[0].finish_reason);
console.log('Preview:', r.choices[0].message.content?.substring(0, 200));
