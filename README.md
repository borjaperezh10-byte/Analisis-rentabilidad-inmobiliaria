# Análisis Inmobiliario · Dashboard

Dashboard privado de análisis de inversiones inmobiliarias. Frontend estático (HTML/CSS/JS), sin backend, sin coste.

## Estructura

```
dashboard/
├── index.html      Pantalla de login + estructura
├── styles.css      Estilos
├── app.js          Lógica del dashboard
├── data.json       Datos de viviendas + benchmarks (ÚNICO archivo a actualizar)
├── vercel.json     Configuración del despliegue
└── README.md       Este archivo
```

## Contraseña

Definida en `app.js`, cerca del inicio:
```js
const PASSWORD = 'talavera2026';
```
Para cambiarla, edita esa línea y vuelve a desplegar.

⚠️ Es protección **del lado cliente**. Suficiente para evitar accesos casuales, pero no es seguridad criptográfica. No subas datos genuinamente confidenciales.

## Cómo subirlo a Vercel (5 minutos)

### Paso 1 — Crear repositorio en GitHub

1. Inicia sesión en https://github.com
2. Botón verde "New repository" arriba a la derecha
3. Nombre: `inversiones-dashboard` (o lo que quieras)
4. Visibilidad: **Private** (recomendado)
5. NO marques nada de "Initialize with README" — vamos a subir archivos ya hechos
6. "Create repository"

### Paso 2 — Subir los archivos

GitHub te enseña una pantalla con instrucciones. La forma más fácil:
- Click en "uploading an existing file" (link en la pantalla)
- Arrastra los 6 archivos del dashboard al navegador
- Mensaje de commit: "Initial dashboard"
- "Commit changes"

### Paso 3 — Conectar con Vercel

1. Inicia sesión en https://vercel.com con la cuenta de GitHub
2. "Add New..." → "Project"
3. Importa el repositorio que acabas de crear
4. **No cambies nada** en la configuración (Vercel detecta que es estático)
5. "Deploy"

En 30 segundos tendrás una URL tipo `inversiones-dashboard-xxxxx.vercel.app`.

### Paso 4 — Acceder

Abre la URL en cualquier dispositivo, introduce la contraseña, y listo.

## Cómo actualizar las viviendas

El flujo de trabajo previsto:

1. **Pegas URLs en el dashboard** (botón "Pegar URLs nuevas"). Quedan guardadas como "pendientes" en tu navegador.
2. **Pasas la lista a Claude** (botón "Copiar lista" → pegar en chat).
3. **Claude las analiza** y te devuelve el `data.json` actualizado.
4. **Subes el nuevo `data.json` al repo de GitHub** (Edit → Replace file → commit). Vercel redeploya solo en ~30 segundos.
5. **Abres el dashboard** y las viviendas ya aparecen analizadas. Las pendientes que ya estén en `data.json` se quitan automáticamente.

## Cómo eliminar viviendas

Hover sobre una tarjeta → aparece una **X** en la esquina superior izquierda. Click → confirmas → la vivienda se oculta.

⚠️ Los **eliminados son locales** (solo en tu navegador). Si Claude vuelve a analizar la misma vivienda y la mete al `data.json`, **volverá a aparecer** porque el dashboard no tiene memoria entre sesiones. Si quieres reaparecer una eliminada, usa el botón "Reset local".

## Capacidad y mantenimiento

- Vercel plan Hobby: 100 GB ancho de banda/mes (sobra para uso personal)
- GitHub: ilimitado para repos privados
- Coste total: **0 €**

## ¿Algo no funciona?

Pasa el mensaje de error o captura por el chat con Claude.
