# Read a single KEY=value from .env without sourcing (safe for spaces and #!&).
read_env_var() {
  local key="$1" file="$2" default="${3:-}"
  if [ ! -f "$file" ]; then
    printf '%s' "$default"
    return
  fi
  local line
  line=$(grep -E "^[[:space:]]*${key}=" "$file" | tail -1 || true)
  if [ -z "$line" ]; then
    printf '%s' "$default"
    return
  fi
  local val="${line#*=}"
  val="${val#"${val%%[![:space:]]*}"}"
  val="${val%"${val##*[![:space:]]}"}"
  if [[ "$val" == \"*\" && "$val" == *\" ]]; then
    val="${val:1:${#val}-2}"
  elif [[ "$val" == \'*\' && "$val" == *\' ]]; then
    val="${val:1:${#val}-2}"
  fi
  printf '%s' "$val"
}

load_ollama_vars_from_env_file() {
  local file="$1"
  OLLAMA_BASE_MODEL=$(read_env_var OLLAMA_BASE_MODEL "$file" "${OLLAMA_BASE_MODEL:-llama3.2:3b}")
  OLLAMA_MODEL=$(read_env_var OLLAMA_MODEL "$file" "${OLLAMA_MODEL:-orion-ai}")
  OLLAMA_USE_MODELFILE=$(read_env_var OLLAMA_USE_MODELFILE "$file" "${OLLAMA_USE_MODELFILE:-1}")
  export OLLAMA_BASE_MODEL OLLAMA_MODEL OLLAMA_USE_MODELFILE
}
