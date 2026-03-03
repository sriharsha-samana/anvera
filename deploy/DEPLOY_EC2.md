# Deploy Anvera on AWS EC2 (Docker + HTTPS)

This deploys frontend + backend + SQLite with persistent Docker volumes and automatic TLS via Caddy.

## 1) Create infrastructure

1. Launch an Ubuntu 24.04 EC2 instance.
2. Security Group inbound rules:
   - TCP 22 from your IP
   - TCP 80 from 0.0.0.0/0
   - TCP 443 from 0.0.0.0/0
3. Create DNS records:
   - `app.example.com` -> EC2 public IP
   - `api.example.com` -> EC2 public IP

## 2) Install Docker

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

## 3) Clone and configure

```bash
git clone <your-repo-url> anvera
cd anvera/deploy
cp .env.cloud.example .env.cloud
```

Edit `.env.cloud`:
- Set `APP_DOMAIN` and `API_DOMAIN`
- Set a strong `JWT_SECRET`
- Configure `AI_PROVIDER` + keys (`LLM_API_KEY` for openrouter/groq/openai_compatible)

## 4) Deploy

From `anvera/deploy`:

```bash
docker compose --env-file .env.cloud -f docker-compose.cloud.yml up -d --build
```

## 5) Verify

```bash
curl -sS https://api.example.com/health
```

Expected: `{ "ok": true }`

Open in browser:
- `https://app.example.com`

## 6) Update to latest version

```bash
cd ~/anvera
git pull
cd deploy
docker compose --env-file .env.cloud -f docker-compose.cloud.yml up -d --build
```

## 7) Back up SQLite data

DB file lives inside Docker volume `sqlite_data` as `/data/prod.db`.

Quick backup command:

```bash
docker run --rm -v deploy_sqlite_data:/data -v "$PWD":/backup alpine sh -c 'cp /data/prod.db /backup/prod.db.backup'
```

## Notes

- This setup is single-node and suitable for small/medium workloads.
- For horizontal scaling, migrate from SQLite to Postgres first.
