import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import express from "npm:express@4.18.2";
import bcrypt from "npm:bcryptjs@2.4.3";
import multer from "npm:multer@1.4.5-lts.1";
import nodemailer from "npm:nodemailer@7.0.9";
import { SignJWT, importPKCS8 } from "npm:jose@6";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = express();
app.use(express.json({ limit: "1mb" }));
const multipart = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const supabaseUrl = Deno.env.get("PROJECT_URL") || Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SECRET_KEY") || Deno.env.get("SERVICE_KEY");
const sessionSecret = Deno.env.get("SESSION_SECRET");
const smtpHost = Deno.env.get("SMTP_HOST");
const smtpUser = Deno.env.get("SMTP_USER");
const smtpPass = Deno.env.get("SMTP_PASS");
const smtpPort = Number(Deno.env.get("SMTP_PORT") || 587);
const smtpSecure = Deno.env.get("SMTP_SECURE") === "true";
const smtpFrom = Deno.env.get("SMTP_FROM") || smtpUser;
const googleDriveFolderId = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID");
const googleServiceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
let googleAccessToken: { value: string; expiresAt: number } | null = null;
if (!supabaseUrl || !serviceKey || !sessionSecret) {
  throw new Error("PROJECT_URL (or SUPABASE_URL), SECRET_KEY (or SERVICE_KEY) and SESSION_SECRET are required.");
}

const db = createClient(supabaseUrl, serviceKey);
const smtpTransport = smtpHost && smtpUser && smtpPass
  ? nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user: smtpUser, pass: smtpPass }
  })
  : null;
const cookieName = "ck_session";
const allowedOrigins = (Deno.env.get("CORS_ORIGINS") || "*").split(",").map((origin) => origin.trim()).filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes("*") || allowedOrigins.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "authorization, apikey, content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  if (req.url === "/api" || req.url.startsWith("/api/")) {
    req.url = req.url.slice(4) || "/";
  }
  next();
});

const text = (value: unknown) => typeof value === "string" ? value : "";
type UploadedFile = { originalname: string; mimetype: string; buffer: Uint8Array };
type MultipartRequest = express.Request & { files?: UploadedFile[]; file?: UploadedFile };
const parseId = (value: string) => {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// --- Firebase Cloud Messaging (FCM HTTP v1) Service ---
let cachedFcmToken: { token: string; exp: number } | null = null;
const fcmProjectId = "ck-app-2665c";
const defaultFcmClientEmail = "firebase-adminsdk-fbsvc@ck-app-2665c.iam.gserviceaccount.com";
const defaultFcmPrivateKeyPkcs8 = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDAytrUM/oR77Gt
ikxsetKArfEGXE7zDkYqRhuoWLRu1D3iKuQHY0tdNy6Voa9FC20WZ/4K85I88M5g
/jgawAg5LT1QgzJPevyd6tco8BJGQgA0k7Cc/NTcS+zn/St4+eW1OcbyXXQUm0ia
gggEY8YmeaWiA0DOCf6H2SxwCTNzfwyyMHvghpl/pD9CqiHiLXumyOaF19TtVKOq
RNK5lJ3dbdfGLkmbToRg17/o2JfHYgJEfFJkUs+eYGgfEGibeGbXuj85EIoTp0Zy
qEpYKbSGE0cyU+LJCVb4gXjt5vqo7gDVdrYpR5UXEcsxM19fon8YUJVynurUeaUP
dU9WPCsLAgMBAAECggEAF7tg1epSss6HV/jEO5OgQfLSI+73pk0a2gKoo5UicNoe
MVmyRC6MN7yejBDLxdCy7E/UzShP12yVGwoa10Ai7aw3S1KQaN7s0HZOEgirVzay
ARwvthjGuG99iXkirCZRiSNu7VAPr/xazZo1aRpBvrlkEt4aUMKY2xl4B4/lDicI
XsuMY8m3RY0GzD5P6CgKmCLuDH+HB4gz32aG9iEecrlMtRrs60uzVMRCIYw7nPc9
Tve+/feTVNow1Wje0f7YwV87YwyVEiD1zQRZcrEk7+E2fEfi9bykDu8qELsYIPdH
q/zQa5MYZeoxP3GpZ1w1lCtL4t7jjJ7KvxLV6yk4YQKBgQD+RDWYUuECDEJfvy7s
+OSM3FVbiu05gXlesZmx39yI8jJOkQJV4z2focRCz+bU++2jJv8WpHwTBryH/UmD
b/uPc6FatR3qsZlB2dag3tLdMTnOj0BjbJawTYdxYhgAF73Dps73hlF/jgaeR6fR
YR7WyTJyLFAQ+MgD9SS+VAwxaQKBgQDCG1mgfbFBwLdvZIRctevpDVaYumKX+1BM
Uyh2O8Vu+1xjErNCqdnkHjl0fk8VEmdJ9A4K48jm+VRHNo+RHRdrmRIJEBTOQv9x
t3Jy0Wk3N4twYaGO4UCP1WrstBKQUsyT0LBynQLHNSTtRIFPTMI/TawsLPtREAVs
nu3jTXw2UwKBgA6vT80ZVEdy/85Z01L6WPDNtNxRnLvKf4D5jt/YBvudyUwCUfk1
45Q5moUlTraUSjg3A1qCa2wJ4o+UEE/YAtZZHkOH3E92rFxCQYQO+myt8CG+4kAb
wGQ0RhNFUA+JT3tiQefHySMtx7ISf123Vzmeaxxu9LzWMW8RFGstnXqpAoGAKC6/
RCEhE8qQbsfxOrwSZUF0ntNe27WT7uj8JFXFTm9MtdnGMFO3Hqk/HaWUO3l+1mlm
isyS53XQA5oA6HqMQaMDf8rLc9Ocy+69C5XcYSjnfdFIP6rT0bLNmsjAWw44+ZSn
ImLsk06mIVQgLMloIPC0ZsS9Fg/p/417E6YTw68CgYEA2EJU0d9xNYmMKl+G0rti
er829HRqK+cezEpj51qTWdoCqiPH4/YrvmtXe6rpCG71s11k2Ktwio7PelWhug3b
9mKFPPMzt17w7rwn4w9iPEsOjUxOIgUyOHWjn+l89IKPpnw1b7b47gvq9OOGVF5H
tcvA+O6ZDDWYggJ9sWKc/P4=
-----END PRIVATE KEY-----`;

async function getFcmAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedFcmToken && cachedFcmToken.exp > now + 60000) {
    return cachedFcmToken.token;
  }
  let email = defaultFcmClientEmail;
  let pkcs8 = defaultFcmPrivateKeyPkcs8;
  const envKey = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (envKey) {
    try {
      const parsed = JSON.parse(envKey);
      if (parsed.client_email && parsed.private_key) {
        email = parsed.client_email;
        pkcs8 = parsed.private_key;
      }
    } catch (_) {}
  }

  const privateKey = await importPKCS8(pkcs8, "RS256");
  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/firebase.messaging"
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(email)
    .setSubject(email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to obtain Google access token: ${errorText}`);
  }
  const data = await res.json();
  cachedFcmToken = { token: data.access_token, exp: now + 3500000 };
  return data.access_token;
}

