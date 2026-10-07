// POST /api/checkin  { codigo, pin } → valida una entrada en la puerta y la marca como usada
const { stripe, configurado, evento, leerCodigo, pinCorrecto, reembolsado, enviar } = require("./_lib.js");

module.exports = async (req, res) => {
  if (req.method !== "POST") return enviar(res, 405, { error: "metodo" });
  if (!configurado()) return enviar(res, 503, { error: "no_configurado" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  if (!pinCorrecto(body.pin)) return enviar(res, 401, { resultado: "pin" });
  if (body.soloPin) return enviar(res, 200, { resultado: "pin_ok" });

  const c = leerCodigo(body.codigo);
  if (!c) return enviar(res, 200, { resultado: "falsa" });

  try {
    const s = stripe();
    let pi;
    try { pi = await s.paymentIntents.retrieve(c.pi, { expand: ["latest_charge"] }); }
    catch { return enviar(res, 200, { resultado: "falsa" }); }

    const qty = parseInt(pi.metadata.qty || "0", 10);
    const e = evento(pi.metadata.evento);
    const info = { evento: e ? e.nombre : pi.metadata.evento, fecha: e ? e.fecha : "", nombre: pi.metadata.nombre || "", n: c.i + 1, de: qty };

    if (pi.status !== "succeeded" || c.i >= qty) return enviar(res, 200, { resultado: "falsa", ...info });
    if (reembolsado(pi)) return enviar(res, 200, { resultado: "reembolsada", ...info });
    if (body.evento && body.evento !== pi.metadata.evento) return enviar(res, 200, { resultado: "otro_evento", ...info });

    const clave = "u" + c.i;
    if (pi.metadata[clave]) return enviar(res, 200, { resultado: "usada", usadaEn: pi.metadata[clave], ...info });

    await s.paymentIntents.update(pi.id, { metadata: { [clave]: new Date().toISOString() } });
    enviar(res, 200, { resultado: "ok", ...info });
  } catch (err) {
    console.error("checkin:", err);
    enviar(res, 500, { resultado: "error" });
  }
};
