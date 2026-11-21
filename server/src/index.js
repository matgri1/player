import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

try { process.loadEnvFile(new URL('../.env', import.meta.url)); } catch { /* no .env: use real environment */ }

const { migrate } = await import('./db.js');
const { default: publicRoutes } = await import('./routes/public.js');
const { default: adminRoutes } = await import('./routes/admin.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.json({ limit: '32kb' }));

app.use('/api/admin', adminRoutes);
app.use('/api', publicRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Admin panel (static, data comes from /api/admin after login)
app.use('/admin', (req, res, next) => {
  res.set('X-Frame-Options', 'DENY');
  res.set('Cache-Control', 'no-store');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
}, express.static(path.join(here, '../admin')));

// Public website
const siteDir = path.resolve(here, '..', process.env.SITE_DIR || '../kuy');
app.use(express.static(siteDir, { extensions: ['html'] }));

// Bad JSON and other errors
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') return res.status(400).json({ error: 'Bad request' });
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const port = Number(process.env.PORT || 3100);
await migrate();
app.listen(port, '127.0.0.1', () => console.log(`Kuy server on http://127.0.0.1:${port} (site: ${siteDir})`));
