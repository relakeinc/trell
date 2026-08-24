#!/usr/bin/env bash
# Trell self-host smoke — run AFTER `docker compose up -d --build`.
# Validates: containers healthy → api /health → DB + migrations → create project
# → pk/sk → ingest event → event in Postgres (analytics) → web responds.
set -euo pipefail

API="${API_URL:-http://localhost:8787}"
WEB="${WEB_URL:-http://localhost:3000}"
ADMIN="${TRELL_ADMIN_KEY:-change-me-admin}"
ORIGIN="${ORIGIN:-https://example.com}"
EVENT_ID="$(cat /proc/sys/kernel/random/uuid)"

fail() { echo "FAIL  $1"; exit 1; }
ok()   { echo "PASS  $1"; }

echo "▸ smoke at api=$API web=$WEB"

# 1) api healthy
for i in $(seq 1 30); do
  curl -sf "$API/health" >/dev/null 2>&1 && break
  sleep 1
done
curl -sf "$API/health" >/dev/null 2>&1 || fail "api /health"

# 2) create project (admin bootstrap) → pk/sk
RESP="$(curl -sf -X POST "$API/v1/projects" \
  -H "authorization: Bearer $ADMIN" -H 'content-type: application/json' \
  -d '{"name":"Self-host smoke","domains":["example.com"]}')" || fail "create project"
PK="$(node -e "process.stdout.write(JSON.parse(process.argv[1]).keys.pk)" "$RESP")"
SK="$(node -e "process.stdout.write(JSON.parse(process.argv[1]).keys.sk)" "$RESP")"
PID="$(node -e "process.stdout.write(JSON.parse(process.argv[1]).project.id)" "$RESP")"
[ -n "$PK" ] && [ -n "$SK" ] || fail "project has pk/sk"

# 3) ingest an event (allowed origin)
EV="{\"v\":1,\"event_id\":\"$EVENT_ID\",\"project\":\"$PK\",\"type\":\"form_submit\",\"ts\":$(date +%s%3N),\"session_id\":\"s1\",\"visitor_id\":\"v1\",\"url\":\"https://example.com/form\",\"page\":{\"path\":\"/form\",\"title\":\"Form\"},\"referrer\":\"https://google.com\",\"utm\":null,\"device\":{\"type\":\"desktop\",\"os\":\"linux\",\"browser\":\"chrome\",\"viewport\":[1280,800]},\"properties\":{},\"form\":{\"id\":\"contact\",\"name\":\"Contact\"},\"valid\":true}"
INGEST="$(curl -sf -X POST "$API/v1/events" \
  -H "authorization: Bearer $PK" -H "origin: $ORIGIN" -H 'content-type: application/json' \
  -d "[$EV]")" || fail "ingest event"

# 4) analytics reflects the event (DB read)
for i in $(seq 1 10); do
  STATS="$(curl -sf "$API/v1/projects/$PID/stats" -H "authorization: Bearer $SK")" && break
  sleep 1
done
SUBMITS="$(node -e "process.stdout.write(String(JSON.parse(process.argv[1]).metrics.submits))" "$STATS")"
[ "$SUBMITS" = "1" ] || fail "analytics reflects event (submits=$SUBMITS)"

# 5) web responds
curl -sf "$WEB/signin" >/dev/null 2>&1 || fail "web /signin"

ok "api /health"
ok "project created (pk/sk)"
ok "event ingested (202)"
ok "event persisted → analytics (submits=1)"
ok "web responds"
echo "ALL SELF-HOST CHECKS PASSED"
