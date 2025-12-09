# Integração DigiStore IPN - Documentação Completa

## Visão Geral

A integração com DigiStore IPN permite gerenciar automaticamente o acesso dos usuários baseado em pagamentos, reembolsos, chargebacks e cancelamentos de assinatura.

## Funcionalidades Implementadas

### 1. **on_payment** - Pagamento Recebido

Quando um cliente paga:

- ✅ Cria conta automaticamente (se não existir)
- ✅ Ativa conta existente (se estiver inativa)
- ✅ Salva dados de assinatura:
  - `digistoreOrderId`: ID do pedido
  - `subscriptionStatus`: "active"
  - `lastPaymentDate`: Data do pagamento
  - `nextPaymentDate`: Próxima data de pagamento (para assinaturas recorrentes)
  - `productId`: ID do produto comprado
  - `billingType`: Tipo de cobrança (one_time, recurring, etc)
- ✅ Gera senha temporária e envia para o cliente via email DigiStore
- ✅ Usuário pode usar a IA imediatamente após pagamento

### 2. **on_payment_missed** - Pagamento Perdido

Quando um cliente não paga:

- ✅ Desativa a conta (`isActive: false`)
- ✅ Bloqueia acesso (`isBlocked: true`)
- ✅ Atualiza status: `subscriptionStatus: "payment_missed"`
- ✅ Remove próxima data de pagamento

### 3. **on_refund** - Reembolso

Quando há reembolso:

- ✅ Desativa a conta
- ✅ Bloqueia acesso
- ✅ Atualiza status: `subscriptionStatus: "refunded"`
- ✅ Remove próxima data de pagamento

### 4. **on_chargeback** - Estorno

Quando há chargeback:

- ✅ Desativa a conta
- ✅ Bloqueia acesso
- ✅ Atualiza status: `subscriptionStatus: "chargeback"`
- ✅ Remove próxima data de pagamento

### 5. **on_rebill_cancelled** - Assinatura Cancelada

Quando cliente cancela assinatura:

- ✅ Desativa a conta
- ✅ Bloqueia acesso
- ✅ Atualiza status: `subscriptionStatus: "cancelled"`
- ✅ Remove próxima data de pagamento

### 6. **on_rebill_resumed** - Assinatura Retomada

Quando cliente retoma pagamento:

- ✅ Reativa a conta (`isActive: true`)
- ✅ Desbloqueia acesso (`isBlocked: false`)
- ✅ Atualiza status: `subscriptionStatus: "active"`
- ✅ Atualiza `lastPaymentDate` e `nextPaymentDate`

## Schema do Banco de Dados

Novos campos adicionados ao modelo `User`:

```prisma
// Campos de assinatura DigiStore
digistoreOrderId    String?  // ID do pedido na DigiStore
subscriptionStatus  String?  // "active", "cancelled", "payment_missed", "refunded", "chargeback"
lastPaymentDate     DateTime? // Data do último pagamento
nextPaymentDate     DateTime? // Próxima data de pagamento (para assinaturas recorrentes)
productId           String?  // ID do produto comprado
billingType         String?  // "one_time", "recurring", etc
```

## Configuração

### 1. Variáveis de Ambiente

No Vercel, configure:

```env
DIGISTORE_IPN_PASSPHRASE=your_digistore_ipn_passphrase
SITE_URL=https://your-site.vercel.app
```

### 2. Configuração na DigiStore

**⚠️ IMPORTANTE:** A DigiStore **NÃO aceita** URLs de túneis temporários (como Cloudflare Tunnel `.trycloudflare.com`). Você **DEVE** usar a URL de produção do Vercel.

1. Acesse: https://www.digistore24.com/settings/ipn
2. Configure a URL do IPN com sua URL de **produção do Vercel**:
   ```
   https://your-site.vercel.app/api/digistore-ipn
   ```
   **❌ NÃO use:** `https://*.trycloudflare.com/api/digistore-ipn` (não será aceito)
   **✅ USE:** `https://seu-dominio-vercel.vercel.app/api/digistore-ipn`
3. Configure IPN timing: **"Before redirect to thankyou page"**
4. Configure "group by upsells": **NO** (importante para enviar dados de acesso por email)
5. Configure o IPN Passphrase (mesmo valor de `DIGISTORE_IPN_PASSPHRASE`)

