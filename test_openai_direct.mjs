import 'dotenv/config'

async function testDirect() {
  const apiKey = process.env.OPENROUTER_API_KEY
  console.log('API KEY:', apiKey?.substring(0, 20) + '...')
  console.log('API KEY length:', apiKey?.length)
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://mrl-ff.ru',
        'X-Title': 'MRL Legal Test'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 5
      })
    })
    
    const data = await response.json()
    console.log('Status:', response.status)
    console.log('Response:', JSON.stringify(data, null, 2))
  } catch (e) {
    console.error('ERROR:', e.message)
  }
}

testDirect()
