# План переноса Kuy на сервер

Сервер владельца: адрес и SSH-доступ владелец даст в чате.
На сервере уже работает **QUY Travel**: сайт `https://82-27-201-63.nip.io/quytravel/`,
API (Node/Express, по README порт 3001), PostgreSQL, Telegram-бот @quytravel_bot (polling).

**Цель:** поставить Kuy рядом, ничего не сломав у QUY Travel.

Предлагаемая схема:
```
https://kuy.82-27-201-63.nip.io   →  nginx (новый server-блок)  →  127.0.0.1:3100  →  Kuy (systemd: kuy.service)
                                                                         ├─ сайт:   /opt/kuy/kuy
                                                                         ├─ API:    /api/...
                                                                         └─ админка:/admin
PostgreSQL: отдельная база `kuy`, отдельный пользователь `kuy`
```
`nip.io` резолвит любой поддомен вида `*.82-27-201-63.nip.io` в этот IP, поэтому отдельный
домен покупать не нужно, а сертификат Let's Encrypt выпускается обычным `certbot`.
Позже можно заменить на свой домен (поменять `server_name`, выпустить сертификат, обновить `SITE_URL`).

---

## Этап 0. Подключение
Проверить, что SSH работает, и **ничего не менять**:
```bash
ssh -i <ключ> -o BatchMode=yes -o IdentitiesOnly=yes <user>@<server> 'hostname; uptime'
```

## Этап 1. Разведка (только чтение) → отчёт владельцу
```bash
cat /etc/os-release | head -3; uname -r
node -v; npm -v; which pm2 docker 2>/dev/null
df -h /; free -h
ss -ltnp                                   # кто какие порты слушает (3100 должен быть свободен)
systemctl list-units --type=service --state=running --no-pager | grep -Eiv "systemd|getty|dbus|cron|ssh|rsyslog|polkit|udev|journald|logind|networkd|resolved"
ps -eo pid,etime,user,cmd | grep -Ei "node|python|bot" | grep -v grep   # ⚠ не выводить строки с токенами в чат
nginx -v; ls -la /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null
nginx -T 2>/dev/null | grep -nE "server_name|listen|location|proxy_pass|root" | head -60
certbot certificates 2>/dev/null | grep -E "Certificate Name|Domains|Expiry"
sudo -u postgres psql -Atc "select version();" ; sudo -u postgres psql -Atc "\l" | cut -d'|' -f1
```
Сообщить владельцу: версии Node/PostgreSQL/nginx, свободен ли порт 3100, как устроен nginx у QUY,
есть ли certbot. **Согласовать** поддомен и план, прежде чем что-то ставить.

Требования Kuy: Node.js **≥ 20.12** (используется `process.loadEnvFile`), PostgreSQL ≥ 12, nginx.
Если Node старее — не обновлять системный Node (сломает QUY), а поставить второй через `nvm`
для пользователя `kuy` или обсудить с владельцем.

## Этап 2. Пользователь и файлы
```bash
useradd --system --create-home --home-dir /opt/kuy --shell /usr/sbin/nologin kuy
```
Залить код одним из способов:
- **из архива**: `scp kuy-project.zip <user>@<server>:/tmp/` → `unzip` → скопировать `kuy/` и `server/` в `/opt/kuy/`;
- **из GitHub**: `git clone -b claude/kuy-vietnam-services-site-646vgc https://github.com/matgri1/player.git /opt/kuy/repo`
  и использовать `/opt/kuy/repo/kuy` + `/opt/kuy/repo/server` (тогда в `.env` `SITE_DIR=../kuy` остаётся верным).
```bash
chown -R kuy:kuy /opt/kuy
cd /opt/kuy/server && sudo -u kuy npm ci --omit=dev
```

## Этап 3. База данных (отдельная от QUY)
```bash
PW=$(openssl rand -hex 24)
sudo -u postgres psql -c "CREATE USER kuy WITH PASSWORD '$PW';"
sudo -u postgres psql -c "CREATE DATABASE kuy OWNER kuy;"
echo "DATABASE_URL=postgres://kuy:$PW@127.0.0.1:5432/kuy"   # записать в .env, в чат НЕ выводить
```
Таблицы создаются автоматически при первом запуске (`server/src/schema.sql`).

