# Proteção da VPS Ollama

Para proteger sua VPS Ollama e permitir apenas que sua aplicação use o serviço, você tem algumas opções:

## Opção 1: Proxy Reverso com Nginx (Recomendado)

Configure um proxy reverso Nginx na VPS para validar o token antes de encaminhar para o Ollama.

### 1. Instalar Nginx na VPS

```bash
sudo apt update
sudo apt install nginx
```

### 2. Configurar Nginx

Crie o arquivo `/etc/nginx/sites-available/ollama-proxy`:

```nginx
server {
    listen 80;
    server_name your-server-ip-or-domain;

    location /api/ {
        # Validar token no header
        if ($http_x_api_key != "SEU_TOKEN_SECRETO_AQUI") {
            return 403;
        }

        if ($http_authorization != "Bearer SEU_TOKEN_SECRETO_AQUI") {
            return 403;
        }

        # Proxy para Ollama
        proxy_pass http://localhost:11434/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Ativar configuração

```bash
sudo ln -s /etc/nginx/sites-available/ollama-proxy /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Configurar variável de ambiente

No seu projeto, adicione no `.env`:

```
OLLAMA_URL=http://your-ollama-server:11434
OLLAMA_API_KEY=SEU_TOKEN_SECRETO_AQUI
```

## Opção 2: Firewall (IP Whitelist)

Bloqueie acesso externo e permita apenas IPs específicos:

```bash
# Permitir apenas localhost e IPs específicos
sudo ufw allow from SEU_IP_VERCEL to any port 11434
sudo ufw deny 11434
```

## Opção 3: Ollama com Autenticação Básica

Configure autenticação básica no Nginx:

```nginx
location /api/ {
    auth_basic "Ollama API";
    auth_basic_user_file /etc/nginx/.htpasswd;

    proxy_pass http://localhost:11434/api/;
    proxy_set_header Host $host;
}
```

Criar arquivo de senha:

```bash
sudo htpasswd -c /etc/nginx/.htpasswd ollama_user
```

## Opção 4: Usar apenas localhost e criar endpoint intermediário

Mantenha o Ollama apenas em localhost e crie um endpoint na sua aplicação que valida autenticação antes de chamar o Ollama.

**Recomendação:** Use a Opção 1 (Proxy Reverso com Nginx) - é a mais segura e flexível.
