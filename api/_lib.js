// Utilidades compartidas por las funciones de /api (no es una ruta pública: empieza por "_")
const crypto = require("crypto");
const EVENTOS = require("./_eventos.js");

let _stripe = null;
function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!_stripe) {
    const Stripe = require("stripe");
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}
const configurado = () => !!(process.env.STRIPE_SECRET_KEY && process.env.TICKET_SECRET);
const modoPrueba = () => String(process.env.STRIPE_SECRET_KEY || "").startsWith("sk_test_");

const evento = (id) => EVENTOS.find((e) => e.id === id) || null;

// El concierto sigue a la venta hasta el final de su día (hora de Tallinn ≈ UTC+2/3; usamos 23:59 UTC+3 como margen)
const yaPaso = (e) => Date.now() > new Date(e.fecha + "T23:59:00+03:00").getTime();

function enviar(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

// ── Códigos de las entradas (lo que va dentro del QR) ──
//    KA1.<id del pago en Stripe>.<nº de entrada>.<firma>
//    La firma usa TICKET_SECRET: sin ella nadie puede fabricar una entrada válida.
function firma(pi, i) {
  return crypto.createHmac("sha256", process.env.TICKET_SECRET || "").update(pi + "." + i).digest("base64url").slice(0, 22);
}
const codigo = (pi, i) => `KA1.${pi}.${i}.${firma(pi, i)}`;
function leerCodigo(c) {
  const m = /^KA1\.(pi_[A-Za-z0-9]+)\.(\d{1,2})\.([A-Za-z0-9_-]{22})$/.exec(String(c || "").trim());
  if (!m) return null;
  const pi = m[1], i = parseInt(m[2], 10);
  const a = Buffer.from(m[3]), b = Buffer.from(firma(pi, i));
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? { pi, i } : null;
}

// ── Aforo: entradas pagadas + compras en curso (para no vender de más) ──
async function ocupadas(id) {
  const s = stripe();
  let total = 0, page;
  do {
    const r = await s.paymentIntents.search({ query: `status:'succeeded' AND metadata['evento']:'${id}'`, limit: 100, page });
    for (const p of r.data) total += parseInt(p.metadata.qty || "0", 10);
    page = r.next_page;
  } while (page);
  // Compras abiertas (alguien está pagando ahora mismo): se reservan 30 min como máximo
  for await (const cs of s.checkout.sessions.list({ status: "open", limit: 100 })) {
    if (cs.metadata && cs.metadata.evento === id) total += parseInt(cs.metadata.qty || "0", 10);
  }
  return total;
}

const pinCorrecto = (pin) => {
  const real = String(process.env.CHECKIN_PIN || "");
  if (!real) return false;
  const a = Buffer.from(String(pin || "")), b = Buffer.from(real);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const reembolsado = (pi) => {
  const ch = pi.latest_charge;
  return !!(ch && typeof ch === "object" && (ch.refunded || ch.amount_refunded > 0 || ch.disputed));
};

module.exports = { EVENTOS, stripe, configurado, modoPrueba, evento, yaPaso, enviar, codigo, leerCodigo, ocupadas, pinCorrecto, reembolsado };
