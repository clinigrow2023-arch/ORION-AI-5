# Deploy Orion AI na VPS (Ollama local)

Este branch (`feature/vps-ollama-only`) roda **frontend + API + Ollama** na mesma VPS. Não depende da Vercel para o app.

## Requisitos na VPS

- Node.js 20+
- MongoDB Atlas (ou MongoDB local)
- Ollama instalado e modelo carregado (`ollama pull llama3-8b-fast` ou o definido em `OLLAMA_MODEL`)
- Porta aberta (ex.: 3000) no firewall

## Variáveis de ambiente (`.env` na raiz)

```env
PORT=3000
SITE_URL=https://seu-dominio.com

DATABASE_URL=mongodb+srv://...
JWT_SECRET=...

OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3-8b-fast
OLLAMA_API_KEY=

GMAIL_USER=
GMAIL_PASS=

DIGISTORE_IPN_PASSPHRASE=
DIGISTORE_ALLOWED_PRODUCT_IDS=686819,686820,683588,686804
```

## Instalação

```bash
git clone <repo>
git checkout feature/vps-ollama-only
npm install
npm run db:push
npm run build
npm run start
```

Produção com rebuild:

```bash
npm run start:prod
```

## Endpoints

| Rota | Uso |
|------|-----|
| `/` | App React (SPA) |
| `/api/chat` | Chat com Ollama (SSE com `?stream=true`) |
| `/api/gemini` | Alias legado → mesmo handler de `/api/chat` |
| `/api/digistore-ipn` | IPN Digistore |

## Systemd (exemplo)

```ini
[Unit]
Description=Orion AI
After=network.target ollama.service

[Service]
Type=simple
WorkingDirectory=/opt/orion-ai
EnvironmentFile=/opt/orion-ai/.env
ExecStart=/usr/bin/npm run start
Restart=always

[Install]
WantedBy=multi-user.target
```

## Nginx reverse proxy (opcional)

```nginx
server {
  listen 80;
  server_name seu-dominio.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
  }
}
```

`proxy_buffering off` ajuda o streaming SSE do chat.

## Migração desde Vercel

1. Apontar DNS para a VPS.
2. Copiar todas as env da Vercel para `.env` na VPS.
3. Garantir `OLLAMA_URL=http://127.0.0.1:11434` (Ollama na mesma máquina).
4. Atualizar URL IPN na Digistore: `https://seu-dominio.com/api/digistore-ipn`.
5. Manter branch `main` na Vercel até validar este deploy.

## Produtos Digistore (referência)

- `686819` = Upsell Orion AI ILC MASCULINO
- `686820` = Downsell Orion AI ILC MASCULINO
- `683588` = Upsell Orion AI URM MASCULINO
- `686804` = Downsell Orion AI URM MASCULINO