**Nota sobre Cloudflare Tunnel:**

- O Cloudflare Tunnel é apenas para **desenvolvimento/testes locais**
- Para **produção**, você **DEVE** fazer deploy no Vercel e usar a URL de produção
- A DigiStore valida o domínio e rejeita domínios temporários por segurança

### 3. Atualizar Banco de Dados

Após fazer deploy, execute:

```bash
npm run db:push
```

Isso aplicará as mudanças do schema ao banco de dados MongoDB.

## Fluxo de Funcionamento

### Pagamento Bem-Sucedido

1. Cliente faz pagamento na DigiStore
2. DigiStore envia IPN `on_payment` para `/api/digistore-ipn`
3. Sistema cria/ativa usuário automaticamente
4. Sistema retorna dados de acesso (email e senha temporária)
5. DigiStore envia email ao cliente com dados de acesso
6. Cliente pode fazer login e usar a IA imediatamente

### Pagamento Perdido / Cancelamento

1. Cliente não paga ou cancela assinatura
2. DigiStore envia IPN (`on_payment_missed` ou `on_rebill_cancelled`)
3. Sistema desativa e bloqueia a conta automaticamente
4. Cliente perde acesso imediatamente

### Reembolso / Chargeback

1. Cliente solicita reembolso ou há chargeback
2. DigiStore envia IPN (`on_refund` ou `on_chargeback`)
3. Sistema desativa e bloqueia a conta automaticamente
4. Cliente perde acesso imediatamente

## Testes

### Teste de Conexão

A DigiStore permite testar a conexão IPN. O endpoint retorna `OK` para `connection_test`.

### Teste de Pagamento

1. Faça um pagamento de teste na DigiStore
2. Verifique os logs do Vercel para confirmar que o IPN foi recebido
3. Verifique se o usuário foi criado/ativado no banco de dados
4. Verifique se o email com dados de acesso foi enviado

## Logs e Monitoramento

Todos os eventos são logados no console do Vercel:

- `DigiStore IPN received`: Quando IPN é recebido
- `DigiStore IPN - Payment received`: Quando pagamento é processado
- `User created from DigiStore payment`: Quando novo usuário é criado
- `User activated with new temporary password`: Quando usuário é reativado
- `User deactivated and blocked due to missed payment`: Quando acesso é removido

## Segurança

- ✅ Validação de assinatura SHA512 (se `DIGISTORE_IPN_PASSPHRASE` estiver configurado)
- ✅ Validação de formato de email
- ✅ Validação de campos obrigatórios
- ✅ Busca de usuário por `orderId` ou `email` para evitar duplicatas

## Troubleshooting

### Erro: "O domínio da URL não é confiável" (DS8-390078)

**Problema:** A DigiStore rejeita URLs de túneis temporários como Cloudflare Tunnel.

**Solução:**

- ✅ Use a URL de **produção do Vercel**: `https://seu-site.vercel.app/api/digistore-ipn`
- ❌ **NÃO use** URLs de túneis: `https://*.trycloudflare.com/api/digistore-ipn`
- Faça deploy no Vercel primeiro, depois configure o IPN com a URL de produção

### IPN não está sendo recebido

1. Verifique se a URL está correta no painel DigiStore (deve ser URL de produção do Vercel)
2. Verifique se o endpoint está acessível publicamente (teste acessando a URL no navegador)
3. Verifique os logs do Vercel para erros
4. Certifique-se de que fez deploy no Vercel antes de configurar o IPN

### Usuário não está sendo criado

1. Verifique os logs do Vercel para erros
2. Verifique se `DATABASE_URL` está configurado corretamente
3. Verifique se o schema foi atualizado no banco (`npm run db:push`)

### Email não está sendo enviado

1. Verifique se "group by upsells" está configurado como **NO**
2. Verifique se IPN timing está como **"Before redirect to thankyou page"**
3. Verifique se a resposta do IPN está no formato correto

## Próximos Passos

- [ ] Adicionar webhook para notificar admin sobre novos pagamentos
- [ ] Adicionar dashboard para visualizar assinaturas ativas
- [ ] Adicionar notificação por email quando acesso é removido
- [ ] Adicionar período de graça antes de bloquear por pagamento perdido
