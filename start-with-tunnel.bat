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

REM Verificar se tunnel configurado existe
set TUNNEL_NAME=orion-ai-dev
%CLOUDFLARED_CMD% tunnel list | findstr /C:"%TUNNEL_NAME%" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Tunnel configurado '%TUNNEL_NAME%' encontrado.
    echo.
    echo Deseja usar:
    echo 1. Tunnel configurado (%TUNNEL_NAME%) - Recomendado para webhooks
    echo 2. Quick tunnel temporario
    echo.
    set /p tunnel_option="Escolha (1/2) [padrao: 1]: "
    if "%tunnel_option%"=="" set tunnel_option=1
) else (
    echo [AVISO] Tunnel configurado nao encontrado.
    echo [INFO] Execute 'setup-cloudflare-tunnel.bat' primeiro para configurar.
    echo.
    echo Deseja usar:
    echo 1. Tentar usar tunnel configurado mesmo assim
    echo 2. Quick tunnel temporario (recomendado agora)
    echo.
    set /p tunnel_option="Escolha (1/2) [padrao: 2]: "
    if "%tunnel_option%"=="" set tunnel_option=2
)

REM Iniciar servidor em nova janela
echo.
echo [INFO] Iniciando servidor de desenvolvimento na porta %SERVER_PORT%...
echo [INFO] O servidor sera iniciado em uma nova janela.
start "ORION-AI Server" cmd /k "npm run dev"

REM Aguardar servidor iniciar (aumentar tempo)
echo [INFO] Aguardando servidor iniciar (aguarde 10 segundos)...
timeout /t 10 /nobreak >nul

REM Verificar se o servidor esta rodando
echo [INFO] Verificando se o servidor esta respondendo na porta %SERVER_PORT%...
timeout /t 3 /nobreak >nul

REM Tentar verificar se a porta está em uso (opcional)
netstat -an | findstr ":%SERVER_PORT%" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Servidor parece estar rodando na porta %SERVER_PORT%
) else (
    echo [AVISO] Nao foi possivel confirmar se o servidor esta rodando.
    echo [AVISO] Continuando mesmo assim...
)
echo.

REM Iniciar Cloudflare Tunnel
echo.
echo ========================================
echo   Iniciando Cloudflare Tunnel...
echo ========================================
echo.

if "%tunnel_option%"=="1" (
    REM Usar tunnel configurado
    echo [INFO] Usando tunnel configurado: %TUNNEL_NAME%
    echo [INFO] URL sera exibida abaixo quando o tunnel estiver pronto.
    echo.
    echo ========================================
    echo   TUNNEL CONFIGURADO - Para Webhooks
    echo ========================================
    echo.
    %CLOUDFLARED_CMD% tunnel run %TUNNEL_NAME%
) else if "%tunnel_option%"=="3" (
    REM Tunnel com hostname personalizado (requer configuracao previa)
    echo Por favor, informe o hostname do tunnel:
    set /p tunnel_hostname="Hostname (ex: app.exemplo.com): "
    if "%tunnel_hostname%"=="" (
        echo [ERRO] Hostname nao pode ser vazio.
        pause
        exit /b 1
    )
    echo.
    echo [INFO] Criando tunnel para: %tunnel_hostname%
    echo [INFO] URL sera exibida abaixo quando o tunnel estiver pronto.
    echo.
    %CLOUDFLARED_CMD% tunnel --url http://%TUNNEL_HOST%:%TUNNEL_PORT% --hostname %tunnel_hostname%
) else (
    REM Quick tunnel (temporario) - mais simples e recomendado para desenvolvimento
    echo [INFO] Criando tunnel temporario (quick tunnel)...
    echo [INFO] URL sera exibida abaixo quando o tunnel estiver pronto.
    echo.
    echo ========================================
    echo   TUNNEL ATIVO - Aguarde a URL abaixo
    echo ========================================
    echo.
    echo [INFO] Conectando a http://%TUNNEL_HOST%:%TUNNEL_PORT%
    echo.
    %CLOUDFLARED_CMD% tunnel --url http://%TUNNEL_HOST%:%TUNNEL_PORT%
)

REM Se chegou aqui, o tunnel foi encerrado
echo.
echo [INFO] Cloudflare Tunnel encerrado.
echo [INFO] Servidor ainda pode estar rodando na janela separada.
echo.
pause
