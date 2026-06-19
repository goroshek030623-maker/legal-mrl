const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'legal_mrl',
    password: '@t+G7s8wWNzV',
    database: 'legal_mrl'
  });
  const [rows] = await conn.execute(
    'SELECT id, title, generated_document IS NOT NULL as has_doc FROM cases WHERE id = ?',
    ['6a022723-629a-4e43-b1be-cd4dbec4eeab']
  );
  console.log(JSON.stringify(rows));
  await conn.end();
}

main().catch(e => console.error(e.message));
