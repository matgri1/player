import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRequest, vnDate } from '../src/validate.js';

const base = () => ({
  lang: 'en', destination: 'laos', request_mode: 'date_request', travel_date: vnDate(10),
  passengers: [{ name: 'John Smith', nationality_code: 'US', visa: 'evisa90' }],
  contact_name: 'John', contact_channel: 'telegram', contact_value: '@john_smith',
  pickup: 'FLC Sea Tower', idempotency_key: 'test-key-123'
});

test('valid request passes and is normalized', () => {
  const r = validateRequest(base());
  assert.ok(r.data);
  assert.equal(r.data.contact_value, '@john_smith');
  assert.equal(r.data.passengers[0].nationality, 'United States');
  assert.equal(r.data.est_visa_total, 2150000);
});
test('US passport cannot use the visa-free stamp', () => {
  const b = base(); b.passengers[0].visa = 'stamp';
  assert.ok(validateRequest(b).errors['passengers.0.visa']);
});
test('date must be in the future for a date request', () => {
  const b = base(); b.travel_date = vnDate(0);
  assert.ok(validateRequest(b).errors.travel_date);
});
test('telegram username format is checked', () => {
  const b = base(); b.contact_value = 'ab';
  assert.ok(validateRequest(b).errors.contact_value);
});
test('whatsapp needs a country code', () => {
  const b = base(); b.contact_channel = 'whatsapp'; b.contact_value = '0901234567';
  assert.ok(validateRequest(b).errors.contact_value);
  b.contact_value = '+84 90 123 4567';
  assert.ok(validateRequest(b).data);
});
test('honeypot marks spam', () => {
  const b = base(); b.website = 'http://spam.example';
  assert.equal(validateRequest(b).spam, true);
});
test('scheduled request needs a departure id', () => {
  const b = base(); b.request_mode = 'scheduled';
  assert.ok(validateRequest(b).errors.quy_trip_id);
});
test('bad QUY Club code is rejected, empty is fine', () => {
  const b = base(); b.club_code = 'HELLO';
  assert.ok(validateRequest(b).errors.club_code);
  b.club_code = '';
  assert.ok(validateRequest(b).data);
});
