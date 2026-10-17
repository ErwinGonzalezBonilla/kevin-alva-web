# Web oficial de Kevin Alva

Sitio estático (HTML + CSS + JS, sin dependencias). Se publica automáticamente en Vercel con cada cambio en GitHub.

## Estructura
- `index.html`: toda la web
- `img/`: fotos, logo y portadas
- `video/`: video en bucle del hero

## Cómo actualizar contenido
Casi todo se edita en el bloque `CONFIG` al final de `index.html`:

- **Shows**: `shows` → fecha (AAAA-MM-DD), ciudad, país, sala y enlace de `entradas`. Las fechas pasadas se ocultan solas.
- **Discografía**: `discografia` → nombre, año, portada y `enlace` del álbum en Spotify.
- **Videos de YouTube**: `videos` → pega el ID (lo que va después de `watch?v=`).
- **Spotify**: `spotifyPrincipal` (tema destacado) y `spotifyArtista`.
- **Redes y Donar**: `redes` y `donar`.
- **Formulario de booking**: `email` (el primer envío pide confirmar el correo una vez).

Para cambiar una foto: sube la nueva a `img/` con el mismo nombre, o cambia la ruta en `index.html`.

## Enlaces directos para redes (vercel.json)
- `kevinalvamusic.com/entradas` → agenda en español, con los conciertos de España resaltados
- `kevinalvamusic.com/tickets` → lo mismo en inglés
- `kevinalvamusic.com/madrid` y `/barcelona` → abre directamente la compra de ese concierto

Al añadir un concierto nuevo con venta, se puede crear su enlace copiando una línea en `vercel.json`
(el valor de `comprar=` es el `id` del concierto en `api/_eventos.js`).

## Entradas por correo (Stripe webhook + Resend)
Cuando Stripe confirma un pago, avisa a `/api/stripe-webhook` y la web envía al comprador un correo
(en su idioma) con el enlace a sus entradas y los QR adjuntos en PNG. Si el aviso llega repetido, no se reenvía.
Si el correo falla, la función responde con error y Stripe lo reintenta solo.

- `api/stripe-webhook.js`: recibe el aviso de Stripe y comprueba su firma.
- `api/_correo.js`: plantilla del correo (EN/ES/ET), QR en PNG y envío con Resend.
- `api/_qr/`: generador de QR (MIT, Kazuhiko Arase).
- `reenviar.html` + `api/reenviar.js`: buscar una compra por correo o referencia y reenviar las entradas
  (también a otro correo). Protegido con el mismo PIN que el escáner.

Variables de entorno (Vercel):
- `STRIPE_WEBHOOK_SECRET`: clave de firma del webhook (`whsec_...`). Es distinta en modo de prueba y en modo real.
- `RESEND_API_KEY`: clave de Resend.
- `EMAIL_FROM` (opcional): por defecto `Kevin Alva <entradas@kevinalvamusic.com>`.
- `EMAIL_REPLY_TO` (recomendada): correo de Kevin donde llegan las respuestas de los compradores.

URL del webhook en Stripe: `https://www.kevinalvamusic.com/api/stripe-webhook` (con `www`: Stripe no sigue redirecciones).
Eventos: `checkout.session.completed` y `checkout.session.async_payment_succeeded`.
