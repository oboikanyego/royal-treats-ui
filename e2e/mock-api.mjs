// Contract-faithful mock of royal-treats-api for the browser suites. It runs the API's own validation,
// pricing and order rules (a snapshot in ./api-snapshot, or a live checkout via API_SRC) over in-memory data,
// so the site is exercised against the real contract without MongoDB, Cloudinary or email.
// Behaviour switches: POST /__mode {delayMs, failNext, failAlways, ...}; see the suites.
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const apiSrc = path.resolve(process.env.API_SRC || path.join(here, 'api-snapshot', 'src'));
const load = (name) => import(pathToFileURL(path.join(apiSrc, name)).href);
const { seedProducts } = await load('catalogue.ts');
const { orderInput, pagination, productInput, settingsInput, account, statusFilter } = await load('validation.ts');
const { assertProductImage } = await load('images.ts');
const { priceOrder, allowedStatuses, assertStatusChange } = await load('order-rules.ts');
const { ApiError } = await load('security.ts');
const { createLiveHub } = await load('live.ts');
const { randomUUID, createHash } = await import('node:crypto');
const view = (p) => ({ id: p._id, name: p.name, category: p.category, description: p.description, image: p.image,
  available: p.available ?? true, deliverable: p.deliverable, priceCents: Math.min(...p.variants.map((v) => v.priceCents)),
  variants: p.variants, sauces: p.sauces, toppings: p.toppings });
const extra = [
  { _id: 'cake', name: 'Cake Slice', category: 'Cakes', description: 'A fractional price', image: 'https://images.unsplash.com/x', deliverable: false, available: true,
    variants: [{ label: 'Slice', priceCents: 2550 }, { label: 'Whole', priceCents: 24999 }], sauces: ['Caramel'], toppings: [] },
  { _id: 'old', name: 'Retired Treat', category: 'Slushies', description: 'Sold out', image: 'https://images.unsplash.com/y', deliverable: false, available: false,
    variants: [{ label: 'One', priceCents: 1000 }], sauces: [], toppings: [] },
];
const bulk = Array.from({ length: 130 }, (_, i) => ({ _id: 'bulk' + i, name: 'Bulk ' + i, category: 'Milkshakes', description: 'b', image: 'https://images.unsplash.com/z',
  deliverable: false, available: true, variants: [{ label: 'S', priceCents: 1000 + i }], sauces: ['Vanilla'], toppings: [] }));
