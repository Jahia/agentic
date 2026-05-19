#!/usr/bin/env bash
# CrumbleCo Benchmark Runner
# Measures time, tokens, and captures screenshots for the full site build.
#
# Usage:
#   ./benchmark/run.sh [--module-dir <path>]
#
# Prerequisites (run once before benchmarking):
#   1. npm init @jahia/module@latest crumbleco  (choose "Hello World template set")
#   2. cd crumbleco && yarn install
#   3. (Optional) Create the Jahia site "crumbleco" via the UI
#
# The script:
#   - Sets up: starts Jahia + initial deploy (not timed)
#   - Timed:   runs Claude in yolo mode with prompt.md
#   - Post:    parses tokens/cost, takes screenshots, saves results

set -euo pipefail

BENCHMARK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="$BENCHMARK_DIR/results"
SCREENSHOTS_DIR="$RESULTS_DIR/screenshots"
PROMPT_FILE="$BENCHMARK_DIR/prompt.md"
SCREENSHOT_SCRIPT="$BENCHMARK_DIR/screenshot.js"

MODULE_DIR="${1:-}"
if [[ -z "$MODULE_DIR" ]]; then
  # Auto-detect: look for crumbleco module in parent directories
  if [[ -d "$BENCHMARK_DIR/../crumbleco" ]]; then
    MODULE_DIR="$BENCHMARK_DIR/../crumbleco"
  elif [[ -d "$(pwd)/crumbleco" ]]; then
    MODULE_DIR="$(pwd)/crumbleco"
  else
    echo "ERROR: Could not find crumbleco module directory."
    echo "Run: npm init @jahia/module@latest crumbleco"
    echo "Or:  ./run.sh --module-dir /path/to/crumbleco"
    exit 1
  fi
fi
MODULE_DIR="$(cd "$MODULE_DIR" && pwd)"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
RUN_ID=$(date +"%Y%m%d-%H%M%S")
LOG_FILE="$RESULTS_DIR/output-$RUN_ID.log"

mkdir -p "$SCREENSHOTS_DIR/$RUN_ID"

echo "============================================================"
echo "  CrumbleCo Benchmark"
echo "  Run ID: $RUN_ID"
echo "  Module: $MODULE_DIR"
echo "============================================================"
echo ""

# ── Setup (not timed) ────────────────────────────────────────────────────────

echo "[setup] Starting Jahia..."
(cd "$MODULE_DIR" && docker compose up --wait --detach 2>&1) | tail -5

echo "[setup] Deploying base module..."
(cd "$MODULE_DIR" && yarn build --silent && yarn jahia-deploy --silent 2>&1) | tail -3

