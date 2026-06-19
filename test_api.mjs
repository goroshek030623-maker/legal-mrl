import OpenAI from 'openai';
const client = new OpenAI({ 
  apiKey: 'sk-J91RCPbHcmnAZQL3Y3e8NKFQLmeTnuCfIEBiatEeJdB4o2pn', 
  baseURL: 'https://api.moonshot.cn/v1' 
});

const r = await client.chat.completions.create({
  model: 'kimi-k2.5',
  messages: [{role: 'user', content: 'Напиши 2 предложения'}],
  max_tokens: 100
});
console.log('OK:', r.choices[0].message.content);
