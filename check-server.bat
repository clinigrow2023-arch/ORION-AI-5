@echo off
REM Script para verificar se o servidor está rodando
echo ========================================
echo   Verificando Status do Servidor
echo ========================================
echo.

set SERVER_PORT=3000
set EXPRESS_PORT=8888

echo [INFO] Verificando porta %SERVER_PORT% (Vite/Frontend)...
netstat -an | findstr ":%SERVER_PORT%" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Porta %SERVER_PORT% esta em uso
    echo [INFO] Testando resposta HTTP...
    powershell -Command "$response = try { Invoke-WebRequest -Uri 'http://localhost:%SERVER_PORT%/' -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop; Write-Host '[OK] Servidor respondeu com status:' $response.StatusCode } catch { Write-Host '[ERRO] Servidor nao respondeu:' $_.Exception.Message }"
) else (
    echo [ERRO] Porta %SERVER_PORT% nao esta em uso
    echo [INFO] O servidor Vite nao esta rodando
)

echo.
echo [INFO] Verificando porta %EXPRESS_PORT% (Express/Backend)...
netstat -an | findstr ":%EXPRESS_PORT%" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Porta %EXPRESS_PORT% esta em uso
    echo [INFO] Testando resposta HTTP...
    powershell -Command "$response = try { Invoke-WebRequest -Uri 'http://localhost:%EXPRESS_PORT%/api/auth-verify' -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop; Write-Host '[OK] Backend respondeu com status:' $response.StatusCode } catch { Write-Host '[AVISO] Backend nao respondeu (pode ser normal se nao tiver token):' $_.Exception.Message }"
) else (
    echo [ERRO] Porta %EXPRESS_PORT% nao esta em uso
    echo [INFO] O servidor Express nao esta rodando
)

echo.
echo ========================================
echo   Processos Node.js em execucao
echo ========================================
tasklist | findstr "node.exe"
if %errorlevel% neq 0 (
    echo [AVISO] Nenhum processo Node.js encontrado
)

echo.
pause
