# Pharmacy City Health Center: patient monitoring platform (HTML, CSS and JavaScript)

## How to run
1. Unzip and open the folder in Visual Studio Code (File > Open Folder).
2. Double-click `index.html`, or right-click it and choose "Open with Live Server".
3. No server is needed. Data is saved in the browser (localStorage).

## Demo logins
- Clinician: clinician@pchc.ug / Clinic@123
- Patient: patient@pchc.ug / Patient@123
Use "Reset demo data" on the log-in page to restore the sample data.

## Pages (5, down from 15)
| Page | What it holds |
| --- | --- |
| `index.html` | Home page |
| `about.html` | About the project, objectives, benefits, team, Help/FAQ and Contact (jump links at the top) |
| `login.html` | Log in and Create patient account (two tabs) |
| `patient.html` | Patient area. Views: `#home`, `#log`, `#history`, `#medicine`, `#chat`, `#profile` |
| `clinician.html` | Clinician area. Views: `#dashboard`, `#alerts`, `#patient/<id>` |

## Folders
- `assets/css/style.css`: all styling (mobile-first, responsive, colours taken from the logo)
- `assets/js/store.js`: the browser "database" and the triage rules
- `assets/js/layout.js`: shared header, footer and mobile tab bar
- `assets/js/pages.js`: logic for every page and the view router
- `assets/js/chart.js`: dependency-free charts
- `assets/js/main.js`: menu, tabs, form validation, animations
- `assets/img/`: `logo.jpeg` (official logo) and illustrations

## Next step: PHP + XAMPP + MySQL
`store.js` is the only file that holds data. In the next stage its functions are replaced by PHP pages that read and write MySQL,
and passwords are hashed with `password_hash()` instead of the demo hash used here.
