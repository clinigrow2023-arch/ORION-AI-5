# 🚀 Guia de Deploy - Vercel

Este projeto está configurado para rodar na **Vercel**:

- ✅ Frontend (React/Vite)
- ✅ Backend (Vercel Serverless Functions)
- ✅ Database (MongoDB Atlas - externo)

## 📋 Pré-requisitos

1. Conta no [Vercel](https://vercel.com/)
2. Conta no [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (gratuito)
3. Repositório no GitHub

## 🔧 Configuração na Vercel

### 1. Conectar Repositório

1. Acesse [Vercel Dashboard](https://vercel.com/dashboard)
2. Clique em **"Add New Project"**
3. Conecte seu repositório GitHub
4. A Vercel detectará automaticamente o framework (Vite)

### 2. Configurar Variáveis de Ambiente

No Vercel Dashboard, vá em **Settings** → **Environment Variables** e adicione:

```env
# API Keys (obrigatórias)
GEMINI_API_KEY=sua_chave_gemini_aqui
GROK_API_KEY=sua_chave_grok_aqui
GROQ_API_KEY=sua_chave_groq_aqui
OPENAI_API_KEY=sua_chave_openai_aqui
DEEPSEEK_API_KEY=sua_chave_deepseek_aqui
LAOZANG_API_KEY=sua_chave_laozang_aqui

# Database (obrigatória)
DATABASE_URL=mongodb+srv://user:password@cluster.mongodb.net/orionai?appName=OrionAI

# Security (obrigatória)
JWT_SECRET=seu_jwt_secret_super_seguro_aqui_mude_em_producao

# Site URL (obrigatória)
SITE_URL=https://seu-projeto.vercel.app

# DigiStore (opcional)
DIGISTORE_IPN_PASSPHRASE=sua_digistore_ipn_passphrase
```

**⚠️ IMPORTANTE:**

- `DATABASE_URL` deve incluir o nome do banco (ex: `/orionai`)
- `JWT_SECRET` deve ser uma string aleatória e segura
- `SITE_URL` deve ser a URL do seu projeto na Vercel
- Use caracteres especiais e números para maior segurança

### 3. Configurações de Build (Já configurado no vercel.json)

O arquivo `vercel.json` já está configurado:

- **Build command**: `npm run build`
- **Output directory**: `dist`
- **Framework**: `vite`
- **Rewrites**: `/api/*` para serverless functions

## 🏗️ Processo de Deploy

### Deploy Automático (Recomendado)

1. Faça push para a branch `main` no GitHub
2. A Vercel detectará automaticamente e fará o deploy
3. O build irá:
   - Instalar dependências (`npm install`)
   - Gerar Prisma Client (`prisma generate` - automático via postinstall)
   - Build do frontend (`npm run build`)
   - Deploy das Vercel Serverless Functions

### Deploy Manual

1. No Vercel Dashboard, vá em **Deployments**
2. Clique em **"Redeploy"** → **"Redeploy"**

## 📁 Estrutura de API Routes

As funções serverless estão em `/api`:

- `/api/auth-login` - Login
- `/api/auth-register` - Registro
- `/api/auth-verify` - Verificação de token
- `/api/gemini` - Chat com IA (com fallback automático)
- `/api/conversations` - Gerenciamento de conversas
- `/api/admin-users` - Painel admin
- `/api/change-password` - Alterar senha
- `/api/set-new-password` - Definir nova senha após reset
- `/api/digistore-ipn` - Webhook DigiStore

## 🔄 Fallback de IA

O sistema tem fallback automático entre múltiplos providers:

1. **Gemini** (Google) - Primário
2. **Grok** (xAI) - Fallback 1
3. **Groq** - Fallback 2
4. **OpenAI** - Fallback 3
5. **Deep Seek** - Fallback 4
6. **Laozang** - Fallback 5

Se um provider falhar ou exceder limite, o sistema tenta automaticamente o próximo.

## 🐛 Troubleshooting

### Erro: "Missing required environment variable: DATABASE_URL"

- Certifique-se de que `DATABASE_URL` está configurada nas Environment Variables da Vercel
- O Prisma Client será gerado automaticamente durante o build
- Se o build falhar, o sistema usa uma URL dummy temporária

### Erro: "Prisma generate failed"

- Isso é normal durante o build se `DATABASE_URL` não estiver disponível
- O Prisma Client será gerado em runtime quando a função for executada
- Certifique-se de que `DATABASE_URL` está configurada corretamente

### Funções não funcionam

- Verifique se as variáveis de ambiente estão configuradas
- Verifique os logs da Vercel em **Deployments** → **Functions**
- Certifique-se de que o `vercel.json` está correto

### Erro 500: FUNCTION_INVOCATION_FAILED

Este erro geralmente indica um problema na execução da função serverless. Siga estes passos:

1. **Verificar variáveis de ambiente na Vercel:**

   - Acesse **Settings** → **Environment Variables**
   - Certifique-se de que `DATABASE_URL` está configurada corretamente
   - Verifique se `JWT_SECRET` está configurado
   - Confirme que todas as chaves de API de IA estão configuradas

2. **Verificar logs da função:**

   - Acesse **Deployments** → Selecione o deployment → **Functions**
   - Clique na função que está falhando (ex: `api/auth-login`)
   - Veja os logs de erro para identificar o problema específico

3. **Verificar Prisma Client:**

   - O Prisma Client deve ser gerado durante o build
   - Se o build falhar, verifique se `DATABASE_URL` está disponível durante o build
   - O `postinstall` script tenta gerar o Prisma Client mesmo sem `DATABASE_URL`

4. **Problemas comuns:**

   - **DATABASE_URL inválida**: Verifique se a string de conexão está correta
   - **Prisma Client não gerado**: Verifique os logs do build
   - **Timeout de conexão**: Verifique se o MongoDB Atlas permite conexões da Vercel
   - **Erro de autenticação**: Verifique credenciais do banco de dados

5. **Testar localmente:**
   - Execute `npm run dev` localmente
   - Teste as funções em `http://localhost:8888/api/auth-login`
   - Se funcionar localmente, o problema é específico da Vercel (env vars, build, etc.)

## 📝 Notas Importantes

- **Prisma Client**: Será gerado automaticamente durante o build ou em runtime
- **Environment Variables**: Devem ser configuradas no dashboard da Vercel
- **Build Time**: O build pode falhar se `DATABASE_URL` não estiver disponível, mas isso é OK - o Prisma será gerado em runtime
- **API Routes**: Todas as rotas estão em `/api` e seguem o padrão Vercel Serverless Functions
