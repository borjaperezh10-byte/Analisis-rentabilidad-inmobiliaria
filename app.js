// =========================================================================
// ANÁLISIS INMOBILIARIO · DASHBOARD
// =========================================================================
// Frontend puro: HTML/CSS/JS. Sin dependencias.
// La contraseña se valida en cliente — protege contra accesos casuales.

const PASSWORD = 'talavera2026';
const STORAGE_KEY = 'inv_inmobil_auth_v1';

// ---- HELPERS DE FORMATO ----
const fmt = {
    eur: (v) => v == null ? '—' : new Intl.NumberFormat('es-ES', {
        style: 'currency', currency: 'EUR', maximumFractionDigits: 0
    }).format(v),
    eurDec: (v) => v == null ? '—' : new Intl.NumberFormat('es-ES', {
        style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(v),
    pct: (v) => v == null ? '—' : (v >= 0 ? '+' : '') +
        new Intl.NumberFormat('es-ES', {
            style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 2
        }).format(v),
    pctNoSign: (v) => v == null ? '—' :
        new Intl.NumberFormat('es-ES', {
            style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2
        }).format(v),
    int: (v) => v == null ? '—' : new Intl.NumberFormat('es-ES').format(Math.round(v)),
    em2: (v) => v == null ? '—' : `${fmt.int(v)} €/m²`,
    m2: (v) => v == null ? '—' : `${v} m²`,
    date: (v) => {
        if (!v) return '—';
        const d = new Date(v);
        return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    },
};

// ---- ESTADO ----
let state = {
    data: null,           // datos completos (json + cambios locales aplicados)
    rawData: null,        // datos del json sin modificar
    activeView: 'viviendas',
    activeFilter: 'all',
    sortBy: 'fechaAnalisis',
    activeCity: null,     // slug de la ciudad activa
};

// ---- ALMACENAMIENTO LOCAL ----
const LOCAL_KEYS = {
    deleted: 'inv_inmobil_deleted_v1',     // array de IDs eliminadas
    pendientes: 'inv_inmobil_pendientes_v1', // array de URLs pendientes
};

const localData = {
    getDeleted: () => {
        try { return JSON.parse(localStorage.getItem(LOCAL_KEYS.deleted) || '[]'); }
        catch { return []; }
    },
    setDeleted: (arr) => localStorage.setItem(LOCAL_KEYS.deleted, JSON.stringify(arr)),
    addDeleted: (id) => {
        const arr = localData.getDeleted();
        if (!arr.includes(id)) {
            arr.push(id);
            localData.setDeleted(arr);
        }
    },
    getPendientes: () => {
        try { return JSON.parse(localStorage.getItem(LOCAL_KEYS.pendientes) || '[]'); }
        catch { return []; }
    },
    setPendientes: (arr) => localStorage.setItem(LOCAL_KEYS.pendientes, JSON.stringify(arr)),
    addPendientes: (urls) => {
        const existing = new Set(localData.getPendientes());
        urls.forEach(u => existing.add(u));
        localData.setPendientes([...existing]);
    },
    clearAll: () => {
        localStorage.removeItem(LOCAL_KEYS.deleted);
        localStorage.removeItem(LOCAL_KEYS.pendientes);
    },
};

// ---- TOAST ----
function toast(message, type = 'default') {
    let el = document.getElementById('toast-el');
    if (!el) {
        el = document.createElement('div');
        el.id = 'toast-el';
        el.className = 'toast';
        document.body.appendChild(el);
    }
    el.className = `toast ${type}`;
    el.textContent = message;
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2400);
}

// =========================================================================
// AUTENTICACIÓN
// =========================================================================
function checkAuth() {
    return sessionStorage.getItem(STORAGE_KEY) === 'ok';
}

function setupLogin() {
    const overlay = document.getElementById('login-overlay');
    const form = document.getElementById('login-form');
    const input = document.getElementById('login-input');
    const errEl = document.getElementById('login-error');

    if (checkAuth()) {
        overlay.classList.add('hidden');
        showApp();
        return;
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const val = input.value.trim();
        if (val === PASSWORD) {
            sessionStorage.setItem(STORAGE_KEY, 'ok');
            overlay.classList.add('hidden');
            showApp();
        } else {
            errEl.textContent = 'Contraseña incorrecta';
            input.value = '';
            input.focus();
            input.style.borderColor = 'var(--red)';
            setTimeout(() => { input.style.borderColor = ''; errEl.textContent = ''; }, 2000);
        }
    });
}

function showApp() {
    document.getElementById('app').classList.remove('hidden');
    loadData();
}

// =========================================================================
// CARGA DE DATOS
// =========================================================================
async function loadData() {
    try {
        const res = await fetch('data.json?t=' + Date.now());
        if (!res.ok) throw new Error('No se pudo cargar data.json');
        state.rawData = await res.json();
        applyLocalChanges();
        renderAll();
        setupNavigation();
        setupFilters();
        setupActions();
    } catch (err) {
        console.error(err);
        document.getElementById('grid-viviendas').innerHTML =
            `<p style="color:var(--red);padding:40px;text-align:center;">Error al cargar los datos: ${err.message}</p>`;
    }
}

// Aplica eliminaciones locales y guarda pendientes
function applyLocalChanges() {
    const deleted = new Set(localData.getDeleted());
    state.data = JSON.parse(JSON.stringify(state.rawData)); // deep clone
    state.data.viviendas = state.data.viviendas.filter(v => !deleted.has(v.id));

    // Inicializar ciudad activa si no está
    if (!state.activeCity) {
        // 1) intentar localStorage
        const savedCity = localStorage.getItem('inv_active_city');
        if (savedCity && state.data.ciudades?.some(c => c.slug === savedCity)) {
            state.activeCity = savedCity;
        }
        // 2) usar la default del JSON
        else if (state.data.meta?.ciudadActivaPorDefecto) {
            state.activeCity = state.data.meta.ciudadActivaPorDefecto;
        }
        // 3) primera ciudad disponible
        else if (state.data.ciudades?.length > 0) {
            state.activeCity = state.data.ciudades[0].slug;
        }
    }
}

// Devuelve la ciudad activa completa (objeto con slug, nombre, benchmarks, criterios...)
function getActiveCity() {
    if (!state.data?.ciudades) return null;
    return state.data.ciudades.find(c => c.slug === state.activeCity) || state.data.ciudades[0];
}

// =========================================================================
// NAVEGACIÓN
// =========================================================================
function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            switchView(view);
        });
    });
}

function switchView(view) {
    state.activeView = view;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =========================================================================
// FILTROS Y ORDENACIÓN
// =========================================================================
function setupFilters() {
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.activeFilter = chip.dataset.filter;
            renderViviendas();
        });
    });

    document.getElementById('sort-select').addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        renderViviendas();
    });
}

// =========================================================================
// ACCIONES (pegar URLs, eliminar, exportar, reset)
// =========================================================================
function setupActions() {
    // Mostrar/ocultar panel de pegar URLs
    const inbox = document.getElementById('inbox-panel');
    document.getElementById('btn-add-urls').addEventListener('click', () => {
        // Cerrar el otro panel si está abierto
        document.getElementById('import-panel').classList.add('hidden');
        inbox.classList.toggle('hidden');
        if (!inbox.classList.contains('hidden')) {
            document.getElementById('inbox-textarea').focus();
        }
    });
    document.getElementById('btn-inbox-close').addEventListener('click', () => inbox.classList.add('hidden'));

    // Procesar URLs pegadas
    document.getElementById('btn-inbox-add').addEventListener('click', addPendientes);

    // Copiar lista de pendientes
    document.getElementById('btn-copy-pendientes').addEventListener('click', copyPendientes);

    // Limpiar pendientes
    document.getElementById('btn-clear-pendientes').addEventListener('click', () => {
        if (!confirm('¿Eliminar todas las URLs pendientes? Esta acción no se puede deshacer.')) return;
        localData.setPendientes([]);
        renderPendientes();
        toast('Pendientes vaciados', 'success');
    });

    // Exportar JSON
    document.getElementById('btn-export').addEventListener('click', exportData);

    // Reset cambios locales
    document.getElementById('btn-reset-local').addEventListener('click', () => {
        const deleted = localData.getDeleted();
        const pendientes = localData.getPendientes();
        if (deleted.length === 0 && pendientes.length === 0) {
            toast('No hay cambios locales que limpiar');
            return;
        }
        const msg = `Vas a eliminar ${deleted.length} eliminación(es) y ${pendientes.length} pendiente(s) guardadas localmente.\n\n¿Continuar?`;
        if (!confirm(msg)) return;
        localData.clearAll();
        applyLocalChanges();
        renderAll();
        toast('Cambios locales eliminados', 'success');
    });

    // Configuración GitHub e importar
    setupConfigView();
    setupImportPanel();
    setupCalculadora();
    updateGitHubStatusIndicator();
}

// Extrae IDs únicos de Idealista de un texto pegado
function extractIdealistaUrls(text) {
    const re = /idealista\.com\/inmueble\/(\d+)/g;
    const ids = new Set();
    let m;
    while ((m = re.exec(text)) !== null) {
        ids.add(m[1]);
    }
    return [...ids].map(id => `https://www.idealista.com/inmueble/${id}/`);
}

