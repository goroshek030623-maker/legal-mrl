const jwt = require('jsonwebtoken');

const userId = '060c24c2-0f49-436a-b2d3-62299192b4dc';
const email = 'dokiq@list.ru';
const secret = 'default-secret-key';

const token = jwt.sign(
  { userId, email, isAdmin: false },
  secret,
  { expiresIn: '7d' }
);

console.log(token);
