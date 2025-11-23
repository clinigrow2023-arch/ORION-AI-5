import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Obter argumentos da linha de comando
const args = process.argv.slice(2);
const userId = args[0] || 'test-user-id';
const email = args[1] || 'test@example.com';
const expiresIn = args[2] || '7d';

// Gerar token JWT
const token = jwt.sign(
  { userId, email },
  JWT_SECRET,
  { expiresIn }
);

console.log('\n✅ JWT Token gerado com sucesso!\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n📋 Token:');
console.log(token);
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n📝 Informações:');
console.log(`   User ID: ${userId}`);
console.log(`   Email: ${email}`);
console.log(`   Expires In: ${expiresIn}`);
console.log(`   Secret: ${JWT_SECRET.substring(0, 20)}...`);
console.log('\n💡 Uso:');
console.log('   npm run generate-jwt [userId] [email] [expiresIn]');
console.log('   Exemplo: npm run generate-jwt "user123" "user@example.com" "7d"');
console.log('\n');

