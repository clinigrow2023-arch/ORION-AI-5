# Guia de Testes - DigiStore IPN

## Opções para Testar

### Opção 1: Deploy em Staging no Vercel (Recomendado)

A melhor forma de testar é fazer deploy em um ambiente de staging no Vercel:

1. **Criar um projeto de preview no Vercel:**

   ```bash
   # Fazer deploy da branch de desenvolvimento
   vercel --prod=false
   ```

   Isso criará uma URL temporária como: `https://orion-ai-5-git-feature-digistore-ipn-integration.vercel.app`

2. **Usar a URL de preview para testes:**

   - A DigiStore pode aceitar URLs do Vercel (mesmo preview)
   - Configure o IPN com: `https://sua-preview-url.vercel.app/api/digistore-ipn`
   - Teste os eventos de pagamento

3. **Vantagens:**
   - ✅ URL real do Vercel (pode ser aceita pela DigiStore)
   - ✅ Ambiente idêntico à produção
   - ✅ Logs completos no Vercel
   - ✅ Fácil de iterar e testar

### Opção 2: Usar ngrok (Alternativa ao Cloudflare Tunnel)

O ngrok pode funcionar melhor que Cloudflare Tunnel para testes com DigiStore:

1. **Instalar ngrok:**

   ```bash
   # Windows: Baixe de https://ngrok.com/download
   # Ou use chocolatey: choco install ngrok
   ```

2. **Iniciar servidor local:**

   ```bash
   npm run dev
   ```

3. **Criar túnel ngrok:**

   ```bash
   ngrok http 3000
   ```

4. **Usar URL do ngrok:**
   - ngrok fornece URLs como: `https://abc123.ngrok.io`
   - **Nota:** A DigiStore pode ainda rejeitar, mas ngrok tem melhor reputação que Cloudflare Tunnel
   - Configure: `https://sua-url-ngrok.ngrok.io/api/digistore-ipn`

### Opção 3: Teste Manual com cURL/Postman

Você pode simular eventos IPN manualmente para testar a lógica:

1. **Teste de conexão:**

   ```bash
   curl -X POST https://seu-site.vercel.app/api/digistore-ipn \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "event=connection_test"
   ```

   Deve retornar: `OK`

2. **Simular pagamento:**

   ```bash
   curl -X POST https://seu-site.vercel.app/api/digistore-ipn \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "event=on_payment&order_id=TEST123&email=teste@example.com&address_first_name=João&address_last_name=Silva&product_id=123&product_name=Produto Teste&billing_type=one_time&api_mode=test"
   ```

3. **Simular pagamento perdido:**
   ```bash
   curl -X POST https://seu-site.vercel.app/api/digistore-ipn \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "event=on_payment_missed&order_id=TEST123&email=teste@example.com&api_mode=test"
   ```

### Opção 4: Usar Modo de Teste da DigiStore

A DigiStore tem um modo de teste que permite simular eventos:

1. **Configurar IPN em modo de teste:**

   - No painel DigiStore, configure o IPN com `api_mode=test`
   - Faça um pagamento de teste
   - O IPN será enviado com `api_mode=test`

2. **Verificar logs:**
   - Todos os eventos de teste são logados no Vercel
   - Verifique se o usuário foi criado/atualizado corretamente

## Script de Teste Automatizado

Crie um script para testar todos os eventos:

```bash
# test-digistore-ipn.sh
#!/bin/bash

BASE_URL="https://seu-site.vercel.app/api/digistore-ipn"

echo "🧪 Testando DigiStore IPN..."

# Teste 1: Connection Test
echo "1. Testando connection_test..."
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "event=connection_test"
echo -e "\n"

# Teste 2: Payment
echo "2. Testando on_payment..."
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "event=on_payment&order_id=TEST-$(date +%s)&email=teste@example.com&address_first_name=João&address_last_name=Silva&product_id=123&product_name=Produto Teste&billing_type=one_time&api_mode=test"
echo -e "\n"

# Teste 3: Payment Missed
echo "3. Testando on_payment_missed..."
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "event=on_payment_missed&order_id=TEST-$(date +%s)&email=teste@example.com&api_mode=test"
echo -e "\n"
```

