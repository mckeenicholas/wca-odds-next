#!/bin/bash

# Run the initial sync
python3 pull_results.py -s

# Start cron in the foreground
exec cron -f