@echo off
REM Script para iniciar o Cloudflare Tunnel configurado
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
        echo Por favor, execute setup-cloudflare-tunnel.bat primeiro.
        pause
        exit /b 1
    )
)

set TUNNEL_NAME=orion-ai-dev

echo [INFO] Iniciando tunnel: %TUNNEL_NAME%
echo [INFO] Certifique-se de que o servidor esta rodando na porta 3000
echo.
echo ========================================
echo   TUNNEL ATIVO
echo   URL sera exibida abaixo
echo ========================================
echo.
echo [INFO] Use Ctrl+C para parar o tunnel
echo.

%CLOUDFLARED_CMD% tunnel run %TUNNEL_NAME%

echo.
echo [INFO] Tunnel encerrado.
pause
