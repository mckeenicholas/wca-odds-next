#!/bin/bash

set -e

{
    echo "export POSTGRES_HOST=${POSTGRES_HOST:-localhost}"
    echo "export POSTGRES_DB=${POSTGRES_DB}"
    echo "export POSTGRES_USER=${POSTGRES_USER}"
    echo "export POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
    echo "export POSTGRES_PORT=${POSTGRES_PORT:-5432}"
    echo "export PYTHONUNBUFFERED=1"
} > /etc/wca-env

chmod 0600 /etc/wca-env

{
    echo "SHELL=/bin/bash"
    echo "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    echo ""
    echo "0 2 * * * root source /etc/wca-env && python3 /app/pull_results.py 2>&1 | logger -t wca-pull"
} > /etc/cron.d/wca-pull-results

chmod 0644 /etc/cron.d/wca-pull-results

echo "Running initial WCA data sync..."
python3 /app/pull_results.py -s

echo "Starting cron daemon..."
exec cron -f