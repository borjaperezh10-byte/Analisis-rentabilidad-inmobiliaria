# InmoMetrics by Borja Pérez · v3

Dashboard privado de análisis de inversiones inmobiliarias. Multi-ciudad, con calculadora propia y auto-publicación a GitHub.

## Novedades v3

- 🏙️ **Multi-ciudad**: selector en el header. Cada ciudad tiene sus propios benchmarks y criterios.
- 🧮 **Vista Calculadora**: introduce datos manualmente, ve los resultados en tiempo real. Botón para guardar como vivienda y subir a GitHub.
- 📅 **Orden por fecha de análisis** (por defecto, viviendas más recientes arriba).
- 💬 **Motivo del verdict**: las tarjetas marcadas como "Zona gris" o "Descartada" muestran el motivo en 1-2 líneas.
- 🎨 **Branding**: InmoMetrics by Borja Pérez.
- 🧹 KPI "Inversión total potencial" retirado.

## Cómo añadir una ciudad nueva

1. Pasa a Claude por chat el nombre de la ciudad.
2. Claude busca RealAdvisor + BestYieldFinder para esa ciudad.
3. Junto con tu documento de criterios para esa ciudad, te devuelve un objeto JSON con la estructura completa de la nueva ciudad.
4. Lo pegas en el dashboard usando "Importar análisis" (acepta tanto viviendas sueltas como objetos de ciudad).

⚠️ Por simplicidad inicial, para añadir ciudad puedes pedirme directamente que actualice el `data.json` completo y subirlo manualmente al repo. Más adelante automatizamos la importación de ciudades desde el panel.

## Setup inicial

Idéntico al de v2: ver historial de chats si lo necesitas. En resumen: generas un Personal Access Token en GitHub con permisos de Contents Read/Write sobre tu repo, lo introduces en la vista "Configuración" (icono engranaje), pruebas la conexión y guardas.

## Calculadora

Vista dedicada para meter datos a mano:
- **Columna izquierda**: formularios con los inputs (precio, m², año, hipoteca, ITP, gastos, alquiler, IRPF...)
- **Columna derecha**: resultados en tiempo real con verdict según los criterios de la ciudad activa

Acciones:
- **Limpiar**: vacía todos los campos
- **Guardar como vivienda**: añade el análisis a tu lista y lo sube a GitHub. Funciona aunque no haya URL de Idealista (genera un id manual).

## Estructura de datos

`data.json` ahora tiene la siguiente raíz:
- `meta` — versión, fecha, ciudad activa por defecto
- `parametros` — parámetros generales (hipoteca, fiscalidad, estimación)
- `ciudades[]` — array de ciudades con `slug`, `nombre`, `ccaa`, `itp`, `benchmarks` (RealAdvisor + BYF + criterios + catalizadores)
- `viviendas[]` — lista de viviendas, cada una con `ciudadSlug` para asignar a su ciudad

## Coste

Total: **0 €**. Vercel + GitHub gratis.

## Si algo no funciona

Capturas o errores → al chat con Claude.
