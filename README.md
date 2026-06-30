# InmoMetrics by Borja Pérez · v4

Mejoras sobre v3: fechas visibles, orden por fecha corregido, y eliminación de viviendas ya no disponibles en Idealista.

## Qué cambia en esta versión

### 1. Fechas visibles
- Cada tarjeta muestra ahora "Analizado [fecha]" bajo la zona, y "· Publicado [fecha]" si esa vivienda tiene `fechaPublicacionIdealista`.
- El modal de detalle añade ambas fechas en la sección "Datos del inmueble".
- `fechaPublicacionIdealista` es un campo **opcional** a nivel de vivienda (mismo nivel que `fechaAnalisis`). Si no se conoce, simplemente no se incluye y no se muestra nada.

### 2. Orden por fecha corregido
El campo `fechaAnalisis` nunca se mostraba en pantalla, así que era imposible comprobar a simple vista si el orden era correcto. Además, el comparador se ha hecho más robusto: ahora convierte las fechas a timestamps reales y cualquier vivienda con fecha ausente o mal formada se manda al final en vez de descolocar el resto.

### 3. Eliminación de viviendas no disponibles
El panel **"Importar análisis"** ahora acepta, además de las viviendas de siempre, un campo `_eliminar` con una lista de IDs a borrar:

```json
{
  "viviendas": [ ... nuevas o actualizadas ... ],
  "_eliminar": ["111234567", "108999999"]
}
```

También puedes pegar **solo** el campo `_eliminar` sin viviendas, para una limpieza pura:

```json
{ "_eliminar": ["111234567", "108999999"] }
```

Claude usará esto automáticamente cada vez que detecte, al comprobar tus viviendas existentes contra Idealista, que alguna ya no está disponible (anuncio retirado o 404).

## Resto de funcionalidades

Igual que v3: selector de ciudad, calculadora manual, configuración de GitHub vía token, panel de URLs pendientes, etc. Ver el resto de este documento en versiones anteriores si necesitas repasar el setup inicial (token de GitHub, despliegue en Vercel).

## Cómo desplegar esta actualización

Sustituye en tu repositorio de GitHub estos 3 archivos: `index.html`, `app.js`, `styles.css`. No toques `data.json` ni `vercel.json`. Vercel redeploya solo en ~30 segundos.

## Coste

Sigue siendo **0 €**.
