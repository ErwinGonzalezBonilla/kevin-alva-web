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
