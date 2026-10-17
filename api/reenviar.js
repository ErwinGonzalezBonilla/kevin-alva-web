// POST /api/reenviar → herramienta de Kevin (protegida con el PIN de la puerta) para
// buscar compras por correo o referencia y volver a enviar las entradas, también a otro correo.
const { stripe, configurado, evento, pinCorrecto, reembolsado, enviar } = require("./_lib.js");
const { enviarEntradas, emailValido } = require("./_correo.js");

function resumen(pi) {
  const e = evento(pi.metadata.evento);
  return {
    pi: pi.id, ref: (pi.metadata.ref || "").slice(0, 8).toUpperCase(),
    evento: e ? e.nombre : pi.metadata.evento, fecha: e ? e.fecha : "",
    nombre: pi.metadata.nombre || "", email: pi.metadata.email || "",
    cantidad: parseInt(pi.metadata.qty || "0", 10), total: pi.amount_received, moneda: pi.currency,
    estado: reembolsado(pi) ? "reembolsado" : pi.status === "succeeded" ? "pagado" : pi.status,
    enviado: pi.metadata.mail_enviado || "", enviadoA: pi.metadata.mail_a || "",
    enlace: pi.metadata.ref ? `https://www.kevinalvamusic.com/entrada.html?ref=${pi.metadata.ref}` : "",
  };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return enviar(res, 405, { error: "metodo" });
  if (!configurado()) return enviar(res, 503, { error: "no_configurado" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  if (!pinCorrecto(body.pin)) return enviar(res, 401, { error: "pin" });
  const s = stripe();

  try {
    if (body.accion === "buscar") {
      const q = String(body.q || "").trim();
      const ids = new Set();
      if (emailValido(q)) {
        // Sesiones de pago con ese correo (encuentra también compras sin datos guardados)
        const ses = await s.checkout.sessions.list({ customer_details: { email: q }, limit: 20 });
        ses.data.forEach((c) => c.payment_intent && c.metadata && c.metadata.evento && ids.add(c.payment_intent));
        const r = await s.paymentIntents.search({ query: `metadata['email']:'${q.replace(/'/g, "")}'`, limit: 20 });
        r.data.forEach((p) => ids.add(p.id));
      } else if (/^[a-f0-9]{32}$/i.test(q) || /^[a-f0-9]{8}$/i.test(q)) {
        // Referencia completa (del enlace) o corta (la del correo: 8 caracteres)
        const campo = q.length === 32 ? "ref" : "rc";
        const valor = q.length === 32 ? q.toLowerCase() : q.toUpperCase();
        const r = await s.paymentIntents.search({ query: `metadata['${campo}']:'${valor}'`, limit: 10 });
        r.data.forEach((p) => ids.add(p.id));
      } else if (/^pi_[A-Za-z0-9]+$/.test(q)) {
        ids.add(q);
      } else {
        return enviar(res, 400, { error: "busqueda" });
      }
      const lista = [];
      for (const id of [...ids].slice(0, 20)) {
        const pi = await s.paymentIntents.retrieve(id, { expand: ["latest_charge"] }).catch(() => null);
        if (pi && pi.metadata && pi.metadata.evento && pi.status === "succeeded") lista.push(resumen(pi));
      }
      return enviar(res, 200, { compras: lista });
    }

    if (body.accion === "enviar") {
      if (!/^pi_[A-Za-z0-9]+$/.test(String(body.pi || ""))) return enviar(res, 400, { error: "pago" });
      const email = String(body.email || "").trim();
      if (email && !emailValido(email)) return enviar(res, 400, { error: "email" });
      const r = await enviarEntradas(body.pi, { forzar: true, email });
      return enviar(res, 200, r);
    }
    enviar(res, 400, { error: "accion" });
  } catch (err) {
    console.error("reenviar:", err.message);
    enviar(res, 500, { error: "servidor" });
  }
};
