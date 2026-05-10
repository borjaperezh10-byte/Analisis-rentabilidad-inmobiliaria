# Análisis Inmobiliario · Dashboard v2

Dashboard privado de análisis de inversiones inmobiliarias con auto-publicación a GitHub.

## Novedades respecto a v1

- 🔐 **Vista Configuración** (icono engranaje arriba): conecta el dashboard con tu repo de GitHub
- 📤 **Botón "Importar análisis"**: pega el JSON de Claude → se sube a GitHub automáticamente
- ✅ Indicador de estado de la conexión con GitHub en la barra superior

## Estructura

```
dashboard/
├── index.html      Pantalla de login + estructura
├── styles.css      Estilos
├── app.js          Lógica del dashboard + integración GitHub API
├── data.json       Datos de viviendas + benchmarks
├── vercel.json     Configuración del despliegue
└── README.md       Este archivo
```

## Setup inicial (solo la primera vez)

### 1. Sube los archivos a tu repo de GitHub

Reemplaza los archivos `index.html`, `styles.css`, `app.js` y `README.md` por estas nuevas versiones. (No toques `data.json` ni `vercel.json` si ya los tenías).

### 2. Genera un Personal Access Token en GitHub

1. Ve a https://github.com/settings/tokens?type=beta (Fine-grained)
2. Click en **Generate new token**
3. Token name: el que quieras (ej: `dashboard-inmobiliario`)
4. Expiration: 1 año (máximo)
5. Repository access: **Only select repositories** → tu repo concreto
6. Permissions → Repository permissions → **Contents: Read and write**
7. Generate token → cópialo (no lo verás dos veces)

### 3. Configura el dashboard

1. Abre el dashboard en tu navegador
2. Click en el **icono engranaje** arriba a la derecha
3. Rellena: tu usuario de GitHub, nombre del repo, rama (`main` por defecto), y el token
4. Click en **Probar conexión** → debe salir verde
5. Click en **Guardar configuración**

A partir de aquí, el indicador "GitHub conectado" estará verde.

## Flujo de trabajo nuevo

1. **Recibes alertas de Idealista en tu email** → copias las URLs
2. **Pegas las URLs en el dashboard** (botón "Pegar URLs nuevas") → se guardan como pendientes
3. **Le das a "Copiar lista"** → pegas en el chat con Claude
4. **Claude te devuelve un JSON** con las viviendas analizadas
5. **Pegas el JSON en el dashboard** (botón "Importar análisis") → click "Importar y subir a GitHub"
6. **Vercel redeploya solo en ~30 segundos**
7. **Refrescas la página** → ya están las viviendas analizadas

**Ya no abres GitHub manualmente.** El dashboard hace el commit por ti.

## Cómo eliminar viviendas

Hover sobre una tarjeta → aparece una **X** en la esquina superior izquierda. Click → confirmas → la vivienda se oculta localmente.

⚠️ Las eliminaciones son **locales** (solo en tu navegador). Si Claude vuelve a analizar la misma vivienda en otra sesión, volverá a aparecer.

## Seguridad del token

- El token se guarda **solo en tu navegador** (localStorage)
- **Nunca se envía a ningún servidor** excepto a la API oficial de GitHub
- Tiene permisos limitados: solo puede leer/escribir archivos en TU repo concreto
- Si crees que se ha comprometido: ve a GitHub → Settings → Developer settings → Personal access tokens → revoca el token. Genera uno nuevo y actualízalo en el dashboard.

## Capacidad y mantenimiento

- Vercel plan Hobby: 100 GB ancho de banda/mes (sobra)
- GitHub: ilimitado para repos privados
- Coste total: **0 €**

## Si algo no funciona

- "401 Unauthorized" → token caducado o sin permisos. Regenera el token y actualízalo.
- "404 Not Found" → owner/repo/rama incorrecta o `data.json` no existe en esa rama.
- "JSON inválido" → el texto pegado no es JSON parseable. Pídele a Claude el JSON limpio.
- Otra cosa → captura el error y pásalo por el chat.
