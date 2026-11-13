/* Page logic. 5 pages: index/about (static), login (log in + register), patient (6 views), clinician (3 views).
   Patient and clinician views are switched with the URL hash, e.g. patient.html#history */
(function () {
  const page = document.body.dataset.page, app = document.getElementById('app');
  const $ = (s, r = document) => r.querySelector(s);
  let render = () => {}, stop = null, param = '';
  const go = url => { if (url[0] === '#') { if (location.hash === url) render(); else location.hash = url; } else location.href = url; };
  const toast = (type, msg) => showToast(msg, type);
  const PHONE_RE = /^(\+256|0)\d{9}$/;
  // Run a handler when a form with this id is submitted and passed the shared validation in main.js
  const forms = {};
  document.addEventListener('submit', e => { const fn = forms[e.target.id]; if (!fn || e.defaultPrevented) return; e.preventDefault(); fn(e.target); });
  const onSubmit = (id, fn) => { forms[id] = fn; };
  let onResolve = null;
  document.addEventListener('click', e => { if (e.target.id === 'resolve' && onResolve) onResolve(); });
  const note = (id, type, msg) => { const n = document.getElementById(id); if (n) n.innerHTML = msg ? `<p class="notice notice-${type}">${esc(msg)}</p>` : ''; };
  const errorsHtml = list => list.map(x => `<p class="notice notice-bad">${esc(x)}</p>`).join('');
  const trendData = (vs, label) => ({
    labels: vs.map(v => label(v.at)),
    metrics: {
      bp: { title: 'Blood pressure', series: [{ name: 'Systolic', color: '#d9482b', values: vs.map(v => v.sys) }, { name: 'Diastolic', color: '#1546a8', values: vs.map(v => v.dia) }] },
      hr: { title: 'Heart rate', series: [{ name: 'Heart rate', color: '#d9482b', values: vs.map(v => v.hr) }] },
      temp: { title: 'Temperature', series: [{ name: 'Temperature', color: '#c58a00', values: vs.map(v => v.temp) }] },
      glu: { title: 'Glucose', series: [{ name: 'Glucose', color: '#1546a8', values: vs.map(v => v.glu) }] },
    },
  });
  const chartTabs = id => `<div class="seg" data-chart-tabs="${id}"><button class="on" data-metric="bp">BP</button><button data-metric="hr">Heart</button><button data-metric="temp">Temp</button><button data-metric="glu">Glucose</button></div>`;
  const bubbles = (msgs, mineRole) => msgs.map(m => { const s = userById(m.senderId), mine = s.role === mineRole;
    return `<div class="bubble ${mine ? 'me' : 'them'}"><small>${esc(mine ? 'You' : s.name)} · ${esc(timeAgo(m.at))}</small><p>${esc(m.body)}</p></div>`; }).join('');
  const levelRank = { critical: 0, warning: 1, normal: 2 };

  const PAGES = {};

  /* ---------------- Public pages ---------------- */
  PAGES.login = () => {
    const u = currentUser(); if (u) return go(homeFor(u));
    onSubmit('loginForm', f => {
      const user = login(f.email.value, f.password.value);
      if (!user) return note('loginError', 'bad', 'That email and password do not match. Check both and try again.');
      flash('ok', 'Welcome back, ' + firstName(user.name) + '.'); go(homeFor(user));
    });
    $('#resetDemo').addEventListener('click', e => { e.preventDefault(); if (confirm('This erases everything you saved and restores the demo data. Continue?')) { resetDemo(); flash('ok', 'Demo data restored.'); go('login.html'); } });
  };

  PAGES.register = () => {
    if (currentUser()) return go(homeFor(currentUser()));
    onSubmit('registerForm', f => {
      const errs = [], name = f.full_name.value.trim(), email = f.email.value.trim(), phone = f.phone.value.trim(), pw = f.password.value, dob = f.dob.value;
      if (name.length < 3) errs.push('Enter your full name.');
      if (!/^\S+@\S+\.\S+$/.test(email)) errs.push('Enter a valid email address.');
      if (!PHONE_RE.test(phone.replace(/\s+/g, ''))) errs.push('Enter a Ugandan phone number such as 0772 123 456.');
      if (pw.length < 8 || !/\d/.test(pw) || !/[A-Za-z]/.test(pw)) errs.push('Use a password of 8 or more characters with letters and numbers.');
      if (!dob || new Date(dob) > new Date()) errs.push('Enter a valid date of birth.');
      if (!errs.length && DB.users.some(x => x.email.toLowerCase() === email.toLowerCase())) errs.push('An account with that email already exists. Try logging in instead.');
      if (errs.length) { $('#registerErrors').innerHTML = errorsHtml(errs); return window.scrollTo({ top: 0, behavior: 'smooth' }); }
      const clin = DB.users.find(x => x.role === 'clinician');
      const u = { id: ++DB.seq.u, name, email, phone, pw: hashPw(pw), role: 'patient' }; DB.users.push(u);
      DB.patients.push({ id: ++DB.seq.p, userId: u.id, clinicianId: clin.id, dob, gender: f.gender.value, condition: f.condition.value }); save();
      toast('ok', 'Account created. Log in to record your first reading.'); location.hash = '#login';
    });
  };

  PAGES.contact = () => onSubmit('contactForm', f => {
    $('#contactResult').innerHTML = `<p class="notice notice-ok">Thank you, ${esc(f.name.value.trim())}. Your message has been received.</p>`; f.reset();
  });

  PAGES.auth = () => {
    const u = currentUser(); if (u) return go(homeFor(u));
    PAGES.login(); PAGES.register();
    const show = () => {
      const reg = location.hash === '#register';
      $('#panel-login').hidden = reg; $('#panel-register').hidden = !reg;
      $('#tabLogin').classList.toggle('on', !reg); $('#tabRegister').classList.toggle('on', reg);
      $('#authTitle').textContent = reg ? 'Join ' + 'Pharmacy City’s remote care' : 'Good to see you again';
    };
    window.addEventListener('hashchange', show); show();
  };

  /* ---------------- Patient pages ---------------- */
  PAGES['patient-dashboard'] = () => {
    const u = requireRole('patient'); if (!u) return;
    const p = patientOf(u.id), clin = userById(p.clinicianId), vs = vitalsOf(p.id).slice(-7), latest = vs.slice(-1)[0];
    const meds = medsOf(p.id), taken = meds.filter(m => takenToday(m.id)).length, last = messagesOf(p.id).slice(-1)[0];
    const h = new Date().getHours(), greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    let top = '';
    if (latest) {
      const a = assess(latest);
      top = `<div class="status-card status-${a.level}"><div><small>Latest reading, ${esc(timeAgo(latest.at))}</small>
        <h2>${{ normal: 'Your readings look stable', warning: 'Some readings need review', critical: 'Urgent: contact your clinic now' }[a.level]}</h2>
        ${a.reasons.length ? '<ul>' + a.reasons.map(r => `<li>${esc(r)}</li>`).join('') + '</ul>' : ''}</div>${badge(a.level)}</div>
        <div class="vital-grid">
          <div class="vital"><small>Blood pressure</small><b>${latest.sys}/${latest.dia}</b><span>mmHg</span></div>
          <div class="vital"><small>Heart rate</small><b>${latest.hr}</b><span>bpm</span></div>
          <div class="vital"><small>Temperature</small><b>${latest.temp}</b><span>°C</span></div>
          <div class="vital"><small>Blood glucose</small><b>${latest.glu}</b><span>mmol/L</span></div></div>`;
    } else top = `<div class="card empty"><h2>No readings yet</h2><p>Record your first set of vitals so your clinician can start following your progress.</p><a class="btn btn-primary" href="#log">Log your first reading</a></div>`;
    app.innerHTML = `<section class="app-wrap container">
      <div class="app-head"><div><h1>${greet}, ${esc(firstName(u.name))}</h1><p class="muted">Monitoring for ${esc(p.condition)}. Your clinician is ${esc(clin.name)}.</p></div>
        <a class="btn btn-primary" href="#log">Log today’s vitals</a></div>${top}
      <div class="grid-2">
        <div class="card"><div class="card-head"><h3>Last 7 readings</h3>${chartTabs('trend')}</div>
          <canvas id="trend" class="chart" height="240" data-default="bp" data-chart="${esc(JSON.stringify(trendData(vs, i => new Date(i).toLocaleDateString('en-GB', { weekday: 'short' }))))}"></canvas></div>
        <div class="card"><h3>Today’s medicine</h3>
          <div class="ring-row"><div class="ring" data-ring="${meds.length ? Math.round(taken / meds.length * 100) : 0}"><span>${taken}/${meds.length}</span></div>
          <p>${meds.length && taken === meds.length ? 'All doses taken. Well done.' : 'Tick off each dose when you take it.'}</p></div>
          <a class="btn btn-ghost btn-block" href="#medicine">Open medicine list</a></div></div>
      <div class="card"><h3>Latest message</h3>
        ${last ? `<p><b>${esc(userById(last.senderId).role === 'clinician' ? userById(last.senderId).name : 'You')}:</b> ${esc(last.body)} <span class="muted">(${esc(timeAgo(last.at))})</span></p>` : '<p class="muted">No messages yet. Tell your clinician how you feel.</p>'}
        <div class="btn-row" style="margin:0"><a class="btn btn-ghost" href="#chat">Open chat</a><a class="btn btn-ghost" href="#history">Full history</a><a class="btn btn-ghost" href="#profile">My profile</a></div></div></section>`;
  };

  PAGES['log-vitals'] = () => {
    const u = requireRole('patient'); if (!u) return;
    const p = patientOf(u.id), ids = ['systolic', 'diastolic', 'heart_rate', 'temperature', 'glucose'];
    app.innerHTML = `<section class="app-wrap container narrow">
      <nav class="crumbs"><a href="#home">My health</a> / Log vitals</nav>
      <h1>Log today’s vitals</h1><p class="muted">Measure at rest, then enter the numbers. The check below updates as you type.</p><div id="vitalErrors"></div>
      <form class="card form" id="vitalsForm" novalidate>
        <fieldset><legend>Blood pressure</legend><div class="row2">
          <label>Systolic (top number)<input type="number" inputmode="numeric" id="systolic" placeholder="120"></label>
          <label>Diastolic (bottom number)<input type="number" inputmode="numeric" id="diastolic" placeholder="80"></label></div></fieldset>
        <div class="row3">
          <label>Heart rate (bpm)<input type="number" inputmode="numeric" id="heart_rate" placeholder="72"></label>
          <label>Temperature (°C)<input type="number" step="0.1" inputmode="decimal" id="temperature" placeholder="36.6"></label>
          <label>Glucose (mmol/L)<input type="number" step="0.1" inputmode="decimal" id="glucose" placeholder="5.5"></label></div>
        <label>Symptoms (optional)<textarea id="symptoms" rows="3" maxlength="250" placeholder="Headache, dizziness, swelling…"></textarea></label>
        <div class="live-check" id="liveCheck" data-state="empty"><b>Safety check</b><p id="liveText">Enter your readings to see how they look.</p></div>
        <button class="btn btn-primary btn-block" type="submit">Save reading</button></form></section>`;
    const el = Object.fromEntries(ids.map(i => [i, document.getElementById(i)]));
    const read = () => ({ sys: +el.systolic.value, dia: +el.diastolic.value, hr: +el.heart_rate.value, temp: +el.temperature.value, glu: +el.glucose.value });
    const check = () => {
      const box = $('#liveCheck'), txt = $('#liveText');
      if (ids.some(i => el[i].value === '')) { box.dataset.state = 'empty'; txt.textContent = 'Enter your readings to see how they look.'; return null; }
      const a = assess(read()); box.dataset.state = a.level;
      txt.textContent = a.level === 'normal' ? 'All four readings are in the safe range.' : (a.level === 'warning' ? 'Your clinician will review: ' : 'Urgent. Contact the clinic now: ') + a.reasons.join(', ') + '.';
      return a.level;
    };
    ids.forEach(i => el[i].addEventListener('input', check));
    onSubmit('vitalsForm', () => {
      const empty = ids.filter(i => !el[i].value); ids.forEach(i => el[i].classList.toggle('bad', !el[i].value));
      if (empty.length) { el[empty[0]].focus(); return showToast('Fill in all five readings before saving.', 'error'); }
      const v = read(), errs = [];
      if (v.sys < 60 || v.sys > 260) errs.push('Systolic pressure must be between 60 and 260.');
      if (v.dia < 30 || v.dia > 160) errs.push('Diastolic pressure must be between 30 and 160.');
      if (v.hr < 25 || v.hr > 220) errs.push('Heart rate must be between 25 and 220 bpm.');
      if (v.temp < 32 || v.temp > 43) errs.push('Temperature must be between 32 and 43 °C.');
      if (v.glu < 1 || v.glu > 40) errs.push('Glucose must be between 1 and 40 mmol/L.');
      if (errs.length) { $('#vitalErrors').innerHTML = errorsHtml(errs); return window.scrollTo({ top: 0, behavior: 'smooth' }); }
      const a = assess(v);
      if (a.level === 'critical' && !confirm('This reading is urgent. Save it and alert your clinician now?')) return;
      const vit = { id: ++DB.seq.v, patientId: p.id, ...v, symptoms: $('#symptoms').value.trim().slice(0, 250), risk: a.level, at: new Date().toISOString() }; DB.vitals.push(vit);
      if (a.level !== 'normal') DB.alerts.push({ id: ++DB.seq.a, patientId: p.id, vitalId: vit.id, severity: a.level, message: a.reasons.join('; '), read: false, at: vit.at });
      save(); toast(a.level === 'normal' ? 'ok' : 'warn', a.level === 'normal' ? 'Reading saved. Everything looks stable.' : 'Reading saved. Your clinician has been alerted.'); go('#home');
    });
  };

  PAGES.history = () => {
    const u = requireRole('patient'); if (!u) return;
    const p = patientOf(u.id), level = param;
    const rows = vitalsOf(p.id).reverse().filter(v => !level || v.risk === level).slice(0, 60);
    const seg = [['', 'All'], ['normal', 'Stable'], ['warning', 'Review'], ['critical', 'Urgent']].map(([k, l]) => `<a href="#history${k ? '/' + k : ''}" style="text-decoration:none"><button type="button" class="${level === k ? 'on' : ''}">${l}</button></a>`).join('');
    app.innerHTML = `<section class="app-wrap container"><nav class="crumbs"><a href="#home">My health</a> / History</nav>
      <div class="app-head"><h1>Your reading history</h1><div class="seg">${seg}</div></div>
      <div class="card"><div class="table-wrap"><table><thead><tr><th>When</th><th>BP</th><th>Heart</th><th>Temp</th><th>Glucose</th><th>Symptoms</th><th>Status</th></tr></thead><tbody>
      ${rows.map(v => `<tr><td>${esc(fmt(v.at, true))}</td><td>${v.sys}/${v.dia}</td><td>${v.hr}</td><td>${v.temp}</td><td>${v.glu}</td><td>${esc(v.symptoms)}</td><td>${badge(v.risk)}</td></tr>`).join('')
        || '<tr><td colspan="7" class="muted center">No readings match. <a href="#log">Log one now</a>.</td></tr>'}</tbody></table></div></div></section>`;
  };

  PAGES.medications = () => {
    const u = requireRole('patient'); if (!u) return;
    const p = patientOf(u.id), meds = medsOf(p.id), total = meds.length, count = () => meds.filter(m => takenToday(m.id)).length;
    app.innerHTML = `<section class="app-wrap container narrow"><nav class="crumbs"><a href="#home">My health</a> / Medicine</nav><h1>Today’s medicine</h1>
      <div class="card ring-row"><div class="ring" id="medRing" data-ring="${total ? Math.round(count() / total * 100) : 0}"><span id="medCount">${count()}/${total}</span></div>
        <p id="medMsg">${total && count() === total ? 'All doses taken. Well done.' : 'Tick each dose after you take it.'}</p></div>
      <ul class="med-list" id="medList">${meds.map(m => `<li class="med ${takenToday(m.id) ? 'done' : ''}"><label>
        <input type="checkbox" data-med="${m.id}" ${takenToday(m.id) ? 'checked disabled' : ''}><span class="med-time">${to12h(m.time)}</span>
        <span class="med-name"><b>${esc(m.drug)}</b><small>${esc(m.dose)}</small></span></label></li>`).join('') || '<li class="card empty">Your clinician has not added medicines yet.</li>'}</ul>
      <a class="btn btn-ghost" href="#chat">Ask about a medicine</a></section>`;
    $('#medList').addEventListener('change', e => {
      const b = e.target; if (!b.dataset.med) return;
      DB.medLogs.push({ medId: +b.dataset.med, date: todayStr() }); save(); b.disabled = true; b.closest('.med').classList.add('done');
      const n = count(); $('#medCount').textContent = n + '/' + total; $('#medRing').style.setProperty('--p', Math.round(n / total * 100));
      $('#medMsg').textContent = n === total ? 'All doses taken. Well done.' : 'Tick each dose after you take it.'; showToast('Dose recorded.');
    });
  };

  PAGES.messages = () => {
    const u = requireRole('patient'); if (!u) return;
    const p = patientOf(u.id);
    const draw = () => { const m = messagesOf(p.id); $('#chat').innerHTML = bubbles(m, 'patient') || '<p class="muted center">No messages yet. Describe how you are feeling below.</p>'; $('#chat').scrollTop = 1e6; };
    app.innerHTML = `<section class="app-wrap container narrow"><nav class="crumbs"><a href="#home">My health</a> / Chat</nav><h1>Chat with your care team</h1>
      <div class="chat" id="chat"></div>
      <form class="chat-form" id="chatForm" data-validate novalidate><textarea name="body" rows="2" maxlength="500" required placeholder="Type your message…"></textarea><button class="btn btn-primary" type="submit">Send</button></form></section>`;
    draw();
    onSubmit('chatForm', f => { DB.messages.push({ id: ++DB.seq.g, patientId: p.id, senderId: u.id, body: f.body.value.trim(), at: new Date().toISOString() }); save(); f.reset(); draw(); showToast('Message sent to your clinician.'); });
  };

  PAGES.profile = () => {
    const u = requireRole('patient'); if (!u) return;
    const p = patientOf(u.id), me = userById(u.id), clin = userById(p.clinicianId);
    app.innerHTML = `<section class="app-wrap container narrow"><nav class="crumbs"><a href="#home">My health</a> / Profile</nav><h1>My profile</h1><div id="profileErrors"></div>
      <div class="card"><h3>${esc(me.name)}</h3><p class="muted">${esc(me.email)} · ${esc(p.gender)} · born ${esc(new Date(p.dob).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }))}</p>
        <p>Monitored for <b>${esc(p.condition)}</b> by <b>${esc(clin.name)}</b>.</p></div>
      <form class="card form" id="profileForm" data-validate novalidate>
        <label>Phone<input name="phone" required value="${esc(me.phone)}"></label>
        <label>New password (leave blank to keep current)<input type="password" name="new_password" autocomplete="new-password"></label>
        <button class="btn btn-primary" type="submit">Save changes</button></form></section>`;
    onSubmit('profileForm', f => {
      const errs = [], phone = f.phone.value.trim(), pw = f.new_password.value;
      if (!PHONE_RE.test(phone.replace(/\s+/g, ''))) errs.push('Enter a Ugandan phone number such as 0772 123 456.');
      if (pw && (pw.length < 8 || !/\d/.test(pw) || !/[A-Za-z]/.test(pw))) errs.push('A new password needs 8+ characters with letters and numbers.');
      if (errs.length) return ($('#profileErrors').innerHTML = errorsHtml(errs));
      me.phone = phone; if (pw) me.pw = hashPw(pw); save(); toast('ok', 'Profile updated.'); go('#profile');
    });
  };

  /* ---------------- Clinician pages ---------------- */
  PAGES['clinician-dashboard'] = () => {
    const u = requireRole('clinician'); if (!u) return;
    app.innerHTML = `<section class="app-wrap container wide" id="clinic">
      <div class="app-head"><div><h1>Triage dashboard</h1><p class="muted">Signed in as ${esc(u.name)}. Updates every 10 seconds <span class="dot-live">Live</span></p></div>
        <div class="btn-row" style="margin:0"><a class="btn btn-ghost" href="#alerts">Alert log</a><button class="btn btn-ghost" id="markAll" type="button">Mark all alerts read</button></div></div>
      <div class="kpi-row"><div class="kpi"><small>Patients</small><b id="kPatients">0</b></div><div class="kpi"><small>Readings today</small><b id="kToday">0</b></div>
        <div class="kpi kpi-warn"><small>Open alerts</small><b id="kAlerts">0</b></div><div class="kpi kpi-crit"><small>Urgent</small><b id="kCrit">0</b></div></div>
      <div class="grid-2 grid-wide-left"><div class="card"><div class="card-head"><h3>Patients by priority</h3><div class="filters">
        <input type="search" id="search" placeholder="Search name or condition" aria-label="Search patients"><select id="filterLevel" aria-label="Filter by status"><option value="">All</option><option value="critical">Urgent</option><option value="warning">Needs review</option><option value="normal">Stable</option></select></div></div>
        <div class="table-wrap"><table id="patientTable"><thead><tr><th>Patient</th><th>BP</th><th>HR</th><th>Temp</th><th>Glucose</th><th>Status</th><th></th></tr></thead><tbody></tbody></table>
        <p class="muted center" id="noMatch" hidden>No patients match your search.</p></div></div>
        <div class="stack"><div class="card"><h3>Unread alerts</h3><ul class="alert-feed" id="alertFeed"></ul></div><div class="card"><h3>Status mix</h3><div id="mixBox"></div></div></div></div></section>`;
    let lastAlert = Math.max(0, ...DB.alerts.map(a => a.id)), lastMix = '';
    const filter = () => {
      const q = $('#search').value.toLowerCase(), f = $('#filterLevel').value; let n = 0;
      document.querySelectorAll('#patientTable tbody tr').forEach(r => { const ok = r.dataset.text.includes(q) && (!f || r.dataset.level === f); r.hidden = !ok; if (ok) n++; });
      $('#noMatch').hidden = n > 0;
    };
    const draw = () => {
      const rows = DB.patients.map(p => ({ p, user: userById(p.userId), v: latestOf(p.id) }))
        .sort((a, b) => (a.v ? levelRank[a.v.risk] : 9) - (b.v ? levelRank[b.v.risk] : 9) || (b.v ? new Date(b.v.at) : 0) - (a.v ? new Date(a.v.at) : 0));
      $('#patientTable tbody').innerHTML = rows.map(({ p, user, v }) => `<tr data-level="${v ? v.risk : 'none'}" data-text="${esc((user.name + ' ' + p.condition).toLowerCase())}">
        <td><b>${esc(user.name)}</b><small>${esc(p.condition)}</small></td>
        ${v ? `<td>${v.sys}/${v.dia}</td><td>${v.hr}</td><td>${v.temp}</td><td>${v.glu}</td><td>${badge(v.risk)}<small>${esc(timeAgo(v.at))}</small></td>` : '<td colspan="5" class="muted">No readings yet</td>'}
        <td><a class="btn btn-sm btn-primary" href="#patient/${p.id}">Open</a></td></tr>`).join(''); filter();
      const open = DB.alerts.filter(a => !a.read).sort((a, b) => b.id - a.id);
      $('#kPatients').textContent = DB.patients.length; $('#kAlerts').textContent = open.length; $('#kCrit').textContent = open.filter(a => a.severity === 'critical').length;
      $('#kToday').textContent = DB.vitals.filter(v => v.at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;
      $('#alertFeed').innerHTML = open.slice(0, 8).map(a => `<li class="${a.severity}"><b>${esc(userById(patientById(a.patientId).userId).name)}</b><small>${esc(a.message)} · ${esc(timeAgo(a.at))}</small><a href="#patient/${a.patientId}">Review</a></li>`).join('')
        || '<li class="muted" style="background:none;border-color:#d6deec">No unread alerts. Nice and quiet.</li>';
      if (open.length && open[0].id > lastAlert) showToast('New patient alert received.', 'warn'); lastAlert = Math.max(lastAlert, ...DB.alerts.map(a => a.id));
      const mix = { normal: 0, warning: 0, critical: 0 }; rows.forEach(r => r.v && mix[r.v.risk]++);
      if (JSON.stringify(mix) !== lastMix) { lastMix = JSON.stringify(mix); $('#mixBox').innerHTML = `<canvas id="mix" class="chart" height="180" data-bars="${esc(lastMix)}"></canvas>`; window.initCharts && initCharts(); }
    };
    draw(); const timer = setInterval(() => { reload(); draw(); }, 10000);
    const onStorage = e => { if (e.key === DB_KEY) { reload(); draw(); } };
    window.addEventListener('storage', onStorage);
    stop = () => { clearInterval(timer); window.removeEventListener('storage', onStorage); };
    $('#search').addEventListener('input', filter); $('#filterLevel').addEventListener('change', filter);
    $('#markAll').addEventListener('click', () => { DB.alerts.forEach(a => a.read = true); save(); draw(); showToast('All alerts marked as read.'); });
  };

  PAGES['clinician-patient'] = () => {
    const u = requireRole('clinician'); if (!u) return;
    const id = +param, p = patientById(id);
    if (!p) { toast('error', 'Patient not found.'); return go('#dashboard'); }
    const pu = userById(p.userId), age = Math.floor((Date.now() - new Date(p.dob)) / 31557600000);
    const draw = () => {
      const all = vitalsOf(p.id), vs = all.slice(-14), meds = medsOf(p.id), thread = messagesOf(p.id);
      app.innerHTML = `<section class="app-wrap container wide"><nav class="crumbs"><a href="#dashboard">Dashboard</a> / ${esc(pu.name)}</nav>
        <div class="app-head"><div><h1>${esc(pu.name)}</h1><p class="muted">${esc(p.condition)} · ${age} years · ${esc(p.gender)} · <a href="tel:${esc(pu.phone)}">${esc(pu.phone)}</a></p></div>
          <button class="btn btn-ghost" id="resolve" type="button">Mark alerts read</button></div>
        <div class="grid-2 grid-wide-left"><div class="card"><div class="card-head"><h3>Trend (last ${vs.length} readings)</h3>${chartTabs('trend')}</div>
          <canvas id="trend" class="chart" height="260" data-default="bp" data-chart="${esc(JSON.stringify(trendData(vs, i => new Date(i).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }))))}"></canvas>
          <h3>Reading history</h3><div class="table-wrap"><table><thead><tr><th>When</th><th>BP</th><th>HR</th><th>Temp</th><th>Glucose</th><th>Symptoms</th><th>Status</th></tr></thead><tbody>
          ${all.slice().reverse().slice(0, 14).map(v => `<tr><td>${esc(fmt(v.at))}</td><td>${v.sys}/${v.dia}</td><td>${v.hr}</td><td>${v.temp}</td><td>${v.glu}</td><td>${esc(v.symptoms)}</td><td>${badge(v.risk)}</td></tr>`).join('')}</tbody></table></div></div>
        <div class="stack"><div class="card"><h3>Medicines</h3><ul class="plain">
          ${meds.map(m => `<li><b>${esc(m.drug)}</b> ${esc(m.dose)} at ${to12h(m.time)} ${takenToday(m.id) ? '<span class="badge badge-normal">taken today</span>' : '<span class="badge badge-warning">not yet</span>'}</li>`).join('') || '<li class="muted">No medicines yet.</li>'}</ul>
          <form class="form mini" id="medForm" data-validate novalidate><input name="drug" placeholder="Medicine" required><input name="dose" placeholder="Dose, e.g. 5 mg" required><input type="time" name="time" required><button class="btn btn-sm btn-primary" type="submit">Add medicine</button></form></div>
          <div class="card"><h3>Messages</h3><div class="chat small" id="thread">${bubbles(thread, 'clinician') || '<p class="muted">No messages yet.</p>'}</div>
          <form class="chat-form" id="replyForm" data-validate novalidate><textarea name="body" rows="2" maxlength="500" required placeholder="Write a reply…"></textarea><button class="btn btn-primary" type="submit">Reply</button></form></div></div></div></section>`;
      window.initCharts && initCharts(); window.dispatchEvent(new Event('pchc-redrawn'));
    };
    draw();
    onResolve = () => { DB.alerts.filter(a => a.patientId === p.id).forEach(a => a.read = true); save(); showToast('Alerts for this patient marked as read.'); };
    onSubmit('replyForm', f => { DB.messages.push({ id: ++DB.seq.g, patientId: p.id, senderId: u.id, body: f.body.value.trim(), at: new Date().toISOString() }); save(); draw(); showToast('Reply sent to ' + pu.name + '.'); });
    onSubmit('medForm', f => { DB.meds.push({ id: ++DB.seq.m, patientId: p.id, drug: f.drug.value.trim(), dose: f.dose.value.trim(), time: f.time.value }); save(); draw(); showToast('Medicine added to the patient’s list.'); });
  };

  PAGES['clinician-alerts'] = () => {
    const u = requireRole('clinician'); if (!u) return;
    const rows = DB.alerts.slice().sort((a, b) => b.id - a.id).slice(0, 100);
    app.innerHTML = `<section class="app-wrap container wide"><nav class="crumbs"><a href="#dashboard">Dashboard</a> / Alert log</nav><h1>Alert log</h1>
      <p class="muted">The 100 most recent alerts across all patients, an audit trail of every unsafe reading.</p>
      <div class="card"><div class="table-wrap"><table><thead><tr><th>Time</th><th>Patient</th><th>Severity</th><th>Reason</th><th>State</th><th></th></tr></thead><tbody>
      ${rows.map(a => `<tr><td>${esc(fmt(a.at))}</td><td><b>${esc(userById(patientById(a.patientId).userId).name)}</b></td><td>${badge(a.severity)}</td><td>${esc(a.message)}</td><td>${a.read ? 'Read' : '<b>Unread</b>'}</td>
        <td><a class="btn btn-sm btn-ghost" href="#patient/${a.patientId}">Open patient</a></td></tr>`).join('') || '<tr><td colspan="6" class="muted center">No alerts yet.</td></tr>'}</tbody></table></div></div></section>`;
  };

  /* ---------------- Hash router for the patient and clinician areas ---------------- */
  const ROUTES = {
    patient: { def: 'home', home: 'patient-dashboard', log: 'log-vitals', history: 'history', medicine: 'medications', chat: 'messages', profile: 'profile' },
    clinician: { def: 'dashboard', dashboard: 'clinician-dashboard', alerts: 'clinician-alerts', patient: 'clinician-patient' },
  };
  const R = ROUTES[page];
  if (R) {
    render = () => {
      if (stop) { stop(); stop = null; } onResolve = null;
      const [v, arg] = location.hash.slice(1).split('/'), view = R[v] && v !== 'def' ? v : R.def;
      param = arg || '';
      document.querySelectorAll('.tabbar a, .main-nav a').forEach(a => { const [f, h] = a.getAttribute('href').split('#');
        if (h !== undefined && f === page + '.html') a.classList.toggle('active', h === view); });
      PAGES[R[view]]();
      document.querySelectorAll('[data-ring]').forEach(r => r.style.setProperty('--p', r.dataset.ring));
      window.initCharts && initCharts(); window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', render); render();
  } else (PAGES[page] || (() => {}))();
})();