async function sendFcmPushToAll(title: string, body: string, extraData: Record<string, string> = {}) {
  try {
    const { data: rows, error } = await db.from("push_tokens").select("token");
    if (error) {
      console.error("Error querying push_tokens", error);
      return;
    }
    if (!rows || rows.length === 0) {
      console.log("[FCM PUSH] No registered tokens found");
      return;
    }
    const tokens = rows.map((r: { token: string }) => r.token).filter(Boolean);
    const accessToken = await getFcmAccessToken();
    const endpoint = `https://fcm.googleapis.com/v1/projects/${fcmProjectId}/messages:send`;

    const deadTokens: string[] = [];
    await Promise.allSettled(
      tokens.map(async (deviceToken: string) => {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              message: {
                token: deviceToken,
                notification: { title, body },
                data: extraData,
                android: {
                  priority: "high",
                  notification: {
                    sound: "default",
                    channel_id: "cantusok_push_channel"
                  }
                }
              }
            })
          });
          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            const code = errJson?.error?.details?.[0]?.errorCode || errJson?.error?.status;
            if (code === "UNREGISTERED" || code === "INVALID_ARGUMENT") {
              deadTokens.push(deviceToken);
            }
          }
        } catch (singleErr) {
          console.warn("Single FCM send failed:", singleErr);
        }
      })
    );

    if (deadTokens.length > 0) {
      await db.from("push_tokens").delete().in("token", deadTokens);
    }
  } catch (err) {
    console.error("sendFcmPushToAll error:", err);
  }
}

