// Script para criar primeiro usuário admin
// Execute: npx tsx scripts/create-admin.ts

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

async function createAdmin() {
  try {
    console.log('=== Create Admin User ===\n');

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

    // Criar admin
    const admin = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: 'admin',
        credits: 999999, // Créditos ilimitados para admin
        isBlocked: false,
      },
    });

    console.log('\n✅ Admin user created successfully!');
    console.log(`ID: ${admin.id}`);
    console.log(`Email: ${admin.email}`);
    console.log(`Role: ${admin.role}`);
  } catch (error: any) {
    console.error('Error creating admin:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

createAdmin();

