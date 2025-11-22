// Script para corrigir DATABASE_URL duplicada no .env
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(process.cwd(), '.env');

if (!fs.existsSync(envPath)) {
  console.error('❌ Arquivo .env não encontrado!');
  process.exit(1);
}

let envContent = fs.readFileSync(envPath, 'utf-8');
const lines = envContent.split('\n');

let fixed = false;
const newLines = lines.map(line => {
  // Se a linha começa com DATABASE_URL e contém DATABASE_URL= novamente no valor
  if (line.trim().startsWith('DATABASE_URL=') && line.includes('DATABASE_URL=mongodb')) {
    // Extrair apenas a parte após o segundo DATABASE_URL=
    const match = line.match(/DATABASE_URL=(DATABASE_URL=)?(.+)/);
    if (match && match[2]) {
      fixed = true;
      return `DATABASE_URL=${match[2].trim()}`;
    }
  }
  return line;
});

if (fixed) {
  fs.writeFileSync(envPath, newLines.join('\n'), 'utf-8');
  console.log('✅ DATABASE_URL corrigida no arquivo .env');
  console.log('📝 Nova linha:');
  const newLine = newLines.find(l => l.trim().startsWith('DATABASE_URL='));
  if (newLine) {
    console.log(`   ${newLine.trim()}`);
  }
} else {
  console.log('ℹ️  DATABASE_URL parece estar correta ou não foi encontrada duplicação');
}

