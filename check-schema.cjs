const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'legal_mrl',
    password: '@t+G7s8wWNzV',
    database: 'legal_mrl'
  });
  const [rows] = await conn.execute('DESCRIBE cases');
  console.log(JSON.stringify(rows.map(r => r.Field)));
  await conn.end();
}

main().catch(e => console.error(e.message));
