import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import express from "npm:express@4.18.2";
import bcrypt from "npm:bcryptjs@2.4.3";
import multer from "npm:multer@1.4.5-lts.1";
import nodemailer from "npm:nodemailer@7.0.9";
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
  return { roles: [...new Set([...explicit.filter((role) => role !== "all-time admin"), ...derived])], isAllTimeAdmin: explicit.includes("all-time admin") };
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

app.get("/health", (_req, res) => res.json({ ok: true }));

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
  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "");
  const path = `${username}/${crypto.randomUUID()}-${safeName || "upload"}`;
  const { error } = await db.storage.from("uploads").upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
  if (error) throw error;
  return `${supabaseUrl}/storage/v1/object/public/uploads/${path}`;
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
  const { data, error } = await db.from("gallery_images").select("id,image_url,alt_text,uploaded_by,created_at").eq("approved", false).order("created_at", { ascending: true });
  if (error) return res.status(500).json({ message: "A függő képek lekérése nem sikerült." });
  res.json({ images: data || [] });
});

app.post("/admin/gallery/:id/approve", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Érvénytelen azonosító" });
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
