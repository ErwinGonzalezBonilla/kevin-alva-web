// GET /api/ticket?session_id=cs_...  o  ?ref=...  → datos de la compra + códigos de las entradas
const { stripe, configurado, modoPrueba, evento, codigo, reembolsado, enviar } = require("./_lib.js");

async function porSesion(s, id) {
  const cs = await s.checkout.sessions.retrieve(id);
  if (cs.payment_status !== "paid" || !cs.payment_intent) return { pendiente: true };
  let pi = await s.paymentIntents.retrieve(cs.payment_intent, { expand: ["latest_charge"] });
  // Guardamos nombre y correo en el pago (así aparecen también al escanear en la puerta)
  const nombre = (cs.customer_details && cs.customer_details.name) || "";
  const email = (cs.customer_details && cs.customer_details.email) || "";
  if (pi.metadata.nombre === undefined) {
    await s.paymentIntents.update(pi.id, { metadata: { nombre: nombre.slice(0, 200), email: email.slice(0, 200) } });
    pi.metadata.nombre = nombre; pi.metadata.email = email;
  }
  return { pi };
}

async function porRef(s, ref) {
  const r = await s.paymentIntents.search({ query: `metadata['ref']:'${ref}'`, limit: 1 });
  if (!r.data.length) return { pendiente: true };
  const pi = await s.paymentIntents.retrieve(r.data[0].id, { expand: ["latest_charge"] });
  if (pi.status !== "succeeded") return { pendiente: true };
  return { pi };
}

module.exports = async (req, res) => {
  if (!configurado()) return enviar(res, 503, { error: "no_configurado" });
  const sid = String(req.query.session_id || "");
  const ref = String(req.query.ref || "");
  if (!/^cs_[A-Za-z0-9_]+$/.test(sid) && !/^[a-f0-9]{32}$/.test(ref)) return enviar(res, 400, { error: "enlace" });

  try {
    const s = stripe();
    const r = sid ? await porSesion(s, sid) : await porRef(s, ref);
    if (r.pendiente) return enviar(res, 202, { estado: "pendiente" });
    const pi = r.pi;
    if (ref && pi.metadata.ref !== ref) return enviar(res, 400, { error: "enlace" });

    const e = evento(pi.metadata.evento) || { nombre: "Kevin Alva", fecha: "", hora: "", lugar: "", direccion: "" };
    const qty = parseInt(pi.metadata.qty || "0", 10);
    enviar(res, 200, {
      estado: reembolsado(pi) ? "reembolsado" : "pagado",
      prueba: modoPrueba(),
      ref: pi.metadata.ref,
      evento: { nombre: e.nombre, fecha: e.fecha, hora: e.hora, lugar: e.lugar, direccion: e.direccion },
      nombre: pi.metadata.nombre || "",
      cantidad: qty,
      total: pi.amount_received,
      moneda: pi.currency,
      entradas: reembolsado(pi) ? [] : Array.from({ length: qty }, (_, i) => ({ n: i + 1, codigo: codigo(pi.id, i), usada: !!pi.metadata["u" + i] })),
    });
  } catch (err) {
    console.error("ticket:", err);
    enviar(res, 500, { error: "stripe" });
  }
};
