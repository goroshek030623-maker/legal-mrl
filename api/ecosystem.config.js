module.exports = {
  apps: [{
    name: legal-mrl-api,
    script: ./api/server.ts,
    interpreter: npx tsx,
    cwd: /var/www/legal-mrl,
    env: {
      NODE_ENV: production
    }
  }]
}
