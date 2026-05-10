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
    sortBy: 'cashflow',
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
    if (state.activeFilter !== 'all') {
        viviendas = viviendas.filter(v => v.filtros.verdict === state.activeFilter);
    }
    viviendas.sort((a, b) => {
        switch (state.sortBy) {
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
    document.getElementById('lastUpdated').textContent = `Actualizado ${fmt.date(state.data.meta.lastUpdated)}`;
    renderViviendas();
    renderPendientes();
    renderBenchmarks();
    renderCriterios();
}

// ---- VISTA VIVIENDAS ----
function renderViviendas() {
    const all = state.data.viviendas;
    const counts = {
        total: all.length,
        pass: all.filter(v => v.filtros.verdict === 'pass').length,
        warn: all.filter(v => v.filtros.verdict === 'warning').length,
        fail: all.filter(v => v.filtros.verdict === 'fail').length,
    };
    document.getElementById('kpi-total').textContent = counts.total;
    document.getElementById('kpi-pass').textContent  = counts.pass;
    document.getElementById('kpi-warn').textContent  = counts.warn;
    document.getElementById('kpi-fail').textContent  = counts.fail;
    document.getElementById('kpi-inversion').textContent =
        fmt.eur(all.reduce((s, v) => s + (v.calculo.costeTotal || 0), 0));

    const filtered = getFilteredViviendas();
    const grid = document.getElementById('grid-viviendas');
    if (filtered.length === 0) {
        grid.innerHTML = `<p style="color:var(--ink-muted);padding:40px;text-align:center;grid-column:1/-1;">Sin resultados con este filtro</p>`;
        return;
    }
    grid.innerHTML = filtered.map(v => renderCard(v)).join('');
    grid.querySelectorAll('.card').forEach(c => {
        c.addEventListener('click', (e) => {
            // Si clicaron en el botón X de eliminar, eliminar y no abrir modal
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
    const b = state.data.benchmarks.talavera;
    const ra = b.fuentes.realAdvisor;
    const byf = b.fuentes.bestYieldFinder;

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

// =========================================================================
// VISTA CRITERIOS
// =========================================================================
function renderCriterios() {
    const cri = state.data.benchmarks.talavera.criterios;
    const params = state.data.parametros;

    const talaveraEl = document.getElementById('criterios-talavera');
    talaveraEl.innerHTML = `
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

    const paramsEl = document.getElementById('criterios-params');
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
// INICIO
// =========================================================================
setupLogin();
