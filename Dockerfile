FROM node:22-slim AS frontend-builder
ARG VITE_ADMIN_KEY=""
ENV VITE_ADMIN_KEY=${VITE_ADMIN_KEY}
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend backend/
COPY --from=frontend-builder /app/frontend/dist frontend/dist/

ENV PORT=8080
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
