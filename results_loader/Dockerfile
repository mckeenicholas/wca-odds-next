FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y cron

COPY requirements.txt .

RUN pip install -r requirements.txt

COPY pull_results.py .

RUN echo "0 0 * * 0 cd /app && /usr/local/bin/python pull_results.py > /proc/1/fd/1 2>&1" > /etc/cron.d/pull-cron

RUN chmod 0644 /etc/cron.d/pull-cron

RUN crontab /etc/cron.d/pull-cron

COPY entrypoint.sh .
RUN chmod +x entrypoint.sh
ENTRYPOINT ["./entrypoint.sh"]