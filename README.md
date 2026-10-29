# Cantusok Köre Weboldal

## PostgreSQL deployment

The Express API uses PostgreSQL. Set one `DATABASE_URL` connection string
instead of separate MySQL variables:

```powershell
$env:DATABASE_URL = 'postgresql://user:password@host:5432/database?sslmode=require'
npm install
npm start
```

The server creates the required tables and roles automatically at startup.
Supabase, Neon, and Render PostgreSQL provide connection URLs suitable for
this configuration. Keep `DATABASE_URL` in the hosting provider's secret
environment variables; never commit it.

## Funkciók

### Backend (server.js)
- **Bejelentkezés**: Felhasználónév és jelszó alapján történő hitelesítés, session kezelés és online felhasználók nyilvántartása.
- **Online felhasználók lekérdezése**: Jelenleg bejelentkezett felhasználók listájának lekérése.
- **Kijelentkezés**: Felhasználó kijelentkeztetése, session törlése.

### Frontend (index.html)
- **Bejelentkezési űrlap**: Egyszerű felhasználói belépés.
- **Navigáció és tartalom**: Rólunk, Tagok listája, Kapcsolat szekciók.
- **Tagok listája**: Alapító és rendes tagok felsorolása.

### Stílusok (ck_fooldal.css)
- Modern, letisztult és reszponzív webes megjelenés.

---

További részletekért és a teljes funkciólistáért tekintsd meg a [forráskódot a GitHubon](https://github.com/Nagymark67/ck-weboldal/search?q=function).

## Licenc
A projekt 2025-ig védett. Minden jog fenntartva.

## Database setup

The Express server creates its PostgreSQL tables automatically at startup.
The older `db_init.sql` file is retained only for legacy MySQL installations.

## Legacy MySQL setup

The following XAMPP instructions apply only to older versions of the project
that used MySQL. They are not needed by the current PostgreSQL server.

1. Download and install XAMPP from https://www.apachefriends.org/index.html (choose Windows).
2. Start the Apache and MySQL services from the XAMPP Control Panel.
3. Open phpMyAdmin (http://localhost/phpmyadmin) and run the SQL in `db_init.sql` or use the Import UI to load the file.
4. Update `.env` (or set environment variables) to match your MySQL credentials. XAMPP's MySQL usually has user `root` with an empty password.

Example (PowerShell) to set env vars for the current session:

```powershell
$env:DB_HOST = '127.0.0.1'
$env:DB_USER = 'root'
$env:DB_PASS = ''
$env:DB_NAME = 'users'
$env:PORT = '3000'
npm start
```

## Expose your local server with ngrok

1. Download ngrok from https://ngrok.com and sign up to get an auth token.
2. Authenticate ngrok (once):

```powershell
ngrok authtoken <YOUR_AUTH_TOKEN>
```

3. Start your Node server locally (npm start), then in another terminal run:

```powershell
ngrok http 3000
```

4. ngrok will show a public URL (https://something.ngrok.io). Use that URL to share your site or test webhooks.

Notes:
- When using ngrok from a different origin, consider setting `CORS_ALLOW_ALL=1` in your environment (for development only).
- Do NOT expose production databases or secrets through ngrok without appropriate security.

## Streamlit app

The Streamlit app provides separate Home, Login, and Register pages and uses
the existing Express API for authentication, registration, and the post feed.
The Express API retains each browser session's login cookie. PostgreSQL and Express
must both be running before the feed and account forms can work.

On Windows, start Express in one PowerShell terminal from the project folder.
Install Node.js first if `node` or `npm` is not recognized. Configure `DATABASE_URL` for PostgreSQL, then start the API:

```powershell
$env:DATABASE_URL = 'postgresql://user:password@host:5432/database?sslmode=require'
$env:PORT = '3000'
npm install
npm start
```

Leave that terminal running. In a second terminal, start Streamlit:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
$env:CK_API_BASE_URL = 'http://localhost:3000'
python -m streamlit run streamlit_app.py
```

Open the Streamlit URL (usually <http://localhost:8501>). `localhost` works
only when Streamlit and Express run on the same computer. For a hosted
Streamlit app, set `CK_API_BASE_URL` to an Express API URL that the Streamlit
host can reach; the hosted app's `localhost` is not your personal computer.
Do not expose a development database or API publicly without securing it.

### Streamlit Community Cloud

Community Cloud hosts the Streamlit interface, not this Express API. Deploy
Express and PostgreSQL separately to hosts that provide a
reachable HTTPS API URL. In Streamlit Community Cloud, open the app's
**Settings → Secrets** and add:

```toml
CK_API_BASE_URL = "https://your-express-api.example.com"
```

Do not use `http://localhost:3000` there: it points to the Streamlit host, not
your computer. Never put database credentials or other secrets in the Git
repository.
