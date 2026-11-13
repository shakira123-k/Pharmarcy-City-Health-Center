/* Pharmacy City Health Center - site-wide interactions */
document.addEventListener('DOMContentLoaded', () => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Mobile menu
  const toggle = $('#navToggle'), nav = $('#mainNav');
  if (toggle) toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });

  // Toasts: auto-dismiss
  $$('.toast').forEach((t, i) => setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 350); }, 4200 + i * 600));

  // Count-up numbers when they scroll into view
  const counters = $$('[data-count]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target, end = +el.dataset.count; let n = 0;
      const step = Math.max(1, Math.ceil(end / 40));
      const id = setInterval(() => { n = Math.min(end, n + step); el.textContent = n; if (n >= end) clearInterval(id); }, 30);
      io.unobserve(el);
    }), { threshold: .4 });
    counters.forEach(c => io.observe(c));
  } else counters.forEach(c => c.textContent = c.dataset.count);

  // Tabs
  $$('[data-tabs]').forEach(box => {
    const btns = $$('[role=tab]', box);
    btns.forEach(b => b.addEventListener('click', () => {
      btns.forEach(x => x.setAttribute('aria-selected', x === b));
      $$('.tab-panel', box).forEach(p => p.hidden = p.id !== 'tab-' + b.dataset.tab);
    }));
  });

  // Progress rings
  $$('[data-ring]').forEach(r => r.style.setProperty('--p', r.dataset.ring));

  // Show/hide password
  $$('[data-toggle-pw]').forEach(b => b.addEventListener('click', () => {
    const i = document.getElementById(b.dataset.togglePw);
    i.type = i.type === 'password' ? 'text' : 'password';
    b.textContent = i.type === 'password' ? 'Show' : 'Hide';
  }));

  // Password strength meter
  $$('[data-meter-for]').forEach(m => {
    const input = document.getElementById(m.dataset.meterFor), bar = $('i', m), text = m.parentElement.querySelector('[data-meter-text]');
    input.addEventListener('input', () => {
      const v = input.value; let s = 0;
      if (v.length >= 8) s++; if (/[A-Z]/.test(v)) s++; if (/\d/.test(v)) s++; if (/[^A-Za-z0-9]/.test(v)) s++;
      bar.style.width = (s * 25) + '%';
      bar.style.background = ['#d9482b', '#d9482b', '#c58a00', '#2a8a2f', '#2a8a2f'][s];
      text.textContent = ['Use 8+ characters with letters and numbers', 'Too weak', 'Getting there', 'Good', 'Strong'][s];
    });
  });

  // Demo account buttons on the login page
  $$('[data-fill]').forEach(b => b.addEventListener('click', () => {
    const [mail, pw] = b.dataset.fill.split('|');
    $('#loginForm input[name=email]').value = mail; $('#loginForm input[name=password]').value = pw;
  }));

  // Confirm dialogs
  $$('[data-confirm]').forEach(a => a.addEventListener('click', e => { if (!confirm(a.dataset.confirm)) e.preventDefault(); }));

  // Client-side form validation (delegated, so forms drawn later by pages.js are covered too)
  document.addEventListener('submit', e => {
    const f = e.target; if (!f.matches || !f.matches('form[data-validate]')) return;
    let ok = true;
    $$('.field-err', f).forEach(x => x.remove());
    $$('input,textarea,select', f).forEach(i => {
      i.classList.remove('bad');
      if (i.type === 'hidden' || i.disabled) return;
      if (!i.checkValidity()) {
        ok = false; i.classList.add('bad');
        const msg = document.createElement('span'); msg.className = 'field-err';
        msg.textContent = i.validationMessage || 'Check this field.';
        (i.closest('label') || i.parentElement).appendChild(msg);
      }
    });
    if (!ok) { e.preventDefault(); const first = $('.bad', f); if (first) first.focus(); }
  }, true);

  // Landing page: risky reading demo
  const dt = $('#demoToggle');
  if (dt) {
    const phone = dt.closest('.phone'); let risky = false;
    dt.addEventListener('click', () => {
      risky = !risky; phone.classList.toggle('alarm', risky);
      $('#demoBP').textContent = risky ? '186/124' : '124/82';
      $('#demoHR').textContent = risky ? '134 bpm' : '76 bpm';
      $('#demoStatus').textContent = risky ? 'Urgent: the clinic has been alerted and will contact you now.' : 'Everything looks stable. See you at your next visit.';
      dt.textContent = risky ? 'Back to a normal reading' : 'Try a risky reading';
    });
  }
});

/* Toast helper used by other scripts */
function showToast(msg, type = 'ok') {
  const stack = document.getElementById('toastStack'); if (!stack) return;
  const t = document.createElement('div'); t.className = 'toast toast-' + type; t.textContent = msg; stack.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 350); }, 4200);
}
