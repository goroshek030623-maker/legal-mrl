module.exports = {
  apps: [
    { name: 'legal-mrl-api', script: 'api/server.ts', interpreter: 'npx', interpreter_args: 'tsx', cwd: '/var/www/legal-mrl' },
    { name: 'legal-mrl-ai', script: 'services/ai/server.js', cwd: '/var/www/legal-mrl' },
    { name: 'legal-mrl-ai-worker', script: 'services/ai/worker.js', cwd: '/var/www/legal-mrl' },
    { name: 'legal-mrl-docgen', script: 'services/docgen/server.js', cwd: '/var/www/legal-mrl' },
    { name: 'legal-mrl-ocr', script: 'services/ocr/server.js', cwd: '/var/www/legal-mrl' },
    { name: 'legal-mrl-ocr-worker', script: 'services/ocr/worker.js', cwd: '/var/www/legal-mrl' }
  ]
}
