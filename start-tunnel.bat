@echo off
REM Script para iniciar o Cloudflare Tunnel (Quick Tunnel - sem configuracao)
REM Autor: ORION-AI-5
REM Data: 2025

echo ========================================
echo   Iniciando Cloudflare Tunnel
echo ========================================
echo.

REM Verificar se cloudflared está instalado
set CLOUDFLARED_CMD=cloudflared
where cloudflared >nul 2>&1
if %errorlevel% neq 0 (
    if exist cloudflared.exe (
        set CLOUDFLARED_CMD=.\cloudflared.exe
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
)

set TUNNEL_PORT=3000

echo [INFO] Certifique-se de que o servidor esta rodando na porta %TUNNEL_PORT%
echo [INFO] Expondo porta %TUNNEL_PORT% via Cloudflare Tunnel...
echo.
echo ========================================
echo   TUNNEL ATIVO
echo   URL sera exibida abaixo
echo ========================================
echo.
echo [INFO] Use Ctrl+C para parar o tunnel
echo.

%CLOUDFLARED_CMD% tunnel --url http://localhost:%TUNNEL_PORT%

echo.
echo [INFO] Tunnel encerrado.
pause
