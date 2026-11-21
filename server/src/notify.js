// Telegram message to the admin chat about a new request.
// Does nothing until TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID are set.
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const VISA = { stamp: 'штамп 45 дн.', evisa90: 'e-visa 90 дн.', multivisa: 'мультивиза' };

export async function notifyNewRequest(r) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chat) return;
  const lines = [
    `🛂 <b>Новая заявка ${esc(r.code)}</b> (сайт)`,
    `${r.destination === 'laos' ? '🇱🇦 Лаос' : '🇰🇭 Камбоджа'} · ${esc(r.travel_date)}${r.departure_time ? ' ' + esc(r.departure_time) : ''}${r.request_mode === 'date_request' ? ' · желаемая дата' : ''}`,
    `👥 ${r.pax_count} чел.:`,
    ...r.passengers.map((p, i) => `  ${i + 1}. ${esc(p.name)} — ${esc(p.nationality)} — ${esc(VISA[p.visa] || p.visa)}`),
    `📞 ${esc(r.contact_name)}, ${esc(r.contact_value)}`,
    `📍 ${esc(r.pickup)}`
  ];
  if (r.note) lines.push(`💬 ${esc(r.note)}`);
  if (r.club_code) lines.push(`⭐ QUY Club: ${esc(r.club_code)}`);
  if (process.env.ADMIN_URL) lines.push(`\n<a href="${esc(process.env.ADMIN_URL)}">Открыть админку</a>`);
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: lines.join('\n'), parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(8000)
    });
  } catch (e) {
    console.error('Telegram notify failed:', e.message);
  }
}
