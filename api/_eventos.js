// ─────────────────────────────────────────────────────────────────────────────
//  CONCIERTOS CON VENTA DE ENTRADAS
//  Este archivo lo lee el SERVIDOR: el precio no se puede manipular desde el navegador.
//
//  id           → debe ser igual al campo "venta" de ese show en CONFIG.shows (index.html)
//  precio       → en CÉNTIMOS  (1500 = 15,00 €)
//  aforo        → número máximo de entradas que se venden por la web
//  maxPorCompra → máximo de entradas en una misma compra
//  activo       → true = venta abierta · false = venta cerrada
// ─────────────────────────────────────────────────────────────────────────────
module.exports = [
  {
    id: "madrid-2026-11-19",
    nombre: "Kevin Alva · Barracuda Rock Bar (Madrid)",
    fecha: "2026-11-19",
    hora: "",
    lugar: "Barracuda Rock Bar",
    direccion: "Calle de Brescia 19, 28028 Madrid",
    precio: 1500,      // ⚠️ PENDIENTE DE CONFIRMAR
    moneda: "eur",
    aforo: 110,
    maxPorCompra: 10,
    activo: false,
  },
  {
    id: "barcelona-2026-11-21",
    nombre: "Kevin Alva · Soda Acústic (Barcelona)",
    fecha: "2026-11-21",
    hora: "",
    lugar: "Soda Acústic",
    direccion: "Carrer de les Guilleries 6, Gràcia, Barcelona",
    precio: 1500,      // ⚠️ PENDIENTE DE CONFIRMAR
    moneda: "eur",
    aforo: 100,
    maxPorCompra: 10,
    activo: false,
  },
];
