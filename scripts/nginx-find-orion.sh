#!/usr/bin/env bash
# Acha o vhost nginx que aponta para Orion (porta 3001 / domínio orionaii.com)
set -euo pipefail

echo "=== Arquivos nginx com orionaii / 3001 / proxy_pass ==="
sudo grep -rn "orionaii\|127.0.0.1:3001\|proxy_pass" /etc/nginx/ 2>/dev/null || true

echo ""
echo "=== proxy_read_timeout atual ==="
sudo grep -rn "proxy_read_timeout" /etc/nginx/ 2>/dev/null || echo "(nenhum — padrão 60s, corta SSE do chat)"

echo ""
echo "Edite o arquivo do server 443/80 acima e dentro de location / adicione:"
echo "  proxy_buffering off;"
echo "  proxy_read_timeout 300s;"
echo "  proxy_send_timeout 300s;"
echo ""
echo "Depois: sudo nginx -t && sudo systemctl reload nginx"
