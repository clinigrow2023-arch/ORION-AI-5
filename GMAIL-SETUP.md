# Configuração de Email com Gmail

## Como configurar o Gmail para envio de emails

### 1. Criar App Password no Gmail

1. Acesse sua conta Google: https://myaccount.google.com/
2. Vá em **Segurança**
3. Ative a **Verificação em duas etapas** (se ainda não estiver ativada)
4. Role até **Senhas de app**
5. Selecione **Email** e **Outro (nome personalizado)**
6. Digite um nome (ex: "Orion AI")
7. Clique em **Gerar**
8. **Copie a senha gerada** (ela só aparece uma vez!)

### 2. Configurar variáveis de ambiente

Adicione ao seu arquivo `.env`:

```env
# Gmail Configuration
GMAIL_USER=seu-email@gmail.com
GMAIL_PASS=senha-de-app-gerada-aqui
```

**IMPORTANTE:**
- Use o **App Password**, não a senha normal da sua conta
- A senha de app tem 16 caracteres (sem espaços)
- Mantenha essas variáveis seguras e nunca as commite no Git

### 3. Variáveis de ambiente no Vercel (produção)

1. Acesse seu projeto no Vercel
2. Vá em **Settings** → **Environment Variables**
3. Adicione:
   - `GMAIL_USER` = seu-email@gmail.com
   - `GMAIL_PASS` = senha-de-app-gerada

### 4. Como funciona

#### Novo usuário (não tem conta):
- Sistema cria conta automaticamente
- Gera senha temporária
- **Envia email** com:
  - Email do usuário
  - Senha temporária
  - Link para login
  - Instruções para trocar senha no primeiro login

#### Usuário existente (já tem conta):
- Sistema atualiza dados de assinatura
- Libera acesso (desbloqueia se estava bloqueado)
- **Envia email** informando:
  - Que acesso foi liberado
  - Que pode usar a plataforma
  - Link para login
  - Instrução para usar credenciais habituais

### 5. Testar envio de email

1. Configure as variáveis de ambiente
2. Reinicie o servidor
3. Faça um teste de compra na DigiStore
4. Verifique se o email foi recebido

### 6. Troubleshooting

**Email não está sendo enviado:**
- Verifique se `GMAIL_USER` e `GMAIL_PASS` estão configurados
- Verifique se a senha de app está correta (16 caracteres)
- Verifique os logs do servidor para erros
- Confirme que a verificação em duas etapas está ativada

**Erro de autenticação:**
- Certifique-se de estar usando App Password, não senha normal
- Verifique se a verificação em duas etapas está ativada
- Gere uma nova senha de app se necessário

**Emails indo para spam:**
- Isso é normal no início
- Adicione o remetente aos contatos
- Configure SPF/DKIM se tiver domínio próprio (opcional)

### 7. Segurança

- **NUNCA** commite `GMAIL_PASS` no Git
- Use senhas de app diferentes para desenvolvimento e produção
- Revogue senhas de app antigas se suspeitar de comprometimento
- Monitore logs para detectar uso não autorizado

