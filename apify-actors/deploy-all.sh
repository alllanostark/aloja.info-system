#!/bin/bash

export PATH="/Users/marciolemossantos/.npm-global/bin:$PATH"

ENV_FILE="/Users/marciolemossantos/sparks-aloja/.env.local"
ACTORS_DIR="/Users/marciolemossantos/sparks-aloja/apify-actors"

# Token lido do ambiente. Se nao estiver exportado, tenta carregar do .env.local.
# NUNCA hardcode o token aqui — e uma credencial real.
if [ -z "${APIFY_API_TOKEN:-}" ] && [ -f "$ENV_FILE" ]; then
  APIFY_API_TOKEN="$(grep -E '^APIFY_API_TOKEN=' "$ENV_FILE" | head -n1 | cut -d= -f2-)"
fi
TOKEN="${APIFY_API_TOKEN:?Defina APIFY_API_TOKEN (export APIFY_API_TOKEN=... ou linha APIFY_API_TOKEN= em .env.local)}"

echo "=== Sparks Aloja — Deploy dos Atores Apify ==="
echo ""

# Autenticar
echo "→ Autenticando..."
apify login --token "$TOKEN"
echo ""

# Push de cada ator
ACTORS=("milanuncios" "habitaclia" "homyspace" "spotahome" "uniplaces" "fotocasa" "airbnb" "idealista")

for actor in "${ACTORS[@]}"; do
  echo "==============================="
  echo "Push: $actor"
  echo "==============================="
  cd "$ACTORS_DIR/$actor"

  echo "→ npm install..."
  npm install --silent 2>&1

  echo "→ tsc build..."
  npm run build 2>&1

  echo "→ apify push..."
  apify push --force 2>&1
  STATUS=$?

  if [ $STATUS -eq 0 ]; then
    echo "✓ $actor deployado com sucesso"
    # Determinar a key do env
    ENV_KEY="APIFY_ACTOR_$(echo $actor | tr '[:lower:]' '[:upper:]' | tr '-' '_')"
    APIFY_USER="leafed_photocopier"
    ACTOR_ID="${APIFY_USER}/sparks-${actor}"
    grep -v "^${ENV_KEY}=" "$ENV_FILE" > "${ENV_FILE}.tmp" && mv "${ENV_FILE}.tmp" "$ENV_FILE"
    echo "${ENV_KEY}=${ACTOR_ID}" >> "$ENV_FILE"
    echo "  → Adicionado: ${ENV_KEY}=${ACTOR_ID}"
  else
    echo "✗ $actor falhou (exit $STATUS) — continua com o próximo"
  fi
  echo ""
done

echo "=== Resultado final ==="
grep "APIFY_ACTOR_" "$ENV_FILE" || echo "(nenhum ator registado)"