function addPendientes() {
    const textarea = document.getElementById('inbox-textarea');
    const status = document.getElementById('inbox-status');
    const text = textarea.value.trim();

    if (!text) {
        status.textContent = 'Pega al menos una URL';
        status.className = 'inbox-status error';
        return;
    }

    const urls = extractIdealistaUrls(text);
    if (urls.length === 0) {
        status.textContent = 'No se han detectado URLs de Idealista válidas';
        status.className = 'inbox-status error';
        return;
    }

    // Filtrar las que ya están analizadas (en data) o ya pendientes
    const existingIds = new Set(state.data.viviendas.map(v => v.id));
    const existingPendientes = new Set(localData.getPendientes());

    const nuevas = [];
    const yaAnalizadas = [];
    const yaPendientes = [];

    for (const url of urls) {
        const id = url.match(/inmueble\/(\d+)/)[1];
        if (existingIds.has(id)) {
            yaAnalizadas.push(id);
        } else if (existingPendientes.has(url)) {
            yaPendientes.push(id);
        } else {
            nuevas.push(url);
        }
    }

    if (nuevas.length > 0) {
        localData.addPendientes(nuevas);
        textarea.value = '';
        let msg = `${nuevas.length} URL${nuevas.length > 1 ? 's' : ''} añadida${nuevas.length > 1 ? 's' : ''}`;
        if (yaAnalizadas.length > 0) msg += ` · ${yaAnalizadas.length} ya analizada${yaAnalizadas.length > 1 ? 's' : ''}`;
        if (yaPendientes.length > 0) msg += ` · ${yaPendientes.length} ya pendiente${yaPendientes.length > 1 ? 's' : ''}`;
        status.textContent = msg;
        status.className = 'inbox-status success';
        renderPendientes();
        toast(`${nuevas.length} pendiente${nuevas.length > 1 ? 's' : ''} añadida${nuevas.length > 1 ? 's' : ''}`, 'success');
    } else {
        let msg = '';
        if (yaAnalizadas.length > 0) msg += `${yaAnalizadas.length} ya analizada${yaAnalizadas.length > 1 ? 's' : ''}`;
        if (yaPendientes.length > 0) msg += (msg ? ' · ' : '') + `${yaPendientes.length} ya pendiente${yaPendientes.length > 1 ? 's' : ''}`;
        status.textContent = msg || 'Nada nuevo';
        status.className = 'inbox-status';
    }
}

function copyPendientes() {
    const pendientes = localData.getPendientes();
    if (pendientes.length === 0) {
        toast('No hay pendientes', 'error');
        return;
    }
    const text = pendientes.join('\n');
    navigator.clipboard.writeText(text).then(
        () => toast(`${pendientes.length} URL${pendientes.length > 1 ? 's' : ''} copiada${pendientes.length > 1 ? 's' : ''}`, 'success'),
        () => toast('No se pudo copiar', 'error')
    );
}

function exportData() {
    // Exporta el estado actual (data.json modificado) como descarga
    const exportPayload = {
        ...state.rawData,
        meta: {
            ...state.rawData.meta,
            exportedAt: new Date().toISOString(),
            exportedFrom: 'dashboard',
        },
        _localState: {
            deleted: localData.getDeleted(),
            pendientes: localData.getPendientes(),
        },
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inversiones_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('JSON descargado', 'success');
}

function deleteVivienda(id) {
    const v = state.rawData.viviendas.find(x => x.id === id);
    if (!v) return;
    if (!confirm(`¿Eliminar "${v.titulo}" del dashboard?\n\nLa vivienda quedará oculta localmente. Para volver a verla, usa "Reset local".`)) return;
    localData.addDeleted(id);
    applyLocalChanges();
    renderAll();
    toast('Vivienda eliminada', 'success');
}

function renderPendientes() {
    const pendientes = localData.getPendientes();
    const section = document.getElementById('pendientes-section');
    const list = document.getElementById('pendientes-list');
    const count = document.getElementById('pendientes-count');

    if (pendientes.length === 0) {
        section.classList.add('hidden');
        return;
    }
    section.classList.remove('hidden');
    count.textContent = pendientes.length;
    list.innerHTML = pendientes.map(url => {
        const id = (url.match(/inmueble\/(\d+)/) || [])[1] || '?';
        return `
            <div class="pendiente-item">
                <span class="pendiente-url"><a href="${url}" target="_blank" rel="noopener">${url}</a></span>
                <button class="btn-icon" onclick="removePendiente('${url.replace(/'/g, "\\'")}')" aria-label="Eliminar URL">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        `;
    }).join('');
}

function removePendiente(url) {
    const arr = localData.getPendientes().filter(u => u !== url);
    localData.setPendientes(arr);
    renderPendientes();
}
window.removePendiente = removePendiente;

function getFilteredViviendas() {
    let viviendas = [...state.data.viviendas];

    // Filtrar por ciudad activa
    if (state.activeCity) {
        viviendas = viviendas.filter(v => {
            // Si la vivienda tiene ciudadSlug, comparar; si no, asignar por localidad
            if (v.ciudadSlug) return v.ciudadSlug === state.activeCity;
            // Compatibilidad: viviendas antiguas sin ciudadSlug
            const ciudad = getActiveCity();
            if (!ciudad) return false;
            return (v.localidad || '').toLowerCase().includes(ciudad.nombre.toLowerCase().split(' ')[0].toLowerCase());
        });
    }

    if (state.activeFilter !== 'all') {
        viviendas = viviendas.filter(v => v.filtros.verdict === state.activeFilter);
    }

    viviendas.sort((a, b) => {
        switch (state.sortBy) {
            case 'fechaAnalisis':
                return (b.fechaAnalisis || '').localeCompare(a.fechaAnalisis || '');
            case 'cashflow':           return (b.calculo.cashflowAnual ?? -Infinity) - (a.calculo.cashflowAnual ?? -Infinity);
            case 'rentabilidadBruta':  return (b.calculo.rentabilidadBruta ?? 0) - (a.calculo.rentabilidadBruta ?? 0);
            case 'margenSeguridad':    return (b.calculo.margenSeguridadPct ?? -Infinity) - (a.calculo.margenSeguridadPct ?? -Infinity);
            case 'precio':             return (a.datos.precio ?? Infinity) - (b.datos.precio ?? Infinity);
            case 'em2':                return (a.datos.precio / a.datos.m2Construidos) - (b.datos.precio / b.datos.m2Construidos);
            case 'multiplo':           return (a.calculo.multiplo ?? Infinity) - (b.calculo.multiplo ?? Infinity);
            default: return 0;
        }
    });
    return viviendas;
}

// =========================================================================
// RENDER PRINCIPAL
// =========================================================================
function renderAll() {
    setupCitySelector();
    document.getElementById('lastUpdated').textContent = `Actualizado ${fmt.date(state.data.meta.lastUpdated)}`;
    renderViviendas();
    renderPendientes();
    renderBenchmarks();
    renderCriterios();
}

function setupCitySelector() {
    const sel = document.getElementById('city-selector');
    if (!sel) return;
    const ciudades = state.data.ciudades || [];
    sel.innerHTML = ciudades.map(c =>
        `<option value="${c.slug}" ${c.slug === state.activeCity ? 'selected' : ''}>${c.nombre}</option>`
    ).join('');
    sel.onchange = (e) => {
        state.activeCity = e.target.value;
        localStorage.setItem('inv_active_city', state.activeCity);
        renderViviendas();
        renderBenchmarks();
        renderCriterios();
    };
}

// ---- VISTA VIVIENDAS ----
function renderViviendas() {
    // Solo las de la ciudad activa para los KPIs
    let cityViviendas = state.data.viviendas;
    if (state.activeCity) {
        cityViviendas = cityViviendas.filter(v => {
            if (v.ciudadSlug) return v.ciudadSlug === state.activeCity;
            const ciudad = getActiveCity();
            if (!ciudad) return false;
            return (v.localidad || '').toLowerCase().includes(ciudad.nombre.toLowerCase().split(' ')[0].toLowerCase());
        });
    }
    const counts = {
        total: cityViviendas.length,
        pass: cityViviendas.filter(v => v.filtros.verdict === 'pass').length,
        warn: cityViviendas.filter(v => v.filtros.verdict === 'warning').length,
        fail: cityViviendas.filter(v => v.filtros.verdict === 'fail').length,
    };
    document.getElementById('kpi-total').textContent = counts.total;
    document.getElementById('kpi-pass').textContent  = counts.pass;
    document.getElementById('kpi-warn').textContent  = counts.warn;
    document.getElementById('kpi-fail').textContent  = counts.fail;

    const filtered = getFilteredViviendas();
    const grid = document.getElementById('grid-viviendas');
    if (filtered.length === 0) {
        grid.innerHTML = `<p style="color:var(--ink-muted);padding:40px;text-align:center;grid-column:1/-1;">Sin resultados con este filtro</p>`;
        return;
    }
    grid.innerHTML = filtered.map(v => renderCard(v)).join('');
    grid.querySelectorAll('.card').forEach(c => {
        c.addEventListener('click', (e) => {
            const delBtn = e.target.closest('.card-delete');
            if (delBtn) {
                e.stopPropagation();
                deleteVivienda(delBtn.dataset.id);
                return;
            }
            if (e.target.closest('.card-link')) return;
            openModal(c.dataset.id);
        });
    });
}

function renderCard(v) {
    const verdict = v.filtros.verdict;
    const verdictText = {
        pass: '✓ Pasa filtro',
        warning: '~ Zona gris',
        fail: '✗ Descartada',
    }[verdict];
    const em2 = Math.round(v.datos.precio / v.datos.m2Construidos);
    const cashflow = v.calculo.cashflowAnual;
    const rb = v.calculo.rentabilidadBruta;
    const ms = v.calculo.margenSeguridadPct;

    const cfClass = cashflow >= 0 ? 'pos' : 'neg';
    const msClass = ms >= 0.25 ? 'pos' : ms >= 0 ? '' : 'neg';

    // Texto del motivo (solo para warning y fail)
    // Construir motivo legible a partir de verdictRazones (array) o verdictTexto (string)
    let motivoBloque = '';
    if (verdict === 'warning' || verdict === 'fail') {
        let motivoStr = '';
        if (Array.isArray(v.filtros.verdictRazones) && v.filtros.verdictRazones.length > 0) {
            motivoStr = v.filtros.verdictRazones.join(' · ');
        } else if (v.filtros.verdictTexto) {
            motivoStr = v.filtros.verdictTexto;
        }
        if (motivoStr) {
            // Truncar visual a ~140 caracteres (2 líneas aprox)
            const display = motivoStr.length > 140 ? motivoStr.slice(0, 137) + '…' : motivoStr;
            motivoBloque = `<div class="card-verdict-reason">${display}</div>`;
        }
    }

    return `
        <article class="card verdict-${verdict}" data-id="${v.id}">
            <button class="card-delete" data-action="delete" data-id="${v.id}" aria-label="Eliminar vivienda" title="Eliminar de mi lista">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div class="card-head">
                <div>
                    <h3 class="card-title">${v.titulo}</h3>
                    <p class="card-zone">${v.localidad} · ${v.zona}</p>
                </div>
                <span class="card-verdict">${verdictText}</span>
            </div>
            ${motivoBloque}
            <div class="card-price-block">
                <div>
                    <span class="card-price">${fmt.eur(v.datos.precio)}</span>
                </div>
                <div class="card-price-meta">
                    <strong>${fmt.em2(em2)}</strong><br>
                    ${v.datos.m2Construidos} m² · ${v.datos.habitaciones} hab
                </div>
            </div>
            <div class="card-stats">
                <div class="card-stat">
                    <span class="card-stat-label">Cashflow anual</span>
                    <span class="card-stat-value ${cfClass}">${fmt.eur(cashflow)}</span>
                </div>
                <div class="card-stat">
                    <span class="card-stat-label">Rent. bruta</span>
                    <span class="card-stat-value">${fmt.pctNoSign(rb)}</span>
                </div>
                <div class="card-stat">
                    <span class="card-stat-label">Alquiler est.</span>
                    <span class="card-stat-value">${fmt.eur(v.estimaciones.alquilerMensual)}</span>
                </div>
                <div class="card-stat">
                    <span class="card-stat-label">Margen seg.</span>
                    <span class="card-stat-value ${msClass}">${fmt.pct(ms)}</span>
                </div>
            </div>
            <div class="card-footer">
                <span class="card-quality">Calidad: <strong>${v.calculo.calidadInversion}</strong> · Múlt. ${v.calculo.multiplo}</span>
                <a href="${v.url}" target="_blank" rel="noopener" class="card-link">Idealista →</a>
            </div>
        </article>
    `;
}

// =========================================================================
// MODAL DE DETALLE
// =========================================================================
function openModal(id) {
    const v = state.data.viviendas.find(x => x.id === id);
    if (!v) return;
    const overlay = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    body.innerHTML = renderModalContent(v);
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'modal-overlay') closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
});

