FROM python:3.11-slim
WORKDIR /app
COPY backend /app/backend
RUN pip install --no-cache-dir -e /app/backend
WORKDIR /app/backend
ENV PYTHONPATH=/app/backend
ENV BCRYPT_ROUNDS=10
EXPOSE 8000
CMD ["sh", "-c", "alembic -c alembic.ini upgrade head && python -m meterstack.demo_seed && uvicorn meterstack.main:app --host 0.0.0.0 --port 8000"]
