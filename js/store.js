/* Pharmacy City Health Center - browser-side "database" (localStorage) for the HTML-only version.
   Later this file is replaced by PHP + MySQL calls; the page code stays the same shape. */
const DB_KEY = 'pchc_db_v1', SESSION_KEY = 'pchc_session', FLASH_KEY = 'pchc_flash';

const firstName = n => String(n).replace(/^(Dr\.?|Nurse|Mr\.?|Mrs\.?|Ms\.?)\s+/i, '').split(' ')[0];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Demo-only hash. The PHP version uses password_hash() instead.
const hashPw = p => { let h = 2166136261; for (const c of p) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return 'demo$' + (h >>> 0).toString(16); };

function todayStr() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function timeAgo(iso) {
  const d = (Date.now() - new Date(iso)) / 1000;
  if (d < 60) return 'just now'; if (d < 3600) return Math.floor(d / 60) + ' min ago';
  if (d < 86400) return Math.floor(d / 3600) + ' h ago'; return Math.floor(d / 86400) + ' d ago';
}
const fmt = (iso, withYear) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', ...(withYear ? { year: 'numeric' } : {}), hour: '2-digit', minute: '2-digit' });

/* ---------- Clinical triage rules (same limits as the PHP version) ---------- */
function assess(v) {
  let level = 'normal'; const reasons = []; const rank = { normal: 0, warning: 1, critical: 2 };
  const bump = (l, m) => { if (rank[l] > rank[level]) level = l; reasons.push(m); };
  const { sys, dia, hr, temp, glu } = v;
  if (sys >= 180 || dia >= 120 || sys <= 80) bump('critical', `Blood pressure ${sys}/${dia} mmHg is dangerous`);
  else if (sys >= 140 || dia >= 90 || sys < 90) bump('warning', `Blood pressure ${sys}/${dia} mmHg is outside the safe range`);
  if (hr >= 130 || hr <= 40) bump('critical', `Heart rate ${hr} bpm is dangerous`); else if (hr > 100 || hr < 55) bump('warning', `Heart rate ${hr} bpm is abnormal`);
  if (temp >= 39.5 || temp <= 35) bump('critical', `Temperature ${temp} °C is dangerous`); else if (temp >= 37.8 || temp < 36) bump('warning', `Temperature ${temp} °C is abnormal`);
  if (glu >= 16.7 || glu < 3) bump('critical', `Blood glucose ${glu} mmol/L is dangerous`); else if (glu >= 11.1 || glu < 3.9) bump('warning', `Blood glucose ${glu} mmol/L is outside the target range`);
  return { level, reasons };
}
const badge = l => `<span class="badge badge-${l}">${{ normal: 'Stable', warning: 'Needs review', critical: 'Urgent' }[l] || l}</span>`;

