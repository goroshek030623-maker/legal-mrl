import { tsImport } from 'tsx/esm/api'

try {
  await tsImport('./api/server.ts', import.meta.url)
  console.log('OK')
} catch(e: any) {
  console.log('ERROR:', e.message)
  console.log(e.stack?.split('\n').slice(0, 8).join('\n'))
}