## Checklist de Testes

### ✅ Testes Básicos

- [ ] **Connection Test**: Endpoint responde `OK`
- [ ] **on_payment**: Cria usuário novo corretamente
- [ ] **on_payment**: Ativa usuário existente inativo
- [ ] **on_payment**: Atualiza dados de assinatura para usuário ativo
- [ ] **on_payment_missed**: Desativa e bloqueia usuário
- [ ] **on_refund**: Remove acesso do usuário
- [ ] **on_chargeback**: Remove acesso do usuário
- [ ] **on_rebill_cancelled**: Cancela assinatura e remove acesso
- [ ] **on_rebill_resumed**: Reativa usuário

### ✅ Testes de Validação

- [ ] **Email inválido**: Retorna erro 400
- [ ] **Campos obrigatórios faltando**: Retorna erro 400
- [ ] **Assinatura SHA inválida**: Retorna erro 400 (se passphrase configurado)
- [ ] **Método HTTP incorreto**: Retorna erro 405

### ✅ Testes de Dados

- [ ] **Dados de assinatura salvos corretamente**:
  - [ ] `digistoreOrderId` salvo
  - [ ] `subscriptionStatus` atualizado
  - [ ] `lastPaymentDate` salvo
  - [ ] `nextPaymentDate` salvo (para recorrentes)
  - [ ] `productId` salvo
  - [ ] `billingType` salvo

## Verificação no Banco de Dados

Após cada teste, verifique no banco:

```bash
# Usando Prisma Studio
npm run db:studio
```

Ou via MongoDB:

```javascript
// Verificar usuário criado
db.users.findOne({ email: "teste@example.com" });

// Verificar status de assinatura
db.users.find({ subscriptionStatus: "active" });

// Verificar usuários bloqueados
db.users.find({ isBlocked: true });
```

## Logs para Monitorar

No Vercel, monitore os logs para:

- ✅ `DigiStore IPN received` - IPN foi recebido
- ✅ `User created from DigiStore payment` - Usuário criado
- ✅ `User activated with new temporary password` - Usuário reativado
- ✅ `User deactivated and blocked` - Acesso removido
- ❌ Erros de validação ou banco de dados

## Testes em Produção

**⚠️ CUIDADO:** Antes de testar em produção:

1. Use `api_mode=test` quando possível
2. Use emails de teste (não emails reais de clientes)
3. Monitore os logs cuidadosamente
4. Tenha um plano de rollback se algo der errado

## Troubleshooting de Testes

### IPN não está sendo recebido

1. Verifique se a URL está acessível publicamente
2. Verifique se o endpoint está respondendo (teste com curl)
3. Verifique os logs do Vercel
4. Verifique se há firewall bloqueando

### Usuário não está sendo criado

1. Verifique os logs do Vercel para erros
2. Verifique se `DATABASE_URL` está configurado
3. Verifique se o schema foi atualizado (`npm run db:push`)
4. Verifique se os campos obrigatórios estão sendo enviados

### Erro de assinatura SHA

1. Verifique se `DIGISTORE_IPN_PASSPHRASE` está configurado corretamente
2. Verifique se o passphrase na DigiStore é o mesmo
3. Para testes, você pode desabilitar temporariamente a validação (removendo o passphrase)

## Próximos Passos

Após testes bem-sucedidos:

1. ✅ Fazer deploy em produção
2. ✅ Configurar IPN na DigiStore com URL de produção
3. ✅ Fazer um pagamento de teste real
4. ✅ Verificar se tudo funciona corretamente
5. ✅ Monitorar logs nas primeiras horas/dias