/* ---------- Seed data (synthetic, as promised in the ethics section) ---------- */
function seed() {
  let r = 42; const rnd = n => { r = (r * 1664525 + 1013904223) % 4294967296; return Math.floor(r / 4294967296 * (n + 1)); };
  const db = { users: [], patients: [], vitals: [], alerts: [], meds: [], medLogs: [], messages: [], seq: { u: 0, p: 0, v: 0, a: 0, m: 0, g: 0 } };
  const addUser = (name, email, phone, pw, role) => { const u = { id: ++db.seq.u, name, email, phone, pw: hashPw(pw), role }; db.users.push(u); return u; };
  const doc = addUser('Dr. Grace Nakato', 'clinician@pchc.ug', '0700111222', 'Clinic@123', 'clinician');
  addUser('Nurse David Mugisha', 'nurse@pchc.ug', '0700333444', 'Clinic@123', 'clinician');
  const people = [
    ['Sarah Namukasa', 'patient@pchc.ug', '0772100200', 'Hypertension', '1971-04-12', 'Female'],
    ['John Okello', 'john@pchc.ug', '0782300400', 'Type 2 diabetes', '1964-09-30', 'Male'],
    ['Mary Achieng', 'mary@pchc.ug', '0752500600', 'Post-operative recovery', '1990-01-22', 'Female'],
    ['Peter Ssemwogerere', 'peter@pchc.ug', '0702700800', 'Hypertension and diabetes', '1958-07-05', 'Male'],
  ];
  const pts = [];
  people.forEach(([name, email, phone, cond, dob, gender], i) => {
    const u = addUser(name, email, phone, 'Patient@123', 'patient');
    const p = { id: ++db.seq.p, userId: u.id, clinicianId: doc.id, dob, gender, condition: cond }; db.patients.push(p); pts.push(p);
    for (let d = 6; d >= 0; d--) {
      const v = { sys: 118 + rnd(24) + (i % 2 ? 12 : 0), dia: 74 + rnd(12), hr: 68 + rnd(22), temp: +(36.4 + rnd(8) / 10).toFixed(1), glu: +(5 + rnd(30) / 10 + (i === 1 ? 3.5 : 0)).toFixed(1) };
      if (i === 1 && d === 0) v.glu = 17.4; if (i === 3 && d === 1) { v.sys = 164; v.dia = 98; } if (i === 2 && d === 0) v.temp = 38.2;
      const a = assess(v), at = new Date(Date.now() - d * 86400000 - rnd(40) * 60000).toISOString();
      const vit = { id: ++db.seq.v, patientId: p.id, ...v, symptoms: a.level === 'normal' ? 'Feeling fine' : 'Tired and dizzy', risk: a.level, at }; db.vitals.push(vit);
      if (a.level !== 'normal') db.alerts.push({ id: ++db.seq.a, patientId: p.id, vitalId: vit.id, severity: a.level, message: a.reasons.join('; '), read: d > 0, at });
    }
    db.meds.push({ id: ++db.seq.m, patientId: p.id, drug: 'Amlodipine', dose: '5 mg', time: '08:00' }, { id: ++db.seq.m, patientId: p.id, drug: 'Metformin', dose: '500 mg', time: '20:00' });
  });
  db.messages.push({ id: ++db.seq.g, patientId: pts[0].id, senderId: pts[0].userId, body: 'Good morning Doctor, I have had mild headaches this week.', at: new Date(Date.now() - 86400000).toISOString() },
                   { id: ++db.seq.g, patientId: pts[0].id, senderId: doc.id, body: 'Thank you Sarah. Keep logging your blood pressure daily and drink plenty of water.', at: new Date(Date.now() - 72000000).toISOString() });
  return db;
}
let DB = JSON.parse(localStorage.getItem(DB_KEY) || 'null');
if (!DB) { DB = seed(); localStorage.setItem(DB_KEY, JSON.stringify(DB)); }
const save = () => localStorage.setItem(DB_KEY, JSON.stringify(DB));
const reload = () => { DB = JSON.parse(localStorage.getItem(DB_KEY)); };
const resetDemo = () => { DB = seed(); save(); localStorage.removeItem(SESSION_KEY); };

/* ---------- Lookups ---------- */
const userById = id => DB.users.find(u => u.id === id);
const patientOf = userId => DB.patients.find(p => p.userId === userId);
const patientById = id => DB.patients.find(p => p.id === id);
const vitalsOf = pid => DB.vitals.filter(v => v.patientId === pid).sort((a, b) => new Date(a.at) - new Date(b.at));
const latestOf = pid => vitalsOf(pid).slice(-1)[0] || null;
const medsOf = pid => DB.meds.filter(m => m.patientId === pid).sort((a, b) => a.time.localeCompare(b.time));
const takenToday = medId => DB.medLogs.some(l => l.medId === medId && l.date === todayStr());
const messagesOf = pid => DB.messages.filter(m => m.patientId === pid).sort((a, b) => new Date(a.at) - new Date(b.at));
const to12h = t => { const [h, m] = t.split(':').map(Number); return ((h + 11) % 12 + 1) + ':' + String(m).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM'); };

/* ---------- Session and flash messages ---------- */
const currentUser = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (_) { return null; } };
function login(email, pw) {
  const u = DB.users.find(x => x.email.toLowerCase() === email.trim().toLowerCase() && x.pw === hashPw(pw));
  if (!u) return null;
  localStorage.setItem(SESSION_KEY, JSON.stringify({ id: u.id, name: u.name, role: u.role })); return u;
}
const logout = () => localStorage.removeItem(SESSION_KEY);
const flash = (type, msg) => { const f = JSON.parse(sessionStorage.getItem(FLASH_KEY) || '[]'); f.push([type, msg]); sessionStorage.setItem(FLASH_KEY, JSON.stringify(f)); };
const popFlashes = () => { const f = JSON.parse(sessionStorage.getItem(FLASH_KEY) || '[]'); sessionStorage.removeItem(FLASH_KEY); return f; };
function requireRole(role) {
  const u = currentUser();
  if (!u) { flash('error', 'Please log in to continue.'); location.href = 'login.html'; return null; }
  if (role && u.role !== role) { flash('error', 'You do not have access to that page.'); location.href = 'login.html'; return null; }
  return u;
}
const homeFor = u => u.role === 'clinician' ? 'clinician.html#dashboard' : 'patient.html#home';
