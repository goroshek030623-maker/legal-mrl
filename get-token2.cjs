const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'legal_mrl',
    password: '@t+G7s8wWNzV',
    database: 'legal_mrl'
  });
  const [rows] = await conn.execute('SELECT id, email FROM users WHERE email = ?', ['test@test.com']);
  if (rows.length > 0) {
    const user = rows[0];
    const token = jwt.sign(
      { userId: user.id, email: user.email, isAdmin: false },
      'default-secret-key',
      { expiresIn: '7d' }
    );
    console.log('TOKEN:', token);
  } else {
    console.log('User not found, checking all users...');
    const [all] = await conn.execute('SELECT id, email FROM users LIMIT 5');
    console.log(all);
  }
  await conn.end();
}

main().catch(e => console.error(e.message));
