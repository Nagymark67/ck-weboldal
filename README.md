# Cantusok Köre Weboldal

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

If you haven't created the MySQL database used by the app, there's a helper SQL file at `db_init.sql`.

To create the database and table on Windows (using the MySQL command-line client):

1. Open a PowerShell window.
2. Run (replace password if your root user has one):

```powershell
mysql -u root -p < db_init.sql
```

3. If MySQL server is not running, start it from Services or use the MySQL Shell / MySQL Notifier that came with your installation.

Notes:
- The `db_init.sql` creates a `users` database and a `registered_users` table.
- The app uses database credentials in `server.js` (currently `root` / `P@ssw0rd!!`). Change these to match your MySQL setup or set up a dedicated MySQL user for the app.

## Using XAMPP (recommended for a local MySQL)

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

## Streamlit prototype

The Streamlit app is an alternative interface for signing in and viewing the
post feed. It uses the existing Express API for authentication and data, so
start the Node server and MySQL database as described above before launching
Streamlit. The Express session cookie is retained for each Streamlit browser
session. The prototype displays post text and links to attachments; the
existing HTML pages continue to provide the full site.

On Windows, from the project directory:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
$env:CK_API_BASE_URL = 'http://localhost:3000'
python -m streamlit run streamlit_app.py
```

Open the local URL printed by Streamlit (usually <http://localhost:8501>).
For deployment, set `CK_API_BASE_URL` to the reachable Express API URL and
install the packages in `requirements.txt`. Keep the Express API and its
database accessible only as appropriate for your deployment; do not connect
the Streamlit app directly to MySQL.
