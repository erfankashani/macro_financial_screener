# Backend: FastAPI + uv, Python 3.12
FROM python:3.12-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install deps first for layer caching
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY app ./app

# The daily refresh writes the cache; the API serves it. Override CMD to run the
# refresh job instead (e.g. in a scheduled task):
#   docker run ... python -m app.refresh
ENV PORT=8000
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