function renderModalContent(v) {
    const verdict = v.filtros.verdict;
    const verdictText = { pass: '✓ Pasa filtro', warning: '~ Zona gris', fail: '✗ Descartada' }[verdict];
    const c = v.calculo;
    const e = v.estimaciones;
    const d = v.datos;
    const em2 = Math.round(d.precio / d.m2Construidos);

    const sign = (n) => n >= 0 ? 'pos' : 'neg';

    return `
    <div class="modal-content">
        <span class="modal-verdict-banner verdict-${verdict}">${verdictText}</span>
        <h2 class="modal-title">${v.titulo}</h2>
        <p class="modal-subtitle">${v.localidad} · ${v.zona} · Ref ${v.id}</p>
        <a href="${v.url}" target="_blank" rel="noopener" class="modal-link">Ver en Idealista →</a>

        <div class="modal-section">
            <h3 class="modal-section-title">Datos del inmueble</h3>
            <div class="modal-grid">
                <div class="modal-item"><span class="modal-item-label">Precio</span><span class="modal-item-value big">${fmt.eur(d.precio)}</span></div>
                <div class="modal-item"><span class="modal-item-label">€/m²</span><span class="modal-item-value big">${fmt.em2(em2)}</span></div>
                <div class="modal-item"><span class="modal-item-label">Tipo</span><span class="modal-item-value">${d.tipo || '—'}</span></div>
                <div class="modal-item"><span class="modal-item-label">m² construidos</span><span class="modal-item-value">${d.m2Construidos || '—'}</span></div>
                <div class="modal-item"><span class="modal-item-label">m² útiles</span><span class="modal-item-value">${d.m2Utiles || '—'}</span></div>
                <div class="modal-item"><span class="modal-item-label">Habitaciones</span><span class="modal-item-value">${d.habitaciones || '—'}</span></div>
                <div class="modal-item"><span class="modal-item-label">Baños</span><span class="modal-item-value">${d.banos || '—'}</span></div>
                <div class="modal-item"><span class="modal-item-label">Año</span><span class="modal-item-value">${d.ano || 'No indicado'}</span></div>
                <div class="modal-item"><span class="modal-item-label">Planta</span><span class="modal-item-value">${d.planta || '—'}</span></div>
                <div class="modal-item"><span class="modal-item-label">Calefacción</span><span class="modal-item-value">${d.calefaccion || '—'}</span></div>
                <div class="modal-item"><span class="modal-item-label">Aire acond.</span><span class="modal-item-value">${d.aireAcondicionado ? 'Sí' : 'No'}</span></div>
                <div class="modal-item"><span class="modal-item-label">Comunidad/mes</span><span class="modal-item-value">${fmt.eur(d.comunidadMes)}</span></div>
                ${d.bajadaPrecio ? `<div class="modal-item"><span class="modal-item-label">Bajada precio</span><span class="modal-item-value pos">${fmt.pct(-d.bajadaPrecio)}</span></div>` : ''}
            </div>
        </div>

        <div class="modal-section">
            <h3 class="modal-section-title">Posicionamiento de mercado</h3>
            <div class="benchmarks-bar">
                <div class="bench-pill">
                    <div class="bench-pill-label">vs €/m² RealAdvisor</div>
                    <div class="bench-pill-value ${v.filtros.vsRA == null ? '' : v.filtros.vsRA <= 0 ? 'pos' : 'neg'}">${v.filtros.vsRA == null ? 'n/a' : fmt.pct(v.filtros.vsRA)}</div>
                </div>
                <div class="bench-pill">
                    <div class="bench-pill-label">vs €/m² BestYieldFinder</div>
                    <div class="bench-pill-value ${v.filtros.vsBYF == null ? '' : v.filtros.vsBYF <= 0 ? 'pos' : 'neg'}">${v.filtros.vsBYF == null ? 'n/a' : fmt.pct(v.filtros.vsBYF)}</div>
                </div>
            </div>
        </div>

        <div class="modal-section">
            <h3 class="modal-section-title">Estimaciones del cálculo</h3>
            <div class="modal-grid">
                <div class="modal-item"><span class="modal-item-label">Alquiler mensual</span><span class="modal-item-value">${fmt.eur(e.alquilerMensual)}</span></div>
                <div class="modal-item"><span class="modal-item-label">IBI anual</span><span class="modal-item-value">${fmt.eur(e.ibi)}</span></div>
                <div class="modal-item"><span class="modal-item-label">Vacancia</span><span class="modal-item-value">${fmt.pctNoSign(e.vacancia)}</span></div>
                <div class="modal-item"><span class="modal-item-label">Mantenimiento</span><span class="modal-item-value">${fmt.pctNoSign(e.mantenimiento)}</span></div>
            </div>
            ${e.alquilerNotas ? `<p style="margin-top:14px;font-size:13px;color:var(--ink-muted);font-style:italic;">${e.alquilerNotas}</p>` : ''}
        </div>

        <div class="modal-section">
            <h3 class="modal-section-title">Inversión y financiación</h3>
            <div class="modal-grid">
                <div class="modal-item"><span class="modal-item-label">Coste total</span><span class="modal-item-value big">${fmt.eur(c.costeTotal)}</span></div>
                <div class="modal-item"><span class="modal-item-label">Capital propio</span><span class="modal-item-value big">${fmt.eur(c.capitalPropio)}</span></div>
                <div class="modal-item"><span class="modal-item-label">Cuota mensual</span><span class="modal-item-value">${fmt.eurDec(c.cuotaMensual)}</span></div>
                <div class="modal-item"><span class="modal-item-label">Cuota anual</span><span class="modal-item-value">${fmt.eur(c.cuotaAnual)}</span></div>
                <div class="modal-item"><span class="modal-item-label">Amortiz. año 1</span><span class="modal-item-value">${fmt.eur(c.amortizacionAno1)}</span></div>
                <div class="modal-item"><span class="modal-item-label">Intereses año 1</span><span class="modal-item-value">${fmt.eur(c.interesesAno1)}</span></div>
            </div>
        </div>

        <div class="modal-section">
            <h3 class="modal-section-title">Resultados anuales</h3>
            <div class="modal-grid">
                <div class="modal-item"><span class="modal-item-label">Ingresos</span><span class="modal-item-value">${fmt.eur(c.ingresosAnuales)}</span></div>
                <div class="modal-item"><span class="modal-item-label">Gastos</span><span class="modal-item-value neg">${fmt.eur(-c.gastosAnuales)}</span></div>
                <div class="modal-item"><span class="modal-item-label">IRPF</span><span class="modal-item-value ${sign(-c.irpfAnual)}">${fmt.eur(-c.irpfAnual)}</span></div>
                <div class="modal-item"><span class="modal-item-label">Beneficio neto</span><span class="modal-item-value">${fmt.eur(c.beneficioNeto)}</span></div>
                <div class="modal-item"><span class="modal-item-label">Cashflow</span><span class="modal-item-value big ${sign(c.cashflowAnual)}">${fmt.eur(c.cashflowAnual)}</span></div>
            </div>
        </div>

        <div class="modal-section">
            <h3 class="modal-section-title">Rentabilidades</h3>
            <div class="modal-grid">
                <div class="modal-item"><span class="modal-item-label">Bruta</span><span class="modal-item-value">${fmt.pctNoSign(c.rentabilidadBruta)}</span></div>
                <div class="modal-item"><span class="modal-item-label">Neta (post-IRPF)</span><span class="modal-item-value">${fmt.pctNoSign(c.rentabilidadNeta)}</span></div>
                <div class="modal-item"><span class="modal-item-label">Por flujo de caja</span><span class="modal-item-value ${sign(c.rentabilidadFlujoCaja)}">${fmt.pct(c.rentabilidadFlujoCaja)}</span></div>
                <div class="modal-item"><span class="modal-item-label">Por pago de deuda</span><span class="modal-item-value pos">${fmt.pct(c.rentabilidadPagoDeuda)}</span></div>
                <div class="modal-item"><span class="modal-item-label">Por inflación</span><span class="modal-item-value pos">${fmt.pct(c.rentabilidadInflacion)}</span></div>
                <div class="modal-item"><span class="modal-item-label">TOTAL</span><span class="modal-item-value big ${sign(c.rentabilidadTotal)}">${fmt.pct(c.rentabilidadTotal)}</span></div>
                <div class="modal-item"><span class="modal-item-label">ROCE</span><span class="modal-item-value ${sign(c.roce)}">${fmt.pct(c.roce)}</span></div>
                <div class="modal-item"><span class="modal-item-label">Múltiplo</span><span class="modal-item-value">${c.multiplo}</span></div>
                <div class="modal-item"><span class="modal-item-label">Calidad</span><span class="modal-item-value">${c.calidadInversion}</span></div>
                <div class="modal-item"><span class="modal-item-label">Mín. alquiler</span><span class="modal-item-value">${fmt.eur(c.minimoAlquiler)}</span></div>
                <div class="modal-item"><span class="modal-item-label">Margen seguridad</span><span class="modal-item-value big ${c.margenSeguridadPct >= 0.25 ? 'pos' : c.margenSeguridadPct >= 0 ? '' : 'neg'}">${fmt.pct(c.margenSeguridadPct)}</span></div>
            </div>
        </div>

        ${v.notas ? `
        <div class="modal-section">
            <h3 class="modal-section-title">Notas del analista</h3>
            <div class="modal-notes">${v.notas}</div>
        </div>` : ''}
    </div>
    `;
}

