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

The initial all-time admin is also configured through environment variables.
Set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and a strong random `SESSION_SECRET`
before starting the server. If the configured admin username already exists,
startup preserves that account and only ensures its all-time-admin role.

For Render, add these values under **Environment → Environment Variables** for
the service; do not commit a `.env` file or put real credentials in
`.env.example`:

```text
DATABASE_URL=<Render PostgreSQL connection string>
ADMIN_USERNAME=<your admin username>
ADMIN_PASSWORD=<a new strong admin password>
SESSION_SECRET=<a long random session secret>
NODE_ENV=production
```

### Google Drive photo imports

The admin page can import a random batch of images from the existing
`KépeCK` folder. Imported files are copied to the server's `uploads` directory
and are **not published automatically**: an all-time admin must approve each
image under the pending gallery section.

1. In Google Cloud, enable the Google Drive API and create a service account.
2. Share the `KépeCK` folder with the service account's e-mail address as a
   Viewer.
3. Copy the folder ID from its Drive URL (the text after `/folders/`).
4. Configure these server-side environment variables:

```text
GOOGLE_DRIVE_FOLDER_ID=<KépeCK folder ID>
GOOGLE_SERVICE_ACCOUNT_JSON=<the service-account JSON, kept secret>
```

For PowerShell, a compact single-line value can be created without committing
the file:

```powershell
$env:GOOGLE_SERVICE_ACCOUNT_JSON = (Get-Content .\service-account.json -Raw | ConvertFrom-Json | ConvertTo-Json -Compress)
```

The admin page's **9 kép importálása** button selects files that have not
already been imported. It never exposes the service-account credentials to the
browser. Automatic imports on a multi-day schedule and the rule for replacing
rejected photos should be added only after the manual import and moderation
flow is verified.

When using the deployed Supabase API, also apply
[`supabase/migrations/20261114034000_google_drive_gallery.sql`](./supabase/migrations/20261114034000_google_drive_gallery.sql)
and set the same two values as Supabase function secrets:

```powershell
supabase secrets set GOOGLE_DRIVE_FOLDER_ID=<KépeCK folder ID>
supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON='<compact service-account JSON>'
```

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

## Mobilalkalmazás (Capacitor / Android)

A weboldal közvetlenül Android alkalmazásként is használható a Capacitor segítségével:
- A natív `android/` projekt helyi build-eszköz; a `.gitignore` miatt nem kerül a weboldal repójába.
- A webes forrás, a Capacitor konfiguráció és a build-szkriptek maradnak verziókezelve.
- **Alkalmazás-azonosító (App ID)**: `hu.cantusokkore.app`
- **Alkalmazás neve**: Cantusok Köre
- **Natív funkciók**:
  - Cantusok Köre címeres egyedi indítóikonok és indítóképernyő (Splash Screen)
  - Bordó (`#4b0000`) státuszbár integráció
  - Hardveres Android vissza-gomb kezelés (előbb a megnyitott modálok/fiók fiók záródik be, utána lapoz vissza, vagy lép ki a főoldalról)
  - Notchek és lekerekített kijelzők (safe-area) támogatása

### Hasznos parancsok:
- **Webes fájlok előkészítése**: `npm run build`
- **Szinkronizálás az Android projekttel**: `npm run cap:sync`
- **Megnyitás Android Studio-ban**: `npm run cap:open` (vagy az `android` mappa megnyitása)
- **Debug APK építése parancssorból**:
  ```powershell
  cd android
  .\gradlew.bat assembleDebug
  ```
  A kész telepíthető APK itt található: `android/app/build/outputs/apk/debug/app-debug.apk`

Ha az `android/` mappa új gépen hiányzik, egyszer kell létrehozni a helyi natív projektet:
```powershell
npx cap add android
npm run cap:sync
```

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

## Supabase Edge Function backend

The repository includes a Supabase Edge Function implementation in
[`supabase/functions/api/index.ts`](./supabase/functions/api/index.ts). It
uses the existing `registered_users`, `roles`, `user_roles`, `posts`, and
`gallery_images` tables; it does not create replacement tables.

