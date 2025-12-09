# Troubleshooting - Cloudflare Tunnel

## Problema: "We can't connect to the server"

Este erro indica que o Cloudflare Tunnel está ativo, mas não consegue se conectar ao servidor local.

### Diagnóstico Rápido

1. **Execute o script de diagnóstico:**
   ```bash
   check-server.bat
   ```

2. **Verifique manualmente se o servidor está rodando:**
   - Abra uma nova janela do terminal
   - Execute: `netstat -an | findstr ":3000"`
   - Se não aparecer nada, o servidor não está rodando

3. **Verifique a janela do servidor:**
   - Procure por erros na janela "ORION-AI Server"
   - Verifique se há mensagens de erro relacionadas a:
     - `DATABASE_URL` não encontrado
     - Porta já em uso
     - Erros de dependências

### Soluções Comuns

#### 1. Servidor não está rodando

**Sintomas:**
- `check-server.bat` mostra que as portas não estão em uso
- Nenhum processo Node.js está rodando

**Solução:**
```bash
# Pare todos os processos Node.js
taskkill /F /IM node.exe

# Inicie o servidor novamente
npm run dev
```

#### 2. Porta já está em uso

**Sintomas:**
- Erro: "Port 3000 is already in use"
- `check-server.bat` mostra porta em uso, mas servidor não responde

**Solução:**
```bash
# Encontre o processo usando a porta 3000
netstat -ano | findstr ":3000"

# Mate o processo (substitua PID pelo número do processo)
taskkill /F /PID <PID>

# Ou mude a porta no vite.config.ts
```

#### 3. Servidor está rodando, mas não responde

**Sintomas:**
- Porta está em uso
- `check-server.bat` mostra que servidor não responde HTTP

**Solução:**
- Verifique se há erros no console do servidor
- Verifique se o arquivo `.env` está configurado corretamente
- Tente acessar `http://localhost:3000` diretamente no navegador

#### 4. Firewall bloqueando

**Sintomas:**
- Servidor responde localmente (`localhost:3000`)
- Tunnel não consegue conectar

**Solução:**
- Adicione exceção no Windows Firewall para Node.js
- Ou desative temporariamente o firewall para testar

#### 5. DATABASE_URL não configurado

**Sintomas:**
- Servidor inicia mas para imediatamente
- Erro: "DATABASE_URL not found"

**Solução:**
- Crie/verifique o arquivo `.env` na raiz do projeto
- Adicione: `DATABASE_URL=mongodb+srv://...`

### Passos para Reiniciar Tudo

1. **Pare todos os processos:**
   ```bash
   taskkill /F /IM node.exe
   taskkill /F /IM cloudflared.exe
   ```

2. **Verifique o arquivo `.env`:**
   - Certifique-se de que todas as variáveis estão configuradas

3. **Inicie o servidor manualmente primeiro:**
   ```bash
   npm run dev
   ```
   - Aguarde até ver: `🚀 Development server running on http://localhost:3000`
   - Aguarde até ver: `🚀 Development server running on http://localhost:8888`

4. **Em outra janela, inicie o tunnel:**
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

### Verificação de Saúde

Execute periodicamente:
```bash
check-server.bat
```

Isso verifica:
- ✅ Se as portas estão em uso
- ✅ Se os servidores respondem HTTP
- ✅ Se os processos Node.js estão rodando

### Logs Úteis

**Servidor (janela separada):**
- Procure por: `🚀 Development server running`
- Procure por: `📡 API routes available`
- Procure por erros em vermelho

**Tunnel (janela atual):**
- Procure por: `Registered tunnel connection`
- Procure por: `https://...trycloudflare.com`
- Procure por erros: `Unable to reach the origin service`

### Contato

Se o problema persistir:
1. Execute `check-server.bat` e copie a saída
2. Copie os logs do servidor (janela separada)
3. Copie os logs do tunnel (janela atual)
4. Verifique se o arquivo `.env` está configurado corretamente
