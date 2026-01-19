#!/bin/bash
# Startup script for Docker container
# Ensures environment variables are available to cron and starts all services

set -e

# Export environment variables so cron can access them
# This ensures CRON_SECRET and NEXT_PUBLIC_APP_URL are available
export CRON_SECRET
export NEXT_PUBLIC_APP_URL

# Update cron job with current environment variables
# We'll embed the variables in the cron job itself for reliability
if [ -n "$CRON_SECRET" ]; then
  # Create cron job with environment variables
  echo "0 * * * * root CRON_SECRET='${CRON_SECRET}' NEXT_PUBLIC_APP_URL='${NEXT_PUBLIC_APP_URL:-http://localhost:3000}' /usr/local/bin/cron-scans.sh" > /etc/cron.d/nexusdocs-scans
  chmod 0644 /etc/cron.d/nexusdocs-scans
  echo "Cron job configured with CRON_SECRET"
else
  echo "Warning: CRON_SECRET not set, cron scans will be disabled"
  # Create a disabled cron job that just logs
  echo "# 0 * * * * root echo 'CRON_SECRET not set, skipping scans'" > /etc/cron.d/nexusdocs-scans
  chmod 0644 /etc/cron.d/nexusdocs-scans
fi

# Start cron daemon
echo "Starting cron daemon..."
cron

# Start pm2 for Next.js
echo "Starting Next.js application..."
pm2 start npm --name 'nextjs' -- run start

# Start nginx
echo "Starting nginx..."
nginx -g 'daemon off;'
