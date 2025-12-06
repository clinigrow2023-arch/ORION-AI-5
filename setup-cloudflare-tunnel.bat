@echo off
REM Script para criar e configurar Cloudflare Tunnel para webhooks
REM Autor: ORION-AI-5
REM Data: 2025

echo ========================================
echo   Configuracao do Cloudflare Tunnel
echo   Para receber webhooks (DigiStore IPN)
echo ========================================
echo.

REM Verificar se cloudflared está instalado
set CLOUDFLARED_CMD=cloudflared
where cloudflared >nul 2>&1
if %errorlevel% neq 0 (
    if exist cloudflared.exe (
        set CLOUDFLARED_CMD=.\cloudflared.exe
        echo [INFO] cloudflared encontrado no diretorio atual.
    ) else (
        echo [ERRO] cloudflared nao encontrado!
        echo.
        echo Por favor, instale o Cloudflare Tunnel:
        echo 1. Baixe de: https://github.com/cloudflare/cloudflared/releases
        echo 2. Extraia o arquivo cloudflared.exe
        echo 3. Adicione ao PATH ou coloque neste diretorio
        echo.
        pause
        exit /b 1
    )
) else (
    echo [OK] cloudflared encontrado no PATH.
)
echo.

REM Nome do tunnel (pode ser alterado)
set TUNNEL_NAME=orion-ai-dev
set TUNNEL_PORT=3000

echo [INFO] Nome do tunnel: %TUNNEL_NAME%
echo [INFO] Porta local: %TUNNEL_PORT%
echo.

REM Verificar se já está logado no Cloudflare
echo [INFO] Verificando autenticacao no Cloudflare...
%CLOUDFLARED_CMD% tunnel info >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Nao esta autenticado. Fazendo login...
    echo [INFO] Isso abrira seu navegador para autenticacao.
    echo.
    %CLOUDFLARED_CMD% tunnel login
    if %errorlevel% neq 0 (
        echo [ERRO] Falha na autenticacao.
        pause
        exit /b 1
    )
    echo.
) else (
    echo [OK] Ja esta autenticado no Cloudflare.
    echo.
)

REM Verificar se o tunnel já existe
echo [INFO] Verificando se o tunnel '%TUNNEL_NAME%' ja existe...
%CLOUDFLARED_CMD% tunnel list | findstr /C:"%TUNNEL_NAME%" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Tunnel '%TUNNEL_NAME%' ja existe.
    echo.
    echo Deseja:
    echo 1. Usar o tunnel existente
    echo 2. Deletar e criar um novo
    echo 3. Cancelar
    echo.
    set /p option="Escolha (1/2/3): "
    
    if "%option%"=="2" (
        echo [INFO] Deletando tunnel existente...
        %CLOUDFLARED_CMD% tunnel delete %TUNNEL_NAME%
        if %errorlevel% neq 0 (
            echo [ERRO] Falha ao deletar tunnel.
            pause
            exit /b 1
        )
        echo [OK] Tunnel deletado.
        echo.
        goto :create_tunnel
    ) else if "%option%"=="3" (
        exit /b 0
    ) else (
        echo [INFO] Usando tunnel existente.
        goto :configure_tunnel
    )
) else (
    echo [INFO] Tunnel nao existe. Criando novo tunnel...
    :create_tunnel
    %CLOUDFLARED_CMD% tunnel create %TUNNEL_NAME%
    if %errorlevel% neq 0 (
        echo [ERRO] Falha ao criar tunnel.
        pause
        exit /b 1
    )
    echo [OK] Tunnel '%TUNNEL_NAME%' criado com sucesso!
    echo.
)

:configure_tunnel
REM Obter UUID do tunnel
echo [INFO] Obtendo informacoes do tunnel...
for /f "tokens=*" %%i in ('%CLOUDFLARED_CMD% tunnel list ^| findstr /C:"%TUNNEL_NAME%"') do (
    set TUNNEL_INFO=%%i
)
echo [INFO] Tunnel configurado: %TUNNEL_NAME%
echo.

REM Criar arquivo de configuracao do tunnel
echo [INFO] Criando arquivo de configuracao...
set CONFIG_DIR=%USERPROFILE%\.cloudflared
if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%"

REM Verificar se já existe config
if exist "%CONFIG_DIR%\config.yml" (
    echo [AVISO] Arquivo config.yml ja existe.
    echo Deseja sobrescrever? (S/N)
    set /p overwrite="> "
    if /i not "%overwrite%"=="S" (
        echo [INFO] Mantendo configuracao existente.
        goto :start_tunnel
    )
)

REM Criar config.yml
(
echo tunnel: %TUNNEL_NAME%
echo credentials-file: %CONFIG_DIR%\%TUNNEL_NAME%.json
echo.
echo ingress:
echo   - hostname: ^^
echo     service: http://localhost:%TUNNEL_PORT%
echo   - service: http_status:404
) > "%CONFIG_DIR%\config.yml"

echo [OK] Arquivo de configuracao criado em: %CONFIG_DIR%\config.yml
echo.

REM Perguntar sobre hostname personalizado
echo Deseja configurar um hostname personalizado? (S/N)
set /p use_hostname="> "
if /i "%use_hostname%"=="S" (
    echo.
    echo Por favor, informe o hostname (ex: dev.orion-ai.com):
    set /p custom_hostname="Hostname: "
    if not "%custom_hostname%"=="" (
        echo [INFO] Configurando hostname: %custom_hostname%
        REM Adicionar rota DNS
        %CLOUDFLARED_CMD% tunnel route dns %TUNNEL_NAME% %custom_hostname%
        if %errorlevel% equ 0 (
            echo [OK] Hostname configurado: https://%custom_hostname%
            set TUNNEL_URL=https://%custom_hostname%
        ) else (
            echo [AVISO] Falha ao configurar hostname. Usando URL temporaria.
            set TUNNEL_URL=URL_SERA_EXIBIDA_ABAIXO
        )
    )
) else (
    echo [INFO] Usando URL temporaria do Cloudflare.
    set TUNNEL_URL=URL_SERA_EXIBIDA_ABAIXO
)
echo.

:start_tunnel
echo ========================================
echo   Configuracao concluida!
echo ========================================
echo.
echo [INFO] Para iniciar o tunnel, execute:
echo   %CLOUDFLARED_CMD% tunnel run %TUNNEL_NAME%
echo.
echo [INFO] Ou use o script: start-tunnel.bat
echo.
echo [INFO] A URL do tunnel sera exibida quando iniciar.
echo [INFO] Use essa URL para configurar webhooks (ex: DigiStore IPN)
echo.
pause