echo "[setup] Creating site if needed..."
# Create the crumbleco site if it doesn't exist yet
curl -s -u root:root1234 \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8080" \
  -X POST http://localhost:8080/modules/graphql \
  -d '{"query":"{ jcr { nodeByPath(path: \"/sites/crumbleco\") { name } } }"}' \
  | grep -q '"name":"crumbleco"' || \
  curl -s -u root:root1234 \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:8080" \
    -X POST http://localhost:8080/modules/graphql \
    -d '{"query":"mutation { jcr { addNode(parentPathOrId: \"/sites\", name: \"crumbleco\", primaryNodeType: \"jnt:virtualsite\", properties: [{name:\"j:templatesSet\",value:\"crumbleco\"},{name:\"j:defaultLanguage\",value:\"en\"},{name:\"j:languages\",values:[\"en\"]},{name:\"j:mixLanguage\",value:\"false\"},{name:\"j:serverName\",value:\"localhost_8080\"},{name:\"jcr:title\",value:\"CrumbleCo Biscuits\",language:\"en\"}]) { uuid } } }"}' \
    > /dev/null 2>&1 || true

echo ""
echo "[benchmark] Starting timed run..."
echo ""

# ── Timed phase ──────────────────────────────────────────────────────────────

START_NS=$(date +%s%N 2>/dev/null || python3 -c "import time; print(int(time.time()*1e9))")

(
  cd "$MODULE_DIR"
  claude --dangerously-skip-permissions \
    --output-format stream-json \
    -p "$(cat "$PROMPT_FILE")"
) > "$LOG_FILE" 2>&1

EXIT_CODE=$?

END_NS=$(date +%s%N 2>/dev/null || python3 -c "import time; print(int(time.time()*1e9))")
DURATION_MS=$(( (END_NS - START_NS) / 1000000 ))
DURATION_SECONDS=$(( DURATION_MS / 1000 ))

echo ""
echo "[benchmark] Run complete (${DURATION_SECONDS}s, exit code: $EXIT_CODE)"

# ── Parse metrics ────────────────────────────────────────────────────────────

# Sum input/output tokens across all assistant messages in the stream-json log
TOKENS_INPUT=0
TOKENS_OUTPUT=0
if command -v jq &>/dev/null; then
  TOKENS_INPUT=$(jq -r 'select(.type == "assistant") | .message.usage.input_tokens // 0' "$LOG_FILE" 2>/dev/null \
    | awk '{sum+=$1} END{print int(sum)}')
  TOKENS_OUTPUT=$(jq -r 'select(.type == "assistant") | .message.usage.output_tokens // 0' "$LOG_FILE" 2>/dev/null \
    | awk '{sum+=$1} END{print int(sum)}')
  COST=$(jq -r 'select(.type == "result") | .cost_usd // empty' "$LOG_FILE" 2>/dev/null | tail -1)
  FINAL_TEXT=$(jq -r 'select(.type == "result") | .result // empty' "$LOG_FILE" 2>/dev/null | tail -1)
else
  echo "[warn] jq not found — token counts unavailable"
  COST=""
  FINAL_TEXT=""
fi

# Extract page URLs from the Claude output
declare -A PAGE_URLS
while IFS= read -r line; do
  if [[ "$line" =~ PAGE_URL:\ ([A-Za-z0-9_-]+)\ (https?://[^[:space:]\"\']+) ]]; then
    PAGE_URLS["${BASH_REMATCH[1]}"]="${BASH_REMATCH[2]}"
  fi
done < <(echo "$FINAL_TEXT"; grep -a 'PAGE_URL:' "$LOG_FILE" 2>/dev/null || true)

# Determine status
if [[ ${#PAGE_URLS[@]} -ge 7 ]]; then
  STATUS="completed"
elif [[ ${#PAGE_URLS[@]} -gt 0 ]]; then
  STATUS="partial"
else
  STATUS="failed"
fi

echo "[metrics] Duration: ${DURATION_SECONDS}s"
echo "[metrics] Tokens in: ${TOKENS_INPUT:-unknown} / out: ${TOKENS_OUTPUT:-unknown}"
echo "[metrics] Cost: ${COST:-unknown} USD"
echo "[metrics] Status: $STATUS (${#PAGE_URLS[@]}/10 page URLs found)"

# ── Screenshots ──────────────────────────────────────────────────────────────

if [[ ${#PAGE_URLS[@]} -gt 0 ]] && command -v node &>/dev/null; then
  echo ""
  echo "[screenshots] Capturing ${#PAGE_URLS[@]} pages..."

  # Build args for screenshot.js
  SCREENSHOT_ARGS=()
  for key in "${!PAGE_URLS[@]}"; do
    SCREENSHOT_ARGS+=("--$key" "${PAGE_URLS[$key]}")
  done

  node "$SCREENSHOT_SCRIPT" \
    --output-dir "$SCREENSHOTS_DIR/$RUN_ID" \
    "${SCREENSHOT_ARGS[@]}" \
    && echo "[screenshots] Saved to $SCREENSHOTS_DIR/$RUN_ID" \
    || echo "[warn] Some screenshots failed"
else
  echo "[screenshots] Skipped (no page URLs or node unavailable)"
fi

# ── Write results ─────────────────────────────────────────────────────────────

PAGES_JSON="{"
FIRST=true
for key in "${!PAGE_URLS[@]}"; do
  [[ "$FIRST" == "false" ]] && PAGES_JSON+=","
  PAGES_JSON+="\"$key\":\"${PAGE_URLS[$key]}\""
  FIRST=false
done
PAGES_JSON+="}"

RESULT_JSON=$(cat <<EOF
{
  "timestamp": "$TIMESTAMP",
  "run_id": "$RUN_ID",
  "duration_seconds": $DURATION_SECONDS,
  "tokens_input": ${TOKENS_INPUT:-0},
  "tokens_output": ${TOKENS_OUTPUT:-0},
  "cost_usd": ${COST:-null},
  "status": "$STATUS",
  "pages_found": ${#PAGE_URLS[@]},
  "pages": $PAGES_JSON,
  "screenshots_dir": "results/screenshots/$RUN_ID",
  "log": "results/output-$RUN_ID.log"
}
EOF
)

echo "$RESULT_JSON" > "$RESULTS_DIR/latest.json"

# Append to runs.json history
RUNS_FILE="$RESULTS_DIR/runs.json"
if [[ -f "$RUNS_FILE" ]] && command -v jq &>/dev/null; then
  jq ". + [$RESULT_JSON]" "$RUNS_FILE" > "$RUNS_FILE.tmp" && mv "$RUNS_FILE.tmp" "$RUNS_FILE"
else
  echo "[$RESULT_JSON]" > "$RUNS_FILE"
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "============================================================"
echo "  Results"
echo "============================================================"
echo "  Duration:     ${DURATION_SECONDS}s"
echo "  Tokens in:    ${TOKENS_INPUT:-unknown}"
echo "  Tokens out:   ${TOKENS_OUTPUT:-unknown}"
echo "  Cost:         ${COST:-unknown} USD"
echo "  Status:       $STATUS"
echo "  Pages found:  ${#PAGE_URLS[@]}/10"
echo ""
if [[ ${#PAGE_URLS[@]} -gt 0 ]]; then
  echo "  URLs:"
  for key in "${!PAGE_URLS[@]}"; do
    echo "    $key → ${PAGE_URLS[$key]}"
  done
  echo ""
fi
echo "  Latest result: $RESULTS_DIR/latest.json"
echo "  Full log:      $LOG_FILE"
echo "============================================================"
