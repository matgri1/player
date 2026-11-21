# Kuy server: заявки с сайта и админ-панель

Небольшой сервис на Node.js + Express + PostgreSQL (тот же стек, что у QUY Travel).

- отдаёт сайт из папки `../kuy` по адресу `/`;
- принимает заявки на визаран с сайта: `POST /api/visa/requests`;
- админ-панель для команды: `/admin` (вход по логину и паролю).

Сайт на GitHub Pages продолжает работать без сервера: форма тогда отправляет заявку
сообщением в Telegram. Как только сайт отдаёт этот сервер, заявки сохраняются в базу.

## Что умеет админка

- **Сводка**: новые заявки, сколько поступило сегодня, сколько человек едет в ближайшие 14 дней.
- **Заявки**: поиск, фильтры по статусу, границе и датам; карточка заявки с пассажирами,
  контактом (кнопка «Написать клиенту»), статусом (новая → связались → подтверждена →
  завершена / отменена), заметкой и историей изменений.
- **Группы**: все, кто едет в одну дату на одну границу, со списком пассажиров.
- **Выгрузить CSV**: открывается в Google Таблицах и Excel.
- **Уведомление в Telegram** о каждой новой заявке (если заданы бот и чат).

## Защита

- пароль хранится только в виде хэша (scrypt); вход ограничен 10 попытками за 15 минут;
- сессия в подписанной cookie (HttpOnly, SameSite=Strict, Secure за HTTPS);
- изменения в админке принимаются только со своей страницы (защита от CSRF);
- заявки: проверка всех полей на сервере, ловушка для ботов, не больше 8 заявок
  за 10 минут с одного адреса, защита от двойной отправки;
- выгрузка CSV защищена от формул-инъекций в таблицах;
- `/admin` закрыт от поисковиков и встраивания во фреймы.

## Локальный запуск

```bash
cd server
npm install
cp .env.example .env          # заполнить
npm run hash-password         # получить ADMIN_PASSWORD_HASH
npm start                     # http://127.0.0.1:3100 , админка: /admin
npm test                      # проверки валидации
```

Таблицы создаются автоматически при запуске (`src/schema.sql`).

## Перенос на сервер (Ubuntu)

1. **Node.js 20+ и PostgreSQL.** Если уже стоят для QUY Travel, ставить заново не нужно.
2. **База и пользователь** (отдельные от QUY):
   ```bash
   sudo -u postgres psql -c "CREATE USER kuy WITH PASSWORD 'сложный-пароль';"
   sudo -u postgres psql -c "CREATE DATABASE kuy OWNER kuy;"
   ```
3. **Код**: скопировать папки `kuy/` и `server/` в `/opt/kuy/`, затем
   `cd /opt/kuy/server && npm ci --omit=dev`.
4. **`.env`**: `DATABASE_URL=postgres://kuy:…@127.0.0.1:5432/kuy`,
   `SESSION_SECRET` (`openssl rand -hex 32`), `ADMIN_PASSWORD_HASH`, `TRUST_PROXY=1`,
   `ADMIN_URL=https://ваш-домен/admin/`. Права: `chmod 600 .env`.
5. **Автозапуск** `/etc/systemd/system/kuy.service`:
   ```ini
   [Unit]
   Description=Kuy site and admin
   After=network.target postgresql.service

   [Service]
   WorkingDirectory=/opt/kuy/server
   ExecStart=/usr/bin/node src/index.js
   Restart=always
   User=kuy
   Environment=NODE_ENV=production

   [Install]
   WantedBy=multi-user.target
   ```
   `sudo systemctl enable --now kuy`
6. **nginx + HTTPS** (сервер слушает только 127.0.0.1:3100):
   ```nginx
   server {
     server_name kuy.example.com;
     location / { proxy_pass http://127.0.0.1:3100; proxy_set_header Host $host;
                  proxy_set_header X-Forwarded-For $remote_addr; proxy_set_header X-Forwarded-Proto $scheme; }
   }
   ```
   затем `sudo certbot --nginx -d kuy.example.com`.
7. **Уведомления**: создать тестового бота в @BotFather, добавить его в чат админов,
   вписать `TELEGRAM_BOT_TOKEN` и `TELEGRAM_ADMIN_CHAT_ID`, перезапустить сервис.
8. **Резервные копии**: `pg_dump kuy > kuy-$(date +%F).sql` раз в день (cron).

## Связка с QUY Travel (следующий шаг)

Сейчас заявки с сайта хранятся в своей таблице `kuy_visa_requests`. В ней уже есть всё,
что нужно QUY: id выезда (`quy_trip_id`), дата, пассажиры с гражданством и визой,
код QUY Club. Когда решим объединять, можно:
- передавать каждую заявку в `journey_requests` QUY Travel (тогда она появится
  в их админке и Google Таблице), или
- показывать заявки с сайта прямо в админке QUY.