// =========================================================================
// VISTA BENCHMARKS
// =========================================================================
function renderBenchmarks() {
    const ciudad = getActiveCity();
    const benchView = document.getElementById('view-benchmarks');
    if (!ciudad || !ciudad.benchmarks) {
        // Mostrar mensaje de "no hay benchmarks para esta ciudad"
        const noBenchHTML = `
            <div class="view-header">
                <h2 class="view-title">Benchmarks · ${ciudad ? ciudad.nombre : '—'}</h2>
                <p class="view-sub">Datos de referencia del mercado</p>
            </div>
            <div class="bench-card" style="text-align:center;padding:60px 32px;">
                <h3 style="font-family:var(--font-display);font-weight:500;font-size:22px;letter-spacing:-0.01em;margin-bottom:8px;">Sin benchmarks para esta ciudad</h3>
                <p style="color:var(--ink-muted);font-size:14px;max-width:520px;margin:0 auto;line-height:1.6;">
                    Aún no se han cargado datos de referencia para <strong>${ciudad ? ciudad.nombre : 'esta ubicación'}</strong>.
                    ${ciudad && ciudad.nota ? '<br><br><em>' + ciudad.nota + '</em>' : ''}
                    <br><br>Pídele a Claude los benchmarks (Real Advisor + BestYieldFinder) y un documento de criterios para esta ciudad.
                </p>
            </div>
        `;
        benchView.innerHTML = noBenchHTML;
        return;
    }

    // Si la vista no tiene la estructura interna (porque antes mostramos "sin benchmarks"), reconstruirla
    if (!document.getElementById('ra-em2')) {
        benchView.innerHTML = buildBenchmarksTemplate(ciudad.nombre);
    }

    const b = ciudad.benchmarks;
    const ra = b.fuentes.realAdvisor;
    const byf = b.fuentes.bestYieldFinder;

    // Actualizar título por si la ciudad cambió
    const titleEl = benchView.querySelector('.view-title');
    if (titleEl) titleEl.textContent = `Benchmarks · ${ciudad.nombre}`;

    document.getElementById('ra-em2').textContent = fmt.em2(ra.em2Mediano);
    document.getElementById('ra-precio').textContent = fmt.eur(ra.precioMediano);
    document.getElementById('ra-alq').textContent = fmt.eur(ra.alquilerMediano) + '/mes';
    document.getElementById('byf-em2').textContent = fmt.em2(byf.em2Mediano);
    document.getElementById('byf-precio').textContent = fmt.eur(byf.precioMediano);
    document.getElementById('byf-alq').textContent = fmt.eur(byf.alquilerMediano) + '/mes';

    // Tamaños
    const tamanoEl = document.getElementById('bench-tamano');
    const maxRent = Math.max(...byf.rentabilidadPorTamano.map(t => t.rentabilidad));
    tamanoEl.innerHTML = byf.rentabilidadPorTamano.map(t => {
        const pct = (t.rentabilidad / maxRent) * 100;
        return `
            <div class="size-bar ${t.destacado ? 'highlight' : ''}">
                <span class="size-bar-label">${t.rango}</span>
                <div class="size-bar-track"><div class="size-bar-fill" style="width:${pct}%"></div></div>
                <span class="size-bar-value">${fmt.pctNoSign(t.rentabilidad)}</span>
                <span class="size-bar-em2">${fmt.em2(t.em2)}</span>
            </div>
        `;
    }).join('');

    // Calles
    const callesEl = document.getElementById('bench-calles');
    callesEl.innerHTML = b.callesEnPrecio.map(c => `
        <div class="calle-item">
            <span class="calle-item-name">${c.calle}</span>
            <span class="calle-item-em2">${fmt.em2(c.em2)}</span>
        </div>
    `).join('');

    // Catalizadores
    const catEl = document.getElementById('bench-catalizadores');
    catEl.innerHTML = b.catalizadores.map(c => `
        <div class="catalizador">
            <h4>${c.nombre}</h4>
            <div class="catalizador-loc">${c.ubicacion}</div>
            <div class="catalizador-state">${c.estado}</div>
            <div class="catalizador-impact">${c.impacto}</div>
        </div>
    `).join('');

    // Scoring
    const scoreEl = document.getElementById('bench-scoring');
    const score = byf.scoring;
    scoreEl.innerHTML = `
        <div class="score-box"><div class="score-value">${score.general}</div><div class="score-label">General</div></div>
        <div class="score-box"><div class="score-value">${score.potencialInversion}</div><div class="score-label">Potencial inversión</div></div>
        <div class="score-box"><div class="score-value">${score.demandaAlquiler}</div><div class="score-label">Demanda alquiler</div></div>
        <div class="score-box"><div class="score-value">${score.demandaCompra}</div><div class="score-label">Demanda compra</div></div>
        <div class="score-box"><div class="score-value">${score.momentumPrecio}</div><div class="score-label">Momentum precio</div></div>
    `;
}

