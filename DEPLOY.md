# 🚀 Guia de Deploy - Netlify (Tudo em um lugar)

Este projeto está configurado para rodar **TUDO no Netlify**:
- ✅ Frontend (React/Vite)
- ✅ Backend (Netlify Functions)
- ✅ Database (MongoDB Atlas - externo, mas acessível)

## 📋 Pré-requisitos

1. Conta no [Netlify](https://www.netlify.com/)
2. Conta no [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (gratuito)
3. Repositório no GitHub

## 🔧 Configuração no Netlify

### 1. Conectar Repositório

1. Acesse [Netlify Dashboard](https://app.netlify.com/)
2. Clique em **"Add new site"** → **"Import an existing project"**
3. Conecte seu repositório GitHub
4. O Netlify detectará automaticamente o `netlify.toml`

### 2. Configurar Variáveis de Ambiente

No Netlify Dashboard, vá em **Site settings** → **Environment variables** e adicione:

```env
# API Keys
GEMINI_API_KEY=sua_chave_gemini_aqui

# Database
DATABASE_URL=mongodb+srv://user:password@cluster.mongodb.net/orionai?appName=OrionAI

# Security
JWT_SECRET=seu_jwt_secret_super_seguro_aqui_mude_em_producao
```

**⚠️ IMPORTANTE:**
- `DATABASE_URL` deve incluir o nome do banco (ex: `/orionai`)
- `JWT_SECRET` deve ser uma string aleatória e segura
- Use caracteres especiais e números para maior segurança

### 3. Configurações de Build (Já configurado no netlify.toml)

O arquivo `netlify.toml` já está configurado:
- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Functions directory**: `netlify/functions`
- **Node version**: 18

## 🏗️ Processo de Deploy

### Deploy Automático (Recomendado)

1. Faça push para a branch `main` no GitHub
2. O Netlify detectará automaticamente e fará o deploy
3. O build irá:
   - Instalar dependências (`npm install`)
   - Gerar Prisma Client (`prisma generate` - automático)
   - Build do frontend (`npm run build`)
   - Deploy das Netlify Functions

### Deploy Manual

1. No Netlify Dashboard, vá em **Deploys**
2. Clique em **"Trigger deploy"** → **"Deploy site"**

## 📦 Estrutura de Deploy

```
Netlify
├── Frontend (dist/)
│   ├── index.html
│   ├── assets/
│   └── ...
├── Netlify Functions (netlify/functions/)
│   ├── auth-login.ts
│   ├── auth-register.ts
│   ├── auth-verify.ts
│   ├── conversations.ts
│   ├── admin-users.ts
│   ├── gemini.ts
│   └── change-password.ts
└── Environment Variables
    ├── GEMINI_API_KEY
    ├── DATABASE_URL
    └── JWT_SECRET
```

## 🔍 Verificações Pós-Deploy

### 1. Verificar Build

- Acesse **Deploys** no Netlify Dashboard
- Verifique se o build foi bem-sucedido
- Se houver erros, verifique os logs

### 2. Verificar Functions

- Acesse **Functions** no Netlify Dashboard
- Deve aparecer todas as 7 functions
- Teste uma function manualmente se necessário

### 3. Testar Aplicação

1. Acesse a URL do site (ex: `https://seu-site.netlify.app`)
2. Teste registro de usuário
3. Teste login
4. Teste chat
5. Teste geração de plano

## 🐛 Troubleshooting

### Erro: "Functions not found"

- Verifique se o diretório `netlify/functions` existe
- Verifique se os arquivos têm extensão `.ts`
- Verifique os logs de build

### Erro: "Database connection failed"

- Verifique se `DATABASE_URL` está correto
- Verifique se o MongoDB Atlas permite conexões de qualquer IP (0.0.0.0/0)
- Verifique se o nome do banco está na URL

### Erro: "JWT verification failed"

- Verifique se `JWT_SECRET` está configurado
- Verifique se é o mesmo secret usado para gerar tokens

### Erro: "API key missing"

- Verifique se `GEMINI_API_KEY` está configurada
- Verifique se não há espaços extras na variável

## 📊 Monitoramento

### Logs

- **Function logs**: Netlify Dashboard → Functions → [Function Name] → Logs
- **Build logs**: Netlify Dashboard → Deploys → [Deploy] → Logs
- **Site logs**: Netlify Dashboard → Site → Logs

### Analytics

- Acesse **Analytics** no Netlify Dashboard
- Monitore tráfego, performance e erros

## 🔐 Segurança

### Variáveis de Ambiente

- ✅ Nunca commite `.env` no Git
- ✅ Use variáveis de ambiente no Netlify
- ✅ Use secrets fortes para `JWT_SECRET`
- ✅ Rotacione chaves API periodicamente

### MongoDB Atlas

- ✅ Configure IP whitelist (ou 0.0.0.0/0 para desenvolvimento)
- ✅ Use usuário com permissões mínimas necessárias
- ✅ Habilite autenticação

## 🚀 Próximos Passos

1. ✅ Configure domínio customizado (opcional)
2. ✅ Configure HTTPS (automático no Netlify)
3. ✅ Configure notificações de deploy
4. ✅ Configure branch previews (opcional)

## 📝 Notas Importantes

- **Prisma Client**: É gerado automaticamente durante o build
- **Netlify Functions**: Executam em ambiente serverless
- **Cold Start**: Primeira requisição pode ser mais lenta (~1-2s)
- **Timeout**: Functions têm timeout de 10s (gratuito) ou 26s (pro)
- **Limites**: Plano gratuito tem 125k invocações/mês

## 🎯 Vantagens de Tudo no Netlify

✅ **Simplicidade**: Tudo em um lugar
✅ **CI/CD Automático**: Deploy automático no push
✅ **HTTPS Gratuito**: SSL automático
✅ **CDN Global**: Performance otimizada
✅ **Serverless**: Escala automaticamente
✅ **Zero Config**: Funciona out-of-the-box

---

**Pronto!** Seu app está configurado para rodar tudo no Netlify. 🎉

