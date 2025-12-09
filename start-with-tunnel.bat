@echo off
REM Script para iniciar o servidor de desenvolvimento com Cloudflare Tunnel
REM Autor: ORION-AI-5
REM Data: 2025

echo ========================================
echo   ORION-AI - Iniciando com Cloudflare Tunnel
echo ========================================
echo.

REM Verificar se Node.js está instalado
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado. Por favor, instale o Node.js primeiro.
    pause
    exit /b 1
)

REM Verificar se npm está instalado
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] npm nao encontrado. Por favor, instale o Node.js primeiro.
    pause
    exit /b 1
)

REM Verificar se cloudflared está instalado
set CLOUDFLARED_CMD=cloudflared
where cloudflared >nul 2>&1
if %errorlevel% neq 0 (
    REM Verificar se está no diretório atual
    if exist cloudflared.exe (
        set CLOUDFLARED_CMD=.\cloudflared.exe
        echo [INFO] cloudflared encontrado no diretorio atual.
    ) else (
        echo [AVISO] cloudflared nao encontrado no PATH nem no diretorio atual.
        echo.
        echo Por favor, instale o Cloudflare Tunnel:
        echo 1. Baixe de: https://github.com/cloudflare/cloudflared/releases
        echo 2. Extraia o arquivo cloudflared.exe
        echo 3. Adicione ao PATH ou coloque neste diretorio
        echo.
        echo Deseja continuar mesmo assim? (S/N)
        set /p continue="> "
        if /i not "%continue%"=="S" (
            exit /b 1
        )
        REM Tentar usar cloudflared mesmo assim
        set CLOUDFLARED_CMD=cloudflared
    )
) else (
    echo [INFO] cloudflared encontrado no PATH.
)

REM Verificar se .env existe
if not exist .env (
    echo [AVISO] Arquivo .env nao encontrado.
    echo Certifique-se de que as variaveis de ambiente estao configuradas.
    echo.
)

REM Verificar se node_modules existe
if not exist node_modules (
    echo [INFO] Instalando dependencias...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERRO] Falha ao instalar dependencias.
        pause
        exit /b 1
    )
    echo.
)

REM Configuracoes
set SERVER_PORT=3000
set TUNNEL_HOST=localhost
set TUNNEL_PORT=%SERVER_PORT%

REM Usar quick tunnel (sem configuracao necessaria)
set tunnel_option=2

REM Iniciar servidor em nova janela
echo.
echo [INFO] Iniciando servidor de desenvolvimento na porta %SERVER_PORT%...
echo [INFO] O servidor sera iniciado em uma nova janela.
start "ORION-AI Server" cmd /k "npm run dev"

REM Aguardar servidor iniciar (tempo inicial)
echo [INFO] Aguardando servidor iniciar (aguarde 15 segundos)...
timeout /t 15 /nobreak >nul

REM Verificar se o servidor esta rodando - tentativas multiplas
echo [INFO] Verificando se o servidor esta respondendo na porta %SERVER_PORT%...
set MAX_ATTEMPTS=15
set ATTEMPT=0
set SERVER_READY=0

:check_server
set /a ATTEMPT+=1
echo [INFO] Tentativa %ATTEMPT%/%MAX_ATTEMPTS% - Verificando servidor...

REM Verificar se a porta está em uso
netstat -an | findstr ":%SERVER_PORT%" >nul 2>&1
if %errorlevel% equ 0 (
    REM Tentar fazer uma requisição HTTP usando PowerShell para confirmar que está respondendo
    powershell -Command "$response = try { Invoke-WebRequest -Uri 'http://localhost:%SERVER_PORT%/' -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop; $response.StatusCode } catch { $null }; if ($response -eq 200 -or $response -eq 404 -or $response -eq 304) { exit 0 } else { exit 1 }" >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] Servidor esta respondendo na porta %SERVER_PORT%!
        set SERVER_READY=1
        goto server_ready
    )
)

if %ATTEMPT% lss %MAX_ATTEMPTS% (
    echo [INFO] Servidor ainda nao esta pronto, aguardando mais 2 segundos...
    timeout /t 2 /nobreak >nul
    goto check_server
) else (
    echo [AVISO] Nao foi possivel confirmar se o servidor esta rodando apos %MAX_ATTEMPTS% tentativas.
    echo [AVISO] Verifique a janela do servidor para ver se ha erros.
    echo [AVISO] Continuando mesmo assim com o tunnel...
    echo.
    echo Pressione qualquer tecla para continuar ou Ctrl+C para cancelar...
    pause >nul
)

:server_ready
echo.

REM Iniciar Cloudflare Tunnel
echo.
echo ========================================
echo   Iniciando Cloudflare Tunnel...
echo ========================================
echo.

REM Verificar novamente antes de iniciar o tunnel
echo [INFO] Verificacao final antes de iniciar o tunnel...
netstat -an | findstr ":%SERVER_PORT%" >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Servidor nao esta rodando na porta %SERVER_PORT%!
    echo [ERRO] Por favor, verifique a janela do servidor para erros.
    echo.
    echo Pressione qualquer tecla para tentar iniciar o tunnel mesmo assim...
    pause >nul
)

REM Quick tunnel (sem configuracao necessaria - apenas expoe a porta)
echo.
echo [INFO] Criando quick tunnel (sem configuracao necessaria)...
echo [INFO] URL sera exibida abaixo quando o tunnel estiver pronto.
echo.
echo ========================================
echo   TUNNEL ATIVO - Aguarde a URL abaixo
echo ========================================
echo.
echo [INFO] Conectando a http://%TUNNEL_HOST%:%TUNNEL_PORT%
echo [INFO] Use essa URL para configurar webhooks (ex: DigiStore IPN)
echo.
echo [DICA] Se o tunnel nao conseguir conectar:
echo   1. Verifique se o servidor esta rodando na janela separada
echo   2. Execute check-server.bat para diagnosticar problemas
echo   3. Certifique-se de que nenhum firewall esta bloqueando a porta %SERVER_PORT%
echo.
%CLOUDFLARED_CMD% tunnel --url http://%TUNNEL_HOST%:%TUNNEL_PORT%

REM Se chegou aqui, o tunnel foi encerrado
echo.
echo [INFO] Cloudflare Tunnel encerrado.
echo [INFO] Servidor ainda pode estar rodando na janela separada.
echo.
pause
