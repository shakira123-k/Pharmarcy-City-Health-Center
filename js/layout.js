/* Shared header, footer, mobile tab bar and toast messages for every page */
(function () {
  const u = currentUser(), page = location.pathname.split('/').pop() || 'index.html';
  const link = (href, label) => `<a href="${href}"${href === page ? ' class="active" aria-current="page"' : ''}>${label}</a>`; // tab links (with #) are highlighted by pages.js
  let nav = link('index.html', 'Home') + link('about.html', 'About') + link('about.html#help', 'Help') + link('about.html#contact', 'Contact');
  if (u && u.role === 'patient') nav += link('patient.html#home', 'My health') + link('patient.html#history', 'History') + link('patient.html#profile', 'Profile');
  if (u && u.role === 'clinician') nav += link('clinician.html#dashboard', 'Clinic dashboard') + link('clinician.html#alerts', 'Alert log');
  nav += u ? `<a class="btn btn-ghost btn-sm" href="#" id="logoutLink">Log out (${esc(firstName(u.name))})</a>`
           : '<a class="btn btn-ghost btn-sm" href="login.html#login">Log in</a><a class="btn btn-primary btn-sm" href="login.html#register">Join as patient</a>';

  const h = document.getElementById('site-header');
  if (h) h.outerHTML = `<header class="site-header"><div class="container nav-wrap">
    <a class="brand" href="index.html"><img src="assets/img/logo.jpeg" alt="" width="81" height="54"><span>Pharmacy City <b>Health Center</b></span></a>
    <button class="nav-toggle" id="navToggle" aria-label="Open menu" aria-expanded="false"><span></span><span></span><span></span></button>
    <nav class="main-nav" id="mainNav" aria-label="Main">${nav}</nav></div></header>`;

  const tab = (href, label, svg) => `<a href="${href}" class="${''}"><svg viewBox="0 0 24 24">${svg}</svg>${label}</a>`;
  const bar = u && u.role === 'patient' ? `<nav class="tabbar" aria-label="Patient app">
    ${tab('patient.html#home', 'Home', '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>')}
    ${tab('patient.html#log', 'Log vitals', '<path d="M3 12h4l3-8 4 16 3-8h4"/>')}
    ${tab('patient.html#medicine', 'Medicine', '<rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-35 12 12)"/><path d="M9 9l6 6"/>')}
    ${tab('patient.html#chat', 'Chat', '<path d="M4 5h16v11H9l-5 4z"/>')}</nav>` : '';

  const f = document.getElementById('site-footer');
  if (f) f.outerHTML = bar + `<footer class="site-footer"><div class="container footer-grid">
    <div><a class="brand brand-light" href="index.html"><img class="footer-logo" src="assets/img/logo.jpeg" alt="" width="90" height="60"><span>Pharmacy City <b>Health Center</b></span></a>
    <p>Remote patient monitoring for Pharmacy City Health Center, Nakawa Division, Kampala.</p></div>
    <div><h4>Explore</h4><a href="index.html">Home</a><a href="about.html">About the project</a><a href="about.html#help">Help and FAQ</a><a href="about.html#contact">Contact</a></div>
    <div><h4>Get started</h4><a href="login.html#register">Patient sign-up</a><a href="login.html#login">Patient or clinician login</a></div>
    <div><h4>Academic</h4><p>Makerere University Business School<br>Bachelor of Business Computing<br>Supervisor: Ms. Caroline Atuhaire</p></div></div>
    <div class="container footer-base">&copy; ${new Date().getFullYear()} Pharmacy City Health Center student prototype. Demo data is synthetic.</div></footer>`;

  const stack = document.getElementById('toastStack');
  if (stack) stack.innerHTML = popFlashes().map(([t, m]) => `<div class="toast toast-${esc(t)}" role="status">${esc(m)}</div>`).join('');

  document.addEventListener('click', e => {
    if (e.target.id === 'logoutLink') { e.preventDefault(); logout(); flash('ok', 'You have been logged out.'); location.href = 'index.html'; }
  });
})();
