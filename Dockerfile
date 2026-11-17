# One server: the API computes user fields (POST /field) and serves the built site.
#   docker build -t furrow . && docker run -d --restart unless-stopped -p 8000:8000 -v furrow-cache:/app/data/cache furrow
FROM node:24-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir numpy==2.5.4 pymoo==0.6.2 h3==4.5.0 fastapi==0.163.1 uvicorn==0.54.0
COPY pipeline/*.py pipeline/
COPY --from=web /web/dist web/dist
COPY web/public/data web/public/data
EXPOSE 8000
CMD ["uvicorn", "--app-dir", "pipeline", "api:app", "--host", "0.0.0.0", "--port", "8000"]