To deploy it:

1. In Supabase, create a Storage bucket named `uploads` and make it public,
   or update the function if the bucket should use signed URLs.
2. Install and authenticate the Supabase CLI, then link the existing project:

   ```powershell
   supabase login
   supabase link --project-ref <your-project-ref>
   ```

3. Add the function secrets. `PROJECT_URL` is your Supabase project URL
   (for example `https://abc123.supabase.co`) and `SECRET_KEY` is the
   project's server-side secret key; never put them in frontend files:

   ```powershell
   supabase secrets set PROJECT_URL=https://<project-ref>.supabase.co
   supabase secrets set SECRET_KEY=<supabase-secret-key>
   supabase secrets set SESSION_SECRET=<long-random-value>
   supabase secrets set CORS_ORIGINS=https://cantusokkore.hu,https://www.cantusokkore.hu
   ```

   For admin password reset e-mails, also configure the SMTP provider:

   ```powershell
   supabase secrets set SMTP_HOST=<smtp-host>
   supabase secrets set SMTP_PORT=587
   supabase secrets set SMTP_SECURE=false
   supabase secrets set SMTP_USER=<smtp-username>
   supabase secrets set SMTP_PASS=<smtp-password-or-app-password>
   supabase secrets set SMTP_FROM=<verified-sender-address>
   ```

   For Gmail, use an app password rather than the normal account password.
   The sender address must be accepted by the SMTP provider.

4. Deploy the function:

   ```powershell
   supabase functions deploy api
   ```

   The function URL is
   `https://<project-ref>.supabase.co/functions/v1/api`.

5. Edit [`api-config.js`](./api-config.js) and replace
   `YOUR_PROJECT_REF` with the existing Supabase project reference. Do not
   put `SECRET_KEY` in this file.

6. Test the API before publishing the frontend:

   ```powershell
   curl.exe https://<project-ref>.supabase.co/functions/v1/api/health
   curl.exe https://<project-ref>.supabase.co/functions/v1/api/posts
   ```

#### Automatic Edge Function deployment

The repository includes a GitHub Actions workflow at
`.github/workflows/deploy-supabase-function.yml`. It deploys the `api` function
after a push to `main` that changes `supabase/functions/**` or the Supabase
configuration. It does not run for ordinary frontend-only changes.

Add these two repository secrets under **Settings → Secrets and variables →
Actions** before using it:

- `SUPABASE_ACCESS_TOKEN`: a Supabase personal access token
- `SUPABASE_PROJECT_REF`: the Supabase project reference ID

The function's runtime secrets (`PROJECT_URL`, `SECRET_KEY`,
`SESSION_SECRET`, and `CORS_ORIGINS`) remain configured in Supabase and are
not copied into GitHub.

The included [`supabase/config.toml`](./supabase/config.toml) disables the
Supabase gateway's JWT requirement because this function authenticates users
with its own `HttpOnly` signed cookie. Keep the function's route-level
authorization intact.

### Gallery approvals and multiple uploads

Before deploying the updated function, run the migration in
[`supabase/migrations/20261101220000_gallery_approval.sql`](./supabase/migrations/20261101220000_gallery_approval.sql)
in the existing Supabase SQL Editor:

```sql
ALTER TABLE gallery_images
  ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT TRUE;
```

Existing gallery rows remain approved. Users with the `Tag` status or role may
upload up to 10 gallery images at once; those images remain hidden until an
all-time admin approves them from `admin.html`. Post uploads remain available
to the existing content roles and support up to 5 attachments.

Users with the `all-time admin`, `cantus_praeses`, or `jegyzo` role can delete
gallery images. The site shows currently online signed-in users and refreshes
their presence every 20 seconds; entries expire after 60 seconds without a
heartbeat.

Run [`supabase/migrations/20261101223000_online_users.sql`](./supabase/migrations/20261101223000_online_users.sql)
before deploying this presence feature.

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
