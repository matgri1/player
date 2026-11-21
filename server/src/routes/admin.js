import { Router } from 'express';
import { pool } from '../db.js';
import { STATUSES, vnDate } from '../validate.js';
import { rateLimiter, verifyPassword, setSession, clearSession, readSession, sameOrigin } from '../security.js';

const router = Router();
const loginLimit = rateLimiter({ windowMs: 15 * 60e3, max: 10 });

router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
// Every change must come from our own admin page
router.use((req, res, next) => {
  if (req.method !== 'GET' && !sameOrigin(req)) return res.status(403).json({ error: 'Запрос с чужого сайта отклонён.' });
  next();
});

router.post('/login', (req, res) => {
  if (!loginLimit(req.ip)) return res.status(429).json({ error: 'Слишком много попыток. Подождите 15 минут.' });
  if (!process.env.SESSION_SECRET || !process.env.ADMIN_PASSWORD_HASH) return res.status(503).json({ error: 'Админка не настроена: заполните SESSION_SECRET и ADMIN_PASSWORD_HASH в .env.' });
  const { login, password } = req.body || {};
  const okLogin = String(login || '') === (process.env.ADMIN_LOGIN || 'admin');
  const okPass = verifyPassword(password, process.env.ADMIN_PASSWORD_HASH);
  if (!okLogin || !okPass) return res.status(401).json({ error: 'Неверный логин или пароль.' });
  setSession(req, res, process.env.ADMIN_LOGIN || 'admin');
  res.json({ login: process.env.ADMIN_LOGIN || 'admin' });
});

router.post('/logout', (req, res) => { clearSession(res); res.json({ ok: true }); });

router.use((req, res, next) => {
  const s = readSession(req);
  if (!s) return res.status(401).json({ error: 'Войдите в админку.' });
  req.admin = s.login;
  next();
});

router.get('/me', (req, res) => res.json({ login: req.admin }));

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => { console.error('Admin API:', e.message); res.status(500).json({ error: 'Ошибка сервера.' }); });

// Dashboard numbers
router.get('/stats', wrap(async (req, res) => {
  const today = vnDate(0), in14 = vnDate(14);
  const [byStatus, newToday, upcoming] = await Promise.all([
    pool.query('SELECT status, count(*)::int AS n FROM kuy_visa_requests GROUP BY status'),
    pool.query("SELECT count(*)::int AS n FROM kuy_visa_requests WHERE (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date"),
    pool.query("SELECT coalesce(sum(pax_count),0)::int AS pax, count(*)::int AS n FROM kuy_visa_requests WHERE status <> 'cancelled' AND travel_date BETWEEN $1 AND $2", [today, in14])
  ]);
  res.json({
    by_status: Object.fromEntries(STATUSES.map((s) => [s, byStatus.rows.find((r) => r.status === s)?.n || 0])),
    new_today: newToday.rows[0].n,
    next14: upcoming.rows[0]
  });
}));

// Request list with filters
router.get('/requests', wrap(async (req, res) => {
  const where = [], args = [];
  const add = (sql, v) => { args.push(v); where.push(sql.replace('?', '$' + args.length)); };
  if (STATUSES.includes(req.query.status)) add('status = ?', req.query.status);
  if (['laos', 'cambodia'].includes(req.query.destination)) add('destination = ?', req.query.destination);
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '')) add('travel_date >= ?', req.query.from);
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '')) add('travel_date <= ?', req.query.to);
  const q = String(req.query.q || '').trim().slice(0, 80);
  if (q) {
    args.push('%' + q.replace(/[%_\\]/g, '\\$&') + '%');
    const n = '$' + args.length;
    where.push(`(code ILIKE ${n} OR contact_name ILIKE ${n} OR contact_value ILIKE ${n} OR pickup ILIKE ${n} OR passengers::text ILIKE ${n})`);
  }
  const sql = `SELECT id, code, created_at, destination, request_mode, travel_date, departure_time, pax_count,
                      contact_name, contact_channel, contact_value, status, club_code, ref_code
               FROM kuy_visa_requests ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY created_at DESC LIMIT 500`;
  res.json((await pool.query(sql, args)).rows);
}));

