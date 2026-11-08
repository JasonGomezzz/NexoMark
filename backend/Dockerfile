# ============================================================
# MarketMind IA — Backend Dockerfile
# Python 3.11.9 slim — multi-stage para imagen liviana
# ============================================================

FROM python:3.11.9-slim AS base

# Metadata
LABEL maintainer="MarketMind IA Team"
LABEL description="Django REST API for MarketMind IA"

# Variables de entorno para Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Directorio de trabajo
WORKDIR /app

# Dependencias del sistema (mínimas)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libcairo2 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    libxml2 \
    shared-mime-info \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements primero (caché de Docker)
COPY requirements/ requirements/

# Instalar dependencias de producción
RUN pip install --upgrade pip \
    && pip install -r requirements/base.txt

# Copiar el código fuente
COPY . .

# Recopilar archivos estáticos
# Build-time dummies: collectstatic no usa estos valores realmente,
# solo necesita que settings.py importe sin UndefinedValueError.
# base.py lee SECRET_KEY y DB_* individuales (no DATABASE_URL).
# En runtime Render sobreescribe con los valores reales del dashboard.
ARG SECRET_KEY=django-insecure-build-only-not-used-in-runtime
ARG DB_NAME=dummy
ARG DB_USER=dummy
ARG DB_PASSWORD=dummy
ARG DB_HOST=localhost
ENV SECRET_KEY=$SECRET_KEY
ENV DB_NAME=$DB_NAME
ENV DB_USER=$DB_USER
ENV DB_PASSWORD=$DB_PASSWORD
ENV DB_HOST=$DB_HOST
# prod.py exige estos dos secretos al importar; aquí van solo para este comando
# (no quedan en la imagen) y en runtime se usan los reales de Render.
RUN INTERNAL_EVENT_TOKEN=build-only-not-used-in-runtime \
    N8N_WEBHOOK_TOKEN=build-only-not-used-in-runtime-0000000000 \
    python manage.py collectstatic --noinput --settings=core.settings.prod

# Puerto expuesto
EXPOSE 8000

# Comando por defecto (producción con gunicorn)
CMD ["sh", "-c", "python manage.py migrate --settings=core.settings.prod && gunicorn --bind 0.0.0.0:${PORT:-8000} --workers 3 --timeout 120 --access-logfile - --error-logfile - core.wsgi:application"]
