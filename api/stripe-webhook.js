// POST /api/stripe-webhook → Stripe avisa aquí cuando se completa un pago.
// Se usa para enviar las entradas por correo aunque el comprador cierre la página.
// Configuración: en Stripe → Desarrolladores → Webhooks, URL https://www.kevinalvamusic.com/api/stripe-webhook
// con los eventos checkout.session.completed y checkout.session.async_payment_succeeded.
// La clave de firma (whsec_...) va en la variable STRIPE_WEBHOOK_SECRET.
const { stripe, configurado } = require("./_lib.js");
const { enviarEntradas } = require("./_correo.js");

// Stripe necesita el cuerpo exacto, sin procesar, para comprobar la firma.
async function cuerpoCrudo(req) {
  const partes = [];
  for await (const p of req) partes.push(typeof p === "string" ? Buffer.from(p) : p);
  if (partes.length) return Buffer.concat(partes);
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body);
  return Buffer.alloc(0);
}

const responder = (res, code, obj) => { res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); };

module.exports = async (req, res) => {
  if (req.method !== "POST") return responder(res, 405, { error: "metodo" });
  if (!configurado() || !process.env.STRIPE_WEBHOOK_SECRET) return responder(res, 503, { error: "no_configurado" });

  let evento;
  try {
    evento = stripe().webhooks.constructEvent(await cuerpoCrudo(req), req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("webhook: firma no válida:", err.message);
    return responder(res, 400, { error: "firma" });
  }

  try {
    if (evento.type === "checkout.session.completed" || evento.type === "checkout.session.async_payment_succeeded") {
      const cs = evento.data.object;
      // Solo compras de entradas pagadas (la futura tienda tendrá su propio proceso)
      if (cs.payment_status === "paid" && cs.payment_intent && cs.metadata && cs.metadata.evento) {
        const d = cs.customer_details || {};
        const r = await enviarEntradas(cs.payment_intent, { email: d.email || "", nombre: d.name || "", lang: cs.metadata.lang || "" });
        console.log("webhook:", evento.id, cs.payment_intent, r.estado);
      }
    }
    responder(res, 200, { recibido: true });
  } catch (err) {
    // Error temporal (Stripe o Resend): respondemos 500 y Stripe lo reintenta solo.
    console.error("webhook: error al procesar", evento.id, err.message);
    responder(res, 500, { error: "procesar" });
  }
};
// Vercel: no procesar el cuerpo (hace falta crudo para la firma)
module.exports.config = { api: { bodyParser: false } };
