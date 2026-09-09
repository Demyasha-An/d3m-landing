# d3m-landing

Минималистичный лендинг VPN-сервиса: статический одностраничник (Express + TypeScript),
живой бейдж статуса серверов и пасхалки с промокодами.

[![Docker](https://github.com/Demyasha-An/d3m-landing/actions/workflows/docker.yml/badge.svg)](https://github.com/Demyasha-An/d3m-landing/actions/workflows/docker.yml)
[![GHCR](https://img.shields.io/badge/ghcr.io-d3m--landing-blue)](https://github.com/users/Demyasha-An/packages/container/package/d3m-landing)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> Репозиторий и пакет приватные: установка и деплой требуют доступа к репо
> и токена с правом `read:packages` (см. ниже).

## Возможности

- 🏠 Лендинг: `public/` (HTML/CSS/JS, Three.js-фон), кнопки «Кабинет» и «Telegram», тарифы «от …»
- 🟢 Живой статус: `GET /api/nodes-status` опрашивает панель **Remnawave**
  (`GET /api/nodes`), считает онлайн/оффлайн и **рекомендует самую свободную ноду**
  (минимум `usersOnline`). Без задержек и пингов — никакой лишней нагрузки.
- 🥚 Пасхалки: напечатай `promo` или кликни 3 раза по логотипу — получишь промокод.
- ❤️ `GET /healthz` для Docker healthcheck.
- 🐳 Готовый образ в GHCR, сборка через GitHub Actions при каждом пуше в `main`.

## Быстрый старт на сервере (готовый образ из GHCR)

```bash
# 1. Каталог установки и общая сеть с реверс-прокси
mkdir -p /opt/d3m-landing && cd /opt/d3m-landing
docker network create remnawave-network 2>/dev/null || true

# 2. Скачай два файла (нужен доступ к репо). Любой вариант:
#    а) один файл через gh CLI:
#       gh api repos/Demyasha-An/d3m-landing/contents/docker-compose.yml --jq .content | base64 -d > docker-compose.yml
#       gh api repos/Demyasha-An/d3m-landing/contents/.env.example --jq .content | base64 -d > .env.example
#    б) напрямую с raw (токен с правом repo — можно взять из `gh auth token`):
#       curl -fsSL -H "Authorization: Bearer <TOKEN>" \
#         -o docker-compose.yml https://raw.githubusercontent.com/Demyasha-An/d3m-landing/main/docker-compose.yml
#       curl -fsSL -H "Authorization: Bearer <TOKEN>" \
#         -o .env.example https://raw.githubusercontent.com/Demyasha-An/d3m-landing/main/.env.example
#    в) руками со страницы репозитория (файл → Raw → сохранить):
#       https://github.com/Demyasha-An/d3m-landing/blob/main/docker-compose.yml
#       https://github.com/Demyasha-An/d3m-landing/blob/main/.env.example

# 3. Конфиг из шаблона
cp .env.example .env
nano .env   # заполнить (разбор переменных — ниже)

# 4. Логин в GHCR (пакет приватный! токен: Settings → Developer settings →
#    Personal access tokens → classic, scope read:packages)
echo <TOKEN> | docker login ghcr.io -u <GITHUB_USERNAME> --password-stdin

# 5. Запуск
docker compose pull && docker compose up -d
docker compose ps
curl -s http://127.0.0.1:3000/healthz   # {"status":"ok"}
```

Обновление:

```bash
cd /opt/d3m-landing && docker compose pull && docker compose up -d
```

## Переменные окружения (`.env`)

| Переменная | Обязат. | Дефолт | Где взять / что значит |
|---|---|---|---|
| `HOST` | − | `0.0.0.0` | Адрес бинда внутри контейнера. Не менять без нужды |
| `PORT` | − | `3000` | Порт внутри контейнера и слева в `ports:` компоуза |
| `SITE_DOMAIN` | − | `d3mvpn.local` | Косметика: только в стартовом логе |
| `DASHBOARD_URL` | − | `https://cabinet.d3mvpn.local` | Кнопка «Кабинет / Регистрация», уходит в браузер |
| `TELEGRAM_BOT_URL` | − | `https://t.me/d3mvpn_bot` | Кнопка «Начать в Telegram», уходит в браузер |
| `MIN_PRICE` / `CURRENCY` | − | `80` / `₽` | «Тарифы от …», уходит в браузер |
| `REMNAWAVE_API_URL` | − | — | Базовый URL панели **без** `/api`, напр. `https://panel.example.com`. Пусто → статус `source:none`, лендинг работает |
| `REMNAWAVE_API_TOKEN` | − | — | Панель → Settings → API Tokens → Create, минимальные скоупы **`nodes:list` + `hosts:list`** (только чтение). **Только сервер**, в браузер не попадает |
| `PROMO_WORD_CODE` / `PROMO_WORD_TEXT` | − | — | Пасхалка №1 (напечатать `promo`). Пустой код выключает |
| `PROMO_LOGO_CODE` / `PROMO_LOGO_TEXT` | − | — | Пасхалка №2 (тройной клик по лого) |

> ⚠️ Промокоды отдаются в браузер через `/config.js` — это механика показа,
> а не секрет. Считай их публичными.

## API

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/healthz` | `{"status":"ok"}` — Docker healthcheck |
| `GET` | `/config.js` | Публичный конфиг для браузера (`window.__D3MVPN_CONFIG__`) |
| `GET` | `/api/nodes-status` | Статус нод (кэш 30с). Пример: |

```json
{
  "allActive": true,
  "totalNodes": 2,
  "activeNodes": 2,
  "recommendedNode": { "name": "Amsterdam", "usersOnline": 12 },
  "source": "remnawave",
  "nodes": [
    { "name": "Amsterdam", "countryCode": "NL", "status": true, "usersOnline": 12 },
    { "name": "Frankfurt", "countryCode": "DE", "status": true, "usersOnline": 47 }
  ]
}
```

## Локальная разработка

```bash
npm install
npm run dev      # ts-node-dev, http://127.0.0.1:3000 (нужен свой .env)
npm run build    # tsc → dist/
npm start        # node dist/server.js
```

Сборка образа без доступа демона к registry (см. `Dockerfile.offline`):

```bash
npm install && npm run build
# базу один раз: crane pull --platform linux/amd64 node:20-alpine base.tar && docker load -i base.tar
docker build -f Dockerfile.offline -t ghcr.io/demyasha-an/d3m-landing:latest .
```

## Структура

```
├── src/server.ts            # Express: статика, /config.js, /healthz, /api/nodes-status
├── public/                  # Лендинг (index.html, styles.css, script.js, bg.js, logo.svg)
├── Dockerfile               # Прод-сборка (npm ci внутри, нужен интернет у демона)
├── Dockerfile.offline       # Сборка из готовых node_modules/ + dist/ (без сети)
├── docker-compose.yml       # Прод-стек: образ из GHCR + healthcheck
├── .env.example             # Шаблон конфига с комментариями
└── .github/workflows/       # CI: сборка и пуш образа в GHCR
```

## Лицензия

MIT
