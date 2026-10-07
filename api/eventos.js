// GET /api/eventos → qué conciertos tienen la venta abierta (lo usa la web para mostrar el botón "Comprar")
const { EVENTOS, configurado, modoPrueba, yaPaso, ocupadas, enviar } = require("./_lib.js");

module.exports = async (req, res) => {
  if (!configurado()) return enviar(res, 200, { activo: false, eventos: [] });
  try {
    const lista = [];
    for (const e of EVENTOS) {
      if (!e.activo || yaPaso(e)) continue;
      const libres = Math.max(0, e.aforo - (await ocupadas(e.id)));
      lista.push({
        id: e.id,
        precio: e.precio,
        moneda: e.moneda || "eur",
        max: Math.max(1, Math.min(e.maxPorCompra || 10, libres)),
        agotado: libres <= 0,
        ultimas: libres > 0 && libres <= 10 ? libres : null,
      });
    }
    res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=40");
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ activo: true, prueba: modoPrueba(), eventos: lista }));
  } catch (err) {
    console.error("eventos:", err);
    enviar(res, 200, { activo: false, eventos: [] });
  }
};