// Template del cuerpo de Benchmarks para reconstruir si fue reemplazado
function buildBenchmarksTemplate(nombreCiudad) {
    return `
        <div class="view-header">
            <h2 class="view-title">Benchmarks · ${nombreCiudad}</h2>
            <p class="view-sub">Datos de referencia del mercado</p>
        </div>
        <section class="bench-card">
            <h3 class="bench-card-title">Comparativa de fuentes</h3>
            <p class="bench-card-sub">La verdad del mercado está entre las dos</p>
            <div class="source-grid">
                <div class="source-box source-ra">
                    <span class="source-tag">RealAdvisor</span>
                    <p class="source-desc">Transacciones reales, conservador</p>
                    <div class="source-metrics">
                        <div><span>€/m² piso</span><strong id="ra-em2">—</strong></div>
                        <div><span>Precio mediano</span><strong id="ra-precio">—</strong></div>
                        <div><span>Alquiler mediano</span><strong id="ra-alq">—</strong></div>
                    </div>
                </div>
                <div class="source-box source-byf">
                    <span class="source-tag">BestYieldFinder</span>
                    <p class="source-desc">Anuncios publicados, optimista</p>
                    <div class="source-metrics">
                        <div><span>€/m² piso</span><strong id="byf-em2">—</strong></div>
                        <div><span>Precio mediano</span><strong id="byf-precio">—</strong></div>
                        <div><span>Alquiler mediano</span><strong id="byf-alq">—</strong></div>
                    </div>
                </div>
            </div>
        </section>
        <section class="bench-card">
            <h3 class="bench-card-title">Rentabilidad bruta por tamaño</h3>
            <p class="bench-card-sub">Fuente: BestYieldFinder · sweet spot resaltado</p>
            <div id="bench-tamano" class="size-bars"></div>
        </section>
        <section class="bench-card">
            <h3 class="bench-card-title">Calles "en precio"</h3>
            <p class="bench-card-sub">Filtra tu búsqueda por estas calles para aumentar probabilidad de éxito</p>
            <div id="bench-calles" class="calles-grid"></div>
        </section>
        <section class="bench-card">
            <h3 class="bench-card-title">Catalizadores de demanda</h3>
            <p class="bench-card-sub">Factores estructurales que mueven el mercado</p>
            <div id="bench-catalizadores" class="catalizadores-grid"></div>
        </section>
        <section class="bench-card">
            <h3 class="bench-card-title">Puntuación del mercado</h3>
            <p class="bench-card-sub">Fuente: BestYieldFinder · escala 0-100</p>
            <div id="bench-scoring" class="scoring-grid"></div>
        </section>
    `;
}

// =========================================================================
// VISTA CRITERIOS
// =========================================================================
function renderCriterios() {
    const ciudad = getActiveCity();
    const view = document.getElementById('view-criterios');
    const titleEl = view.querySelector('.view-title');
    if (titleEl) titleEl.textContent = `Criterios · ${ciudad ? ciudad.nombre : ''}`;

    if (!ciudad || !ciudad.benchmarks || !ciudad.benchmarks.criterios) {
        // Solo mostrar la sección de filosofía y parámetros
        const criteriosEl = document.getElementById('criterios-talavera');
        if (criteriosEl) {
            criteriosEl.innerHTML = `<p style="color:var(--ink-muted);font-style:italic;padding:20px;text-align:center;grid-column:1/-1;">Sin criterios definidos para ${ciudad ? ciudad.nombre : 'esta ciudad'}.</p>`;
        }
        // Renderizar igualmente los parámetros generales (filosofía y params)
        renderParamsGenerales();
        return;
    }

    const cri = ciudad.benchmarks.criterios;

    const criteriosEl = document.getElementById('criterios-talavera');
    criteriosEl.innerHTML = `
        <div class="criterio-item">
            <div class="criterio-label">Tipo de inmueble</div>
            <div class="criterio-value">${cri.tipo}</div>
        </div>
        <div class="criterio-item">
            <div class="criterio-label">Tamaño</div>
            <div class="criterio-value">${cri.m2Min}–${cri.m2Max} m²</div>
        </div>
        <div class="criterio-item">
            <div class="criterio-label">Habitaciones</div>
            <div class="criterio-value">${cri.habitaciones}</div>
        </div>
        <div class="criterio-item">
            <div class="criterio-label">Año mínimo</div>
            <div class="criterio-value">${cri.anoMin}</div>
        </div>
        <div class="criterio-item">
            <div class="criterio-label">€/m² ideal</div>
            <div class="criterio-value">≤ ${fmt.int(cri.em2Ideal)} €</div>
        </div>
        <div class="criterio-item">
            <div class="criterio-label">€/m² aceptable</div>
            <div class="criterio-value">≤ ${fmt.int(cri.em2Aceptable)} €</div>
        </div>
        <div class="criterio-item">
            <div class="criterio-label">€/m² zona riesgo</div>
            <div class="criterio-value">> ${fmt.int(cri.em2Riesgo)} €</div>
        </div>
        <div class="criterio-item">
            <div class="criterio-label">Alquiler objetivo</div>
            <div class="criterio-value">${cri.alquilerObjetivoMin}–${cri.alquilerObjetivoMax} €</div>
        </div>
        <div class="criterio-item" style="grid-column:1/-1;">
            <div class="criterio-label">Zonas objetivo</div>
            <div class="criterio-value" style="font-size:14px;line-height:1.5;">${cri.zonas.join(' · ')}</div>
        </div>
    `;

    renderParamsGenerales();
}

function renderParamsGenerales() {
    const params = state.data.parametros;
    const paramsEl = document.getElementById('criterios-params');
    if (!paramsEl) return;
    paramsEl.innerHTML = `
        <div class="criterio-item">
            <div class="criterio-label">Hipoteca financiada</div>
            <div class="criterio-value">${fmt.pctNoSign(params.hipoteca.porcentajeFinanciado)}</div>
        </div>
        <div class="criterio-item">
            <div class="criterio-label">Tipo de interés</div>
            <div class="criterio-value">${fmt.pctNoSign(params.hipoteca.tipoInteres)}</div>
        </div>
        <div class="criterio-item">
            <div class="criterio-label">Plazo</div>
            <div class="criterio-value">${params.hipoteca.plazoAnos} años</div>
        </div>
        <div class="criterio-item">
            <div class="criterio-label">IRPF tramo</div>
            <div class="criterio-value">${fmt.pctNoSign(params.fiscalidad.irpfTramo)}</div>
        </div>
        <div class="criterio-item">
            <div class="criterio-label">Vacancia</div>
            <div class="criterio-value">${fmt.pctNoSign(params.estimacion.vacancia)}</div>
        </div>
        <div class="criterio-item">
            <div class="criterio-label">Mantenimiento</div>
            <div class="criterio-value">${fmt.pctNoSign(params.estimacion.mantenimiento)}</div>
        </div>
        <div class="criterio-item">
            <div class="criterio-label">Inflación</div>
            <div class="criterio-value">${fmt.pctNoSign(params.estimacion.inflacion)}</div>
        </div>
    `;
}

// =========================================================================
// INTEGRACIÓN GITHUB API
// =========================================================================
const GH_CONFIG_KEY = 'inv_inmobil_gh_config_v1';

