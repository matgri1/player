# Что известно о действующей системе QUY Travel

Источник: архив `QUY-Telegram-Bot.zip`, который владелец выгрузил с сервера 21.11.2026
(снимок кода без токенов, паролей и данных). Сам архив в этот пакет **не входит** — он есть у владельца.

## Компоненты
- **Сайт / мини-приложение**: `https://82-27-201-63.nip.io/quytravel/` (React-сборка в `client/dist`).
- **API**: Node.js/Express, `server/dist/index.js`, порт из `PORT` (по умолчанию 3001), PostgreSQL.
  Клиент обращается к API по пути `/quytravel/api/...`.
- **Бот**: отдельный процесс `server/dist/bot-daemon.js`, @quytravel_bot, long polling.
  ⚠️ Нельзя запускать вторую копию с тем же токеном — она перехватит обновления.
- **Google Sheets**: `services/sheets-sync.js` — заявки уже синхронизируются в Google Таблицу.
- **Админка QUY** есть внутри их приложения (наборы групп, все заявки, фин. калькулятор).
- Менеджер визаранов в Telegram: **@quynhon_visarun**.

## Вход и сессии
- Вход через **Telegram Login Widget** (`/quytravel/api/journeys/account/telegram`) или
  через **initData** мини-приложения (заголовок `x-telegram-init-data`).
- Роут входа принимает только `Origin: https://82-27-201-63.nip.io` (жёстко в коде).
- Сессия: cookie `quy_web_session`, `Path=/quytravel/`, HttpOnly.
- Поэтому с другого домена (наш Kuy) **нельзя** залогинить пользователя QUY или создать
  заявку от его имени без изменений на их сервере.

## Публичные (без входа) эндпоинты, которые использует сайт Kuy
- `GET /quytravel/api/journeys/recruitment/departures` — открытые выезды:
  `id, route_id, departure_date, departure_time, return_time, status, recruitment_note,
  destination_name, destination_country ('Laos'|'Cambodia'), border_name, price_vnd, vehicle_name`.
  Статусы: `recruiting, proposal_ready, open, few_seats, confirmed`.
- `GET /quytravel/api/journeys/visa-options` — `{stamp:{name,fee}, evisa90:{…}, multivisa:{…}}`.
- `GET /quytravel/api/journeys/catalog?city=quynhon` — маршруты, выезды, бонусы и т.д.
- CORS: `cors({ origin: true, credentials: true })` — публичные GET доступны с любого домена.

## Заявка на визаран в QUY (`POST /journeys/requests`, только с входом)
- `kind`: `visarun | transfer | sleeper`; `request_mode`: `scheduled | date_request`.
- `passenger_details[]`: `name`, `nationality`, `entry_type` (`stamp|visa`), `visa_type`
  (`stamp|evisa90|multivisa`); 1–20 пассажиров.
- Обязателен Telegram `@username`, совпадающий с вошедшим пользователем.
- `travel_date` в пределах года; для `scheduled` — `trip_id` открытого выезда.
- `idempotency_key` 8–100 символов; лимит 50 заявок в час на пользователя.
- Статусы: `pending_group` (свободная дата), `awaiting_proposal` (выезд), далее предложение
  организатора → клиент подтверждает. Без предоплаты, оплата при посадке.

## QUY Club (бонусы и рефералы)
- Личный код пользователя: `QUY` + hex (создаётся при первом входе).
- Ссылки приглашения: `?ref=QUY…` на сайте или `t.me/quytravel_bot?startapp=ref_QUY…`.
- Привязка — только новым клиентам (до первой заявки, в первые 24 ч после регистрации).
- Курс бонуса настраивается (`loyalty_settings`), в коде `CLUB_RATE = 1000` VND за балл.
- Сайт Kuy передаёт `QUY…` коды дальше в ссылки на бота/сайт QUY.

## Напоминания о визе
- В профиле есть `visa_expiry_date`, `notify_consent`, `reminder_days` (по умолчанию 30/14/7).
- Сайт Kuy пока использует **отдельный тестовый бот** (поле `REMINDER_BOT` в `kuy/app.js`,
  формат ссылки `t.me/<bot>?start=visa_YYYYMMDD`) — по решению владельца.

## Безопасность (замечено при чтении кода)
- В README архива сказано, что **токен бота был вшит в исходник `bot-daemon.js`** на сервере,
  а в коде был резервный пароль PostgreSQL. Рекомендовано: вынести в `.env` и перевыпустить
  токен в @BotFather. Это решение владельца; без его согласия не трогать.

## Как потом объединить с Kuy (варианты)
1. **Kuy → QUY**: сервер Kuy после сохранения заявки пересылает её в `journey_requests` QUY
   (как «заявка с сайта, контакт не подтверждён»). Нужен служебный эндпоинт или прямой доступ к их БД.
2. **QUY читает Kuy**: в админке QUY показывать таблицу `kuy_visa_requests`.
3. **Единый вход**: Telegram Login Widget на домене Kuy (нужно `/setdomain` у бота — у одного бота
   один домен, поэтому вероятно отдельный бот или общий домен) + разрешить Origin в их коде.
Все варианты требуют изменений в коде QUY — только по решению владельца.
