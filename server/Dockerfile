# Build from the repository root:  docker build -f server/Dockerfile -t mizani-vision .
# Works as a Hugging Face "Docker" Space as-is (it listens on 7860).
FROM python:3.12-slim
WORKDIR /srv
COPY server/requirements.txt server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt
COPY server server
COPY public/models public/models
ENV MODELS_DIR=/srv/public/models
EXPOSE 7860
CMD ["uvicorn", "server.app:app", "--host", "0.0.0.0", "--port", "7860"]