let resets = new Map(); let lastReset = null;
let mode = { mailOff: false, delayMs: 0, failNext: 0, failAlways: false, bulk: false, expireTokens: false, limitAuth: false, dropOrderResponse: 0, soldOut: [], imagesOff: false, raceOnAccept: false };
const orders = [];
const log = [];
const CLOUD = 'https://res.cloudinary.com/demo/image/upload/';
const fakeStore = { isOwnUrl: (u) => typeof u === 'string' && u.startsWith(CLOUD) };
let catalogue = []; let settings;
const defaultSettings = { storeName: 'Royal Treats', address: '34 10th Avenue, Thabazimbi', supportEmail: 'hello@royaltreats.test', open: '09:00', close: '21:00', latitude: -24.59, longitude: 27.41, radiusKm: 5 };
const resetCatalogue = () => { catalogue = structuredClone([...seedProducts, ...extra]); settings = { ...defaultSettings }; uploads = 0; };
let uploads = 0;
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
const stub = fs.readFileSync(new URL('./assets/stub.png', import.meta.url));
const users = new Map(); const sessions = new Map(); let nextId = 1;
const addUser = (name, email, phone, password, role = 'customer') => { const u = { id: 'u' + nextId++, name, email, phone, password, role, active: true, photo: null }; users.set(email, u); return u; };
const resetUsers = () => { resets.clear(); lastReset = null; resetCatalogue(); orders.length = 0; users.clear(); sessions.clear(); nextId = 1; addUser('Royal Admin', 'admin@royaltreats.test', '0740000000', 'AdminPass-12345', 'admin'); addUser('Sipho Courier', 'courier@royaltreats.test', '0740000001', 'CourierPass-12345', 'courier'); };
resetUsers();
const userView = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, active: u.active });
const issue = (u, remember = false) => { const token = randomBytes(32).toString('base64url'); const expiresAt = new Date(Date.now() + (remember === true ? 30 * 24 : 8) * 3600e3); sessions.set(token, { userId: u.id, expiresAt }); return { token, expiresAt: expiresAt.toISOString() }; };
const bearer = (req) => req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
const stamp = (o, status, note) => { (o.history ??= []).push({ status, at: new Date().toISOString(), ...(note ? { note } : {}) }); o.status = status; return o; };
const userFor = (req) => { if (mode.expireTokens) return null; const t = bearer(req); const s = t && sessions.get(t); return s ? [...users.values()].find((u) => u.id === s.userId) : null; };
const readBody = async (req) => { const chunks = []; for await (const c of req) chunks.push(c); return Buffer.concat(chunks); };
const ACCOUNT_KEYS = ['name', 'email', 'phone', 'password', 'acceptedTerms', 'remember'];
const hub = createLiveHub({
  async authorizeAdmin(token) { if (mode.expireTokens) return null; const sess = sessions.get(token); const u = sess && [...users.values()].find((x) => x.id === sess.userId); return u && u.active && u.role === 'admin' ? { tokenHash: token, expiresAt: sess.expiresAt } : null; },
  async countPending() { return orders.filter((o) => o.status === 'Pending').length; },
});
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const origin = req.headers.origin;
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE'); res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] ?? ''); res.statusCode = 204; return res.end(); }
  const json = (code, body) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)); };
  if (url.pathname === '/__mode') { let b = ''; for await (const c of req) b += c; mode = { ...mode, ...JSON.parse(b || '{}') }; log.length = 0; resetUsers(); return json(200, mode); }
  if (url.pathname === '/__advance') { const o = orders.find((x) => x.id === url.searchParams.get('id')); stamp(o, url.searchParams.get('status')); hub.pendingChanged(); return json(200, o); }
  if (url.pathname === '/__drop') { mode.dropOrderResponse = +url.searchParams.get('n'); return json(200, mode); }
  if (url.pathname === '/__flag') { for (const [k, v] of url.searchParams) mode[k] = v === '1'; return json(200, mode); }
  if (url.pathname === '/__orders') return json(200, orders);
  if (url.pathname === '/__lastreset') return json(200, lastReset);
  if (url.pathname === '/__log') return json(200, log);
  log.push(req.method + ' ' + url.pathname + url.search + (req.headers.authorization ? ' [auth]' : ''));
  if (!url.pathname.startsWith('/api/v1/')) return json(404, { error: 'Endpoint not found' });
  if (mode.delayMs) await new Promise((r) => setTimeout(r, mode.delayMs));
  if (mode.failAlways || mode.failNext > 0) { if (mode.failNext > 0) mode.failNext--; return json(503, { error: 'Service unavailable' }); }
  if (url.pathname === '/api/v1/products') {
    const all = [...catalogue, ...(mode.bulk ? bulk : [])];
    const page = +(url.searchParams.get('page') ?? 1), limit = Math.min(+(url.searchParams.get('limit') ?? 20), 100);
    return json(200, { items: all.slice((page - 1) * limit, page * limit).map(view), page, limit, total: all.length });
  }
  if (url.pathname === '/api/v1/settings') return json(200, { ...settings, passwordResetEnabled: !mode.mailOff });
  const P = url.pathname;
  const view2 = (o, u) => { const { idempotencyKey, requestHash, customerId, ...rest } = o; return { ...rest, createdAt: o.createdAt, allowedStatuses: allowedStatuses({ ...o, customerId }, { _id: u.id, role: u.role }) }; };
  if (P === '/api/v1/auth/register' && req.method === 'POST') {
    let body; try { body = JSON.parse((await readBody(req)).toString() || '{}'); } catch { return json(400, { error: 'Invalid request body' }); }
    const issues = []; const bad = (path, message) => issues.push({ path: [path], message });
    for (const k of Object.keys(body)) if (!ACCOUNT_KEYS.includes(k)) bad(k, 'Unrecognized key');
    if (typeof body.name !== 'string' || body.name.trim().length < 2) bad('name', 'Too short');
    if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) bad('email', 'Invalid email');
    if (typeof body.phone !== 'string' || !/^\+?[0-9 ]{9,16}$/.test(body.phone.trim())) bad('phone', 'Invalid');
    if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128) bad('password', 'String must contain at least 12 character(s)');
    if (body.acceptedTerms !== true) bad('acceptedTerms', 'You must accept the privacy notice and terms to register');
    if (issues.length) return json(400, { error: 'Invalid input', details: issues });
    if (users.has(body.email.toLowerCase())) return json(409, { error: 'Record already exists' });
    const u = addUser(body.name.trim(), body.email.toLowerCase(), body.phone.trim(), body.password); u.termsAcceptedAt = new Date().toISOString();
    return json(201, { user: userView(u), ...issue(u, body.remember) });
  }
  if (P === '/api/v1/auth/login' && req.method === 'POST') {
    if (mode.limitAuth) { res.statusCode = 429; res.setHeader('content-type', 'text/plain'); return res.end('Too many requests, please try again later.'); }
    const body = JSON.parse((await readBody(req)).toString() || '{}'); const u = users.get(String(body.email).toLowerCase());
    if (!u || u.password !== body.password || !u.active) return json(401, { error: 'Invalid email or password' });
    return json(200, { user: userView(u), ...issue(u, body.remember) });
  }
  if (P === '/api/v1/auth/logout' && req.method === 'POST') { const t = bearer(req); if (!userFor(req)) return json(401, { error: 'Sign in required' }); sessions.delete(t); hub.signedOut(t); res.statusCode = 204; return res.end(); }
  if (P === '/api/v1/auth/forgot-password' && req.method === 'POST') {
    let body; try { body = JSON.parse((await readBody(req)).toString() || '{}'); } catch { return json(400, { error: 'Invalid request body' }); }
    if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || Object.keys(body).length !== 1) return json(400, { error: 'Invalid input', details: [{ path: ['email'], message: 'Invalid email' }] });
    const u = users.get(body.email.toLowerCase());
    if (u && u.active && !mode.mailOff) { const token = randomBytes(32).toString('base64url'); resets.set(token, u.id); lastReset = { email: u.email, token }; }
    return json(202, { ok: true });
  }
  if (P === '/api/v1/auth/reset-password' && req.method === 'POST') {
    let body; try { body = JSON.parse((await readBody(req)).toString() || '{}'); } catch { return json(400, { error: 'Invalid request body' }); }
    if (typeof body.newPassword !== 'string' || body.newPassword.length < 12 || body.newPassword.length > 128) return json(400, { error: 'Invalid input', details: [{ path: ['newPassword'], message: 'String must contain at least 12 character(s)' }] });
    const id = typeof body.token === 'string' ? resets.get(body.token) : undefined;
    const u = id && [...users.values()].find((x) => x.id === id && x.active);
    if (!u) return json(400, { error: 'This reset link is invalid or has expired' });
    resets.delete(body.token); u.password = body.newPassword;
    for (const [t, s2] of [...sessions]) if (s2.userId === u.id) { sessions.delete(t); hub.signedOut(t); }
    res.statusCode = 204; return res.end();
  }
  if (P === '/api/v1/me' && req.method === 'PATCH') {
    const u = userFor(req); if (!u) return json(401, { error: 'Sign in required' });
    let body; try { body = JSON.parse((await readBody(req)).toString() || '{}'); } catch { return json(400, { error: 'Invalid request body' }); }
    const issues = []; for (const k of Object.keys(body)) if (!['name', 'phone'].includes(k)) issues.push({ path: [k], message: 'Unrecognized key' });
    if (typeof body.name !== 'string' || body.name.trim().length < 2) issues.push({ path: ['name'], message: 'Too short' });
    if (typeof body.phone !== 'string' || !/^\+?[0-9 ]{9,16}$/.test(body.phone.trim())) issues.push({ path: ['phone'], message: 'Invalid' });
    if (issues.length) return json(400, { error: 'Invalid input', details: issues });
    u.name = body.name.trim(); u.phone = body.phone.trim(); return json(200, userView(u));
  }
  if (P === '/api/v1/me/password' && req.method === 'POST') {
    const u = userFor(req); if (!u) return json(401, { error: 'Sign in required' });
    let body; try { body = JSON.parse((await readBody(req)).toString() || '{}'); } catch { return json(400, { error: 'Invalid request body' }); }
    if (typeof body.newPassword !== 'string' || body.newPassword.length < 12 || body.newPassword.length > 128 || typeof body.currentPassword !== 'string') return json(400, { error: 'Invalid input', details: [{ path: ['newPassword'], message: 'String must contain at least 12 character(s)' }] });
    if (body.currentPassword !== u.password) return json(400, { error: 'Current password is incorrect' });
    if (body.newPassword === body.currentPassword) return json(400, { error: 'Choose a password you have not used just now' });
    u.password = body.newPassword; const mine = bearer(req);
    for (const [t, s2] of [...sessions]) if (s2.userId === u.id && t !== mine) { sessions.delete(t); hub.signedOut(t); }
    res.statusCode = 204; return res.end();
  }
  if (P === '/api/v1/me/delete' && req.method === 'POST') {
    const u = userFor(req); if (!u) return json(401, { error: 'Sign in required' });
    let body; try { body = JSON.parse((await readBody(req)).toString() || '{}'); } catch { return json(400, { error: 'Invalid request body' }); }
    if (typeof body.password !== 'string' || !body.password || Object.keys(body).length !== 1) return json(400, { error: 'Invalid input' });
    if (u.role !== 'customer') return json(403, { error: 'Only customer accounts can be deleted here. Ask the shop owner to change staff accounts' });
    if (u.password !== body.password) return json(400, { error: 'Password is incorrect' });
    const mine = orders.filter((o) => o.customerId === u.id);
    if (mine.some((o) => !['Completed', 'Cancelled'].includes(o.status))) return json(409, { error: 'You still have orders in progress. Please wait until they are finished, or ask the shop to cancel them, then try again' });
    for (const o of mine) { o.customer = 'Deleted customer'; o.phone = ''; o.notes = ''; delete o.address; delete o.latitude; delete o.longitude; delete o.distanceKm; for (const i of o.items) i.recipient = ''; }
    for (const [t, s] of [...sessions]) if (s.userId === u.id) sessions.delete(t);
    users.delete(u.email); res.statusCode = 204; return res.end();
  }
  if (P === '/api/v1/me' && req.method === 'GET') { const u = userFor(req); return u ? json(200, userView(u)) : json(401, { error: 'Sign in required' }); }
  if (P === '/api/v1/me/photo' && req.method === 'PUT') {
    const u = userFor(req); if (!u) return json(401, { error: 'Sign in required' });
    const body = await readBody(req);
    if (body.length > 2 * 1024 * 1024) return json(413, { error: 'Invalid upload; the file is too large or malformed' });
    if (!String(req.headers['content-type']).startsWith('multipart/form-data') || !body.includes('name="photo"')) return json(400, { error: 'Upload a photo file' });
    u.photo = stub; res.statusCode = 204; return res.end();
  }
  if (P === '/api/v1/me/photo' && req.method === 'GET') { const u = userFor(req); if (!u) return json(401, { error: 'Sign in required' }); if (!u.photo) return json(404, { error: 'No profile photo' }); res.setHeader('content-type', 'image/webp'); return res.end(u.photo); }
  if (P.startsWith('/api/v1/admin/')) {
    const u = userFor(req); if (!u) return json(401, { error: 'Sign in required' }); if (u.role !== 'admin') return json(403, { error: 'Access denied' });
    const parse = async (schema) => { try { return schema.parse(JSON.parse((await readBody(req)).toString() || '{}')); } catch (e) { if (e.issues) throw Object.assign(new Error('zod'), { zod: e.issues }); throw new ApiError(400, 'Invalid request body'); } };
    try {
      const am = P.match(/^\/api\/v1\/admin\/orders\/([^/]+)\/courier$/);
      if (am && req.method === 'POST') {
        const body = JSON.parse((await readBody(req)).toString() || '{}');
        if (typeof body.courierId !== 'string' || Object.keys(body).length !== 1) return json(400, { error: 'Invalid input' });
        const c = [...users.values()].find((x) => x.id === body.courierId && x.role === 'courier' && x.active); if (!c) return json(404, { error: 'Courier not found' });
        const o = orders.find((x) => x.id === am[1]); if (!o) return json(404, { error: 'Order not found' });
        if (o.fulfillment !== 'delivery' || !['Ready for Delivery', 'Out for Delivery'].includes(o.status)) return json(409, { error: 'A courier can only be assigned to a delivery that is ready or out for delivery' });
        o.courierId = c.id; stamp(o, 'Out for Delivery'); hub.pendingChanged(); return json(200, view2(o, u));
      }
      if (P === '/api/v1/admin/dashboard' && req.method === 'GET') {
        const by = new Map(); for (const o of orders) { const r = by.get(o.status) ?? { _id: o.status, count: 0, totalCents: 0 }; r.count++; r.totalCents += o.totalCents; by.set(o.status, r); }
        const rows = [...by.values()]; return json(200, { ordersByStatus: rows, completedRevenueCents: by.get('Completed')?.totalCents ?? 0, products: catalogue.length });
      }
      if (P === '/api/v1/admin/images' && req.method === 'POST') {
        const body = await readBody(req);
        if (mode.imagesOff) return json(503, { error: 'Image uploads are not configured' });
        if (body.length > 5 * 1024 * 1024) return json(413, { error: 'Invalid upload; the file is too large or malformed' });
        if (!String(req.headers['content-type']).startsWith('multipart/form-data') || !body.includes('name="image"')) return json(400, { error: 'Upload an image file' });
        return json(201, { url: CLOUD + 'upload-' + (++uploads) + '.webp', width: 900, height: 900 });
      }
      if (P === '/api/v1/admin/products' && req.method === 'POST') {
        const input = await parse(productInput); assertProductImage(input.image, fakeStore);
        const p = { ...input, _id: randomUUID() }; catalogue.unshift(p);
        return json(201, view(p));
      }
      const pm = P.match(/^\/api\/v1\/admin\/products\/([^/]+)$/);
      if (pm && req.method === 'PUT') {
        const input = await parse(productInput); const i = catalogue.findIndex((x) => x._id === pm[1]); if (i < 0) return json(404, { error: 'Product not found' });
        assertProductImage(input.image, fakeStore, catalogue[i].image); catalogue[i] = { ...catalogue[i], ...input };
        return json(200, view(catalogue[i]));
      }
      if (P === '/api/v1/admin/settings' && req.method === 'PUT') { const input = await parse(settingsInput); settings = { ...settings, ...input, radiusKm: 5 }; return json(200, settings); }
      if (P === '/api/v1/admin/couriers' && req.method === 'GET') { const cs = [...users.values()].filter((x) => x.role === 'courier'); return json(200, { items: cs.map(userView), page: 1, limit: 100, total: cs.length }); }
      if (P === '/api/v1/admin/couriers' && req.method === 'POST') {
        const input = await parse(account); if (users.has(input.email)) return json(409, { error: 'Record already exists' });
        return json(201, userView(addUser(input.name, input.email, input.phone, input.password, 'courier')));
      }
      const cm = P.match(/^\/api\/v1\/admin\/couriers\/([^/]+)$/);
      if (cm && req.method === 'PATCH') {
        const c = [...users.values()].find((x) => x.id === cm[1] && x.role === 'courier'); if (!c) return json(404, { error: 'Courier not found' });
        const { active } = JSON.parse((await readBody(req)).toString() || '{}'); c.active = active; if (!active) for (const [t, s] of sessions) if (s.userId === c.id) sessions.delete(t);
        return json(200, userView(c));
      }
    } catch (e) { if (e instanceof ApiError) return json(e.status, { error: e.message }); if (e.zod) return json(400, { error: 'Invalid input', details: e.zod.map((i) => ({ path: i.path, message: i.message })) }); throw e; }
  }
  if (P === '/api/v1/courier/jobs' && req.method === 'GET') {
    const u = userFor(req); if (!u) return json(401, { error: 'Sign in required' }); if (u.role !== 'courier') return json(403, { error: 'Access denied' });
    const open = orders.filter((o) => o.fulfillment === 'delivery' && o.status === 'Ready for Delivery' && !o.courierId);
    return json(200, { items: open.map((o) => ({ id: o.id, date: o.date, time: o.time, distanceKm: o.distanceKm })), total: open.length, page: 1, limit: 20 });
  }
  const am = P.match(/^\/api\/v1\/courier\/jobs\/([^/]+)\/accept$/);
  if (am && req.method === 'POST') {
    const u = userFor(req); if (!u) return json(401, { error: 'Sign in required' }); if (u.role !== 'courier') return json(403, { error: 'Access denied' });
    const o = orders.find((x) => x.id === am[1] && x.fulfillment === 'delivery' && x.status === 'Ready for Delivery' && !x.courierId);
    if (mode.raceOnAccept && o) { o.courierId = 'someone-else'; stamp(o, 'Out for Delivery'); }
    if (!o || mode.raceOnAccept) return json(409, { error: 'Job is no longer available' });
    o.courierId = u.id; stamp(o, 'Out for Delivery'); return json(200, view2(o, u));
  }
  try {
  if (P === '/api/v1/orders' && req.method === 'POST') {
    const u = userFor(req); if (!u) return json(401, { error: 'Sign in required' }); if (u.role !== 'customer') return json(403, { error: 'Access denied' });
    let input; try { input = orderInput.parse(JSON.parse((await readBody(req)).toString() || '{}')); } catch (e) { return json(400, { error: 'Invalid input', details: e.issues ?? [] }); }
    const key = req.headers['idempotency-key']; if (!/^[A-Za-z0-9_-]{8,100}$/.test(key ?? '')) return json(400, { error: 'Invalid input' });
    const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const existing = orders.find((o) => o.customerId === u.id && o.idempotencyKey === key);
    if (existing) { if (existing.requestHash !== requestHash) return json(409, { error: 'Idempotency key already used for another order' }); if (mode.dropOrderResponse > 0) { mode.dropOrderResponse--; return req.socket.destroy(); } return json(200, view2(existing, u)); }
    const products = catalogue.map((p) => ({ ...p, available: (p.available ?? true) && !mode.soldOut.includes(p._id) }));
    if (settings.ordersPaused) return json(409, { error: settings.pauseMessage ? `Orders are paused: ${settings.pauseMessage}` : 'Orders are paused right now. Please check back soon' });
    const priced = priceOrder(input, products, settings);
    const order = { ...input, ...priced, id: 'RT-' + randomUUID(), status: 'Pending', history: [{ status: 'Pending', at: new Date().toISOString() }], customerId: u.id, customer: u.name, phone: u.phone, idempotencyKey: key, requestHash, createdAt: new Date().toISOString() };
    orders.unshift(order);
    hub.orderCreated({ id: order.id, customer: order.customer, fulfillment: order.fulfillment, totalCents: order.totalCents, itemCount: order.items.reduce((n, i) => n + i.qty, 0), date: order.date, time: order.time, createdAt: order.createdAt });
    if (mode.dropOrderResponse > 0) { mode.dropOrderResponse--; return req.socket.destroy(); }
    return json(201, view2(order, u));
  }
  if (P === '/api/v1/orders' && req.method === 'GET') {
    const u = userFor(req); if (!u) return json(401, { error: 'Sign in required' });
    const { page, limit } = pagination.parse(Object.fromEntries(url.searchParams));
    let wanted; if (url.searchParams.has('status')) { try { wanted = statusFilter.parse(url.searchParams.get('status')); } catch { return json(400, { error: 'Invalid input', details: [{ path: ['status'], message: 'Invalid status' }] }); } }
    const mine = orders.filter((o) => (u.role === 'admin' || (u.role === 'courier' ? o.courierId === u.id : o.customerId === u.id)) && (!wanted || wanted.includes(o.status)));
    return json(200, { items: mine.slice((page - 1) * limit, page * limit).map((o) => view2(o, u)), total: mine.length, page, limit });
  }
  const m = P.match(/^\/api\/v1\/orders\/([^/]+)\/status$/);
  if (m && req.method === 'PATCH') {
    const u = userFor(req); if (!u) return json(401, { error: 'Sign in required' });
    const o = orders.find((x) => x.id === m[1]); if (!o) return json(404, { error: 'Order not found' });
    const { status } = JSON.parse((await readBody(req)).toString() || '{}');
    assertStatusChange({ ...o }, { _id: u.id, role: u.role }, status);
    stamp(o, status); hub.pendingChanged(); return json(200, view2(o, u));
  }
  } catch (e) { if (e instanceof ApiError) return json(e.status, { error: e.message }); throw e; }
  return json(404, { error: 'Endpoint not found' });
});
hub.attach(server, [process.env.UI_URL || 'http://localhost:4307']);
const port = Number(process.env.MOCK_PORT || 3000);
server.listen(port, () => console.log(`mock api on ${port}`));
