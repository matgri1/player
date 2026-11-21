import { Router } from 'express';
import crypto from 'node:crypto';
import { pool } from '../db.js';
import { validateRequest, vnDate } from '../validate.js';
import { rateLimiter } from '../security.js';
import { notifyNewRequest } from '../notify.js';

const router = Router();
const limit = rateLimiter({ windowMs: 10 * 60e3, max: 8 });
const allowed = () => (process.env.PUBLIC_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);

router.get('/health', (req, res) => res.json({ ok: true, service: 'kuy', time: new Date().toISOString() }));

function newCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rnd = crypto.randomBytes(4);
  const tail = Array.from(rnd, (b) => alphabet[b % alphabet.length]).join('');
  return 'QN-' + vnDate(0).slice(2).replace(/-/g, '') + '-' + tail;
}

// POST /api/visa/requests — a visa run request from the website form
router.post('/visa/requests', async (req, res) => {
  try {
    const origin = req.headers.origin;
    if (origin) {
      let host = '';
      try { host = new URL(origin).host; } catch { /* bad origin */ }
      if (host !== req.headers.host && !allowed().includes(origin)) return res.status(403).json({ error: 'Origin not allowed' });
    }
    if (!limit(req.ip)) return res.status(429).json({ error: 'Too many requests. Please message us instead.' });

    const v = validateRequest(req.body);
    if (v.spam) return res.status(201).json({ code: 'QN-OK' });      // pretend success for bots
    if (v.errors) return res.status(400).json({ error: 'Please check the form', fields: v.errors });
    const d = v.data;

    const existing = await pool.query('SELECT code FROM kuy_visa_requests WHERE idempotency_key=$1', [d.idempotency_key]);
    if (existing.rowCount) return res.status(200).json({ code: existing.rows[0].code, duplicate: true });

    let row = null;
    for (let attempt = 0; attempt < 5 && !row; attempt++) {
      try {
        row = (await pool.query(
          `INSERT INTO kuy_visa_requests
            (code, idempotency_key, lang, destination, request_mode, quy_trip_id, travel_date, departure_time,
             pax_count, passengers, contact_name, contact_channel, contact_value, pickup, note,
             club_code, ref_code, est_price_per_person, est_visa_total)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
           RETURNING *`,
          [newCode(), d.idempotency_key, d.lang, d.destination, d.request_mode, d.quy_trip_id, d.travel_date, d.departure_time,
            d.pax_count, JSON.stringify(d.passengers), d.contact_name, d.contact_channel, d.contact_value, d.pickup, d.note,
            d.club_code, d.ref_code, d.est_price_per_person, d.est_visa_total]
        )).rows[0];
      } catch (err) {
        if (err.code !== '23505') throw err;                       // unique violation: retry with a new code
        const dup = await pool.query('SELECT code FROM kuy_visa_requests WHERE idempotency_key=$1', [d.idempotency_key]);
        if (dup.rowCount) return res.status(200).json({ code: dup.rows[0].code, duplicate: true });
      }
    }
    if (!row) throw new Error('Could not create request code');
    await pool.query("INSERT INTO kuy_audit_log(request_id, actor, action, details) VALUES ($1,'site','created',$2)",
      [row.id, JSON.stringify({ lang: row.lang })]);
    notifyNewRequest(row);                                         // fire and forget
    res.status(201).json({ code: row.code });
  } catch (err) {
    console.error('Create request:', err.message);
    res.status(500).json({ error: 'Something went wrong. Please message us in Telegram or WhatsApp.' });
  }
});

export default router;
