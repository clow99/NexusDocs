#!/bin/bash
# Cron script to trigger scheduled scans
# This script is called by cron to invoke the /api/cron/scans endpoint
# Environment variables (CRON_SECRET, NEXT_PUBLIC_APP_URL) are passed by the cron job

# Get the CRON_SECRET from environment (passed by cron job)
CRON_SECRET="${CRON_SECRET:-}"

# Get the app URL (default to localhost if not set)
APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"

# If no CRON_SECRET is set, skip execution
if [ -z "$CRON_SECRET" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S'): CRON_SECRET not set, skipping scan trigger" >> /var/log/cron-scans.log
  exit 0
fi

# Call the cron endpoint
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  "${APP_URL}/api/cron/scans" 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# Log the result
if [ "$HTTP_CODE" = "200" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S'): Scan trigger successful (HTTP $HTTP_CODE)" >> /var/log/cron-scans.log
else
  echo "$(date '+%Y-%m-%d %H:%M:%S'): Scan trigger failed (HTTP $HTTP_CODE): $BODY" >> /var/log/cron-scans.log
fi

exit 0
