# Foto de perfil

Configuración → Editar perfil → seleccionar foto → vista previa → Guardar cambios.
Cancelar descarta la selección sin enviar nada. Quitar foto es un borrador hasta
guardar; vuelve a las iniciales. La foto y el nombre se guardan juntos mediante
PATCH multipart a /api/auth/me/. El menú lateral se actualiza tras guardar.

Admite JPG, PNG y WebP estáticos de hasta 2 MB, mínimo 64 × 64 píxeles y máximo
16 megapíxeles. El backend comprueba los bytes reales con Pillow, rechaza archivos
inválidos/animados, aplica orientación EXIF, centra/recorta a 256 × 256, elimina
metadatos y guarda un JPEG optimizado. Transparencias se aplanan sobre blanco.
No conserva el archivo original ni su nombre y no acepta SVG/GIF ni URLs externas.

Decisión para el alcance local: foto pequeña normalizada en un campo binario de
PostgreSQL, en vez de archivos públicos o un servicio externo. Esto simplifica
privacidad y reemplazo/eliminación, pero aumenta el tamaño de BD/backups. Si crece
el servicio, evaluar almacenamiento privado de objetos, no exponer MEDIA_URL.
Los respaldos pueden conservar fotos antiguas según su política de retención:
quitar la foto activa no implica borrarla retroactivamente de backups existentes.

GET /api/auth/me/avatar/ solo devuelve la foto del usuario autenticado: JPEG200 o
204 sin foto; sin JWT válido responde401. Cache-Control private/no-store y nosniff.
El frontend obtiene blobs autenticados y libera sus URLs al reemplazar/desmontar.
No publica fotos, no cambia los avatares de redes sociales ni sustituye el logo.

Migración: authentication.0012_user_avatar. Ejecutar manage.py migrate y cargar el
backend actualizado antes de probar. No selecciona ni guarda una foto real por el
usuario; él debe elegirla. Pruebas automáticas usan imágenes sintéticas y SQLite.
Falta verificación manual de subir/guardar/cancelar/quitar con la foto elegida por
el usuario en ambos temas y diferentes tamaños de pantalla. No se cambió Flutter
ni Android para subir o mostrar la foto; este avance es de la web y API Django.
