FROM python:3.12-slim

WORKDIR /app

COPY worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY db/ ./db/
COPY parsers/ ./parsers/
COPY worker/ .

ENV PYTHONUNBUFFERED=1

CMD ["python", "main.py"]
