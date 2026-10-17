// Correo con las entradas (Resend) + imágenes QR en PNG.
// No es una ruta pública: empieza por "_".
//
// Variables de entorno:
//   RESEND_API_KEY   clave de Resend (obligatoria para enviar)
//   EMAIL_FROM       remitente, por defecto "Kevin Alva <entradas@kevinalvamusic.com>"
//   EMAIL_REPLY_TO   correo donde Kevin recibe las respuestas (opcional, recomendado)
const zlib = require("zlib");
const QRCode = require("./_qr/index.js");
const QRErrorCorrectLevel = require("./_qr/QRErrorCorrectLevel.js");
const { stripe, evento, codigo, reembolsado } = require("./_lib.js");

const WEB = "https://www.kevinalvamusic.com";

// ── QR → PNG (sin dependencias) ─────────────────────────────────────────────
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(tipo, datos) {
  const len = Buffer.alloc(4); len.writeUInt32BE(datos.length);
  const td = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function qrPng(texto, escala = 10, margen = 4) {
  const qr = new QRCode(-1, QRErrorCorrectLevel.M); qr.addData(texto); qr.make();
  const n = qr.getModuleCount(), lado = (n + margen * 2) * escala;
  const filas = Buffer.alloc((lado + 1) * lado, 255);
  for (let y = 0; y < lado; y++) {
    filas[y * (lado + 1)] = 0; // filtro "none"
    const my = Math.floor(y / escala) - margen;
    for (let x = 0; x < lado; x++) {
      const mx = Math.floor(x / escala) - margen;
      if (my >= 0 && my < n && mx >= 0 && mx < n && qr.isDark(my, mx)) filas[y * (lado + 1) + 1 + x] = 0;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(lado, 0); ihdr.writeUInt32BE(lado, 4); ihdr[8] = 8; ihdr[9] = 0; // 8 bits, escala de grises
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(filas)), chunk("IEND", Buffer.alloc(0))]);
}

// ── Textos del correo ───────────────────────────────────────────────────────
const T = {
  es: {
    asunto: "Tus entradas · {evento}", hola: "Hola{nombre}:", intro: "Gracias por tu compra. Aquí tienes {n} para:",
    una: "tu entrada", varias: "tus {n} entradas", boton: "Ver mis entradas",
    adjuntos: "Los códigos QR también van adjuntos en este correo ({n} {img}). Así los tienes aunque no haya internet en la sala.",
    img1: "imagen", imgN: "imágenes",
    puerta: "En la puerta, enseña cada QR desde el móvil o impreso. Cada código vale para una persona y una sola vez.",
    guarda: "Guarda este correo.", ayudaReply: "Si tienes cualquier problema, responde a este mensaje.", ayudaWeb: "Si tienes cualquier problema, escríbenos desde kevinalvamusic.com.",
    lugar: "Lugar", pedido: "Referencia", total: "Total pagado", entradas: "Entradas", titular: "A nombre de",
    legal: "Este correo es el justificante de tu compra de entradas. No es una factura.", archivo: "entrada"
  },
  en: {
    asunto: "Your tickets · {evento}", hola: "Hi{nombre},", intro: "Thanks for your purchase. Here {n} for:",
    una: "is your ticket", varias: "are your {n} tickets", boton: "View my tickets",
    adjuntos: "The QR codes are also attached to this email ({n} {img}), so you have them even if there's no internet at the venue.",
    img1: "image", imgN: "images",
    puerta: "At the door, show each QR on your phone or printed. Each code admits one person, once.",
    guarda: "Keep this email.", ayudaReply: "If you have any problem, just reply to this message.", ayudaWeb: "If you have any problem, contact us through kevinalvamusic.com.",
    lugar: "Venue", pedido: "Reference", total: "Total paid", entradas: "Tickets", titular: "Name",
    legal: "This email is your proof of purchase. It is not an invoice.", archivo: "ticket"
  },
  et: {
    asunto: "Sinu piletid · {evento}", hola: "Tere{nombre}!", intro: "Aitäh ostu eest! Siin on {n}:",
    una: "sinu pilet", varias: "sinu {n} piletit", boton: "Vaata minu pileteid",
    adjuntos: "QR-koodid on lisatud ka sellele kirjale ({n} {img}), nii et need on sul olemas ka siis, kui kohapeal internetti pole.",
    img1: "pilt", imgN: "pilti",
    puerta: "Näita uksel iga QR-koodi telefonis või väljaprinditult. Iga kood kehtib ühele inimesele ja ühe korra.",
    guarda: "Hoia see kiri alles.", ayudaReply: "Kui tekib probleeme, vasta lihtsalt sellele kirjale.", ayudaWeb: "Kui tekib probleeme, võta meiega ühendust kodulehe kevinalvamusic.com kaudu.",
    lugar: "Koht", pedido: "Viide", total: "Makstud kokku", entradas: "Piletid", titular: "Nimi",
    legal: "See kiri on sinu ostu kinnitus. See ei ole arve.", archivo: "pilet"
  }
};
const LOC = { es: "es-ES", en: "en-GB", et: "et-EE" };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const rel = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

