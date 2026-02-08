#!/bin/bash

set -e

{
    echo "SHELL=/bin/bash"
    echo "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    echo "POSTGRES_HOST=${POSTGRES_HOST:-localhost}"
    echo "POSTGRES_DB=${POSTGRES_DB}"
    echo "POSTGRES_USER=${POSTGRES_USER}"
    echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
    echo "POSTGRES_PORT=${POSTGRES_PORT:-5432}"
    echo "PYTHONUNBUFFERED=1"
    echo ""
    echo "0 2 * * * root cd /app/results_loader && python3 pull_results.py -s 2>&1 | logger -t wca-pull"
} > /etc/cron.d/wca-pull-results

chmod 0644 /etc/cron.d/wca-pull-results

echo "Running initial WCA data sync..."
cd /app/results_loader
python3 pull_results.py -s

echo "Starting cron daemon..."
exec cron -f