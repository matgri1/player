// Server-side validation of a visa run request. Mirrors the website form
// (kuy/visa/book.js) but never trusts the client.

export const VISA_TYPES = ['stamp', 'evisa90', 'multivisa'];
// Default Vietnam visa fees (VND); QUY Travel's live prices can override them later.
export const VISA_FEES = { stamp: 0, evisa90: 2150000, multivisa: 2800000 };
// Passports without Vietnam's visa-free stamp
const NEEDS_EVISA = ['US', 'CA', 'AU'];
export const NATIONS = {
  US: 'United States', RU: 'Russia', UA: 'Ukraine', KZ: 'Kazakhstan', BY: 'Belarus',
  GB: 'United Kingdom', CA: 'Canada', AU: 'Australia', DE: 'Germany', FR: 'France'
};

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const letters = (v) => (String(v || '').match(/\p{L}/gu) || []).length;

export function vnDate(offsetDays = 0) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
    .format(new Date(Date.now() + offsetDays * 864e5));
}
const isISODate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d;

export function validateRequest(b) {
  const e = {};
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { errors: { body: 'Invalid request' } };

  // Honeypot: real people never fill this hidden field
  if (str(b.website, 200)) return { spam: true };

  const lang = ['en', 'ru', 'vi'].includes(b.lang) ? b.lang : 'en';
  const destination = b.destination;
  if (!['laos', 'cambodia'].includes(destination)) e.destination = 'Choose Laos or Cambodia';

  const request_mode = b.request_mode === 'scheduled' ? 'scheduled' : 'date_request';
  const quy_trip_id = request_mode === 'scheduled' ? Number(b.quy_trip_id) : null;
  if (request_mode === 'scheduled' && !(Number.isSafeInteger(quy_trip_id) && quy_trip_id > 0)) e.quy_trip_id = 'Invalid departure';

  const travel_date = str(b.travel_date, 10);
  const minDate = request_mode === 'scheduled' ? vnDate(0) : vnDate(1);
  if (!isISODate(travel_date) || travel_date < minDate || travel_date > vnDate(370)) e.travel_date = 'Invalid date';
  const departure_time = /^([01]\d|2[0-3]):[0-5]\d$/.test(b.departure_time || '') ? b.departure_time : null;

  const list = Array.isArray(b.passengers) ? b.passengers : [];
  if (list.length < 1 || list.length > 20) e.passengers = 'Add 1 to 20 passengers';
  const passengers = list.slice(0, 20).map((p, i) => {
    const name = str(p && p.name, 120);
    const code = str(p && p.nationality_code, 10).toUpperCase();
    const other = str(p && p.nationality, 80);
    const visa = p && p.visa;
    if (letters(name) < 2) e['passengers.' + i + '.name'] = 'Full name required';
    if (!(code in NATIONS) && !(code === 'OTHER' && letters(other) >= 2)) e['passengers.' + i + '.nationality'] = 'Nationality required';
    if (!VISA_TYPES.includes(visa)) e['passengers.' + i + '.visa'] = 'Visa type required';
    else if (visa === 'stamp' && NEEDS_EVISA.includes(code)) e['passengers.' + i + '.visa'] = 'This passport needs an e-visa';
    return { name, nationality_code: code, nationality: code in NATIONS ? NATIONS[code] : other, visa };
  });

  const contact_name = str(b.contact_name, 120);
  if (letters(contact_name) < 2) e.contact_name = 'Name required';
  const contact_channel = b.contact_channel === 'whatsapp' ? 'whatsapp' : 'telegram';
  let contact_value = str(b.contact_value, 40);
  if (contact_channel === 'telegram') {
    contact_value = contact_value.replace(/^@+/, '');
    if (!/^[A-Za-z0-9_]{5,32}$/.test(contact_value)) e.contact_value = 'Telegram username: 5-32 letters, numbers or _';
    contact_value = '@' + contact_value;
  } else {
    const digits = contact_value.replace(/\D/g, '');
    if (!/^\+\d[\d\s().-]{6,18}$/.test(contact_value) || digits.length < 8 || digits.length > 15) e.contact_value = 'Phone with country code';
  }
  const pickup = str(b.pickup, 300);
  if (pickup.length < 3) e.pickup = 'Pickup address required';
  const note = str(b.note, 500);

  const club_code = str(b.club_code, 43).toUpperCase() || null;
  if (club_code && !/^QUY[A-Z0-9]{6,40}$/.test(club_code)) e.club_code = 'Invalid QUY Club code';
  const ref_raw = str(b.ref_code, 43).toUpperCase();
  const ref_code = /^[A-Z0-9-]{3,43}$/.test(ref_raw) ? ref_raw : null;

  const est = Number(b.est_price_per_person);
  const est_price_per_person = Number.isSafeInteger(est) && est > 0 && est < 100000000 ? est : null;
  const est_visa_total = passengers.reduce((n, p) => n + (VISA_FEES[p.visa] || 0), 0);

  const idempotency_key = str(b.idempotency_key, 64);
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(idempotency_key)) e.idempotency_key = 'Missing request key';

  if (Object.keys(e).length) return { errors: e };
  return {
    data: {
      lang, destination, request_mode, quy_trip_id, travel_date, departure_time,
      pax_count: passengers.length, passengers, contact_name, contact_channel, contact_value,
      pickup, note, club_code, ref_code, est_price_per_person, est_visa_total, idempotency_key
    }
  };
}

export const STATUSES = ['new', 'contacted', 'confirmed', 'completed', 'cancelled'];