function fechaLarga(f, h, lang) {
  if (!f) return "";
  const d = new Date(f + "T12:00:00Z");
  const txt = d.toLocaleDateString(LOC[lang], { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return txt.charAt(0).toUpperCase() + txt.slice(1) + (h ? " · " + h : "");
}

function construirCorreo({ e, lang, nombre, cantidad, total, moneda, ref, enlace }) {
  const t = T[lang] || T.en;
  const primerNombre = (nombre || "").trim().split(/\s+/)[0] || "";
  const nTxt = cantidad === 1 ? t.una : rel(t.varias, { n: cantidad });
  const importe = new Intl.NumberFormat(LOC[lang], { style: "currency", currency: (moneda || "eur").toUpperCase() }).format(total / 100);
  const fecha = fechaLarga(e.fecha, e.hora, lang);
  const lugar = [e.lugar, e.direccion].filter(Boolean).join(" · ");
  const ayuda = process.env.EMAIL_REPLY_TO ? t.ayudaReply : t.ayudaWeb;
  const adj = rel(t.adjuntos, { n: cantidad, img: cantidad === 1 ? t.img1 : t.imgN });
  const refCorta = String(ref || "").slice(0, 8).toUpperCase();
  const hola = rel(t.hola, { nombre: primerNombre ? " " + primerNombre : "" });

  const fila = (k, v) => `<tr><td style="padding:6px 0;color:#6b6b6b;font-size:13px;width:38%;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;color:#111;font-size:14px;font-weight:700">${esc(v)}</td></tr>`;
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(rel(t.asunto, { evento: e.nombre }))}</title></head>
<body style="margin:0;padding:0;background:#efefec;font-family:Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efefec;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
  <tr><td style="background:#050505;padding:22px 28px;border-bottom:4px solid #D6A62C">
    <div style="color:#D6A62C;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase">Kevin Alva · Live</div>
    <div style="color:#F5F5F5;font-size:26px;font-weight:800;line-height:1.15;margin-top:6px;text-transform:uppercase">${esc(e.lugar || e.nombre)}</div>
    <div style="color:#BDBDBD;font-size:14px;margin-top:6px">${esc(fecha)}</div>
  </td></tr>
  <tr><td style="padding:28px">
    <p style="margin:0 0 6px;font-size:16px;color:#111">${esc(hola)}</p>
    <p style="margin:0 0 18px;font-size:15px;color:#333;line-height:1.5">${esc(rel(t.intro, { n: nTxt }))}<br><b style="color:#111">${esc(e.nombre)}</b></p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e6e6e6;border-bottom:1px solid #e6e6e6;margin-bottom:22px">
      ${fila(t.entradas, String(cantidad))}${nombre ? fila(t.titular, nombre) : ""}${lugar ? fila(t.lugar, lugar) : ""}${fila(t.total, importe)}${fila(t.pedido, refCorta)}
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 22px"><tr><td style="background:#D6A62C;border-radius:999px">
      <a href="${esc(enlace)}" style="display:inline-block;padding:15px 30px;color:#050505;font-size:14px;font-weight:800;letter-spacing:2px;text-transform:uppercase;text-decoration:none">${esc(t.boton)}</a>
    </td></tr></table>
    <p style="margin:0 0 12px;font-size:14px;color:#333;line-height:1.55">${esc(adj)}</p>
    <p style="margin:0 0 12px;font-size:14px;color:#333;line-height:1.55">${esc(t.puerta)}</p>
    <p style="margin:0;font-size:14px;color:#333;line-height:1.55"><b>${esc(t.guarda)}</b> ${esc(ayuda)}</p>
  </td></tr>
  <tr><td style="background:#f6f6f4;padding:16px 28px;font-size:12px;color:#777;line-height:1.5">${esc(t.legal)}<br><a href="${WEB}" style="color:#8F6B18">kevinalvamusic.com</a></td></tr>
</table></td></tr></table></body></html>`;

  const text = [hola, "", rel(t.intro, { n: nTxt }), e.nombre, fecha, "", lugar ? `${t.lugar}: ${lugar}` : "", `${t.entradas}: ${cantidad}`, nombre ? `${t.titular}: ${nombre}` : "", `${t.total}: ${importe}`, `${t.pedido}: ${refCorta}`, "", `${t.boton}: ${enlace}`, "", adj, t.puerta, "", `${t.guarda} ${ayuda}`, "", t.legal].filter((x) => x !== false).join("\n");
  return { asunto: rel(t.asunto, { evento: e.nombre }), html, text, archivo: t.archivo };
}

// ── Envío con Resend ────────────────────────────────────────────────────────
async function enviarResend({ para, asunto, html, text, adjuntos, idempotencia }) {
  if (!process.env.RESEND_API_KEY) throw new Error("Falta RESEND_API_KEY");
  const cuerpo = {
    from: process.env.EMAIL_FROM || "Kevin Alva <entradas@kevinalvamusic.com>",
    to: [para], subject: asunto, html, text,
    attachments: adjuntos.map((a) => ({ filename: a.nombre, content: a.datos.toString("base64") })),
  };
  if (process.env.EMAIL_REPLY_TO) cuerpo.reply_to = process.env.EMAIL_REPLY_TO;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": idempotencia },
    body: JSON.stringify(cuerpo),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Resend ${r.status}: ${d.message || d.name || "error"}`);
  return d.id;
}

