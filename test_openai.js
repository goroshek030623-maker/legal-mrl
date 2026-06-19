require('dotenv/config')
const OpenAI = require('openai')
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
})

async function test() {
  console.log('API KEY:', process.env.OPENROUTER_API_KEY?.substring(0, 20) + '...')
  try {
    const completion = await openai.chat.completions.create({
      model: 'deepseek/deepseek-chat',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 5
    })
    console.log('SUCCESS:', completion.choices[0].message.content)
  } catch (e) {
    console.error('ERROR:', e.status, e.message)
  }
}

test()
