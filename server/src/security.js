import crypto from 'node:crypto';

// ---------- Rate limiting (in memory, per key) ----------
export function rateLimiter({ windowMs, max }) {
  const hits = new Map();
  return function hit(key) {
    const now = Date.now();
    let h = hits.get(key);
    if (!h || h.reset < now) { h = { n: 0, reset: now + windowMs }; hits.set(key, h); }
    h.n += 1;
    if (hits.size > 20000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    return h.n <= max;
  };
}

// ---------- Password hashing (scrypt) ----------
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$${salt.toString('base64')}$${hash.toString('base64')}`;
}
export function verifyPassword(password, stored) {
  try {
    const [kind, n, salt, hash] = String(stored || '').split('$');
    if (kind !== 'scrypt') return false;
    const expected = Buffer.from(hash, 'base64');
    const got = crypto.scryptSync(String(password), Buffer.from(salt, 'base64'), expected.length, { N: Number(n), r: 8, p: 1 });
    return crypto.timingSafeEqual(got, expected);
  } catch { return false; }
}

// ---------- Signed session cookie ----------
const COOKIE = 'kuy_admin';
const secret = () => process.env.SESSION_SECRET || '';
const sign = (v) => crypto.createHmac('sha256', secret()).update('kuy-admin-v1:' + v).digest('hex');

export function setSession(req, res, login) {
  const value = Buffer.from(JSON.stringify({ login, exp: Date.now() + 7 * 864e5 })).toString('base64url');
  const secure = req.secure ? '; Secure' : '';
  res.append('Set-Cookie', `${COOKIE}=${value}.${sign(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${secure}`);
}
export function clearSession(res) {
  res.append('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}
export function readSession(req) {
  if (!secret()) return null;
  const raw = (req.headers.cookie || '').split(';').map((x) => x.trim()).find((x) => x.startsWith(COOKIE + '='));
  if (!raw) return null;
  const [value, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!/^[a-f0-9]{64}$/.test(sig || '')) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sign(value), 'hex'), Buffer.from(sig, 'hex'))) return null;
  try {
    const data = JSON.parse(Buffer.from(value, 'base64url').toString());
    return data.exp > Date.now() ? data : null;
  } catch { return null; }
}

// Requests that change data must come from our own pages (CSRF protection)
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;              // same-origin fetch from some browsers / curl
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