router.get('/requests/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) return res.status(400).json({ error: 'Неверный номер.' });
  const r = await pool.query('SELECT * FROM kuy_visa_requests WHERE id=$1', [id]);
  if (!r.rowCount) return res.status(404).json({ error: 'Заявка не найдена.' });
  const log = await pool.query('SELECT created_at, actor, action, details FROM kuy_audit_log WHERE request_id=$1 ORDER BY created_at', [id]);
  res.json({ ...r.rows[0], log: log.rows });
}));

router.patch('/requests/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const sets = [], args = [], changes = {};
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) return res.status(400).json({ error: 'Неизвестный статус.' });
    args.push(b.status); sets.push('status=$' + args.length); changes.status = b.status;
  }
  if (b.admin_note !== undefined) {
    const note = String(b.admin_note).slice(0, 2000);
    args.push(note); sets.push('admin_note=$' + args.length); changes.admin_note = true;
  }
  if (!sets.length) return res.status(400).json({ error: 'Нечего сохранять.' });
  args.push(id);
  const r = await pool.query(`UPDATE kuy_visa_requests SET ${sets.join(', ')}, updated_at=now() WHERE id=$${args.length} RETURNING *`, args);
  if (!r.rowCount) return res.status(404).json({ error: 'Заявка не найдена.' });
  await pool.query('INSERT INTO kuy_audit_log(request_id, actor, action, details) VALUES ($1,$2,$3,$4)',
    [id, req.admin, 'updated', JSON.stringify(changes)]);
  res.json(r.rows[0]);
}));

// Groups: everyone going on the same date to the same border
router.get('/groups', wrap(async (req, res) => {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : vnDate(0);
  const rows = (await pool.query(
    `SELECT id, code, travel_date, departure_time, destination, request_mode, pax_count, passengers,
            contact_name, contact_value, pickup, status
     FROM kuy_visa_requests WHERE status <> 'cancelled' AND travel_date >= $1
     ORDER BY travel_date, destination, created_at`, [from])).rows;
  const groups = new Map();
  for (const r of rows) {
    const key = r.travel_date + '|' + r.destination;
    if (!groups.has(key)) groups.set(key, { travel_date: r.travel_date, destination: r.destination, pax: 0, requests: 0, by_status: {}, items: [] });
    const g = groups.get(key);
    g.pax += r.pax_count; g.requests += 1;
    g.by_status[r.status] = (g.by_status[r.status] || 0) + r.pax_count;
    g.items.push(r);
  }
  res.json([...groups.values()]);
}));

// CSV export (opens in Google Sheets / Excel)
router.get('/export.csv', wrap(async (req, res) => {
  const args = [], where = [];
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '')) { args.push(req.query.from); where.push('travel_date >= $' + args.length); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '')) { args.push(req.query.to); where.push('travel_date <= $' + args.length); }
  const rows = (await pool.query(`SELECT * FROM kuy_visa_requests ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY travel_date, created_at`, args)).rows;
  const cols = ['code', 'created_at', 'status', 'destination', 'request_mode', 'travel_date', 'departure_time', 'pax_count', 'passengers',
    'contact_name', 'contact_channel', 'contact_value', 'pickup', 'note', 'club_code', 'ref_code', 'est_price_per_person', 'est_visa_total', 'admin_note', 'lang'];
  const cell = (v) => {
    let s = v == null ? '' : v instanceof Date ? v.toISOString() : typeof v === 'object' ? v.map((p) => `${p.name} (${p.nationality}, ${p.visa})`).join('; ') : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;                           // no formula injection in spreadsheets
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const csv = '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n');
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="kuy-visa-requests-${vnDate(0)}.csv"`);
  res.send(csv);
}));

export default router;