const emailValido = (e) => typeof e === "string" && e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

// Envía las entradas de un pago. Seguro de llamar varias veces: si ya se envió, no repite (salvo forzar).
async function enviarEntradas(piId, { forzar = false, email = "", nombre = "", lang = "" } = {}) {
  const s = stripe();
  const pi = await s.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
  if (pi.status !== "succeeded" || !pi.metadata.evento) return { estado: "no_pagado" };
  if (reembolsado(pi)) return { estado: "reembolsado" };
  if (pi.metadata.mail_enviado && !forzar) return { estado: "ya_enviado", a: pi.metadata.mail_a };

  const ch = pi.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  const para = (email || pi.metadata.email || (ch && ch.billing_details && ch.billing_details.email) || pi.receipt_email || "").trim();
  if (!emailValido(para)) return { estado: "sin_email" };
  const titular = (nombre || pi.metadata.nombre || (ch && ch.billing_details && ch.billing_details.name) || "").slice(0, 200);
  const idioma = ["es", "en", "et"].includes(lang) ? lang : ["es", "en", "et"].includes(pi.metadata.lang) ? pi.metadata.lang : "en";

  const e = evento(pi.metadata.evento) || { nombre: "Kevin Alva", fecha: "", hora: "", lugar: "", direccion: "" };
  const cantidad = parseInt(pi.metadata.qty || "0", 10);
  const enlace = `${WEB}/entrada.html?ref=${pi.metadata.ref}&lang=${idioma}`;
  const c = construirCorreo({ e, lang: idioma, nombre: titular, cantidad, total: pi.amount_received, moneda: pi.currency, ref: pi.metadata.ref, enlace });
  const adjuntos = Array.from({ length: cantidad }, (_, i) => ({ nombre: `${c.archivo}-${i + 1}-${e.fecha || "kevin-alva"}.png`, datos: qrPng(codigo(pi.id, i)) }));

  const id = await enviarResend({ para, asunto: c.asunto, html: c.html, text: c.text, adjuntos, idempotencia: forzar ? `reenvio-${pi.id}-${Date.now()}` : `entradas-${pi.id}` });
  const meta = { mail_enviado: new Date().toISOString(), mail_a: para.slice(0, 200), email: para.slice(0, 200) };
  if (titular && !pi.metadata.nombre) meta.nombre = titular;
  await s.paymentIntents.update(pi.id, { metadata: meta });
  return { estado: "enviado", a: para, id };
}

module.exports = { qrPng, construirCorreo, enviarEntradas, emailValido };
