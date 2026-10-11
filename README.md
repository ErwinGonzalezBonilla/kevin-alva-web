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
