#!/usr/bin/env bash
# Arranca "Mi Historia sobre Ruedas".
#
# Si tenés instalado Ollama (modelo local, sin API key) y no está corriendo,
# este script lo levanta antes de iniciar la app para que el asistente de IA
# funcione. Si no lo tenés, arranca la app igual (el asistente queda apagado).
#
# Uso:
#   ./arrancar.sh                 # http://127.0.0.1:8000
#   ./arrancar.sh --port 9000     # le pasa los argumentos a app.py
set -euo pipefail
cd "$(dirname "$0")"

# --- Ollama (opcional) ----------------------------------------------------- #
OLLAMA_BIN="${OLLAMA_BIN:-$HOME/.local/ollama/bin/ollama}"
if [ -x "$OLLAMA_BIN" ]; then
  if ! curl -s --max-time 2 http://127.0.0.1:11434/api/version >/dev/null 2>&1; then
    echo "Levantando Ollama…"
    OLLAMA_MODELS="${OLLAMA_MODELS:-$HOME/.local/share/ollama/models}" \
      nohup "$OLLAMA_BIN" serve >/tmp/opencode/ollama.log 2>&1 &
    sleep 3
  fi
fi

# --- App ------------------------------------------------------------------- #
echo "Iniciando Mi Historia sobre Ruedas…"
exec python3 app.py "$@"
