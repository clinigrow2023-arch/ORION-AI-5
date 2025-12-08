// Script para ativar todos os usuários que não têm acesso liberado
// Execute: npx tsx scripts/activate-all-users.ts

import 'dotenv/config';
import { prisma } from '../lib/prisma';

async function activateAllUsers() {
  try {
    console.log('🔍 Procurando usuários sem acesso ativo...');
    
    // Buscar todos os usuários que não estão ativos
    const inactiveUsers = await prisma.user.findMany({
      where: {
        isActive: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
      },
    });

    if (inactiveUsers.length === 0) {
      console.log('✅ Todos os usuários já estão ativos!');
      return;
    }

    console.log(`📋 Encontrados ${inactiveUsers.length} usuário(s) sem acesso:`);
    inactiveUsers.forEach((user) => {
      console.log(`   - ${user.name} (${user.email})`);
    });

    // Ativar todos os usuários
    const result = await prisma.user.updateMany({
      where: {
        isActive: false,
      },
      data: {
        isActive: true,
        // Remover data de expiração se existir (não é mais necessária)
        accessExpiresAt: null,
      },
    });

    console.log(`\n✅ ${result.count} usuário(s) ativado(s) com sucesso!`);
    console.log('🎉 Todos os usuários agora podem usar a IA imediatamente.');
  } catch (error) {
    console.error('❌ Erro ao ativar usuários:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o script
activateAllUsers()
  .then(() => {
    console.log('\n✨ Processo concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Falha ao executar script:', error);
    process.exit(1);
  });
