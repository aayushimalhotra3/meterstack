FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/meterstack /app/meterstack
COPY backend/migrations /app/migrations
COPY backend/alembic.ini /app/alembic.ini
ENV PYTHONPATH=/app
EXPOSE 8000
CMD ["sh", "-c", "alembic -c alembic.ini upgrade head || true && uvicorn meterstack.main:app --host 0.0.0.0 --port 8000"]
