// POST /api/checkout  { evento, cantidad, lang } → crea el pago en Stripe y devuelve la URL de pago
const crypto = require("crypto");
const { stripe, configurado, evento, yaPaso, ocupadas, enviar } = require("./_lib.js");

const LOCALES = { en: "en", es: "es", et: "et" };

module.exports = async (req, res) => {
  if (req.method !== "POST") return enviar(res, 405, { error: "metodo" });
  if (!configurado()) return enviar(res, 503, { error: "no_configurado" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const e = evento(body.evento);
  const cantidad = parseInt(body.cantidad, 10);
  const lang = LOCALES[body.lang] ? body.lang : "en";

  if (!e || !e.activo || yaPaso(e)) return enviar(res, 400, { error: "no_disponible" });
  if (!(cantidad >= 1 && cantidad <= (e.maxPorCompra || 10))) return enviar(res, 400, { error: "cantidad" });

  try {
    const libres = e.aforo - (await ocupadas(e.id));
    if (libres < cantidad) return enviar(res, 409, { error: libres > 0 ? "pocas" : "agotado", libres: Math.max(0, libres) });

    const origen = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
    const ref = crypto.randomBytes(16).toString("hex"); // enlace privado de la entrada
    const enlace = `${origen}/entrada.html?ref=${ref}&lang=${lang}`;
    const meta = { evento: e.id, qty: String(cantidad), ref };

    const sesion = await stripe().checkout.sessions.create({
      mode: "payment",
      locale: LOCALES[lang],
      line_items: [{
        quantity: cantidad,
        price_data: {
          currency: e.moneda || "eur",
          unit_amount: e.precio,
          product_data: { name: e.nombre, description: [e.fecha.split("-").reverse().join("/"), e.hora, e.lugar].filter(Boolean).join(" · ") },
        },
      }],
      metadata: meta,
      payment_intent_data: { metadata: meta, description: `${e.nombre} · Entradas / Tickets: ${enlace}` },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: `${enlace}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origen}/#shows`,
    });
    enviar(res, 200, { url: sesion.url });
  } catch (err) {
    console.error("checkout:", err);
    enviar(res, 500, { error: "stripe" });
  }
};
