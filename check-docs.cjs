const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'legal_mrl',
    password: '@t+G7s8wWNzV',
    database: 'legal_mrl'
  });
  
  const caseId = '6a022723-629a-4e43-b1be-cd4dbec4eeab';
  const [docs] = await conn.execute(
    'SELECT id, name, path FROM documents WHERE case_id = ?',
    [caseId]
  );
  console.log('Documents:', JSON.stringify(docs));
  await conn.end();
}

main().catch(e => console.error(e.message));