const ghConfig = {
    get: () => {
        try {
            const raw = localStorage.getItem(GH_CONFIG_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    },
    set: (cfg) => localStorage.setItem(GH_CONFIG_KEY, JSON.stringify(cfg)),
    clear: () => localStorage.removeItem(GH_CONFIG_KEY),
    isConfigured: () => {
        const c = ghConfig.get();
        return !!(c && c.owner && c.repo && c.token);
    },
};

// API de GitHub: leer un fichero
async function ghReadFile(path) {
    const cfg = ghConfig.get();
    if (!cfg) throw new Error('GitHub no está configurado');
    const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${cfg.branch || 'main'}`;
    const res = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${cfg.token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    });
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`GitHub ${res.status}: ${txt}`);
    }
    const json = await res.json();
    // El contenido viene en base64
    const content = decodeURIComponent(escape(atob(json.content.replace(/\n/g, ''))));
    return { sha: json.sha, content, parsed: JSON.parse(content) };
}

// API de GitHub: escribir un fichero
async function ghWriteFile(path, content, sha, message) {
    const cfg = ghConfig.get();
    if (!cfg) throw new Error('GitHub no está configurado');
    const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
    const body = {
        message: message || 'Update from dashboard',
        content: btoa(unescape(encodeURIComponent(content))),
        sha: sha,
        branch: cfg.branch || 'main',
    };
    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${cfg.token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`GitHub ${res.status}: ${txt}`);
    }
    return res.json();
}

// Test: comprueba que el token tiene acceso al repo y puede leer data.json
async function ghTest() {
    const cfg = ghConfig.get();
    if (!cfg) throw new Error('Configura primero el token y el repo');
    const file = await ghReadFile('data.json');
    if (!file.parsed.viviendas) throw new Error('data.json no tiene la estructura esperada (falta "viviendas")');
    return {
        ok: true,
        viviendas: file.parsed.viviendas.length,
        sha: file.sha.slice(0, 7),
    };
}

function updateGitHubStatusIndicator() {
    const el = document.getElementById('github-status');
    if (!el) return;
    if (ghConfig.isConfigured()) {
        el.className = 'github-status connected';
        el.textContent = 'GitHub conectado';
        el.title = 'Click para ver/cambiar configuración';
        el.style.cursor = 'pointer';
        el.onclick = () => switchView('config');
    } else {
        el.className = 'github-status';
        el.textContent = 'Sin GitHub';
        el.title = 'Configura el token para subir cambios automáticamente';
        el.style.cursor = 'pointer';
        el.onclick = () => switchView('config');
    }
}

// =========================================================================
// VISTA CONFIGURACIÓN
// =========================================================================
function setupConfigView() {
    const ownerInput = document.getElementById('config-owner');
    const repoInput = document.getElementById('config-repo');
    const branchInput = document.getElementById('config-branch');
    const tokenInput = document.getElementById('config-token');
    const testBtn = document.getElementById('btn-config-test');
    const saveBtn = document.getElementById('btn-config-save');
    const clearBtn = document.getElementById('btn-config-clear');
    const toggleBtn = document.getElementById('btn-toggle-token');
    const resultEl = document.getElementById('config-test-result');

    // Cargar configuración guardada
    const cfg = ghConfig.get();
    if (cfg) {
        ownerInput.value = cfg.owner || '';
        repoInput.value = cfg.repo || '';
        branchInput.value = cfg.branch || 'main';
        tokenInput.value = cfg.token || '';
    }

    // Toggle visibilidad del token
    toggleBtn.addEventListener('click', () => {
        tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password';
    });

    // Guardar
    saveBtn.addEventListener('click', () => {
        const cfg = {
            owner: ownerInput.value.trim(),
            repo: repoInput.value.trim(),
            branch: branchInput.value.trim() || 'main',
            token: tokenInput.value.trim(),
        };
        if (!cfg.owner || !cfg.repo || !cfg.token) {
            resultEl.className = 'config-test-result error';
            resultEl.textContent = 'Faltan campos obligatorios (owner, repo, token).';
            return;
        }
        ghConfig.set(cfg);
        resultEl.className = 'config-test-result success';
        resultEl.textContent = '✓ Configuración guardada en este navegador.';
        updateGitHubStatusIndicator();
        toast('Configuración guardada', 'success');
    });

    // Probar conexión
    testBtn.addEventListener('click', async () => {
        const cfg = {
            owner: ownerInput.value.trim(),
            repo: repoInput.value.trim(),
            branch: branchInput.value.trim() || 'main',
            token: tokenInput.value.trim(),
        };
        if (!cfg.owner || !cfg.repo || !cfg.token) {
            resultEl.className = 'config-test-result error';
            resultEl.textContent = 'Rellena los tres campos obligatorios primero.';
            return;
        }
        // Guardamos temporalmente para que ghTest los use
        ghConfig.set(cfg);
        testBtn.classList.add('btn-loading');
        try {
            const result = await ghTest();
            resultEl.className = 'config-test-result success';
            resultEl.innerHTML = `✓ Conexión OK · data.json encontrado con ${result.viviendas} vivienda${result.viviendas !== 1 ? 's' : ''} (sha ${result.sha}).<br>Ya puedes guardar la configuración.`;
            updateGitHubStatusIndicator();
        } catch (err) {
            resultEl.className = 'config-test-result error';
            let msg = err.message;
            if (msg.includes('401')) msg = 'Token inválido o sin permisos. Revisa que el token tenga "Contents: Read and write" sobre este repo.';
            else if (msg.includes('404')) msg = 'Repo no encontrado o data.json no existe en esa rama. Revisa owner/repo/branch.';
            else if (msg.includes('Failed to fetch')) msg = 'No se pudo conectar (posible problema de red o CORS).';
            resultEl.innerHTML = `✗ ${msg}`;
        } finally {
            testBtn.classList.remove('btn-loading');
        }
    });

    // Borrar configuración
    clearBtn.addEventListener('click', () => {
        if (!confirm('¿Eliminar la configuración de GitHub de este navegador?')) return;
        ghConfig.clear();
        ownerInput.value = '';
        repoInput.value = '';
        branchInput.value = 'main';
        tokenInput.value = '';
        resultEl.className = 'config-test-result';
        resultEl.textContent = '';
        updateGitHubStatusIndicator();
        toast('Configuración borrada', 'success');
    });
}

// =========================================================================
// IMPORTAR ANÁLISIS (pegar JSON, hacer push a GitHub)
// =========================================================================
function setupImportPanel() {
    const panel = document.getElementById('import-panel');
    const textarea = document.getElementById('import-textarea');
    const status = document.getElementById('import-status');
    const btnImport = document.getElementById('btn-import');
    const btnClose = document.getElementById('btn-import-close');
    const btnCommit = document.getElementById('btn-import-commit');

    btnImport.addEventListener('click', () => {
        // Cerrar el panel de URLs si está abierto
        document.getElementById('inbox-panel').classList.add('hidden');
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) {
            textarea.focus();
            status.textContent = '';
            status.className = 'inbox-status';
        }
    });
    btnClose.addEventListener('click', () => panel.classList.add('hidden'));

    btnCommit.addEventListener('click', async () => {
        if (!ghConfig.isConfigured()) {
            status.className = 'inbox-status error';
            status.textContent = 'Primero configura GitHub (icono engranaje arriba).';
            return;
        }

        const text = textarea.value.trim();
        if (!text) {
            status.className = 'inbox-status error';
            status.textContent = 'Pega el JSON que te ha dado Claude.';
            return;
        }

        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (err) {
            status.className = 'inbox-status error';
            status.textContent = `JSON inválido: ${err.message}`;
            return;
        }

        // Aceptamos dos formas: array de viviendas, o objeto con campo "viviendas"
        let nuevasViviendas;
        if (Array.isArray(parsed)) {
            nuevasViviendas = parsed;
        } else if (parsed.viviendas && Array.isArray(parsed.viviendas)) {
            nuevasViviendas = parsed.viviendas;
        } else {
            status.className = 'inbox-status error';
            status.textContent = 'El JSON debe ser un array de viviendas o un objeto con campo "viviendas".';
            return;
        }

        if (nuevasViviendas.length === 0) {
            status.className = 'inbox-status error';
            status.textContent = 'El JSON no contiene viviendas.';
            return;
        }

        // Validar mínimamente: cada vivienda debe tener al menos id
        const sinId = nuevasViviendas.filter(v => !v.id);
        if (sinId.length > 0) {
            status.className = 'inbox-status error';
            status.textContent = `${sinId.length} vivienda${sinId.length > 1 ? 's' : ''} sin "id". El JSON parece incompleto.`;
            return;
        }

        btnCommit.classList.add('btn-loading');
        status.className = 'inbox-status';
        status.textContent = 'Conectando con GitHub...';

        try {
            // Leer data.json actual
            const file = await ghReadFile('data.json');
            const existing = file.parsed;

            // Fusionar: las nuevas reemplazan a las existentes con mismo id, las nuevas se añaden
            const map = new Map(existing.viviendas.map(v => [v.id, v]));
            let added = 0;
            let updated = 0;
            for (const v of nuevasViviendas) {
                if (map.has(v.id)) {
                    updated++;
                } else {
                    added++;
                }
                map.set(v.id, v);
            }
            existing.viviendas = [...map.values()];
            existing.meta = existing.meta || {};
            existing.meta.lastUpdated = new Date().toISOString().split('T')[0];

            // Eliminar de pendientes los IDs que acaban de entrar
            const idsImportados = new Set(nuevasViviendas.map(v => v.id));
            const pendientesActuales = localData.getPendientes();
            const pendientesNuevos = pendientesActuales.filter(url => {
                const m = url.match(/inmueble\/(\d+)/);
                return !m || !idsImportados.has(m[1]);
            });
            localData.setPendientes(pendientesNuevos);

            status.textContent = 'Subiendo cambios al repo...';

            // Escribir
            const message = `Dashboard: ${added > 0 ? `+${added} nueva${added > 1 ? 's' : ''}` : ''}${added > 0 && updated > 0 ? ', ' : ''}${updated > 0 ? `${updated} actualizada${updated > 1 ? 's' : ''}` : ''}`;
            await ghWriteFile('data.json', JSON.stringify(existing, null, 2), file.sha, message);

            const summary = `${added > 0 ? `${added} añadida${added > 1 ? 's' : ''}` : ''}${added > 0 && updated > 0 ? ', ' : ''}${updated > 0 ? `${updated} actualizada${updated > 1 ? 's' : ''}` : ''}`;
            status.className = 'inbox-status success';
            status.textContent = `✓ ${summary}. Vercel redespliega en ~30s. Refresca esta página después.`;
            textarea.value = '';
            renderPendientes();
            toast(`Subido a GitHub: ${summary}`, 'success');
        } catch (err) {
            console.error(err);
            status.className = 'inbox-status error';
            let msg = err.message;
            if (msg.includes('401')) msg = 'Token inválido o caducado. Revisa la configuración.';
            else if (msg.includes('404')) msg = 'data.json no encontrado en el repo. Revisa la configuración.';
            else if (msg.includes('409')) msg = 'Conflicto: el data.json ha cambiado. Refresca y vuelve a intentar.';
            status.textContent = `✗ ${msg}`;
        } finally {
            btnCommit.classList.remove('btn-loading');
        }
    });
}

// =========================================================================
// CALCULADORA
// =========================================================================

// Lee todos los inputs y devuelve un objeto numérico
function getCalcInputs() {
    const num = (id, def = 0) => {
        const el = document.getElementById(id);
        if (!el) return def;
        const v = parseFloat(el.value);
        return isNaN(v) ? def : v;
    };
    const str = (id, def = '') => {
        const el = document.getElementById(id);
        return el ? (el.value || def) : def;
    };
    return {
        localidad: str('c-localidad'),
        zona: str('c-zona'),
        url: str('c-url'),
        tipo: str('c-tipo', 'Piso'),
        ano: num('c-ano', null),
        hab: num('c-hab'),
        banos: num('c-banos'),
        planta: str('c-planta'),
        precio: num('c-precio'),
        m2c: num('c-m2c'),
        m2u: num('c-m2u'),
        comunidad: num('c-comunidad'),
        fin: num('c-fin', 70) / 100,
        tipoInteres: num('c-tipo-interes', 3) / 100,
        plazo: num('c-plazo', 25),
        itp: num('c-itp', 9) / 100,
        notaria: num('c-notaria'),
        tasacion: num('c-tasacion'),
        gestoria: num('c-gestoria'),
        retoques: num('c-retoques'),
        agencia: num('c-agencia'),
        otros: num('c-otros'),
        alquiler: num('c-alquiler'),
        ibi: num('c-ibi'),
        segHogar: num('c-seg-hogar'),
        segVida: num('c-seg-vida'),
        segImpago: num('c-seg-impago'),
        vacancia: num('c-vacancia', 8) / 100,
        mantenimiento: num('c-mantenimiento', 10) / 100,
        inflacion: num('c-inflacion', 2) / 100,
        irpf: num('c-irpf', 30) / 100,
        vh: str('c-vh', 'si') === 'si',
        vcSuelo: num('c-vc-suelo', null),
        vcConst: num('c-vc-const', null),
    };
}

function calcularRentabilidad(inputs) {
    const i = inputs;
    if (!i.precio || !i.m2c) return null;

    // Coste total
    const impuestos = i.precio * i.itp;
    const costeTotal = i.precio + impuestos + i.retoques + i.agencia + i.notaria + i.tasacion + i.gestoria + i.otros;

    // Hipoteca
    const importeHip = i.precio * i.fin;
    const capitalPropio = costeTotal - importeHip;

    // Cuota mensual (PMT)
    const r = i.tipoInteres / 12;
    const n = i.plazo * 12;
    let cuotaMensual = 0;
    if (importeHip > 0 && r > 0) {
        cuotaMensual = importeHip * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    } else if (importeHip > 0) {
        cuotaMensual = importeHip / n;
    }
    const cuotaAnual = cuotaMensual * 12;

    // Año 1: amort/interés
    let saldo = importeHip;
    let totalInt = 0, totalAmort = 0;
    for (let m = 0; m < 12; m++) {
        const interes = saldo * r;
        const amort = cuotaMensual - interes;
        totalInt += interes;
        totalAmort += amort;
        saldo -= amort;
    }

    // Ingresos / gastos
    const ingresosAnuales = i.alquiler * 12;
    const gastosAnuales =
        (i.comunidad * 12) +
        i.segHogar + i.segVida + i.segImpago + i.ibi +
        (ingresosAnuales * i.vacancia) +
        (ingresosAnuales * i.mantenimiento);

    const beneficioSinImp = ingresosAnuales - gastosAnuales;

    // IRPF
    const vcSuelo = i.vcSuelo ?? (i.precio * 0.375); // estimación 37.5% del precio
    const vcConst = i.vcConst ?? (i.precio * 0.125); // estimación 12.5% del precio
    const ratioConstr = (vcSuelo + vcConst) > 0 ? vcConst / (vcSuelo + vcConst) : 0.25;
    const amortVivienda = 0.03 * ratioConstr * i.precio + 0.03 * (impuestos + i.retoques + i.agencia + i.notaria);
    const intereses = totalInt;
    const factor = i.vh ? 0.4 : 1.0;
    const irpfAnual = factor * i.irpf * Math.max(0, beneficioSinImp - amortVivienda - intereses);

    const beneficioNeto = beneficioSinImp - irpfAnual;
    const cashflowAnual = beneficioNeto - cuotaAnual;

    // Rentabilidades
    const rentFlujo = capitalPropio > 0 ? cashflowAnual / capitalPropio : 0;
    const rentDeuda = capitalPropio > 0 ? totalAmort / capitalPropio : 0;
    const rentInflacion = capitalPropio > 0 ? i.precio * i.inflacion / capitalPropio : 0;
    const rentTotal = rentFlujo + rentDeuda + rentInflacion;
    const rentBruta = costeTotal > 0 ? ingresosAnuales / costeTotal : 0;
    const rentNeta = costeTotal > 0 ? beneficioNeto / costeTotal : 0;
    const roce = rentFlujo;

    // Múltiplo y calidad
    const multiplo = i.alquiler > 0
        ? (i.precio + impuestos + i.notaria + i.retoques + i.tasacion + i.gestoria) / i.alquiler
        : 0;
    let calidad = '—';
    if (multiplo > 0) {
        if (multiplo < 150) calidad = 'Extraordinaria';
        else if (multiplo < 180) calidad = 'Buena';
        else if (multiplo < 210) calidad = 'Correcta';
        else if (multiplo < 240) calidad = 'Regular';
        else calidad = 'Mala';
    }

    // Mínimo alquiler y margen seguridad
    const minAlquiler = i.alquiler > 0 ? (gastosAnuales + cuotaAnual + irpfAnual) / 12 : 0;
    const margenSegMes = i.alquiler - minAlquiler;
    const margenSegPct = i.alquiler > 0 ? margenSegMes / i.alquiler : 0;

    // €/m² y verdict según ciudad activa
    const em2 = i.m2c > 0 ? i.precio / i.m2c : 0;
    const razones = [];
    const ciudad = getActiveCity();
    const cri = ciudad?.benchmarks?.criterios;

    if (cri) {
        if (i.tipo !== cri.tipo && cri.tipo === 'Piso' && !['Piso','Ático','Dúplex','Estudio'].includes(i.tipo)) {
            razones.push(`tipo ${i.tipo.toLowerCase()} (≠${cri.tipo})`);
        }
        if (i.m2c && cri.m2Min && cri.m2Max) {
            if (i.m2c < cri.m2Min) razones.push(`${i.m2c}m² <${cri.m2Min}`);
            else if (i.m2c > cri.m2Max) razones.push(`${i.m2c}m² >${cri.m2Max}`);
        }
        if (i.ano && cri.anoMin && i.ano < cri.anoMin) {
            razones.push(`año ${i.ano} <${cri.anoMin}`);
        }
        if (em2 && cri.em2Riesgo && em2 > cri.em2Riesgo) {
            razones.push(`€/m²=${Math.round(em2)} riesgo`);
        } else if (em2 && cri.em2Aceptable && em2 > cri.em2Aceptable) {
            razones.push(`€/m²=${Math.round(em2)} >${cri.em2Aceptable}`);
        }
    }

    let verdict = 'pass';
    if (razones.length === 0) verdict = 'pass';
    else if (razones.some(r => /riesgo/i.test(r)) || razones.length >= 3) verdict = 'fail';
    else if (i.ano && cri && cri.anoMin && i.ano < cri.anoMin) verdict = 'fail';
    else verdict = 'warning';

    return {
        em2, costeTotal, capitalPropio, importeHip,
        cuotaMensual, cuotaAnual, totalAmort, totalInt,
        ingresosAnuales, gastosAnuales, beneficioSinImp,
        amortVivienda, irpfAnual, beneficioNeto, cashflowAnual,
        rentFlujo, rentDeuda, rentInflacion, rentTotal,
        rentBruta, rentNeta, roce,
        multiplo, calidad,
        minAlquiler, margenSegMes, margenSegPct,
        vsRA: ciudad?.benchmarks?.fuentes?.realAdvisor?.em2Mediano
            ? (em2 / ciudad.benchmarks.fuentes.realAdvisor.em2Mediano) - 1
            : null,
        vsBYF: ciudad?.benchmarks?.fuentes?.bestYieldFinder?.em2Mediano
            ? (em2 / ciudad.benchmarks.fuentes.bestYieldFinder.em2Mediano) - 1
            : null,
        razones, verdict,
        vcSuelo, vcConst, impuestos,
    };
}

function renderCalcResults(c) {
    const set = (id, val, cls = '') => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = val;
        el.className = cls;
    };
    const banner = document.getElementById('calc-verdict-banner');
    const bannerIcon = document.getElementById('calc-verdict-icon');
    const bannerLabel = document.getElementById('calc-verdict-label');

    if (!c) {
        // Sin datos suficientes
        banner.className = 'calc-verdict-banner';
        bannerIcon.textContent = '—';
        bannerLabel.textContent = 'Rellena al menos precio y m²';
        ['r-coste-total','r-capital','r-em2','r-cuota','r-amort','r-int',
         'r-ingresos','r-gastos','r-irpf','r-beneficio','r-cashflow',
         'r-bruta','r-neta','r-flujo','r-deuda','r-inflacion','r-total',
         'r-multiplo','r-calidad','r-min-alq','r-margen'].forEach(id => set(id, '—'));
        return;
    }

    // Verdict banner
    const txt = c.verdict === 'pass' ? '✓ Pasa filtro'
              : c.verdict === 'warning' ? '~ Zona gris'
              : '✗ Descartada';
    banner.className = `calc-verdict-banner ${c.verdict}`;
    bannerIcon.textContent = c.verdict === 'pass' ? '✓' : c.verdict === 'warning' ? '~' : '✗';
    bannerLabel.textContent = c.razones.length > 0
        ? `${txt} · ${c.razones.join(' · ')}`
        : txt;

    set('r-coste-total', fmt.eur(c.costeTotal));
    set('r-capital', fmt.eur(c.capitalPropio));
    set('r-em2', fmt.em2(c.em2));
    set('r-cuota', fmt.eurDec(c.cuotaMensual));
    set('r-amort', fmt.eur(c.totalAmort));
    set('r-int', fmt.eur(c.totalInt));
    set('r-ingresos', fmt.eur(c.ingresosAnuales));
    set('r-gastos', fmt.eur(-c.gastosAnuales), 'neg');
    set('r-irpf', fmt.eur(-c.irpfAnual), c.irpfAnual > 0 ? 'neg' : '');
    set('r-beneficio', fmt.eur(c.beneficioNeto));
    set('r-cashflow', fmt.eur(c.cashflowAnual), c.cashflowAnual >= 0 ? 'pos' : 'neg');
    set('r-bruta', fmt.pctNoSign(c.rentBruta));
    set('r-neta', fmt.pctNoSign(c.rentNeta));
    set('r-flujo', fmt.pct(c.rentFlujo), c.rentFlujo >= 0 ? 'pos' : 'neg');
    set('r-deuda', fmt.pct(c.rentDeuda), 'pos');
    set('r-inflacion', fmt.pct(c.rentInflacion), 'pos');
    set('r-total', fmt.pct(c.rentTotal), c.rentTotal >= 0 ? 'pos' : 'neg');
    set('r-multiplo', isFinite(c.multiplo) && c.multiplo > 0 ? Math.round(c.multiplo).toString() : '—');
    set('r-calidad', c.calidad);
    set('r-min-alq', c.minAlquiler > 0 ? fmt.eur(c.minAlquiler) + '/mes' : '—');
    set('r-margen', fmt.pct(c.margenSegPct), c.margenSegPct >= 0.25 ? 'pos' : c.margenSegPct >= 0 ? '' : 'neg');
}

function setupCalculadora() {
    // Pre-rellenar con valores por defecto según ciudad activa
    prefillCalcFromCity();

    // Recálculo en tiempo real al cambiar cualquier input
    const allInputs = document.querySelectorAll('#view-calculadora input, #view-calculadora select');
    const debounced = debounce(() => {
        const inputs = getCalcInputs();
        const result = calcularRentabilidad(inputs);
        renderCalcResults(result);
    }, 150);

    allInputs.forEach(el => {
        el.addEventListener('input', debounced);
        el.addEventListener('change', debounced);
    });

    // Botón limpiar
    document.getElementById('btn-calc-clear').addEventListener('click', () => {
        if (!confirm('¿Limpiar todos los campos de la calculadora?')) return;
        allInputs.forEach(el => {
            if (el.tagName === 'SELECT') {
                el.selectedIndex = 0;
            } else {
                el.value = '';
            }
        });
        prefillCalcFromCity();
        renderCalcResults(null);
        toast('Calculadora limpiada', 'success');
    });

    // Botón guardar como vivienda
    document.getElementById('btn-calc-save').addEventListener('click', saveCalcAsVivienda);

    // Render inicial
    renderCalcResults(null);
}

function debounce(fn, wait) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), wait);
    };
}

function prefillCalcFromCity() {
    const ciudad = getActiveCity();
    if (!ciudad) return;
    // Pre-rellenar localidad e ITP
    const locInput = document.getElementById('c-localidad');
    if (locInput && !locInput.value) locInput.value = ciudad.nombre;
    const itpInput = document.getElementById('c-itp');
    if (itpInput && ciudad.itp !== undefined) itpInput.value = (ciudad.itp * 100).toFixed(1);
}

async function saveCalcAsVivienda() {
    const inputs = getCalcInputs();
    const c = calcularRentabilidad(inputs);

    if (!c) {
        toast('Rellena al menos precio y m²', 'error');
        return;
    }
    if (!inputs.precio || !inputs.m2c) {
        toast('Faltan datos clave (precio, m²)', 'error');
        return;
    }
    if (!ghConfig.isConfigured()) {
        toast('Configura GitHub primero', 'error');
        switchView('config');
        return;
    }

    // Construir el objeto vivienda
    let id;
    const urlMatch = (inputs.url || '').match(/inmueble\/(\d+)/);
    if (urlMatch) {
        id = urlMatch[1];
    } else {
        // Generar id manual basado en timestamp si no hay URL Idealista
        id = 'manual-' + Date.now();
    }

    const ciudad = getActiveCity();

    const vivienda = {
        id: id,
        url: inputs.url || '',
        fechaAnalisis: new Date().toISOString().split('T')[0],
        localidad: inputs.localidad || (ciudad ? ciudad.nombre : ''),
        zona: inputs.zona || '',
        direccion: inputs.zona || '',
        tipo: inputs.tipo,
        titulo: `${inputs.tipo} ${inputs.hab ? '(' + inputs.hab + ' hab) ' : ''}${inputs.zona ? 'en ' + inputs.zona : ''}`.trim() || `${inputs.tipo} ${id}`,
        ciudadSlug: state.activeCity,
        datos: {
            precio: inputs.precio,
            m2Construidos: inputs.m2c,
            m2Utiles: inputs.m2u || inputs.m2c,
            habitaciones: inputs.hab,
            banos: inputs.banos,
            planta: inputs.planta,
            ano: inputs.ano,
            estado: '',
            calefaccion: '',
            aireAcondicionado: false,
            ascensor: false,
            terraza: false,
            garaje: false,
            comunidadMes: inputs.comunidad,
            bajadaPrecio: null,
            agencia: '',
        },
        estimaciones: {
            alquilerMensual: inputs.alquiler,
            alquilerNotas: 'Introducido manualmente desde la calculadora.',
            ibi: inputs.ibi,
            vcSuelo: Math.round(c.vcSuelo),
            vcConstruccion: Math.round(c.vcConst),
            vacancia: inputs.vacancia,
            mantenimiento: inputs.mantenimiento,
        },
        calculo: {
            costeTotal: Math.round(c.costeTotal),
            capitalPropio: Math.round(c.capitalPropio),
            cuotaMensual: Math.round(c.cuotaMensual * 100) / 100,
            cuotaAnual: Math.round(c.cuotaAnual * 100) / 100,
            amortizacionAno1: Math.round(c.totalAmort * 100) / 100,
            interesesAno1: Math.round(c.totalInt * 100) / 100,
            ingresosAnuales: c.ingresosAnuales,
            gastosAnuales: Math.round(c.gastosAnuales),
            irpfAnual: Math.round(c.irpfAnual * 100) / 100,
            beneficioNeto: Math.round(c.beneficioNeto * 100) / 100,
            cashflowAnual: Math.round(c.cashflowAnual * 100) / 100,
            rentabilidadBruta: Math.round(c.rentBruta * 10000) / 10000,
            rentabilidadNeta: Math.round(c.rentNeta * 10000) / 10000,
            rentabilidadFlujoCaja: Math.round(c.rentFlujo * 10000) / 10000,
            rentabilidadPagoDeuda: Math.round(c.rentDeuda * 10000) / 10000,
            rentabilidadInflacion: Math.round(c.rentInflacion * 10000) / 10000,
            rentabilidadTotal: Math.round(c.rentTotal * 10000) / 10000,
            roce: Math.round(c.roce * 10000) / 10000,
            multiplo: Math.round(c.multiplo),
            calidadInversion: c.calidad,
            minimoAlquiler: Math.round(c.minAlquiler),
            margenSeguridadMensual: Math.round(c.margenSegMes),
            margenSeguridadPct: Math.round(c.margenSegPct * 10000) / 10000,
        },
        filtros: {
            vsRA: c.vsRA != null ? Math.round(c.vsRA * 10000) / 10000 : null,
            vsBYF: c.vsBYF != null ? Math.round(c.vsBYF * 10000) / 10000 : null,
            verdict: c.verdict,
            verdictRazones: c.razones,
            verdictTexto: c.razones.length > 0 ? c.razones.join(', ') : 'Pasa filtro',
        },
        notas: 'Análisis introducido manualmente desde la calculadora.',
    };

    // Commit a GitHub
    const btn = document.getElementById('btn-calc-save');
    btn.classList.add('btn-loading');
    try {
        const file = await ghReadFile('data.json');
        const existing = file.parsed;
        const map = new Map(existing.viviendas.map(v => [v.id, v]));
        const existed = map.has(vivienda.id);
        map.set(vivienda.id, vivienda);
        existing.viviendas = [...map.values()];
        existing.meta = existing.meta || {};
        existing.meta.lastUpdated = new Date().toISOString().split('T')[0];

        const message = existed
            ? `Calculadora: actualizar ${vivienda.id}`
            : `Calculadora: añadir ${vivienda.id}`;
        await ghWriteFile('data.json', JSON.stringify(existing, null, 2), file.sha, message);

        toast(existed ? 'Vivienda actualizada en GitHub' : 'Vivienda guardada en GitHub', 'success');
        // Refrescar el view tras unos segundos
        setTimeout(() => location.reload(), 2000);
    } catch (err) {
        console.error(err);
        let msg = err.message;
        if (msg.includes('401')) msg = 'Token inválido o caducado. Revisa la configuración.';
        else if (msg.includes('404')) msg = 'data.json no encontrado en el repo.';
        toast(`Error: ${msg}`, 'error');
    } finally {
        btn.classList.remove('btn-loading');
    }
}

// =========================================================================
// INICIO
// =========================================================================
setupLogin();