## Этап 4. `.env` (секреты только на сервере)
```bash
cd /opt/kuy/server && cp .env.example .env && chmod 600 .env && chown kuy:kuy .env
```
Заполнить:
- `DATABASE_URL` — из этапа 3;
- `SESSION_SECRET` — `openssl rand -hex 32`;
- `ADMIN_LOGIN` — например `admin`;
- `ADMIN_PASSWORD_HASH` — **пароль вводит сам владелец** в своём SSH-терминале:
  `cd /opt/kuy/server && node scripts/hash-password.js` → вставить строку в `.env`.
  Пароль в чат не писать;
- `TRUST_PROXY=1`, `SITE_DIR=../kuy`, `ADMIN_URL=https://kuy.82-27-201-63.nip.io/admin/`;
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID` — пусто, пока нет тестового бота
  (**не** токен @quytravel_bot).

## Этап 5. Автозапуск (systemd)
`/etc/systemd/system/kuy.service`:
```ini
[Unit]
Description=Kuy site, API and admin
After=network.target postgresql.service

[Service]
User=kuy
WorkingDirectory=/opt/kuy/server
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```
(путь к `node` проверить: `which node`; если nvm — указать полный путь.)
```bash
systemctl daemon-reload && systemctl enable --now kuy
systemctl status kuy --no-pager | head -5
curl -s http://127.0.0.1:3100/api/health          # {"ok":true,...}
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3100/visa/index.html   # 200
```

## Этап 6. nginx + HTTPS (новый файл, существующие не трогать)
```bash
cp -a /etc/nginx /root/nginx-backup-$(date +%F-%H%M)          # резервная копия
```
`/etc/nginx/sites-available/kuy` (или `conf.d/kuy.conf` — как принято на сервере):
```nginx
server {
    listen 80;
    server_name kuy.82-27-201-63.nip.io;
    client_max_body_size 64k;
    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
```bash
ln -s /etc/nginx/sites-available/kuy /etc/nginx/sites-enabled/kuy
nginx -t && systemctl reload nginx
certbot --nginx -d kuy.82-27-201-63.nip.io        # HTTPS + редирект
curl -sI https://kuy.82-27-201-63.nip.io/ | head -3
curl -sI https://82-27-201-63.nip.io/quytravel/ | head -3    # QUY Travel по-прежнему работает
```

## Этап 7. Настройки сайта под новый адрес
В `/opt/kuy/kuy/app.js`:
- `SITE_URL = "https://kuy.82-27-201-63.nip.io/"` (для реферальных ссылок);
- `SITE_API = "/api"` — оставить;
- `CONTACTS` — заполнить, когда владелец даст контакты.
Изменения статики применяются сразу (перезапуск не нужен; при необходимости очистить кэш браузера).

## Этап 8. Проверка руками
1. Открыть `https://kuy.82-27-201-63.nip.io/visa/index.html#book` — расписание должно подгрузиться
   из API QUY (у их публичных маршрутов CORS открыт). Пройти форму с пометкой «TEST» в комментарии.
   Ожидается экран **«Request received!»**.
2. Открыть `/admin`, войти — заявка видна в «Заявках» и «Группах», выгрузка CSV работает.
3. Удалить тестовую заявку:
   `sudo -u postgres psql kuy -c "DELETE FROM kuy_visa_requests WHERE note ILIKE '%TEST%';"`
4. Проверить, что QUY Travel (сайт и бот) работают как раньше.

## Этап 9. Резервные копии
```bash
mkdir -p /var/backups/kuy && chown postgres /var/backups/kuy
echo '15 3 * * * postgres pg_dump kuy | gzip > /var/backups/kuy/kuy-$(date +\%F).sql.gz && find /var/backups/kuy -mtime +30 -delete' > /etc/cron.d/kuy-backup
```

## Обновление кода потом
```bash
cd /opt/kuy/repo && sudo -u kuy git pull          # если ставили из git
cd /opt/kuy/server && sudo -u kuy npm ci --omit=dev && systemctl restart kuy
```

## Откат (если что-то пошло не так)
```bash
systemctl disable --now kuy
rm /etc/nginx/sites-enabled/kuy && nginx -t && systemctl reload nginx
# при необходимости: sudo -u postgres psql -c "DROP DATABASE kuy;" -c "DROP USER kuy;"
```
QUY Travel при этом не затрагивается.