async function checkAndSendCalendarReminders() {
  const now = new Date();
  const budapestDateStr = now.toLocaleString("en-US", { timeZone: "Europe/Budapest" });
  const budapestNow = new Date(budapestDateStr);
  const dayOfWeek = budapestNow.getDay();
  const hours = budapestNow.getHours();

  if (dayOfWeek === 0 && hours === 20) {
    const reminderKey = `daltanitas_eve_${budapestNow.getFullYear()}_${budapestNow.getMonth()}_${budapestNow.getDate()}`;
    const { data: existing } = await db.from("sent_event_reminders").select("reminder_key").eq("reminder_key", reminderKey).maybeSingle();
    if (!existing) {
      await db.from("sent_event_reminders").insert({ reminder_key: reminderKey });
      await sendFcmPushToAll(
        "Holnap Daltanítás!",
        "Emlékeztető: Holnap 19:00-kor Daltanítás a Liget Sörözőben!",
        { type: "event_reminder" }
      );
    }
  }

  if (dayOfWeek === 1 && hours === 18) {
    const reminderKey = `daltanitas_1h_${budapestNow.getFullYear()}_${budapestNow.getMonth()}_${budapestNow.getDate()}`;
    const { data: existing } = await db.from("sent_event_reminders").select("reminder_key").eq("reminder_key", reminderKey).maybeSingle();
    if (!existing) {
      await db.from("sent_event_reminders").insert({ reminder_key: reminderKey });
      await sendFcmPushToAll(
        "Hamarosan Daltanítás!",
        "1 óra múlva (19:00) kezdődik a Daltanítás a Liget Sörözőben!",
        { type: "event_reminder" }
      );
    }
  }

  // Check custom database events
  try {
    const twoDaysAhead = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
    const { data: eventsList } = await db.from("calendar_events").select("*").gte("start_date", now.toISOString()).lte("start_date", twoDaysAhead);
    if (Array.isArray(eventsList)) {
      for (const ev of eventsList) {
        const evStart = new Date(ev.start_date);
        const diffMs = evStart.getTime() - now.getTime();
        const diffMin = Math.round(diffMs / 60000);
        const timeStr = evStart.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" });

        if (diffMin >= 45 && diffMin <= 75) {
          const reminderKey = `event_1h_${ev.id}_${evStart.getFullYear()}_${evStart.getMonth()}_${evStart.getDate()}`;
          const { data: existing } = await db.from("sent_event_reminders").select("reminder_key").eq("reminder_key", reminderKey).maybeSingle();
          if (!existing) {
            await db.from("sent_event_reminders").insert({ reminder_key: reminderKey });
            await sendFcmPushToAll(
              `Hamarosan: ${ev.title}`,
              `1 óra múlva (${timeStr}) kezdődik: ${ev.title} (${ev.location || "Liget Söröző"})`,
              { type: "event_reminder", eventId: ev.id }
            );
          }
        }

        if (hours === 20) {
          const tomorrow = new Date(budapestNow);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const evBudapestStr = evStart.toLocaleString("en-US", { timeZone: "Europe/Budapest" });
          const evBudapest = new Date(evBudapestStr);
          if (tomorrow.getFullYear() === evBudapest.getFullYear() && tomorrow.getMonth() === evBudapest.getMonth() && tomorrow.getDate() === evBudapest.getDate()) {
            const reminderKey = `event_eve_${ev.id}_${evStart.getFullYear()}_${evStart.getMonth()}_${evStart.getDate()}`;
            const { data: existing } = await db.from("sent_event_reminders").select("reminder_key").eq("reminder_key", reminderKey).maybeSingle();
            if (!existing) {
              await db.from("sent_event_reminders").insert({ reminder_key: reminderKey });
              await sendFcmPushToAll(
                `Holnap: ${ev.title}`,
                `Holnap ${timeStr}-kor: ${ev.title} (${ev.location || "Liget Söröző"})`,
                { type: "event_reminder", eventId: ev.id }
              );
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("Error checking calendar_events in cron:", err);
  }
}

const encode = (value: string) => btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const decode = (value: string) => atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
const key = async () => crypto.subtle.importKey("raw", new TextEncoder().encode(sessionSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

async function createToken(payload: Record<string, unknown>) {
  const body = encode(JSON.stringify({ ...payload, exp: Date.now() + 24 * 60 * 60 * 1000 }));
  const signature = encode(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", await key(), new TextEncoder().encode(body)))));
  return `${body}.${signature}`;
}

async function readToken(token: string | undefined) {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  try {
    const valid = await crypto.subtle.verify("HMAC", await key(), Uint8Array.from(decode(signature), (character) => character.charCodeAt(0)), new TextEncoder().encode(body));
    if (!valid) return null;
    const payload = JSON.parse(decode(body));
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

function cookieValue(req: express.Request) {
  const cookies = text(req.headers.cookie).split(";").map((part) => part.trim());
  const entry = cookies.find((part) => part.startsWith(`${cookieName}=`));
  return entry ? decodeURIComponent(entry.slice(cookieName.length + 1)) : undefined;
}

async function currentUser(req: express.Request) {
  return readToken(cookieValue(req));
}

function setSession(res: express.Response, token: string) {
  res.setHeader("Set-Cookie", `${cookieName}=${encodeURIComponent(token)}; Max-Age=86400; Path=/; HttpOnly; Secure; SameSite=None`);
}

function clearSession(res: express.Response) {
  res.setHeader("Set-Cookie", `${cookieName}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=None`);
}

async function rolesFor(username: string) {
  const { data, error } = await db
    .from("registered_users")
    .select("status, user_roles(roles(role_name))")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  const explicit = (data?.user_roles || []).map((entry: { roles?: { role_name?: string } | null }) => entry.roles?.role_name).filter(Boolean) as string[];
  const derived = data?.status === "Cantus Praeses" ? ["cantus_praeses"] : data?.status === "Jegyző" ? ["jegyzo"] : data?.status === "Alapító" ? ["alapito"] : data?.status === "Tag" ? ["tag"] : [];
  return { roles: [...new Set([...explicit.filter((role) => role !== "all-time admin"), ...derived])], isAllTimeAdmin: explicit.includes("all-time admin"), status: data?.status || null };
}

async function requireUser(req: express.Request, res: express.Response) {
  const session = await currentUser(req);
  if (!session?.username) {
    res.status(401).json({ message: "Nincs bejelentkezve" });
    return null;
  }
  return String(session.username);
}

async function hasRole(username: string, required: string[]) {
  const { isAllTimeAdmin, roles } = await rolesFor(username);
  return isAllTimeAdmin || required.some((role) => roles.includes(role));
}

function sanitizeContent(input: string) {
  return input.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<(iframe|object|embed|form)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, "");
}

app.get("/health", async (_req, res) => {
  checkAndSendCalendarReminders().catch(() => {});
  res.json({ ok: true });
});

app.post("/register", async (req, res) => {
  const username = text(req.body?.username).trim();
  const password = text(req.body?.password);
  const status = text(req.body?.status);
  const email = text(req.body?.email).trim().toLowerCase() || null;
  if (!username || !password || !status) return res.status(400).json({ message: "Hiányzó adatok!" });
  if (status === "Alapító" && !["Simon Gábor", "Barak Antal", "Bodnár Róbert", "Fodor Ferenc", "Czakó Gábor"].includes(username)) {
    return res.status(403).json({ message: "Csak az Alapítóként megadott személyek választhatják ezt a státuszt." });
  }
  try {
    const { data: existing } = await db.from("registered_users").select("id").eq("username", username).maybeSingle();
    if (existing) return res.status(409).json({ message: "A felhasználónév már foglalt!" });
    if (["Cantus Praeses", "Jegyző"].includes(status)) {
      const { data: taken } = await db.from("registered_users").select("id").eq("status", status).limit(1);
      if (taken?.length) return res.status(403).json({ message: `${status} pozíciót már betöltik.` });
    }
    const { error } = await db.from("registered_users").insert({ username, password: await bcrypt.hash(password, 10), status, email });
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error("Register error", error);
    res.status(500).json({ message: "Adatbázis hiba!" });
  }
});

app.post("/login", async (req, res) => {
  const username = text(req.body?.username).trim();
  const password = text(req.body?.password);
  try {
    const { data: user, error } = await db.from("registered_users").select("username,password,password_reset_required").eq("username", username).maybeSingle();
    if (error) throw error;
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ success: false, message: "Hibás felhasználónév vagy jelszó!" });
    if (user.password_reset_required) {
      setSession(res, await createToken({ resetUsername: username }));
      return res.json({ success: true, requiresPasswordChange: true, username });
    }
    setSession(res, await createToken({ username }));
    res.json({ success: true });
  } catch (error) {
    console.error("Login error", error);
    res.status(500).json({ message: "Adatbázis hiba!" });
  }
});

app.post("/password-reset/complete", async (req, res) => {
  const session = await currentUser(req);
  const username = text(session?.resetUsername);
  const password = text(req.body?.password);
  if (!username) return res.status(401).json({ message: "A jelszócsere munkamenete lejárt." });
  if (password.length < 8) return res.status(400).json({ message: "Az új jelszónak legalább 8 karakteresnek kell lennie." });
  const { error } = await db.from("registered_users").update({ password: await bcrypt.hash(password, 10), password_reset_required: false }).eq("username", username);
  if (error) return res.status(500).json({ message: "A jelszó mentése nem sikerült." });
  setSession(res, await createToken({ username }));
  res.json({ success: true });
});

app.post("/logout", (_req, res) => {
  clearSession(res);
  res.json({ success: true });
});

app.get("/me", async (req, res) => {
  const username = await requireUser(req, res);
  if (!username) return;
  try {
    const result = await rolesFor(username);
    res.json({ username, ...result });
  } catch (error) {
    console.error("Me error", error);
    res.status(500).json({ message: "A felhasználói adatok lekérése nem sikerült." });
  }
});

app.get("/reserved-statuses", async (_req, res) => {
  const { data, error } = await db.from("registered_users").select("status").in("status", ["Cantus Praeses", "Jegyző"]);
  if (error) return res.status(500).json({ taken: [] });
  res.json({ taken: [...new Set((data || []).map((row) => row.status).filter(Boolean))] });
});

app.get("/posts", async (req, res) => {
  try {
    const session = await currentUser(req);
    const visibility = session?.username ? ["mindenki", "tagok_es_tanitvanyok", "csak_tagok"] : ["mindenki"];
    const { data, error } = await db.from("posts").select("id,author_username,content,visibility,attachments,poll,created_at").in("visibility", visibility).order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    res.json({ posts: data || [], currentUser: session?.username || null });
  } catch (error) {
    console.error("Posts error", error);
    res.status(500).json({ posts: [] });
  }
});

async function uploadFile(file: { originalname: string; mimetype: string; buffer: Uint8Array }, username: string) {
  const safeUsername = username.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]/g, "_").replace(/^_+|_+$/g, "") || "user";
  const safeName = file.originalname.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${safeUsername}/${crypto.randomUUID()}-${safeName || "upload"}`;
  const { error } = await db.storage.from("uploads").upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
  if (error) throw error;
  return `${supabaseUrl}/storage/v1/object/public/uploads/${path}`;
}

function storagePathFromUrl(value: unknown) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    const marker = "/storage/v1/object/public/uploads/";
    const index = url.pathname.indexOf(marker);
    return index === -1 ? "" : decodeURIComponent(url.pathname.slice(index + marker.length));
  } catch {
    return "";
  }
}

async function getGoogleDriveAccessToken() {
  if (!googleDriveFolderId || !googleServiceAccountJson) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID and GOOGLE_SERVICE_ACCOUNT_JSON are required.");
  }
  if (googleAccessToken && googleAccessToken.expiresAt > Date.now() + 60_000) return googleAccessToken.value;
  const credentials = JSON.parse(googleServiceAccountJson) as { client_email: string; private_key: string };
  const key = await importPKCS8(credentials.private_key, "RS256");
  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token"
  }).setProtectedHeader({ alg: "RS256", typ: "JWT" }).setIssuer(credentials.client_email)
    .setIssuedAt().setExpirationTime("1h").sign(key);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion })
  });
  if (!tokenResponse.ok) throw new Error(`Google token request failed (${tokenResponse.status}).`);
  const token = await tokenResponse.json() as { access_token?: string; expires_in?: number };
  if (!token.access_token) throw new Error("Google token response did not contain an access token.");
  googleAccessToken = { value: token.access_token, expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000 };
  return token.access_token;
}

async function driveFetch(path: string, init: RequestInit = {}) {
  const token = await getGoogleDriveAccessToken();
  const response = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) }
  });
  if (!response.ok) throw new Error(`Google Drive request failed (${response.status}).`);
  return response;
}

type DriveFile = { id?: string; name?: string; mimeType?: string };

async function listDriveImages() {
  const folders = [googleDriveFolderId!];
  const images: DriveFile[] = [];
  const visited = new Set<string>();
  while (folders.length) {
    const folderId = folders.shift()!;
    if (visited.has(folderId)) continue;
    visited.add(folderId);
    let pageToken = "";
    do {
      const params = new URLSearchParams({
        q: `'${folderId}' in parents and trashed = false`,
        pageSize: "1000",
        includeItemsFromAllDrives: "true",
        supportsAllDrives: "true",
        fields: "nextPageToken,files(id,name,mimeType)"
      });
      if (pageToken) params.set("pageToken", pageToken);
      const response = await driveFetch(`files?${params.toString()}`);
      const data = await response.json() as { files?: DriveFile[]; nextPageToken?: string };
      for (const file of data.files || []) {
        if (file.id && file.mimeType === "application/vnd.google-apps.folder") folders.push(file.id);
        else if (file.id && file.mimeType?.startsWith("image/")) images.push(file);
      }
      pageToken = data.nextPageToken || "";
    } while (pageToken);
  }
  return images;
}

async function galleryImageForClient(image: { image_url: string; [key: string]: unknown }) {
  const marker = "/storage/v1/object/public/uploads/";
  try {
    const imagePath = new URL(image.image_url).pathname.split(marker)[1];
    if (!imagePath) return image;
    const { data, error } = await db.storage.from("uploads").createSignedUrl(decodeURIComponent(imagePath), 60 * 60);
    if (error || !data?.signedUrl) return image;
    return { ...image, image_url: data.signedUrl };
  } catch {
    return image;
  }
}

async function approvedGalleryCount() {
  const { count, error } = await db
    .from("gallery_images")
    .select("id", { count: "exact", head: true })
    .eq("approved", true);
  if (error) throw error;
  return count || 0;
}

app.post("/posts", multipart.array("attachments", 5), async (req, res) => {
  const username = await requireUser(req, res);
  if (!username) return;
  if (!(await hasRole(username, ["cantus_praeses", "jegyzo"]))) return res.status(403).json({ message: "Nincs jogosultsága posztolni" });
  try {
    const content = sanitizeContent(text(req.body?.content));
    const visibility = text(req.body?.visibility) || "mindenki";
    let poll = null;
    const pollValue = req.body?.poll;
    if (pollValue) {
      const submitted = JSON.parse(text(pollValue));
      const question = text(submitted.question).trim().slice(0, 300);
      const options = Array.isArray(submitted.options) ? submitted.options.map((option: unknown) => text(option).trim().slice(0, 120)).filter(Boolean).slice(0, 6) : [];
      if (question && options.length >= 2) poll = { question, options: options.map((option: string) => ({ text: option, votes: 0 })) };
    }
    const multipartRequest = req as MultipartRequest;
    const files = Array.isArray(multipartRequest.files) ? multipartRequest.files : [];
    if (!content.trim() && !poll && files.length === 0) return res.status(400).json({ message: "Adj meg tartalmat, képet vagy szavazást" });
    const attachments = await Promise.all(files.map((file) => uploadFile(file, username)));
    const { error } = await db.from("posts").insert({ author_username: username, content, visibility, attachments, poll });
    if (error) throw error;

    // Send push notification to all registered phones
    try {
      const cleanSnippet = content.replace(/<[^>]+>/g, "").trim().slice(0, 100);
      sendFcmPushToAll(
        `Új bejegyzés: ${username}`,
        cleanSnippet || "Új bejegyzés jelent meg a Cantusok Köre oldalán.",
        { type: "new_post" }
      ).catch((err) => console.warn("Background FCM send failed:", err));
    } catch (pushErr) {
      console.warn("FCM push send error:", pushErr);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Create post error", error);
    res.status(500).json({ message: "Hiba a poszt létrehozásakor" });
  }
});

app.post("/posts/:id/vote", async (req, res) => {
  if (!await requireUser(req, res)) return;
  const id = parseId(req.params.id);
  const optionIndex = Number.parseInt(req.body?.optionIndex, 10);
  if (!id || !Number.isInteger(optionIndex)) return res.status(400).json({ message: "Érvénytelen szavazat" });
  const { data: post, error } = await db.from("posts").select("poll").eq("id", id).maybeSingle();
  if (error || !post) return res.status(404).json({ message: "A poszt nem található" });
  const poll = post.poll;
  if (!poll?.options?.[optionIndex]) return res.status(400).json({ message: "A poszt nem tartalmaz szavazást" });
  poll.options[optionIndex].votes = Number(poll.options[optionIndex].votes || 0) + 1;
  const result = await db.from("posts").update({ poll }).eq("id", id);
  if (result.error) return res.status(500).json({ message: "Hiba a szavazás mentésekor" });
  res.json({ success: true, poll });
});

app.delete("/posts/:id", async (req, res) => {
  const username = await requireUser(req, res);
  if (!username) return;
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Érvénytelen azonosító" });
  const { data: post, error } = await db.from("posts").select("author_username").eq("id", id).maybeSingle();
  if (error || !post) return res.status(404).json({ message: "A poszt nem található" });
  if (post.author_username !== username && !await hasRole(username, ["cantus_praeses", "jegyzo"])) return res.status(403).json({ message: "Nincs jogosultsága törölni" });
  const result = await db.from("posts").delete().eq("id", id);
  if (result.error) return res.status(500).json({ message: "Hiba a poszt törlésekor" });
  res.json({ success: true });
});

app.delete("/posts/:id/attachments/:attachmentIndex", async (req, res) => {
  const username = await requireUser(req, res);
  if (!username) return;
  const id = parseId(req.params.id);
  const attachmentIndex = Number.parseInt(req.params.attachmentIndex, 10);
  if (!id || !Number.isInteger(attachmentIndex) || attachmentIndex < 0) {
    return res.status(400).json({ message: "Érvénytelen képazonosító" });
  }
  const { data: post, error } = await db.from("posts").select("author_username,attachments").eq("id", id).maybeSingle();
  if (error || !post) return res.status(404).json({ message: "A poszt nem található" });
  if (post.author_username !== username && !await hasRole(username, ["cantus_praeses", "jegyzo"])) {
    return res.status(403).json({ message: "Nincs jogosultsága a kép törléséhez" });
  }
  const attachments = Array.isArray(post.attachments) ? post.attachments : [];
  if (attachmentIndex >= attachments.length) return res.status(404).json({ message: "A kép nem található" });
  const [removed] = attachments.splice(attachmentIndex, 1);
  const result = await db.from("posts").update({ attachments }).eq("id", id);
  if (result.error) return res.status(500).json({ message: "A kép törlése nem sikerült" });
  const removedUrl = typeof removed === "string"
    ? removed
    : removed && typeof removed === "object"
      ? (removed.url || removed.image_url || removed.path || "")
      : "";
  const storagePath = storagePathFromUrl(removedUrl);
  if (storagePath) {
    const { error: storageError } = await db.storage.from("uploads").remove([storagePath]);
    if (storageError) console.error("Post attachment storage cleanup failed", storageError);
  }
  res.json({ success: true, attachments });
});

app.get("/gallery", async (req, res) => {
  if (!await requireUser(req, res)) return;
  let result = await db.from("gallery_images").select("id,image_url,alt_text,created_at").eq("approved", true).order("created_at", { ascending: true });
  if (result.error) {
    result = await db.from("gallery_images").select("id,image_url,alt_text,created_at").order("created_at", { ascending: true });
  }
  if (result.error) return res.status(500).json({ message: "A galéria betöltése nem sikerült" });
  res.json({ images: await Promise.all((result.data || []).map(galleryImageForClient)) });
});

app.post("/gallery", multipart.array("image", 10), async (req, res) => {
  const username = await requireUser(req, res);
  if (!username) return;
  const canApprove = await hasRole(username, ["cantus_praeses", "jegyzo"]);
  if (!canApprove && !(await hasRole(username, ["tag"]))) return res.status(403).json({ message: "Nincs jogosultsága képet feltölteni" });
  try {
    const files = ((req as MultipartRequest).files || []).slice(0, 10);
    if (files.length === 0) return res.status(400).json({ message: "Kép feltöltése kötelező" });
    if (files.some((file) => !/^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype))) return res.status(400).json({ message: "Érvénytelen képformátum" });
    if (canApprove) {
      const currentCount = await approvedGalleryCount();
      if (currentCount + files.length > 9) {
        return res.status(409).json({ message: `A galéria már ${currentCount}/9 képet tartalmaz. Előbb törölj egy képet.` });
      }
    }
    const altText = text(req.body?.altText).trim().slice(0, 200) || "A Cantusok Köre közös fotója";
    const imageUrls = await Promise.all(files.map((file) => uploadFile(file, username)));
    const { data, error } = await db.from("gallery_images").insert(imageUrls.map((image_url) => ({ image_url, alt_text: altText, uploaded_by: username, approved: canApprove }))).select("id,image_url,alt_text,created_at,approved");
    if (error) throw error;
    res.json({ success: true, images: data || [], pendingApproval: !canApprove });
  } catch (error) {
    console.error("Gallery upload error", error);
    res.status(500).json({ message: "A kép feltöltése nem sikerült" });
  }
});

app.delete("/gallery/:id", async (req, res) => {
  const username = await requireUser(req, res);
  if (!username) return;
  if (!await hasRole(username, ["cantus_praeses", "jegyzo"])) return res.status(403).json({ message: "Nincs jogosultsága képet törölni" });
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Érvénytelen azonosító" });
  const { data: image, error: selectError } = await db.from("gallery_images").select("image_url").eq("id", id).maybeSingle();
  if (selectError) return res.status(500).json({ message: "A kép lekérése nem sikerült" });
  if (!image) return res.status(404).json({ message: "A kép nem található" });
  const { error } = await db.from("gallery_images").delete().eq("id", id);
  if (error) return res.status(500).json({ message: "A kép törlése nem sikerült" });
  try {
    const path = decodeURIComponent(new URL(image.image_url).pathname.split("/storage/v1/object/public/uploads/")[1] || "");
    if (path) await db.storage.from("uploads").remove([path]);
  } catch (cleanupError) {
    console.error("Gallery storage cleanup error", cleanupError);
  }
  res.json({ success: true });
});

app.get("/online-users", async (_req, res) => {
  const cutoff = new Date(Date.now() - 60 * 1000).toISOString();
  const { data, error } = await db
    .from("online_users")
    .select("username, registered_users(status)")
    .gt("last_seen", cutoff)
    .order("username");
  if (error) {
    console.error("Online users error", error);
    return res.status(500).json({ message: "Az online felhasználók lekérése nem sikerült", users: [] });
  }
  res.json({ users: (data || []).map((entry: { username: string; registered_users?: { status?: string } | null }) => ({ username: entry.username, status: entry.registered_users?.status || null })) });
});

app.post("/online-ping", async (req, res) => {
  const username = await requireUser(req, res);
  if (!username) return;
  const { error } = await db.from("online_users").upsert({ username, last_seen: new Date().toISOString() }, { onConflict: "username" });
  if (error) {
    console.error("Online ping error", error);
    return res.status(500).json({ message: "Az online állapot mentése nem sikerült" });
  }
  res.json({ success: true });
});

app.post("/online-leave", async (req, res) => {
  const username = await requireUser(req, res);
  if (!username) return;
  const { error } = await db.from("online_users").delete().eq("username", username);
  if (error) {
    console.error("Online leave error", error);
    return res.status(500).json({ message: "Az online állapot törlése nem sikerült" });
  }
  res.json({ success: true });
});

app.post("/push/register-token", async (req, res) => {
  const token = text(req.body?.token).trim();
  const platform = text(req.body?.platform) || "android";
  if (!token) return res.status(400).json({ message: "Missing token" });
  const user = await currentUser(req);
  const username = user?.username ? String(user.username) : null;
  const { error } = await db.from("push_tokens").upsert({
    token,
    username,
    platform,
    updated_at: new Date().toISOString()
  }, { onConflict: "token" });
  if (error) {
    console.error("Error storing push token", error);
    return res.status(500).json({ message: "DB error" });
  }
  res.json({ success: true });
});

app.post("/push/unregister-token", async (req, res) => {
  const token = text(req.body?.token).trim();
  if (!token) return res.status(400).json({ message: "Missing token" });
  const { error } = await db.from("push_tokens").delete().eq("token", token);
  if (error) {
    console.error("Error deleting push token", error);
    return res.status(500).json({ message: "DB error" });
  }
  res.json({ success: true });
});

app.get("/cron/check-event-reminders", async (_req, res) => {
  try {
    await checkAndSendCalendarReminders();
    res.json({ ok: true });
  } catch (err) {
    console.error("Check reminders error", err);
    res.status(500).json({ error: String(err) });
  }
});

app.get("/events", async (_req, res) => {
  try {
    const { data, error } = await db.from("calendar_events").select("*").order("start_date", { ascending: true });
    if (error) {
      console.warn("Could not fetch calendar_events:", error.message);
      return res.json({ events: [] });
    }
    const formatted = (data || []).map((ev) => ({
      id: ev.id,
      title: ev.title,
      location: ev.location,
      date: ev.start_date,
      endDate: ev.end_date,
      details: ev.description,
      link: ev.link,
      createdBy: ev.created_by
    }));
    res.json({ events: formatted });
  } catch (err) {
    console.error("Fetch events error", err);
    res.status(500).json({ events: [] });
  }
});

app.post("/events", async (req, res) => {
  const username = await requireUser(req, res);
  if (!username) return;
  const canManage = (await hasRole(username, ["cantus_praeses", "jegyzo"])) || (await hasRole(username, ["all-time admin"]));
  if (!canManage) return res.status(403).json({ message: "Nincs jogosultsága eseményt létrehozni" });

  try {
    const title = text(req.body?.title).trim();
    const location = text(req.body?.location).trim();
    const dateStr = text(req.body?.date || req.body?.startDate).trim();
    const endDateStr = text(req.body?.endDate).trim();
    const details = text(req.body?.details || req.body?.description).trim();
    const link = text(req.body?.link).trim();

    if (!title || !location || !dateStr) {
      return res.status(400).json({ message: "A cím, helyszín és kezdési idő megadása kötelező." });
    }

    const start = new Date(dateStr);
    const end = endDateStr ? new Date(endDateStr) : new Date(start.getTime() + 3 * 60 * 60 * 1000);
    const eventId = text(req.body?.id).trim() || `event-${Date.now()}`;

    const record = {
      id: eventId,
      title: title.slice(0, 255),
      location: location.slice(0, 255),
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      description: details ? details.slice(0, 3000) : null,
      link: link ? link.slice(0, 500) : null,
      created_by: username
    };

    const { error } = await db.from("calendar_events").insert(record);
    if (error) {
      console.error("Insert calendar_events error:", error);
      return res.status(500).json({ message: "Adatbázis hiba", error: error.message });
    }

    // Broadcast push notification to all devices!
    try {
      const timeStr = start.toLocaleString("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      sendFcmPushToAll(
        `Új esemény: ${record.title}`,
        `${timeStr} · ${record.location}`,
        { type: "new_event", eventId: record.id }
      ).catch((err) => console.warn("Background new_event FCM push failed:", err));
    } catch (pushErr) {
      console.warn("FCM push send error:", pushErr);
    }

    res.json({ success: true, event: record });
  } catch (err) {
    console.error("Create event error", err);
    res.status(500).json({ message: "Hiba az esemény létrehozásakor" });
  }
});

app.delete("/events/:id", async (req, res) => {
  const username = await requireUser(req, res);
  if (!username) return;
  const canManage = (await hasRole(username, ["cantus_praeses", "jegyzo"])) || (await hasRole(username, ["all-time admin"]));
  if (!canManage) return res.status(403).json({ message: "Nincs jogosultsága eseményt törölni" });

  try {
    const { id } = req.params;
    const { error } = await db.from("calendar_events").delete().eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error("Delete event error", err);
    res.status(500).json({ message: "Hiba az esemény törlésekor" });
  }
});

async function requireAdmin(req: express.Request, res: express.Response) {
  const username = await requireUser(req, res);
  if (!username) return null;
  if (!await hasRole(username, ["all-time admin"])) {
    res.status(403).json({ message: "Nincs jogosultsága" });
    return null;
  }
  return username;
}

app.get("/admin/users", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const { data, error } = await db.from("registered_users").select("id,username,email,status,user_roles(roles(role_name))").order("id");
  if (error) return res.status(500).json({ message: "DB error" });
  const users = (data || []).map((user) => ({ id: user.id, username: user.username, email: user.email, status: user.status, roles: (user.user_roles || []).map((entry: { roles?: { role_name?: string } | null }) => entry.roles?.role_name).filter(Boolean) }));
  res.json({ users });
});

app.delete("/admin/users/:id", async (req, res) => {
  const username = await requireAdmin(req, res);
  if (!username) return;
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Érvénytelen azonosító" });
  const { data: target, error: targetError } = await db.from("registered_users").select("username").eq("id", id).maybeSingle();
  if (targetError) return res.status(500).json({ message: "A felhasználó lekérése nem sikerült." });
  if (!target) return res.status(404).json({ message: "A felhasználó nem található." });
  if (target.username === username) return res.status(400).json({ message: "A saját aktív admin fiókja innen nem törölhető." });
  const targetRoles = await rolesFor(target.username);
  if (targetRoles.isAllTimeAdmin) return res.status(403).json({ message: "All-time admin fiók nem törölhető innen." });
  const roleCleanup = await db.from("user_roles").delete().eq("user_id", id);
  if (roleCleanup.error) return res.status(500).json({ message: "A fiók szerepeinek törlése nem sikerült." });
  const deletion = await db.from("registered_users").delete().eq("id", id);
  if (deletion.error) return res.status(500).json({ message: "A fiók törlése nem sikerült." });
  res.json({ success: true });
});

app.post("/admin/users/:id/reset-password", async (req, res) => {
  const username = await requireAdmin(req, res);
  if (!username) return;
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Érvénytelen azonosító" });
  const temporaryPassword = crypto.randomUUID().replace(/-/g, "").slice(0, 18);
  const { data: resetUser, error: userError } = await db
    .from("registered_users")
    .select("username,email")
    .eq("id", id)
    .maybeSingle();
  if (userError) return res.status(500).json({ message: "A felhasználó lekérése nem sikerült." });
  if (!resetUser) return res.status(404).json({ message: "A felhasználó nem található." });
  const { error: updateError } = await db
    .from("registered_users")
    .update({ password: await bcrypt.hash(temporaryPassword, 10), password_reset_required: true })
    .eq("id", id);
  if (updateError) return res.status(500).json({ message: "A jelszó visszaállítása nem sikerült." });
  if (smtpTransport && resetUser.email) {
    try {
      await smtpTransport.sendMail({
        from: smtpFrom,
        to: resetUser.email,
        subject: "Cantusok Köre – ideiglenes jelszó",
        text: `Szia ${resetUser.username}!\n\nAz adminisztrátor visszaállította a jelszavadat.\n\nIdeiglenes jelszó: ${temporaryPassword}\n\nA bejelentkezés után kötelező új jelszót beállítanod.`
      });
      return res.json({ success: true, emailSent: true });
    } catch (error) {
      console.error("Password reset email failed", error);
      return res.json({ success: true, emailSent: false, temporaryPassword, message: "Az e-mail küldése nem sikerült, használd az ideiglenes jelszót." });
    }
  }
  res.json({
    success: true,
    emailSent: false,
    temporaryPassword,
    message: resetUser.email ? "SMTP nincs beállítva." : "Ehhez a fiókhoz nincs e-mail cím mentve."
  });
});

app.get("/admin/gallery/pending", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const { data, error } = await db.from("gallery_images").select("id,image_url,alt_text,uploaded_by,created_at,source").eq("approved", false).order("created_at", { ascending: true });
  if (error) return res.status(500).json({ message: "A függő képek lekérése nem sikerült." });
  res.json({ images: data || [] });
});

app.get("/admin/google-drive/status", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  let galleryCount: number;
  try {
    galleryCount = await approvedGalleryCount();
  } catch (error) {
    console.error("Gallery capacity check error", error);
    return res.status(500).json({ message: "A galéria állapotának lekérése nem sikerült." });
  }
  const configured = Boolean(googleDriveFolderId && googleServiceAccountJson);
  if (!configured) {
    return res.json({
      configured: false,
      galleryCount,
      full: galleryCount >= 9,
      folderConfigured: Boolean(googleDriveFolderId),
      serviceAccountConfigured: Boolean(googleServiceAccountJson)
    });
  }
  try {
    const response = await driveFetch(`files/${encodeURIComponent(googleDriveFolderId!)}?supportsAllDrives=true&fields=id,name,mimeType`);
    const folder = await response.json() as { id?: string; name?: string; mimeType?: string };
    res.json({
      configured: true,
      accessible: true,
      folderName: folder.name || null,
      galleryCount,
      full: galleryCount >= 9,
      folderConfigured: true,
      serviceAccountConfigured: true
    });
  } catch (error) {
    console.error("Google Drive status error", error);
    res.status(502).json({
      configured: true,
      accessible: false,
      message: error instanceof Error ? error.message : "A Google Drive mappa nem érhető el."
    });
  }
});

app.post("/admin/google-drive/import", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const requestedCount = Number.parseInt(String(req.body?.count || ""), 10);
  const count = Number.isInteger(requestedCount) ? Math.min(Math.max(requestedCount, 1), 20) : 9;
  try {
    const currentCount = await approvedGalleryCount();
    if (currentCount >= 9) {
      return res.status(409).json({ message: "A galéria megtelt (9/9 kép). Előbb törölj egy képet, majd indítsd újra az importot.", full: true, galleryCount: currentCount });
    }
    const files = await listDriveImages();
    const { data: existing, error: existingError } = await db
      .from("gallery_images")
      .select("source_file_id")
      .eq("source", "google_drive")
      .not("source_file_id", "is", null);
    if (existingError) throw existingError;
    const existingIds = new Set((existing || []).map((row) => row.source_file_id));
    const candidates = files.filter((file) => file.id && !existingIds.has(file.id));
    const importCount = Math.min(count, 9 - currentCount);
    if (candidates.length < importCount) {
      return res.status(400).json({
        message: `A KépeCK mappában csak ${candidates.length} kép található, ezért nem lehet ${importCount} képet kiválasztani.`,
        available: candidates.length
      });
    }
    for (let index = candidates.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
    }
    const imported = [];
    for (const file of candidates.slice(0, importCount)) {
      const fileResponse = await driveFetch(`files/${encodeURIComponent(file.id!)}?alt=media&supportsAllDrives=true`);
      const bytes = new Uint8Array(await fileResponse.arrayBuffer());
      const safeName = (file.name || "image").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "image";
      const storagePath = `google-drive/${file.id}-${safeName}`;
      const { error: uploadError } = await db.storage.from("uploads").upload(storagePath, bytes, {
        contentType: file.mimeType || "image/jpeg",
        upsert: false
      });
      if (uploadError) throw uploadError;
      const imageUrl = `${supabaseUrl}/storage/v1/object/public/uploads/${storagePath}`;
      const { data: image, error: insertError } = await db.from("gallery_images").insert({
        image_url: imageUrl,
        alt_text: file.name || "Google Drive fotó",
        uploaded_by: "Google Drive",
        approved: false,
        source: "google_drive",
        source_file_id: file.id
      }).select("id,image_url,alt_text,created_at").single();
      if (insertError) throw insertError;
      imported.push(image);
    }
    res.json({ success: true, imported, available: files.length, newCandidates: candidates.length, skipped: files.length - imported.length, galleryCount: currentCount + imported.length });
  } catch (error) {
    console.error("Google Drive import error", error);
    res.status(500).json({ message: error instanceof Error ? error.message : "A Google Drive importálása nem sikerült." });
  }
});

app.post("/admin/gallery/:id/approve", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Érvénytelen azonosító" });
  const currentCount = await approvedGalleryCount();
  if (currentCount >= 9) {
    return res.status(409).json({ message: "A galéria megtelt (9/9 kép). Előbb törölj egy képet.", full: true });
  }
  const { error } = await db.from("gallery_images").update({ approved: true }).eq("id", id);
  if (error) return res.status(500).json({ message: "A kép jóváhagyása nem sikerült." });
  res.json({ success: true });
});

app.delete("/admin/gallery/:id", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Érvénytelen azonosító" });
  const { error } = await db.from("gallery_images").delete().eq("id", id);
  if (error) return res.status(500).json({ message: "A kép elutasítása nem sikerült." });
  res.json({ success: true });
});

app.post("/admin/users/:id/email", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const id = parseId(req.params.id);
  const email = text(req.body?.email).trim().toLowerCase();
  if (!id || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return res.status(400).json({ message: "Érvénytelen adat." });
  const { error } = await db.from("registered_users").update({ email: email || null }).eq("id", id);
  if (error) return res.status(500).json({ message: "Az e-mail cím mentése nem sikerült." });
  res.json({ success: true });
});

app.post("/admin/users/:id/status", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Érvénytelen id" });
  const { error } = await db.from("registered_users").update({ status: req.body?.status || null }).eq("id", id);
  if (error) return res.status(500).json({ message: "DB error" });
  res.json({ success: true });
});

app.post("/admin/users/:id/roles", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const id = parseId(req.params.id);
  const role = text(req.body?.role).trim();
  const action = text(req.body?.action);
  if (!id || !role || !["add", "remove"].includes(action)) return res.status(400).json({ message: "Hiányzó adatok" });
  let { data: roleRow, error } = await db.from("roles").select("id").eq("role_name", role).maybeSingle();
  if (error) return res.status(500).json({ message: "DB error" });
  if (!roleRow && action === "add") {
    const inserted = await db.from("roles").insert({ role_name: role }).select("id").single();
    if (inserted.error) return res.status(500).json({ message: "DB error" });
    roleRow = inserted.data;
  }
  if (!roleRow) return res.status(404).json({ message: "A szerep nem található" });
  if (action === "add") {
    const result = await db.from("user_roles").upsert({ user_id: id, role_id: roleRow.id }, { onConflict: "user_id,role_id" });
    if (result.error) return res.status(500).json({ message: "DB error" });
  } else {
    const result = await db.from("user_roles").delete().eq("user_id", id).eq("role_id", roleRow.id);
    if (result.error) return res.status(500).json({ message: "DB error" });
  }
  res.json({ success: true });
});

app.listen(8000);
