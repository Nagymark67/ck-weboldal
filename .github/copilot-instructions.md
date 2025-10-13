## Quick context

This repo is a small Node.js + Express site that serves static frontend pages from the project root and exposes a compact JSON API backed by a MySQL database. The server lives in `server.js`. Frontend is plain HTML/CSS/vanilla JS (`index.html`, `login.html`, `register.html`, `ck_fooldal.css`). Uploads are stored under `/uploads`.

## Big picture (what to know first)
- server: `server.js` — Express 5 app using `mysql2/promise`, `express-session`, `multer`, `bcryptjs`.
- frontend: static files served from project root (so editing `index.html`/`login.html`/`register.html` changes live content).
- database: MySQL schema created/ensured at startup by `ensureSchema()` and roles/admin by `ensureRolesAndAdminUser()`.
- persistent session store: default in-memory `express-session` (MemoryStore) — fine for local dev, not for production.

## Important environment variables
- DB_HOST, DB_USER, DB_PASS, DB_NAME — used to configure the mysql2 pool in `server.js` and scripts.
- PORT — server port (default 3000).
- CORS_ORIGINS (comma-separated) or CORS_ALLOW_ALL=1 — controls allowed origins in `server.js`.

Example: README.md shows PowerShell examples to set these for local XAMPP usage.

## Key routes and API contracts (examples)
- GET /, /login, /register -> serve static HTML files (`index.html`, `login.html`, `register.html`).
- POST /register -> { username, password, status } -> 200 JSON { success: true } or 4xx/5xx with { message }
- POST /login -> { username, password } (uses credentials: 'include' client-side) -> sets session and returns { success: true }
- POST /logout -> removes session (expects POST with credentials)
- GET /me -> returns logged-in username, roles, isAllTimeAdmin flag (401 when not logged in)
- GET /posts -> returns { posts: [...] } (server parses attachments JSON column)
- POST /posts -> multipart/form-data with 'attachments' files and 'content','visibility' fields; uses multer (max 5 files, 10MB each)
- DELETE /posts/:id -> deletes post if author or has role
- GET /online-users -> returns { users: [{username, status}, ...] }

Frontend notes: client-side code calls these APIs with fetch; many requests use credentials: 'include' and expect JSON (see `index.html` for examples).

## Database conventions and domain-specific patterns
- Tables: `registered_users`, `roles`, `user_roles`, `posts` — roles are simple strings (examples: `cantus_praeses`, `jegyzo`, `all-time admin`).
- Post visibility enum values: `mindenki`, `tagok_es_tanitvanyok`, `csak_tagok` (Hungarian). Keep these exact strings when modifying visibility logic.
- Attachments: stored as JSON string in `posts.attachments`, client expects relative URLs like `/uploads/<filename>`.

## Scripts & developer workflows
- npm scripts (in `package.json`):
  - `npm start` -> runs `node server.js`
  - `npm run hash-passwords` -> `node scripts/hash_passwords.js` — hashes plaintext DB passwords (see `scripts/hash_passwords.js`).
- `scripts/check_admin.js` prints the special all-time admin user and roles for quick checks.
- DB bootstrapping: `db_init.sql` can be imported into MySQL (README contains PowerShell/XAMPP examples).

## Patterns and gotchas to preserve when editing
- Environment fallbacks: `server.js` intentionally respects empty strings vs undefined for DB env vars — follow the same pattern when reading env vars.
- The server creates a hidden all-time admin user at startup if missing (in `ensureRolesAndAdminUser()`). That behavior affects tests and local installs — be careful when changing usernames/role logic.
- Authentication/authorization: role checks use `userHasRole(username, requiredRoles)` which first checks for the special `all-time admin` role. When adding admin checks, prefer using this helper.
- Minimal XSS sanitization: `sanitizeContent()` strips <script> tags and inline handlers. It's intentionally minimal; if you harden it, make sure client rendering still works (posts contain simple HTML produced via contenteditable).
- File uploads: `multer` saves files to `/uploads` and filenames are sanitized in `server.js` (keep or improve filename safety consistently).

## Troubleshooting & debugging tips
- Start server locally: `npm install` (once) then `npm start` (or use the PowerShell examples in README to set env vars then `npm start`).
- Check console logs: `server.js` logs every request and startup info to stdout.
- To inspect DB state quickly, use `scripts/check_admin.js` or connect with MySQL client and inspect `registered_users`, `roles`, `user_roles`, `posts`.
- If uploads are missing, ensure `/uploads` exists (server creates it on start) and that file permissions allow writes.

## When writing or changing code as an AI helper
- Make edits minimal and local: update `server.js` functions in-place without wide reformatting.
- When adding routes, follow the existing JSON response pattern (Hungarian messages are used in many errors). Keep existing field names and status codes.
- Avoid committing secrets: there are hard-coded defaults in the repo (e.g., default DB password and the admin creation block). Prefer converting these to env variables or document clearly in your PR.
- Add tests conservatively; the repository currently has no test harness. If you add tests, include a short README entry showing how to run them.

## Files to inspect when you need context
- `server.js` — primary source of truth for backend behavior and DB logic
- `index.html`, `login.html`, `register.html` — show how the frontend invokes the API
- `scripts/hash_passwords.js`, `scripts/check_admin.js` — helper DB scripts
- `db_init.sql` — initial DB schema and example data
- `package.json` and `README.md` — developer scripts and run guidance

If any section above is unclear or you want more examples (payload shapes, typical responses, or a short runbook for local dev), tell me which part to expand. I can iterate on this file.
