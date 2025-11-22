// Script para criar usuário de teste
import 'dotenv/config';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

async function createTestUser() {
  try {
    console.log('=== Create Test User ===\n');

    const name = await question('Name: ');
    const email = await question('Email: ');
    const password = await question('Password: ');

    if (!name || !email || !password) {
      console.error('All fields are required!');
      process.exit(1);
    }

    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      console.error('User with this email already exists!');
      process.exit(1);
    }

    // Hash da senha
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: 'user',
        credits: 10,
        isBlocked: false,
      },
    });

    console.log('\n✅ User created successfully!');
    console.log(`ID: ${user.id}`);
    console.log(`Email: ${user.email}`);
    console.log(`Name: ${user.name}`);
    console.log(`Role: ${user.role}`);
    console.log(`Credits: ${user.credits}`);
  } catch (error: any) {
    console.error('Error creating user:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

createTestUser();

