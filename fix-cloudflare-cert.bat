@echo off
REM Script para corrigir problema de certificado do Cloudflare Tunnel
REM Autor: ORION-AI-5
REM Data: 2025

echo ========================================
echo   Corrigindo Certificado Cloudflare Tunnel
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
        pause
        exit /b 1
    )
)

set CERT_PATH=%USERPROFILE%\.cloudflared\cert.pem

echo [INFO] Verificando certificado de origem...
if exist "%CERT_PATH%" (
    echo [OK] Certificado encontrado em: %CERT_PATH%
    echo.
    echo Deseja fazer login novamente? (S/N)
    set /p relogin="> "
    if /i not "%relogin%"=="S" (
        echo [INFO] Mantendo certificado existente.
        exit /b 0
    )
) else (
    echo [INFO] Certificado nao encontrado.
)

echo.
echo [INFO] Fazendo login no Cloudflare...
echo [INFO] Isso abrira seu navegador para autenticacao.
echo [INFO] Apos autenticar, o certificado sera baixado automaticamente.
echo.
pause

%CLOUDFLARED_CMD% tunnel login

if %errorlevel% neq 0 (
    echo [ERRO] Falha na autenticacao.
    pause
    exit /b 1
)

REM Verificar se o certificado foi baixado
if exist "%CERT_PATH%" (
    echo.
    echo [OK] Certificado baixado com sucesso!
    echo [OK] Local: %CERT_PATH%
    echo.
    echo [INFO] Agora voce pode executar:
    echo   start-tunnel.bat
    echo.
) else (
    echo.
    echo [AVISO] Certificado nao foi encontrado apos login.
    echo [INFO] Verifique se completou a autenticacao no navegador.
    echo.
)

pause
