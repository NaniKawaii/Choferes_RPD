const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const crypto = require('crypto');
const db = require('./db');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_me';
const BIOMETRICO_MIN_HOURS = Number(process.env.BIOMETRICO_MIN_HOURS || 8);
const BIOMETRICO_HEADERS = [
  'ID_persona',
  'Nombre',
  'Departamento',
  'Fecha',
  'Primera_perforacion',
  'Ultima_perforacion',
  'Numero_perforaciones',
  'Horas_reales_trabajo'
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const CATALOG_CONFIG = {
  bancos: {
    table: 'bancos',
    select: 'id, nombre, activo, created_at',
    insertFields: ['nombre', 'activo'],
    requiredFields: ['nombre']
  },
  personal_roles: {
    table: 'personal_roles',
    select: 'id, nombre, activo, created_at',
    insertFields: ['nombre', 'activo'],
    requiredFields: ['nombre']
  },
  personal: {
    table: 'personal',
    select: 'id, nombre, documento, banco_id, numero_cuenta, activo, created_at',
    insertFields: ['nombre', 'documento', 'banco_id', 'numero_cuenta', 'activo'],
    requiredFields: ['nombre']
  },
  camiones: {
    table: 'camiones',
    select: 'id, nombre, placa, kilometraje_inicial, tonelaje_max_quintales, rendimiento_esperado, activo, created_at',
    insertFields: ['nombre', 'placa', 'kilometraje_inicial', 'tonelaje_max_quintales', 'rendimiento_esperado', 'activo'],
    requiredFields: ['nombre', 'placa']
  },
  rutas: {
    table: 'rutas',
    select: 'id, nombre, tipo, distancia_km, valor_a_cobrar, valor_a_pagar, activo, created_at',
    insertFields: ['nombre', 'tipo', 'distancia_km', 'valor_a_cobrar', 'valor_a_pagar', 'activo'],
    requiredFields: ['nombre', 'tipo']
  },
  estados_viaje: {
    table: 'estados_viaje',
    select: 'id, nombre, activo, created_at',
    insertFields: ['nombre', 'activo'],
    requiredFields: ['nombre']
  },
  productos: {
    table: 'productos',
    select: 'id, nombre, unidad_medida, peso_quintales_unidad, activo, created_at',
    insertFields: ['nombre', 'unidad_medida', 'peso_quintales_unidad', 'activo'],
    requiredFields: ['nombre']
  },
  metricas_ruta_larga: {
    table: 'metricas_ruta_larga',
    select: 'id, producto_id, tipo_operacion, valor_unitario, activo, created_at',
    insertFields: ['producto_id', 'tipo_operacion', 'valor_unitario', 'activo'],
    requiredFields: ['producto_id', 'tipo_operacion', 'valor_unitario']
  },
  metricas_ruta_corta: {
    table: 'metricas_ruta_corta',
    select: 'id, COALESCE(condicion_valor_carga_desde, 0) AS condicion_valor_carga_desde, COALESCE(condicion_valor_carga_hasta, condicion_valor_carga) AS condicion_valor_carga_hasta, numero_personas, valor_pagar, tipo_operacion, activo, created_at',
    insertFields: ['condicion_valor_carga_desde', 'condicion_valor_carga_hasta', 'numero_personas', 'valor_pagar', 'tipo_operacion', 'activo'],
    requiredFields: ['condicion_valor_carga_desde', 'condicion_valor_carga_hasta', 'numero_personas', 'valor_pagar', 'tipo_operacion']
  }
};

const PHASE1_REQUIRED_CATALOGS = [
  'bancos',
  'personal',
  'personal_roles',
  'camiones',
  'rutas',
  'estados_viaje',
  'productos',
  'metricas_ruta_larga',
  'metricas_ruta_corta'
];

const MODULE_KEYS = [
  'dashboard',
  'bitacora',
  'biometrico',
  'liquidaciones',
  'ajustes_personal',
  'roles_mensuales',
  'pagos',
  'reportes',
  'base_datos',
  'empresa_logo',
  'admin_access'
];

// Health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Auth: simple email/password login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const r = await db.query('SELECT id, email, password_hash, role FROM users WHERE email=$1', [email]);
    if (r.rowCount === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = r.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Middleware to verify token
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'missing token' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'invalid token' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

function requireAdmin(req, res, next) {
  if (String(req.user?.role || '').toLowerCase() !== 'admin') {
    return res.status(403).json({ error: 'acceso restringido a Admin' });
  }
  next();
}

async function getPersonalIdByUserId(userId) {
  const r = await db.query('SELECT id FROM personal WHERE user_id = $1 LIMIT 1', [Number(userId)]);
  return r.rowCount > 0 ? Number(r.rows[0].id) : null;
}

async function getPermissionsByPersonalId(personalId) {
  const result = await db.query(
    `SELECT module_key, can_access, can_modify, can_delete
     FROM admin_module_permissions
     WHERE personal_id = $1`,
    [Number(personalId)]
  );

  const byModule = {};
  for (const moduleKey of MODULE_KEYS) {
    byModule[moduleKey] = { can_access: true, can_modify: true, can_delete: true };
  }

  for (const row of result.rows) {
    byModule[row.module_key] = {
      can_access: row.can_access !== false,
      can_modify: row.can_modify !== false,
      can_delete: row.can_delete !== false
    };
  }

  return byModule;
}

async function getRequestModulePermissions(req) {
  if (req._modulePermissions) return req._modulePermissions;

  if (String(req.user?.role || '').toLowerCase() !== 'admin') {
    const full = {};
    for (const moduleKey of MODULE_KEYS) {
      full[moduleKey] = { can_access: true, can_modify: true, can_delete: true };
    }
    req._modulePermissions = full;
    return full;
  }

  const personalId = await getPersonalIdByUserId(req.user.id);
  if (!personalId) {
    const full = {};
    for (const moduleKey of MODULE_KEYS) {
      full[moduleKey] = { can_access: true, can_modify: true, can_delete: true };
    }
    req._modulePermissions = full;
    return full;
  }

  const modules = await getPermissionsByPersonalId(personalId);
  req._modulePermissions = modules;
  return modules;
}

function requireModulePermission(moduleKey, permission = 'can_access') {
  return async (req, res, next) => {
    try {
      const modules = await getRequestModulePermissions(req);
      const modulePerm = modules?.[moduleKey] || { can_access: true, can_modify: true, can_delete: true };

      const hasAccess = modulePerm.can_access !== false;
      const hasPermission = modulePerm[permission] !== false;

      if (!hasAccess || !hasPermission) {
        return res.status(403).json({
          error: `sin permisos para ${permission} en modulo ${moduleKey}`
        });
      }

      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'server error' });
    }
  };
}

app.get('/api/empresa/logo', authMiddleware, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT logo_data_url
       FROM empresa_config
       WHERE id = 1`
    );
    if (r.rowCount === 0) {
      return res.json({ logo_data_url: null });
    }
    res.json({ logo_data_url: r.rows[0].logo_data_url || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/public/empresa/logo', async (req, res) => {
  try {
    const r = await db.query(
      `SELECT logo_data_url
       FROM empresa_config
       WHERE id = 1`
    );
    if (r.rowCount === 0) {
      return res.json({ logo_data_url: null });
    }
    res.json({ logo_data_url: r.rows[0].logo_data_url || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/me/access', authMiddleware, async (req, res) => {
  try {
    if (String(req.user?.role || '').toLowerCase() !== 'admin') {
      const full = {};
      for (const moduleKey of MODULE_KEYS) {
        full[moduleKey] = { can_access: true, can_modify: true, can_delete: true };
      }
      return res.json({ modules: full });
    }

    const personalId = await getPersonalIdByUserId(req.user.id);
    if (!personalId) {
      const full = {};
      for (const moduleKey of MODULE_KEYS) {
        full[moduleKey] = { can_access: true, can_modify: true, can_delete: true };
      }
      return res.json({ modules: full });
    }

    const modules = await getPermissionsByPersonalId(personalId);
    res.json({ modules });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/admin-access/modules', authMiddleware, requireAdmin, requireModulePermission('admin_access', 'can_access'), async (req, res) => {
  res.json({ modules: MODULE_KEYS });
});

app.get('/api/admin-access/admins', authMiddleware, requireAdmin, requireModulePermission('admin_access', 'can_access'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.id, p.nombre, p.documento, p.user_id, u.email
       FROM personal p
       JOIN personal_role_assignments pra ON pra.personal_id = p.id
       JOIN personal_roles pr ON pr.id = pra.role_id
       LEFT JOIN users u ON u.id = p.user_id
       WHERE LOWER(pr.nombre) = 'admin'
       ORDER BY p.nombre ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/admin-access/:personalId', authMiddleware, requireAdmin, requireModulePermission('admin_access', 'can_access'), async (req, res) => {
  try {
    const personalId = Number(req.params.personalId);
    const exists = await db.query('SELECT id FROM personal WHERE id=$1', [personalId]);
    if (exists.rowCount === 0) return res.status(404).json({ error: 'personal no encontrado' });
    const modules = await getPermissionsByPersonalId(personalId);
    res.json({ personal_id: personalId, modules });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.put('/api/admin-access/:personalId', authMiddleware, requireAdmin, requireModulePermission('admin_access', 'can_modify'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    const personalId = Number(req.params.personalId);
    const modules = req.body?.modules || {};

    const exists = await client.query(
      `SELECT p.id
       FROM personal p
       JOIN personal_role_assignments pra ON pra.personal_id = p.id
       JOIN personal_roles pr ON pr.id = pra.role_id
       WHERE p.id = $1 AND LOWER(pr.nombre) = 'admin'
       LIMIT 1`,
      [personalId]
    );
    if (exists.rowCount === 0) return res.status(404).json({ error: 'admin no encontrado' });

    await client.query('BEGIN');
    await client.query('DELETE FROM admin_module_permissions WHERE personal_id = $1', [personalId]);

    for (const moduleKey of MODULE_KEYS) {
      const row = modules[moduleKey] || {};
      await client.query(
        `INSERT INTO admin_module_permissions(personal_id, module_key, can_access, can_modify, can_delete, updated_by, updated_at)
         VALUES($1,$2,$3,$4,$5,$6,now())`,
        [
          personalId,
          moduleKey,
          row.can_access !== false,
          row.can_modify !== false,
          row.can_delete !== false,
          req.user.id
        ]
      );
    }

    await client.query('COMMIT');

    await auditLog(req.user.id, 'admin_module_permissions', personalId, 'update', { modules: MODULE_KEYS.length });
    const updated = await getPermissionsByPersonalId(personalId);
    res.json({ ok: true, personal_id: personalId, modules: updated });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error(err);
    res.status(500).json({ error: 'server error' });
  } finally {
    client.release();
  }
});

app.put('/api/empresa/logo', authMiddleware, requireModulePermission('empresa_logo', 'can_modify'), async (req, res) => {
  try {
    const { logo_data_url } = req.body;

    if (hasValue(logo_data_url)) {
      const normalized = String(logo_data_url || '');
      if (!normalized.startsWith('data:image/')) {
        return res.status(400).json({ error: 'logo invalido: formato de imagen no soportado' });
      }
      if (normalized.length > 9_000_000) {
        return res.status(400).json({ error: 'logo demasiado grande' });
      }
    }

    const saved = await db.query(
      `INSERT INTO empresa_config(id, logo_data_url, updated_by, updated_at)
       VALUES(1, $1, $2, now())
       ON CONFLICT (id)
       DO UPDATE SET
         logo_data_url = EXCLUDED.logo_data_url,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()
       RETURNING logo_data_url`,
      [hasValue(logo_data_url) ? String(logo_data_url) : null, req.user.id]
    );

    await auditLog(req.user.id, 'empresa_config', 1, 'update_logo', {
      has_logo: Boolean(saved.rows[0].logo_data_url)
    });

    res.json({ ok: true, logo_data_url: saved.rows[0].logo_data_url || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

function getCatalogOrFail(name, res) {
  const catalog = CATALOG_CONFIG[name];
  if (!catalog) {
    res.status(404).json({ error: 'catalogo no soportado' });
    return null;
  }
  return catalog;
}

function hasValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  return true;
}

async function auditLog(userId, entidad, entidadId, accion, detalle = null) {
  try {
    await db.query(
      `INSERT INTO auditoria(user_id, entidad, entidad_id, accion, detalle)
       VALUES($1,$2,$3,$4,$5)`,
      [userId || null, entidad, entidadId || null, accion, detalle ? JSON.stringify(detalle) : null]
    );
  } catch (err) {
    console.error('audit error', err);
  }
}

async function getEstadoIdByName(nombre) {
  const r = await db.query(
    `SELECT id
     FROM estados_viaje
     WHERE activo = TRUE AND LOWER(nombre) = $1
     ORDER BY id DESC
     LIMIT 1`,
    [String(nombre || '').toLowerCase()]
  );
  return r.rowCount > 0 ? Number(r.rows[0].id) : null;
}

async function getPaidWeekOverlap(fechaInicio, fechaFin = null) {
  const inicio = String(fechaInicio || '').slice(0, 10);
  const fin = String(fechaFin || fechaInicio || '').slice(0, 10);
  if (!isValidDate(inicio) || !isValidDate(fin)) return null;

  const rangeStart = inicio <= fin ? inicio : fin;
  const rangeEnd = inicio <= fin ? fin : inicio;

  const r = await db.query(
    `SELECT l.semana_inicio, l.semana_fin
     FROM liquidaciones l
     JOIN pagos pg ON pg.liquidacion_id = l.id
     WHERE LOWER(COALESCE(pg.estado, '')) = 'pagado'
       AND l.semana_inicio <= $2
       AND l.semana_fin >= $1
     ORDER BY l.semana_inicio DESC
     LIMIT 1`,
    [rangeStart, rangeEnd]
  );

  return r.rowCount > 0 ? r.rows[0] : null;
}

function paidWeekMessage(paidWeek) {
  return `semana pagada (${String(paidWeek.semana_inicio).slice(0, 10)} a ${String(paidWeek.semana_fin).slice(0, 10)})`;
}

async function isViajeLocked(viajeId) {
  const paidByDetalle = await db.query(
    `SELECT l.semana_inicio, l.semana_fin
     FROM liquidacion_detalle ld
     JOIN liquidaciones l ON l.id = ld.liquidacion_id
     JOIN pagos pg ON pg.liquidacion_id = l.id
     WHERE ld.viaje_id = $1
       AND LOWER(COALESCE(pg.estado, '')) = 'pagado'
     ORDER BY l.semana_inicio DESC
     LIMIT 1`,
    [Number(viajeId)]
  );

  if (paidByDetalle.rowCount > 0) {
    return {
      exists: true,
      locked: true,
      estado: paidWeekMessage(paidByDetalle.rows[0])
    };
  }

  const r = await db.query(
    `SELECT v.fecha, COALESCE(v.fecha_hasta, v.fecha) AS fecha_hasta, ev.nombre
     FROM viajes v
     JOIN estados_viaje ev ON ev.id = v.estado_viaje_id
     WHERE v.id = $1`,
    [Number(viajeId)]
  );

  if (r.rowCount === 0) return { exists: false, locked: false, estado: null };
  const paidWeek = await getPaidWeekOverlap(r.rows[0].fecha, r.rows[0].fecha_hasta);
  if (paidWeek) {
    return {
      exists: true,
      locked: true,
      estado: paidWeekMessage(paidWeek)
    };
  }

  const estado = String(r.rows[0].nombre || '').trim().toLowerCase();
  const locked = estado === 'liquidado' || estado === 'pagado';
  return { exists: true, locked, estado: r.rows[0].nombre };
}

async function validatePhase1ForTrips() {
  const missingCatalogs = [];

  for (const catalogName of PHASE1_REQUIRED_CATALOGS) {
    const table = CATALOG_CONFIG[catalogName].table;
    const result = await db.query(`SELECT COUNT(*)::int AS total FROM ${table}`);
    const total = Number(result.rows[0].total || 0);
    if (total === 0) {
      missingCatalogs.push(catalogName);
    }
  }

  return missingCatalogs;
}

async function validateConductor(conductorId) {
  const r = await db.query(
    `SELECT p.id
     FROM personal p
     JOIN personal_role_assignments pra ON pra.personal_id = p.id
     JOIN personal_roles pr ON pr.id = pra.role_id
     WHERE p.id = $1 AND p.activo = TRUE AND pr.activo = TRUE AND LOWER(pr.nombre) = 'chofer'`,
    [conductorId]
  );
  return r.rowCount > 0;
}

async function validateCamion(camionId) {
  const r = await db.query('SELECT id, placa FROM camiones WHERE id=$1 AND activo=TRUE', [camionId]);
  return r.rowCount > 0 ? r.rows[0] : null;
}

async function validateRuta(rutaId) {
  const r = await db.query('SELECT id FROM rutas WHERE id=$1 AND activo=TRUE', [rutaId]);
  return r.rowCount > 0;
}

async function getOrCreateRutaCortaProductoId() {
  const nombre = 'Sin producto (Ruta corta)';
  const existing = await db.query(
    `SELECT id
     FROM productos
     WHERE LOWER(nombre) = LOWER($1)
     ORDER BY id ASC
     LIMIT 1`,
    [nombre]
  );

  if (existing.rowCount > 0) return Number(existing.rows[0].id);

  const created = await db.query(
    `INSERT INTO productos(nombre, unidad_medida, peso_quintales_unidad, activo)
     VALUES($1,$2,$3,$4)
     ON CONFLICT (nombre)
     DO UPDATE SET nombre = EXCLUDED.nombre
     RETURNING id`,
    [nombre, 'NA', 0, false]
  );

  return Number(created.rows[0].id);
}

async function validateEstadoViaje(estadoViajeId) {
  const r = await db.query('SELECT id FROM estados_viaje WHERE id=$1 AND activo=TRUE', [estadoViajeId]);
  return r.rowCount > 0;
}

async function validateViajeCoreData(payload, excludeId = null) {
  const {
    viaje_id,
    camion_id,
    conductor_id,
    ruta_id,
    estado_viaje_id,
    km_inicial,
    km_final
  } = payload;

  const fechaDesde = payload.fecha_desde || payload.fecha;
  const fechaHasta = payload.fecha_hasta || payload.fecha;

  if (!hasValue(viaje_id)) return 'viaje_id es obligatorio';
  if (!isValidDate(fechaDesde)) return 'fecha_desde es obligatoria y debe tener formato YYYY-MM-DD';
  if (!isValidDate(fechaHasta)) return 'fecha_hasta es obligatoria y debe tener formato YYYY-MM-DD';
  if (fechaDesde > fechaHasta) return 'fecha_desde no puede ser mayor a fecha_hasta';
  if (!hasValue(camion_id)) return 'camion_id es obligatorio';
  if (!hasValue(conductor_id)) return 'conductor_id es obligatorio';
  if (!hasValue(ruta_id)) return 'ruta_id es obligatorio';
  if (!hasValue(estado_viaje_id)) return 'estado_viaje_id es obligatorio';

  if (Number(km_final) < Number(km_inicial)) {
    return 'km_final debe ser mayor o igual a km_inicial';
  }

  const camion = await validateCamion(Number(camion_id));
  if (!camion) return 'placa/camion invalido';

  const conductorValido = await validateConductor(Number(conductor_id));
  if (!conductorValido) return 'conductor invalido (debe existir y tener rol Chofer)';

  if (!(await validateRuta(Number(ruta_id)))) return 'ruta invalida';
  if (!(await validateEstadoViaje(Number(estado_viaje_id)))) return 'estado de viaje invalido';

  const duplicate = await db.query(
    `SELECT id FROM viajes WHERE viaje_id = $1 ${excludeId ? 'AND id <> $2' : ''}`,
    excludeId ? [String(viaje_id), Number(excludeId)] : [String(viaje_id)]
  );
  if (duplicate.rowCount > 0) return 'Viaje ID ya existe';

  return null;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime());
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '');
}

function validateDateRange(desde, hasta) {
  if (!isValidDate(desde) || !isValidDate(hasta)) {
    return 'desde y hasta deben tener formato YYYY-MM-DD';
  }
  if (desde > hasta) {
    return 'desde no puede ser mayor que hasta';
  }
  return null;
}

function formatDateKey(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return '';
  const year = asDate.getFullYear();
  const month = String(asDate.getMonth() + 1).padStart(2, '0');
  const day = String(asDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidMonth(value) {
  return /^\d{4}-\d{2}$/.test(value || '');
}

function getMonthDateRange(monthValue) {
  if (!isValidMonth(monthValue)) return null;
  const [yearRaw, monthRaw] = String(monthValue).split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;

  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0);
  const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
  return { start, end };
}

function parseMetricaRutaCortaPayload(payload) {
  const desdeRaw = hasValue(payload.condicion_valor_carga_desde)
    ? payload.condicion_valor_carga_desde
    : (hasValue(payload.condicion_valor_carga) ? payload.condicion_valor_carga : null);
  const hastaRaw = hasValue(payload.condicion_valor_carga_hasta)
    ? payload.condicion_valor_carga_hasta
    : (hasValue(payload.condicion_valor_carga) ? payload.condicion_valor_carga : null);

  const desde = Number(desdeRaw);
  const hasta = Number(hastaRaw);
  const numeroPersonas = Number(payload.numero_personas);
  const valorPagar = Number(payload.valor_pagar);

  if (!Number.isFinite(desde)) return { error: 'condicion_valor_carga_desde es obligatoria y debe ser numerica' };
  if (!Number.isFinite(hasta)) return { error: 'condicion_valor_carga_hasta es obligatoria y debe ser numerica' };
  if (desde > hasta) return { error: 'condicion_valor_carga_desde no puede ser mayor a condicion_valor_carga_hasta' };
  if (!Number.isFinite(numeroPersonas) || numeroPersonas <= 0) return { error: 'numero_personas es obligatorio y debe ser mayor a 0' };
  if (!Number.isFinite(valorPagar)) return { error: 'valor_pagar es obligatorio y debe ser numerico' };
  if (!hasValue(payload.tipo_operacion)) return { error: 'tipo_operacion es obligatorio' };

  return {
    data: {
      condicion_valor_carga_desde: desde,
      condicion_valor_carga_hasta: hasta,
      condicion_valor_carga: hasta,
      numero_personas: numeroPersonas,
      valor_pagar: valorPagar,
      tipo_operacion: payload.tipo_operacion,
      activo: payload.activo !== false
    }
  };
}

async function buildPersonalLookup() {
  const normalizeKey = (value) => String(value || '').trim();
  const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');

  const result = await db.query(
    `SELECT p.id, p.documento
     FROM personal p
     WHERE p.activo=TRUE`
  );
  const byDocumento = new Map();
  const byId = new Map();

  for (const row of result.rows) {
    if (hasValue(row.documento)) {
      const docRaw = normalizeKey(row.documento);
      const docDigits = normalizeDigits(row.documento);
      if (docRaw) byDocumento.set(docRaw, row.id);
      if (docDigits) byDocumento.set(docDigits, row.id);
    }

    const idRaw = normalizeKey(row.id);
    const idDigits = normalizeDigits(row.id);
    if (idRaw) byId.set(idRaw, row.id);
    if (idDigits) byId.set(idDigits, row.id);
  }

  return { byDocumento, byId };
}

function extractRoleIdsFromPayload(payload) {
  if (Array.isArray(payload.personal_role_ids)) {
    return [...new Set(payload.personal_role_ids.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
  }

  if (hasValue(payload.personal_role_id)) {
    const roleId = Number(payload.personal_role_id);
    return Number.isInteger(roleId) && roleId > 0 ? [roleId] : [];
  }

  return [];
}

async function validateRoleIds(roleIds) {
  if (!Array.isArray(roleIds) || roleIds.length === 0) return [];
  const result = await db.query(
    `SELECT id
     FROM personal_roles
     WHERE activo = TRUE AND id = ANY($1::int[])`,
    [roleIds]
  );
  return result.rows.map((row) => Number(row.id));
}

async function isAdminRoleSelected(roleIds) {
  if (!Array.isArray(roleIds) || roleIds.length === 0) return false;
  const result = await db.query(
    `SELECT 1
     FROM personal_roles
     WHERE id = ANY($1::int[])
       AND LOWER(nombre) = 'admin'
     LIMIT 1`,
    [roleIds]
  );
  return result.rowCount > 0;
}

async function getPersonalCatalogRows() {
  const result = await db.query(
    `SELECT p.id, p.nombre, p.apellidos, p.documento, p.banco_id, p.numero_cuenta, 
            p.celular, p.direccion, p.correo, p.user_id,
            p.afiliado_iess, p.fecha_afiliacion_iess, p.sueldo_iess, p.sueldo_real,
            p.descuenta_iess, p.cobra_decimo_tercero, p.cobra_decimo_cuarto, p.cobra_fondo_reserva,
            u.email,
            p.activo, p.created_at,
            COALESCE(array_agg(pra.role_id ORDER BY pra.role_id) FILTER (WHERE pra.role_id IS NOT NULL), ARRAY[]::int[]) AS personal_role_ids
     FROM personal p
     LEFT JOIN personal_role_assignments pra ON pra.personal_id = p.id
     LEFT JOIN users u ON u.id = p.user_id
     GROUP BY p.id, p.user_id, u.email
     ORDER BY p.id DESC`
  );

  return result.rows.map((row) => ({
    ...row,
    personal_role_ids: Array.isArray(row.personal_role_ids) ? row.personal_role_ids.map((value) => Number(value)) : [],
    personal_role_id: Array.isArray(row.personal_role_ids) && row.personal_role_ids.length > 0 ? Number(row.personal_role_ids[0]) : null
  }));
}

async function getPersonalCatalogRowById(id) {
  const result = await db.query(
    `SELECT p.id, p.nombre, p.apellidos, p.documento, p.banco_id, p.numero_cuenta,
            p.celular, p.direccion, p.correo, p.user_id,
            p.afiliado_iess, p.fecha_afiliacion_iess, p.sueldo_iess, p.sueldo_real,
            p.descuenta_iess, p.cobra_decimo_tercero, p.cobra_decimo_cuarto, p.cobra_fondo_reserva,
            u.email,
            p.activo, p.created_at,
            COALESCE(array_agg(pra.role_id ORDER BY pra.role_id) FILTER (WHERE pra.role_id IS NOT NULL), ARRAY[]::int[]) AS personal_role_ids
     FROM personal p
     LEFT JOIN personal_role_assignments pra ON pra.personal_id = p.id
     LEFT JOIN users u ON u.id = p.user_id
     WHERE p.id = $1
     GROUP BY p.id, p.user_id, u.email`,
    [id]
  );

  if (result.rowCount === 0) return null;
  const row = result.rows[0];
  return {
    ...row,
    personal_role_ids: Array.isArray(row.personal_role_ids) ? row.personal_role_ids.map((value) => Number(value)) : [],
    personal_role_id: Array.isArray(row.personal_role_ids) && row.personal_role_ids.length > 0 ? Number(row.personal_role_ids[0]) : null
  };
}

async function getAsignacionesByFecha(fecha) {
  const marcasResult = await db.query(
    `SELECT bm.id, bm.fecha, bm.personal_id, p.nombre AS personal_nombre, bm.biometrico_id,
            bm.primera_perforacion, bm.ultima_perforacion, bm.horas_reales_trabajo, bm.aplica_pago,
            COUNT(ae.id)::int AS asignaciones_count
     FROM biometrico_marcas bm
     JOIN personal p ON p.id = bm.personal_id
     LEFT JOIN asignacion_estiba ae ON ae.marca_id = bm.id
     WHERE bm.fecha = $1
     GROUP BY bm.id, p.nombre
     ORDER BY p.nombre ASC, bm.id ASC`,
    [fecha]
  );

  const viajesResult = await db.query(
    `SELECT v.id, v.viaje_id, v.fecha, v.tipo_operacion, v.km_inicial, v.km_final,
            c.placa, p.nombre AS conductor_nombre, r.nombre AS ruta_nombre, ev.nombre AS estado_nombre,
            COUNT(ae.id)::int AS estibadores_asignados
     FROM viajes v
     JOIN camiones c ON c.id = v.camion_id
     JOIN personal p ON p.id = v.conductor_id
     JOIN rutas r ON r.id = v.ruta_id
     JOIN estados_viaje ev ON ev.id = v.estado_viaje_id
     LEFT JOIN asignacion_estiba ae ON ae.viaje_id = v.id
     WHERE v.fecha = $1
     GROUP BY v.id, c.placa, p.nombre, r.nombre, ev.nombre
     ORDER BY v.id DESC`,
    [fecha]
  );

  const asignacionesResult = await db.query(
    `SELECT ae.id, ae.viaje_id, ae.marca_id, ae.created_at,
            v.viaje_id AS viaje_codigo,
            bm.fecha, bm.personal_id, bm.biometrico_id,
            p.nombre AS estibador_nombre
     FROM asignacion_estiba ae
     JOIN viajes v ON v.id = ae.viaje_id
     JOIN biometrico_marcas bm ON bm.id = ae.marca_id
     JOIN personal p ON p.id = bm.personal_id
     WHERE bm.fecha = $1
     ORDER BY ae.id DESC`,
    [fecha]
  );

  return {
    fecha,
    marcas: marcasResult.rows,
    viajes: viajesResult.rows,
    asignaciones: asignacionesResult.rows
  };
}

function normalizeOperacion(value) {
  return String(value || '').trim().toLowerCase();
}

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function splitAmount(total, parts) {
  const totalCents = Math.round(Number(total || 0) * 100);
  if (!parts || parts <= 0) return [];

  const base = Math.floor(totalCents / parts);
  const remainder = totalCents - (base * parts);
  return Array.from({ length: parts }, (_, index) => ((base + (index < remainder ? 1 : 0)) / 100));
}

async function computePagoRutaCorta(viajeId, tipoOperacion, numeroPersonas = 1) {
  const carga = await db.query(
    `SELECT COALESCE(SUM(valor_carga), 0)::numeric(12,2) AS total_carga
     FROM viaje_carga
     WHERE viaje_ref_id = $1`,
    [viajeId]
  );

  const totalCarga = Number(carga.rows[0]?.total_carga || 0);
  console.log(`[DEBUG] computePagoRutaCorta viaje=${viajeId}, tipoOp=${tipoOperacion}, totalCarga=${totalCarga}, numeroPersonas=${numeroPersonas}`);
  
  // Buscar métrica que coincida con el rango de carga Y el número de personas
  const metric = await db.query(
    `SELECT valor_pagar, numero_personas
     FROM metricas_ruta_corta
     WHERE activo = TRUE
       AND LOWER(tipo_operacion) IN ($1, 'mixto')
       AND numero_personas = $3
       AND (
         (
           condicion_valor_carga_desde IS NOT NULL
           AND condicion_valor_carga_hasta IS NOT NULL
           AND $2 BETWEEN condicion_valor_carga_desde AND condicion_valor_carga_hasta
         )
         OR (
           condicion_valor_carga_desde IS NULL
           AND condicion_valor_carga_hasta IS NULL
           AND condicion_valor_carga <= $2
         )
       )
     ORDER BY COALESCE(condicion_valor_carga_desde, condicion_valor_carga) DESC,
              COALESCE(condicion_valor_carga_hasta, condicion_valor_carga) ASC,
              id DESC
     LIMIT 1`,
    [normalizeOperacion(tipoOperacion), totalCarga, numeroPersonas]
  );

  // valor_pagar es el pago por CADA persona, multiplicamos por el número de personas para obtener el total
  const valorPorPersona = Number(metric.rows[0]?.valor_pagar || 0);
  const result = round2(valorPorPersona * numeroPersonas);
  console.log(`[DEBUG] computePagoRutaCorta resultado=${result} (${valorPorPersona} x ${numeroPersonas}), metricaEncontrada=${metric.rowCount}`);
  return result;
}

async function computePagoRutaLarga(viajeId, tipoOperacion) {
  const tipoNorm = normalizeOperacion(tipoOperacion);
  
  // Si el viaje es 'mixto', buscar métricas para cualquier tipo de operación
  // Si es 'carga' o 'descarga', buscar solo ese tipo específico (o 'mixto' como fallback)
  let tiposPermitidos;
  if (tipoNorm === 'mixto') {
    tiposPermitidos = ['carga', 'descarga', 'mixto'];
  } else {
    tiposPermitidos = [tipoNorm, 'mixto'];
  }

  const rows = await db.query(
    `SELECT vc.id, vc.cantidad, vc.producto_id,
            COALESCE(metric.valor_unitario, 0) AS valor_unitario
     FROM viaje_carga vc
     LEFT JOIN LATERAL (
       SELECT ml.valor_unitario, ml.tipo_operacion
       FROM metricas_ruta_larga ml
       WHERE ml.activo = TRUE
         AND ml.producto_id = vc.producto_id
         AND LOWER(ml.tipo_operacion) = ANY($2)
       ORDER BY CASE 
         WHEN LOWER(ml.tipo_operacion) = 'carga' THEN 0
         WHEN LOWER(ml.tipo_operacion) = 'descarga' THEN 1
         WHEN LOWER(ml.tipo_operacion) = 'mixto' THEN 2
         ELSE 3 
       END, ml.id DESC
       LIMIT 1
     ) AS metric ON TRUE
     WHERE vc.viaje_ref_id = $1`,
    [viajeId, tiposPermitidos]
  );

  console.log(`[DEBUG] computePagoRutaLarga viaje=${viajeId}, tipoOp=${tipoOperacion}, cargas=${rows.rowCount}`, rows.rows.map(r => ({ cantidad: r.cantidad, producto_id: r.producto_id, valor_unitario: r.valor_unitario })));

  // Solo paga por cantidad × valor_unitario (del catálogo de ruta larga)
  const result = round2(rows.rows.reduce((acc, row) => acc + (Number(row.cantidad || 0) * Number(row.valor_unitario || 0)), 0));
  console.log(`[DEBUG] computePagoRutaLarga resultado=${result}`);
  return result;
}

async function computePagoViajeEstiba(viaje, numeroPersonas = 1) {
  const tipoRuta = normalizeOperacion(viaje.ruta_tipo);
  console.log(`[DEBUG] computePagoViajeEstiba viaje=${viaje.viaje_id} (id=${viaje.id}), tipoRuta=${tipoRuta}, tipoOperacion=${viaje.tipo_operacion}, numeroPersonas=${numeroPersonas}`);
  
  if (tipoRuta === 'corta') {
    const pago = await computePagoRutaCorta(viaje.id, viaje.tipo_operacion, numeroPersonas);
    console.log(`[DEBUG] Viaje ${viaje.viaje_id} es CORTA, pago=${pago}`);
    return pago;
  }

  if (tipoRuta === 'larga') {
    const pago = await computePagoRutaLarga(viaje.id, viaje.tipo_operacion);
    console.log(`[DEBUG] Viaje ${viaje.viaje_id} es LARGA, pago=${pago}`);
    return pago;
  }

  // Para rutas mixtas, pagar AMBOS: ruta larga + ruta corta
  const montoLarga = await computePagoRutaLarga(viaje.id, viaje.tipo_operacion);
  const montoCorta = await computePagoRutaCorta(viaje.id, viaje.tipo_operacion, numeroPersonas);
  const total = round2(montoLarga + montoCorta);
  console.log(`[DEBUG] Viaje ${viaje.viaje_id} es MIXTA, montoLarga=${montoLarga}, montoCorta=${montoCorta}, total=${total}`);
  return total;
}

async function buildLiquidacionSemana(semanaInicio, semanaFin) {
  const viajesResult = await db.query(
    `SELECT DISTINCT v.id, v.viaje_id, v.fecha, v.tipo_operacion, r.tipo AS ruta_tipo
     FROM viajes v
     JOIN rutas r ON r.id = v.ruta_id
     JOIN viaje_personal vp ON vp.viaje_id = v.id
     WHERE v.fecha BETWEEN $1 AND $2
     ORDER BY v.fecha ASC, v.id ASC`,
    [semanaInicio, semanaFin]
  );

  const byEstibador = new Map();

  for (const viaje of viajesResult.rows) {
    const asignaciones = await db.query(
      `SELECT vp.personal_id, p.nombre AS estibador_nombre
       FROM viaje_personal vp
       JOIN personal p ON p.id = vp.personal_id
       WHERE vp.viaje_id = $1
       ORDER BY vp.id ASC`,
      [viaje.id]
    );

    if (asignaciones.rowCount === 0) continue;

    const pagoViaje = round2(await computePagoViajeEstiba(viaje, asignaciones.rowCount));
    const montos = splitAmount(pagoViaje, asignaciones.rowCount);

    asignaciones.rows.forEach((asignacion, index) => {
      const personalId = Number(asignacion.personal_id);
      const current = byEstibador.get(personalId) || {
        personal_id: personalId,
        estibador_nombre: asignacion.estibador_nombre,
        total: 0,
        detalles: [],
        ajustes: []
      };

      const monto = round2(montos[index] || 0);
      current.total = round2(current.total + monto);
      current.detalles.push({
        viaje_id: viaje.id,
        viaje_codigo: viaje.viaje_id,
        fecha: viaje.fecha,
        asignacion_id: null,
        monto
      });

      byEstibador.set(personalId, current);
    });
  }

  // Aplicar ajustes semanales (sobrantes y faltantes) para estibadores
  const personasIds = Array.from(byEstibador.keys());
  
  // Buscar todos los ajustes semanales activos (incluso de personas sin viajes)
  // Excluir ajustes de cuota única que ya fueron aplicados en una liquidación anterior
  const ajustesSemanales = await db.query(
    `SELECT ap.id, ap.personal_id, ap.tipo, ap.detalle, ap.valor_total, ap.en_cuotas, ap.cantidad_cuotas, ap.cuota_actual,
            p.nombre, p.apellidos
     FROM ajustes_personal ap
     JOIN personal p ON p.id = ap.personal_id
     WHERE ap.estado = 'activo'
       AND ap.frecuencia = 'semanal'
       AND ap.fecha_inicio <= $1
       AND (
         ap.en_cuotas = TRUE
         OR NOT EXISTS (
           SELECT 1 FROM ajustes_aplicaciones aa
           WHERE aa.ajuste_id = ap.id
         )
       )`,
    [semanaFin]
  );
  
  for (const ajuste of ajustesSemanales.rows) {
    const personalId = Number(ajuste.personal_id);
    
    // Si la persona no está en el mapa, agregarla
    if (!byEstibador.has(personalId)) {
      byEstibador.set(personalId, {
        personal_id: personalId,
        estibador_nombre: `${ajuste.nombre} ${ajuste.apellidos || ''}`.trim(),
        total: 0,
        detalles: [],
        ajustes: []
      });
    }
    
    const current = byEstibador.get(personalId);

    const montoAplicar = ajuste.en_cuotas 
      ? Number(ajuste.valor_total) / Number(ajuste.cantidad_cuotas)
      : Number(ajuste.valor_total);

    // sobrante suma, faltante resta
    if (ajuste.tipo === 'sobrante') {
      current.total = round2(current.total + montoAplicar);
    } else if (ajuste.tipo === 'faltante') {
      current.total = round2(current.total - montoAplicar);
    }

    current.ajustes.push({
      ajuste_id: ajuste.id,
      tipo: ajuste.tipo,
      detalle: ajuste.detalle,
      monto: montoAplicar,
      cuota_numero: ajuste.cuota_actual + 1,
      en_cuotas: ajuste.en_cuotas,
      cantidad_cuotas: ajuste.cantidad_cuotas
    });
  }

  return Array.from(byEstibador.values()).sort((a, b) => a.estibador_nombre.localeCompare(b.estibador_nombre));
}

async function listLiquidaciones(semanaInicio = null, semanaFin = null) {
  const params = [];
  let where = '';

  if (semanaInicio && semanaFin) {
    params.push(semanaInicio, semanaFin);
    where = 'WHERE l.semana_inicio = $1 AND l.semana_fin = $2';
  }

  const result = await db.query(
    `SELECT l.id, l.semana_inicio, l.semana_fin, l.estibador_personal_id, p.nombre AS estibador_nombre,
            p.numero_cuenta,
            l.total,
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM pagos pg
                WHERE pg.liquidacion_id = l.id
                  AND LOWER(COALESCE(pg.estado, '')) = 'pagado'
              ) THEN 'pagado'
              ELSE l.estado
            END AS estado,
            l.created_at,
            (
              (SELECT COUNT(*) FROM liquidacion_detalle ld2 WHERE ld2.liquidacion_id = l.id)
              +
              (SELECT COUNT(*) FROM liquidacion_ajustes_detalle lad2 WHERE lad2.liquidacion_id = l.id)
            )::int AS detalles_count,
            CASE
              WHEN (
                (SELECT COUNT(*) FROM liquidacion_detalle ld2 WHERE ld2.liquidacion_id = l.id)
                +
                (SELECT COUNT(*) FROM liquidacion_ajustes_detalle lad2 WHERE lad2.liquidacion_id = l.id)
              ) = 0 THEN 'Sin detalle'
              WHEN (
                (
                  SELECT COUNT(*)
                  FROM liquidacion_detalle ld2
                  JOIN viajes vj ON vj.id = ld2.viaje_id
                  WHERE ld2.liquidacion_id = l.id
                    AND EXISTS (
                      SELECT 1
                      FROM biometrico_marcas bm
                      WHERE bm.personal_id = l.estibador_personal_id
                        AND bm.fecha = vj.fecha
                        AND bm.aplica_pago = TRUE
                    )
                )
                +
                (
                  SELECT COUNT(*)
                  FROM liquidacion_ajustes_detalle lad2
                  JOIN ajustes_personal ap2 ON ap2.id = lad2.ajuste_id
                  WHERE lad2.liquidacion_id = l.id
                    AND EXISTS (
                      SELECT 1
                      FROM biometrico_marcas bm
                      WHERE bm.personal_id = l.estibador_personal_id
                        AND bm.fecha = ap2.fecha_inicio
                        AND bm.aplica_pago = TRUE
                    )
                )
              ) = (
                (SELECT COUNT(*) FROM liquidacion_detalle ld2 WHERE ld2.liquidacion_id = l.id)
                +
                (SELECT COUNT(*) FROM liquidacion_ajustes_detalle lad2 WHERE lad2.liquidacion_id = l.id)
              ) THEN 'Justificado'
              ELSE 'Pendiente TXT'
            END AS justificacion_txt
     FROM liquidaciones l
     JOIN personal p ON p.id = l.estibador_personal_id
     LEFT JOIN liquidacion_detalle ld ON ld.liquidacion_id = l.id
     ${where}
     GROUP BY l.id, p.nombre, p.numero_cuenta
     ORDER BY l.semana_inicio DESC, l.id DESC`,
    params
  );

  return result.rows;
}

async function getLiquidacionTxtStatus(queryable, liquidacionId) {
  const result = await queryable.query(
    `SELECT CASE
              WHEN (
                (SELECT COUNT(*) FROM liquidacion_detalle ld2 WHERE ld2.liquidacion_id = l.id)
                +
                (SELECT COUNT(*) FROM liquidacion_ajustes_detalle lad2 WHERE lad2.liquidacion_id = l.id)
              ) = 0 THEN 'Sin detalle'
              WHEN (
                (
                  SELECT COUNT(*)
                  FROM liquidacion_detalle ld2
                  JOIN viajes vj ON vj.id = ld2.viaje_id
                  WHERE ld2.liquidacion_id = l.id
                    AND EXISTS (
                      SELECT 1
                      FROM biometrico_marcas bm
                      WHERE bm.personal_id = l.estibador_personal_id
                        AND bm.fecha = vj.fecha
                        AND bm.aplica_pago = TRUE
                    )
                )
                +
                (
                  SELECT COUNT(*)
                  FROM liquidacion_ajustes_detalle lad2
                  JOIN ajustes_personal ap2 ON ap2.id = lad2.ajuste_id
                  WHERE lad2.liquidacion_id = l.id
                    AND EXISTS (
                      SELECT 1
                      FROM biometrico_marcas bm
                      WHERE bm.personal_id = l.estibador_personal_id
                        AND bm.fecha = ap2.fecha_inicio
                        AND bm.aplica_pago = TRUE
                    )
                )
              ) = (
                (SELECT COUNT(*) FROM liquidacion_detalle ld2 WHERE ld2.liquidacion_id = l.id)
                +
                (SELECT COUNT(*) FROM liquidacion_ajustes_detalle lad2 WHERE lad2.liquidacion_id = l.id)
              ) THEN 'Justificado'
              ELSE 'Pendiente TXT'
            END AS justificacion_txt
     FROM liquidaciones l
     LEFT JOIN liquidacion_detalle ld ON ld.liquidacion_id = l.id
     WHERE l.id = $1
     GROUP BY l.id, l.estibador_personal_id`,
    [Number(liquidacionId)]
  );

  if (result.rowCount === 0) return null;
  return String(result.rows[0].justificacion_txt || 'Pendiente TXT');
}

function parseBiometricoText(fileText) {
  const errors = [];
  const rows = [];

  function normalizeHeaderToken(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '');
  }

  function isValidHeader(parts) {
    if (!Array.isArray(parts) || parts.length !== BIOMETRICO_HEADERS.length) return false;
    const normalized = parts.map(normalizeHeaderToken);
    return (
      normalized[0].includes('id') && normalized[0].includes('persona') &&
      normalized[1].includes('nombre') &&
      normalized[2].includes('departamento') &&
      normalized[3] === 'fecha' &&
      normalized[4].includes('primera') && normalized[4].includes('perforacion') &&
      normalized[5].includes('ultima') && normalized[5].includes('perforacion') &&
      normalized[6].includes('numero') && normalized[6].includes('perforaciones') &&
      normalized[7].includes('horas') && normalized[7].includes('reales') && normalized[7].includes('trabajo')
    );
  }

  const lines = String(fileText || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');

  if (lines.length === 0) {
    return { rows, errors: [{ row: 0, column: '*', message: 'archivo vacio' }] };
  }

  let headerIndex = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const maybeHeader = lines[index].split('|').map((value) => value.trim());
    if (isValidHeader(maybeHeader)) {
      headerIndex = index;
      break;
    }
  }

  if (headerIndex === -1) {
    errors.push({
      row: 1,
      column: 'header',
      message: 'columnas invalidas. Encabezado esperado (acepta espacios/acentos): ID persona|Nombre|Departamento|Fecha|Primera perforacion|Ultima perforacion|Numero perforaciones|Horas reales de trabajo'
    });
    return { rows, errors };
  }

  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const parts = rawLine.split('|').map((value) => value.trim());
    const rowNumber = index + 1;

    if (parts.length !== BIOMETRICO_HEADERS.length) {
      errors.push({ row: rowNumber, column: '*', message: 'estructura incorrecta de columnas' });
      continue;
    }

    const row = {
      id_persona: parts[0],
      nombre: parts[1],
      departamento: parts[2],
      fecha: parts[3],
      primera_perforacion: parts[4],
      ultima_perforacion: parts[5],
      numero_perforaciones: parts[6],
      horas_reales_trabajo: parts[7],
      rowNumber
    };

    if (!hasValue(row.id_persona)) errors.push({ row: rowNumber, column: 'ID_persona', message: 'ID_persona obligatorio' });
    if (!isValidDate(row.fecha)) errors.push({ row: rowNumber, column: 'Fecha', message: 'fecha invalida (YYYY-MM-DD)' });
    if (!isValidTime(row.primera_perforacion)) errors.push({ row: rowNumber, column: 'Primera_perforacion', message: 'hora invalida (HH:MM)' });
    if (!isValidTime(row.ultima_perforacion)) errors.push({ row: rowNumber, column: 'Ultima_perforacion', message: 'hora invalida (HH:MM)' });

    const perforaciones = Number(row.numero_perforaciones);
    if (!Number.isInteger(perforaciones) || perforaciones < 1) {
      errors.push({ row: rowNumber, column: 'Numero_perforaciones', message: 'debe ser entero >= 1' });
    }

    const horas = Number(row.horas_reales_trabajo);
    if (Number.isNaN(horas)) {
      errors.push({ row: rowNumber, column: 'Horas_reales_trabajo', message: 'debe ser numerico' });
    }

    rows.push(row);
  }

  return { rows, errors };
}

app.get('/api/catalogs/:catalog', authMiddleware, requireModulePermission('base_datos', 'can_access'), async (req, res) => {
  try {
    const catalog = getCatalogOrFail(req.params.catalog, res);
    if (!catalog) return;

    if (req.params.catalog === 'personal') {
      const rows = await getPersonalCatalogRows();
      return res.json(rows);
    }

    if (req.params.catalog === 'metricas_ruta_corta') {
      const rows = await db.query(
        `SELECT id,
                COALESCE(condicion_valor_carga_desde, 0) AS condicion_valor_carga_desde,
                COALESCE(condicion_valor_carga_hasta, condicion_valor_carga) AS condicion_valor_carga_hasta,
                numero_personas,
                valor_pagar, tipo_operacion, activo, created_at
         FROM metricas_ruta_corta
         ORDER BY id DESC`
      );
      return res.json(rows.rows);
    }

    const result = await db.query(`SELECT ${catalog.select} FROM ${catalog.table} ORDER BY id DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/catalogs/:catalog', authMiddleware, requireModulePermission('base_datos', 'can_modify'), async (req, res) => {
  try {
    const catalog = getCatalogOrFail(req.params.catalog, res);
    if (!catalog) return;

    if (req.params.catalog === 'personal') {
      for (const field of catalog.requiredFields) {
        if (!hasValue(req.body[field])) {
          return res.status(400).json({ error: `campo obligatorio: ${field}` });
        }
      }

      const roleIds = extractRoleIdsFromPayload(req.body);
      if (roleIds.length === 0) {
        return res.status(400).json({ error: 'debe seleccionar al menos un rol' });
      }

      const validRoleIds = await validateRoleIds(roleIds);
      if (validRoleIds.length !== roleIds.length) {
        return res.status(400).json({ error: 'uno o mas roles son invalidos o inactivos' });
      }

      const isAdmin = await isAdminRoleSelected(validRoleIds);
      let userId = null;
      if (isAdmin) {
        if (!hasValue(req.body.email)) {
          return res.status(400).json({ error: 'correo es obligatorio para rol Admin' });
        }
        if (!hasValue(req.body.password)) {
          return res.status(400).json({ error: 'contrasena es obligatoria para rol Admin' });
        }

        const passwordHash = await bcrypt.hash(String(req.body.password), 10);
        const userCreated = await db.query(
          `INSERT INTO users(email, password_hash, role)
           VALUES($1,$2,$3)
           RETURNING id`,
          [String(req.body.email).trim().toLowerCase(), passwordHash, 'admin']
        );
        userId = Number(userCreated.rows[0].id);
      }

      const created = await db.query(
        `INSERT INTO personal(
          nombre, apellidos, documento, banco_id, numero_cuenta,
          celular, direccion, correo,
          afiliado_iess, fecha_afiliacion_iess, sueldo_iess, sueldo_real,
          descuenta_iess, cobra_decimo_tercero, cobra_decimo_cuarto, cobra_fondo_reserva,
          user_id, activo
        )
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         RETURNING id`,
        [
          req.body.nombre,
          req.body.apellidos || null,
          req.body.documento || null,
          hasValue(req.body.banco_id) ? Number(req.body.banco_id) : null,
          req.body.numero_cuenta || null,
          req.body.celular || null,
          req.body.direccion || null,
          req.body.correo || null,
          req.body.afiliado_iess === true,
          hasValue(req.body.fecha_afiliacion_iess) ? String(req.body.fecha_afiliacion_iess) : null,
          hasValue(req.body.sueldo_iess) ? Number(req.body.sueldo_iess) : null,
          hasValue(req.body.sueldo_real) ? Number(req.body.sueldo_real) : null,
          req.body.descuenta_iess === true,
          req.body.cobra_decimo_tercero === true,
          req.body.cobra_decimo_cuarto === true,
          req.body.cobra_fondo_reserva === true,
          userId,
          req.body.activo !== false
        ]
      );

      const personalId = Number(created.rows[0].id);
      for (const roleId of validRoleIds) {
        await db.query(
          `INSERT INTO personal_role_assignments(personal_id, role_id)
           VALUES($1,$2)
           ON CONFLICT (personal_id, role_id) DO NOTHING`,
          [personalId, roleId]
        );
      }

      const row = await getPersonalCatalogRowById(personalId);
      return res.status(201).json(row);
    }

    if (req.params.catalog === 'metricas_ruta_corta') {
      const parsed = parseMetricaRutaCortaPayload(req.body || {});
      if (parsed.error) return res.status(400).json({ error: parsed.error });

      const created = await db.query(
        `INSERT INTO metricas_ruta_corta(
          condicion_valor_carga_desde,
          condicion_valor_carga_hasta,
          condicion_valor_carga,
          numero_personas,
          valor_pagar,
          tipo_operacion,
          activo
        )
        VALUES($1,$2,$3,$4,$5,$6,$7)
        RETURNING id,
                  COALESCE(condicion_valor_carga_desde, 0) AS condicion_valor_carga_desde,
                  COALESCE(condicion_valor_carga_hasta, condicion_valor_carga) AS condicion_valor_carga_hasta,
                  numero_personas,
                  valor_pagar, tipo_operacion, activo, created_at`,
        [
          parsed.data.condicion_valor_carga_desde,
          parsed.data.condicion_valor_carga_hasta,
          parsed.data.condicion_valor_carga,
          parsed.data.numero_personas,
          parsed.data.valor_pagar,
          parsed.data.tipo_operacion,
          parsed.data.activo
        ]
      );

      return res.status(201).json(created.rows[0]);
    }

    for (const field of catalog.requiredFields) {
      if (!hasValue(req.body[field])) {
        return res.status(400).json({ error: `campo obligatorio: ${field}` });
      }
    }

    const fields = catalog.insertFields.filter((field) => req.body[field] !== undefined);
    if (fields.length === 0) {
      return res.status(400).json({ error: 'sin campos para guardar' });
    }

    const placeholders = fields.map((_, index) => `$${index + 1}`);
    const values = fields.map((field) => req.body[field]);

    const result = await db.query(
      `INSERT INTO ${catalog.table}(${fields.join(',')}) VALUES(${placeholders.join(',')}) RETURNING ${catalog.select}`,
      values
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'correo ya registrado' });
    }
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.put('/api/catalogs/:catalog/:id', authMiddleware, requireModulePermission('base_datos', 'can_modify'), async (req, res) => {
  try {
    const catalog = getCatalogOrFail(req.params.catalog, res);
    if (!catalog) return;

    if (req.params.catalog === 'personal') {
      const personalId = Number(req.params.id);
      const exists = await db.query('SELECT id, user_id FROM personal WHERE id=$1', [personalId]);
      if (exists.rowCount === 0) {
        return res.status(404).json({ error: 'registro no encontrado' });
      }

      const currentUserId = hasValue(exists.rows[0].user_id) ? Number(exists.rows[0].user_id) : null;

      const fields = [
        'nombre', 'apellidos', 'documento', 'banco_id', 'numero_cuenta',
        'celular', 'direccion', 'correo',
        'afiliado_iess', 'fecha_afiliacion_iess', 'sueldo_iess', 'sueldo_real',
        'descuenta_iess', 'cobra_decimo_tercero', 'cobra_decimo_cuarto', 'cobra_fondo_reserva',
        'activo'
      ].filter((field) => req.body[field] !== undefined);
      if (fields.length > 0) {
        const setSql = fields.map((field, index) => `${field}=$${index + 1}`).join(', ');
        const values = fields.map((field) => {
          if (field === 'banco_id') return hasValue(req.body[field]) ? Number(req.body[field]) : null;
          if (field === 'sueldo_iess' || field === 'sueldo_real') return hasValue(req.body[field]) ? Number(req.body[field]) : null;
          if (field === 'fecha_afiliacion_iess') return hasValue(req.body[field]) ? String(req.body[field]) : null;
          if (
            field === 'afiliado_iess' ||
            field === 'descuenta_iess' ||
            field === 'cobra_decimo_tercero' ||
            field === 'cobra_decimo_cuarto' ||
            field === 'cobra_fondo_reserva' ||
            field === 'activo'
          ) return req.body[field] === true;
          return req.body[field];
        });
        values.push(personalId);

        await db.query(
          `UPDATE personal
           SET ${setSql}
           WHERE id=$${fields.length + 1}`,
          values
        );
      }

      const hasRolePayload = Array.isArray(req.body.personal_role_ids) || req.body.personal_role_id !== undefined;
      let finalRoleIds = [];
      if (hasRolePayload) {
        const roleIds = extractRoleIdsFromPayload(req.body);
        if (roleIds.length === 0) {
          return res.status(400).json({ error: 'debe seleccionar al menos un rol' });
        }

        finalRoleIds = await validateRoleIds(roleIds);
        if (finalRoleIds.length !== roleIds.length) {
          return res.status(400).json({ error: 'uno o mas roles son invalidos o inactivos' });
        }

        await db.query('DELETE FROM personal_role_assignments WHERE personal_id=$1', [personalId]);
        for (const roleId of finalRoleIds) {
          await db.query(
            `INSERT INTO personal_role_assignments(personal_id, role_id)
             VALUES($1,$2)
             ON CONFLICT (personal_id, role_id) DO NOTHING`,
            [personalId, roleId]
          );
        }
      } else {
        const currentRoles = await db.query(
          `SELECT role_id
           FROM personal_role_assignments
           WHERE personal_id = $1`,
          [personalId]
        );
        finalRoleIds = currentRoles.rows.map((row) => Number(row.role_id));
      }

      const isAdmin = await isAdminRoleSelected(finalRoleIds);
      if (isAdmin) {
        const emailProvided = hasValue(req.body.email);
        const passwordProvided = hasValue(req.body.password);

        if (!currentUserId && !emailProvided) {
          return res.status(400).json({ error: 'correo es obligatorio para rol Admin' });
        }
        if (!currentUserId && !passwordProvided) {
          return res.status(400).json({ error: 'contrasena es obligatoria para rol Admin' });
        }

        if (!currentUserId) {
          const passwordHash = await bcrypt.hash(String(req.body.password), 10);
          const userCreated = await db.query(
            `INSERT INTO users(email, password_hash, role)
             VALUES($1,$2,$3)
             RETURNING id`,
            [String(req.body.email).trim().toLowerCase(), passwordHash, 'admin']
          );

          await db.query('UPDATE personal SET user_id=$1 WHERE id=$2', [Number(userCreated.rows[0].id), personalId]);
        } else {
          const updates = [];
          const values = [];

          if (emailProvided) {
            updates.push(`email=$${updates.length + 1}`);
            values.push(String(req.body.email).trim().toLowerCase());
          }

          if (passwordProvided) {
            updates.push(`password_hash=$${updates.length + 1}`);
            values.push(await bcrypt.hash(String(req.body.password), 10));
          }

          if (updates.length > 0) {
            values.push(currentUserId);
            await db.query(
              `UPDATE users
               SET ${updates.join(', ')}
               WHERE id=$${updates.length + 1}`,
              values
            );
          }

          await db.query('UPDATE users SET role=$1 WHERE id=$2', ['admin', currentUserId]);
        }
      }

      const row = await getPersonalCatalogRowById(personalId);
      return res.json(row);
    }

    if (req.params.catalog === 'metricas_ruta_corta') {
      const parsed = parseMetricaRutaCortaPayload(req.body || {});
      if (parsed.error) return res.status(400).json({ error: parsed.error });

      const updated = await db.query(
        `UPDATE metricas_ruta_corta
         SET condicion_valor_carga_desde = $1,
             condicion_valor_carga_hasta = $2,
             condicion_valor_carga = $3,
             numero_personas = $4,
             valor_pagar = $5,
             tipo_operacion = $6,
             activo = $7
         WHERE id = $8
         RETURNING id,
                   COALESCE(condicion_valor_carga_desde, 0) AS condicion_valor_carga_desde,
                   COALESCE(condicion_valor_carga_hasta, condicion_valor_carga) AS condicion_valor_carga_hasta,
                   numero_personas,
                   valor_pagar, tipo_operacion, activo, created_at`,
        [
          parsed.data.condicion_valor_carga_desde,
          parsed.data.condicion_valor_carga_hasta,
          parsed.data.condicion_valor_carga,
          parsed.data.numero_personas,
          parsed.data.valor_pagar,
          parsed.data.tipo_operacion,
          parsed.data.activo,
          Number(req.params.id)
        ]
      );

      if (updated.rowCount === 0) {
        return res.status(404).json({ error: 'registro no encontrado' });
      }

      return res.json(updated.rows[0]);
    }

    const fields = catalog.insertFields.filter((field) => req.body[field] !== undefined);
    if (fields.length === 0) {
      return res.status(400).json({ error: 'sin campos para actualizar' });
    }

    const setSql = fields.map((field, index) => `${field}=$${index + 1}`).join(', ');
    const values = fields.map((field) => req.body[field]);
    values.push(Number(req.params.id));

    const result = await db.query(
      `UPDATE ${catalog.table} SET ${setSql} WHERE id=$${fields.length + 1} RETURNING ${catalog.select}`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'registro no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'correo ya registrado' });
    }
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.delete('/api/catalogs/:catalog/:id', authMiddleware, requireModulePermission('base_datos', 'can_delete'), async (req, res) => {
  try {
    const catalog = getCatalogOrFail(req.params.catalog, res);
    if (!catalog) return;

    const result = await db.query(`DELETE FROM ${catalog.table} WHERE id=$1 RETURNING id`, [Number(req.params.id)]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'registro no encontrado' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/biometrico/imports', authMiddleware, requireModulePermission('biometrico', 'can_access'), async (req, res) => {
  try {
    const r = await db.query(
      `SELECT id, file_name, file_hash, import_date, total_rows, valid_rows, status, errors_json, created_at
       FROM biometrico_imports
       ORDER BY id DESC`
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/biometrico/marcas', authMiddleware, requireModulePermission('biometrico', 'can_access'), async (req, res) => {
  try {
    const { fecha } = req.query;
    const params = [];
    let where = '';
    if (fecha) {
      where = 'WHERE bm.fecha = $1';
      params.push(fecha);
    }

    const r = await db.query(
      `SELECT bm.id, bm.import_id, bm.personal_id, p.nombre AS personal_nombre, bm.biometrico_id,
              bm.nombre_txt, bm.departamento_txt, bm.fecha, bm.primera_perforacion, bm.ultima_perforacion,
              bm.numero_perforaciones, bm.horas_reales_trabajo, bm.aplica_pago, bm.created_at
       FROM biometrico_marcas bm
       JOIN personal p ON p.id = bm.personal_id
       ${where}
       ORDER BY bm.fecha DESC, bm.id DESC`,
      params
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.delete('/api/biometrico/imports/:id', authMiddleware, requireModulePermission('biometrico', 'can_delete'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await db.query('SELECT id, file_name, import_date FROM biometrico_imports WHERE id=$1', [id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'importacion no encontrada' });
    }

    const range = await db.query(
      `SELECT MIN(fecha) AS fecha_min, MAX(fecha) AS fecha_max
       FROM biometrico_marcas
       WHERE import_id = $1`,
      [id]
    );

    const fechaMin = range.rows[0]?.fecha_min || existing.rows[0].import_date;
    const fechaMax = range.rows[0]?.fecha_max || existing.rows[0].import_date;
    const paidWeek = await getPaidWeekOverlap(fechaMin, fechaMax);
    if (paidWeek) {
      return res.status(409).json({
        error: `importacion bloqueada por ${paidWeekMessage(paidWeek)}. Elimina primero el pago registrado de esa semana.`
      });
    }

    await db.query('DELETE FROM biometrico_imports WHERE id=$1', [id]);

    await auditLog(req.user.id, 'biometrico_imports', id, 'delete', {
      file_name: existing.rows[0].file_name
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.delete('/api/biometrico/marcas/:id', authMiddleware, requireModulePermission('biometrico', 'can_delete'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await db.query(
      `SELECT id, import_id, personal_id, fecha
       FROM biometrico_marcas
       WHERE id=$1`,
      [id]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'marca no encontrada' });
    }

    const marca = existing.rows[0];
    const paidWeek = await getPaidWeekOverlap(marca.fecha);
    if (paidWeek) {
      return res.status(409).json({
        error: `marca bloqueada por ${paidWeekMessage(paidWeek)}. Elimina primero el pago registrado de esa semana.`
      });
    }

    await db.query('DELETE FROM biometrico_marcas WHERE id=$1', [id]);

    if (marca.import_id) {
      await db.query(
        `UPDATE biometrico_imports
         SET valid_rows = (
           SELECT COUNT(*)::int
           FROM biometrico_marcas
           WHERE import_id = $1
         )
         WHERE id = $1`,
        [Number(marca.import_id)]
      );
    }

    await auditLog(req.user.id, 'biometrico_marcas', id, 'delete', {
      import_id: marca.import_id,
      personal_id: marca.personal_id,
      fecha: marca.fecha
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/biometrico/import', authMiddleware, requireModulePermission('biometrico', 'can_modify'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'debe adjuntar un archivo TXT en el campo file' });
    }

    const text = req.file.buffer.toString('utf8');
    const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

    const existingImport = await db.query('SELECT id FROM biometrico_imports WHERE file_hash=$1', [fileHash]);
    if (existingImport.rowCount > 0) {
      return res.status(400).json({ error: 'archivo duplicado: ya fue importado anteriormente' });
    }

    const parsed = parseBiometricoText(text);
    const personalLookup = await buildPersonalLookup();
    const rowErrors = [...parsed.errors];
    const rowWarnings = [];
    const duplicateRowsSet = new Set();
    const mappedRows = [];

    const normalizeLookupValue = (value) => String(value || '').trim();
    const normalizeLookupDigits = (value) => String(value || '').replace(/\D/g, '');

    for (const row of parsed.rows) {
      const duplicateKey = `${row.id_persona}|${row.fecha}`;
      if (duplicateRowsSet.has(duplicateKey)) {
        rowWarnings.push({ row: row.rowNumber, column: 'ID_persona', message: 'registro duplicado dentro del archivo para la misma fecha (omitido)' });
        continue;
      }
      duplicateRowsSet.add(duplicateKey);

      const lookupRaw = normalizeLookupValue(row.id_persona);
      const lookupDigits = normalizeLookupDigits(row.id_persona);
      const personalId =
        personalLookup.byDocumento.get(lookupRaw) ||
        personalLookup.byDocumento.get(lookupDigits) ||
        personalLookup.byId.get(lookupRaw) ||
        personalLookup.byId.get(lookupDigits);

      if (!personalId) {
        rowWarnings.push({ row: row.rowNumber, column: 'ID_persona', message: `ID ${row.id_persona} no existe en personal (omitido)` });
        continue;
      }

      const perforaciones = Number(row.numero_perforaciones);
      const horas = Number(row.horas_reales_trabajo);
      mappedRows.push({
        personal_id: personalId,
        biometrico_id: row.id_persona,
        nombre_txt: row.nombre,
        departamento_txt: row.departamento,
        fecha: row.fecha,
        primera_perforacion: row.primera_perforacion,
        ultima_perforacion: row.ultima_perforacion,
        numero_perforaciones: perforaciones,
        horas_reales_trabajo: horas,
        aplica_pago: horas >= BIOMETRICO_MIN_HOURS
      });
    }

    if (rowErrors.length > 0) {
      const failedImport = await db.query(
        `INSERT INTO biometrico_imports(file_name, file_hash, import_date, total_rows, valid_rows, status, errors_json, created_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id`,
        [
          req.file.originalname,
          fileHash,
          mappedRows[0]?.fecha || null,
          parsed.rows.length,
          0,
          'error',
          JSON.stringify(rowErrors),
          req.user.id
        ]
      );

      return res.status(400).json({
        error: 'archivo invalido',
        import_id: failedImport.rows[0].id,
        details: rowErrors
      });
    }

    const duplicateInDbErrors = [];
    const rowsToInsert = [];
    for (const row of mappedRows) {
      const exists = await db.query(
        `SELECT id
         FROM biometrico_marcas
         WHERE personal_id=$1 AND fecha=$2 AND primera_perforacion=$3 AND ultima_perforacion=$4`,
        [row.personal_id, row.fecha, row.primera_perforacion, row.ultima_perforacion]
      );
      if (exists.rowCount > 0) {
        duplicateInDbErrors.push({
          row: row.rowNumber || '*',
          column: 'duplicado',
          message: `marca duplicada ya existe para personal ${row.personal_id} en fecha ${row.fecha} (omitido)`
        });
      } else {
        rowsToInsert.push(row);
      }
    }

    rowWarnings.push(...duplicateInDbErrors);

    if (rowsToInsert.length === 0) {
      const failedImport = await db.query(
        `INSERT INTO biometrico_imports(file_name, file_hash, import_date, total_rows, valid_rows, status, errors_json, created_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id`,
        [
          req.file.originalname,
          fileHash,
          mappedRows[0]?.fecha || null,
          parsed.rows.length,
          0,
          'error',
          JSON.stringify(rowWarnings),
          req.user.id
        ]
      );

      return res.status(400).json({
        error: 'no hay filas validas para importar',
        import_id: failedImport.rows[0].id,
        details: rowWarnings
      });
    }

    const importResult = await db.query(
      `INSERT INTO biometrico_imports(file_name, file_hash, import_date, total_rows, valid_rows, status, errors_json, created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        req.file.originalname,
        fileHash,
        rowsToInsert[0]?.fecha || null,
        parsed.rows.length,
        rowsToInsert.length,
        rowWarnings.length > 0 ? 'success_with_warnings' : 'success',
        rowWarnings.length > 0 ? JSON.stringify(rowWarnings) : null,
        req.user.id
      ]
    );

    const importId = importResult.rows[0].id;

    for (const row of rowsToInsert) {
      await db.query(
        `INSERT INTO biometrico_marcas(
           import_id, personal_id, biometrico_id, nombre_txt, departamento_txt, fecha,
           primera_perforacion, ultima_perforacion, numero_perforaciones, horas_reales_trabajo, aplica_pago
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          importId,
          row.personal_id,
          row.biometrico_id,
          row.nombre_txt,
          row.departamento_txt,
          row.fecha,
          row.primera_perforacion,
          row.ultima_perforacion,
          row.numero_perforaciones,
          row.horas_reales_trabajo,
          row.aplica_pago
        ]
      );
    }

    res.status(201).json({
      ok: true,
      import_id: importId,
      total_rows: parsed.rows.length,
      valid_rows: rowsToInsert.length,
      warning_rows: rowWarnings.length,
      details: rowWarnings
    });

    await auditLog(req.user.id, 'biometrico_imports', importId, 'import_txt_success', {
      file_name: req.file.originalname,
      total_rows: parsed.rows.length,
      valid_rows: rowsToInsert.length,
      warning_rows: rowWarnings.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/asignaciones', authMiddleware, requireModulePermission('bitacora', 'can_access'), async (req, res) => {
  try {
    const { fecha } = req.query;
    if (!isValidDate(fecha)) {
      return res.status(400).json({ error: 'fecha invalida (YYYY-MM-DD)' });
    }

    const data = await getAsignacionesByFecha(fecha);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/asignaciones', authMiddleware, requireModulePermission('bitacora', 'can_modify'), async (req, res) => {
  try {
    const { viaje_id, marca_id } = req.body;
    if (!hasValue(viaje_id)) return res.status(400).json({ error: 'viaje_id es obligatorio' });
    if (!hasValue(marca_id)) return res.status(400).json({ error: 'marca_id es obligatorio' });

    const viajeResult = await db.query('SELECT id, fecha FROM viajes WHERE id=$1', [Number(viaje_id)]);
    if (viajeResult.rowCount === 0) return res.status(404).json({ error: 'viaje no encontrado' });

    const viajeLock = await isViajeLocked(Number(viaje_id));
    if (viajeLock.locked) {
      return res.status(409).json({ error: `viaje bloqueado por estado ${viajeLock.estado}` });
    }

    const marcaResult = await db.query('SELECT id, fecha, aplica_pago FROM biometrico_marcas WHERE id=$1', [Number(marca_id)]);
    if (marcaResult.rowCount === 0) return res.status(404).json({ error: 'marca biometrica no encontrada' });

    const viaje = viajeResult.rows[0];
    const marca = marcaResult.rows[0];
    if (String(viaje.fecha).slice(0, 10) !== String(marca.fecha).slice(0, 10)) {
      return res.status(400).json({ error: 'solo se puede asignar estibadores del mismo dia del viaje' });
    }

    if (!marca.aplica_pago) {
      return res.status(400).json({ error: 'esta marca no aplica pago y no puede asignarse' });
    }

    const created = await db.query(
      `INSERT INTO asignacion_estiba(viaje_id, marca_id, created_by)
       VALUES($1,$2,$3)
       RETURNING id, viaje_id, marca_id, created_at`,
      [Number(viaje_id), Number(marca_id), req.user.id]
    );

    await auditLog(req.user.id, 'asignacion_estiba', created.rows[0].id, 'create', {
      viaje_id: Number(viaje_id),
      marca_id: Number(marca_id)
    });

    res.status(201).json(created.rows[0]);
  } catch (err) {
    if (err?.code === '23505') {
      return res.status(400).json({ error: 'la asignacion ya existe para ese viaje y estibador' });
    }
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.delete('/api/asignaciones/:id', authMiddleware, requireModulePermission('bitacora', 'can_delete'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const asignacion = await db.query('SELECT id, viaje_id, marca_id FROM asignacion_estiba WHERE id=$1', [id]);
    if (asignacion.rowCount === 0) return res.status(404).json({ error: 'asignacion no encontrada' });

    const viajeLock = await isViajeLocked(asignacion.rows[0].viaje_id);
    if (viajeLock.locked) {
      return res.status(409).json({ error: `viaje bloqueado por estado ${viajeLock.estado}` });
    }

    const deleted = await db.query('DELETE FROM asignacion_estiba WHERE id=$1 RETURNING id', [id]);

    await auditLog(req.user.id, 'asignacion_estiba', id, 'delete', {
      viaje_id: asignacion.rows[0].viaje_id,
      marca_id: asignacion.rows[0].marca_id
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/liquidaciones/generar', authMiddleware, requireModulePermission('liquidaciones', 'can_modify'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { semana_inicio, semana_fin } = req.body;
    if (!isValidDate(semana_inicio) || !isValidDate(semana_fin)) {
      return res.status(400).json({ error: 'semana_inicio y semana_fin deben tener formato YYYY-MM-DD' });
    }

    if (semana_inicio > semana_fin) {
      return res.status(400).json({ error: 'semana_inicio no puede ser mayor a semana_fin' });
    }

    const pagosRegistrados = await client.query(
      `SELECT l.id AS liquidacion_id, p.nombre AS estibador_nombre
       FROM liquidaciones l
       JOIN personal p ON p.id = l.estibador_personal_id
       JOIN pagos pg ON pg.liquidacion_id = l.id
       WHERE l.semana_inicio = $1
         AND l.semana_fin = $2
         AND LOWER(COALESCE(pg.estado, '')) = 'pagado'
       GROUP BY l.id, p.nombre
       ORDER BY p.nombre ASC`,
      [semana_inicio, semana_fin]
    );

    if (pagosRegistrados.rowCount > 0) {
      const personasBloqueadas = pagosRegistrados.rows.map((row) => row.estibador_nombre).join(', ');
      return res.status(409).json({
        error: `No se puede regenerar la liquidacion semanal porque ya existen pagos registrados (${personasBloqueadas}). Primero elimina el pago de esa(s) persona(s).`
      });
    }

    const resumen = await buildLiquidacionSemana(semana_inicio, semana_fin);

    await client.query('BEGIN');

    // Obtener ajustes que se van a eliminar para revertir cuota_actual
    const ajustesAEliminar = await client.query(
      `SELECT DISTINCT aa.ajuste_id, aa.cuota_numero
       FROM ajustes_aplicaciones aa
       JOIN liquidacion_ajustes_detalle lad ON lad.aplicacion_id = aa.id
       WHERE lad.liquidacion_id IN (
         SELECT id FROM liquidaciones WHERE semana_inicio = $1 AND semana_fin = $2
       )`,
      [semana_inicio, semana_fin]
    );

    // Borrar liquidacion_ajustes_detalle primero
    await client.query(
      `DELETE FROM liquidacion_ajustes_detalle
       WHERE liquidacion_id IN (
         SELECT id FROM liquidaciones WHERE semana_inicio = $1 AND semana_fin = $2
       )`,
      [semana_inicio, semana_fin]
    );

    // Borrar ajustes_aplicaciones de liquidaciones semanales
    await client.query(
      `DELETE FROM ajustes_aplicaciones
       WHERE referencia_tipo = 'liquidacion_semanal'
         AND referencia_inicio = $1
         AND referencia_fin = $2`,
      [semana_inicio, semana_fin]
    );

    // Revertir cuota_actual de los ajustes eliminados
    for (const ajuste of ajustesAEliminar.rows) {
      await client.query(
        `UPDATE ajustes_personal
         SET cuota_actual = cuota_actual - 1,
             estado = CASE 
               WHEN estado = 'finalizado' AND en_cuotas = TRUE THEN 'activo'
               ELSE estado
             END
         WHERE id = $1`,
        [ajuste.ajuste_id]
      );
    }

    await client.query(
      `DELETE FROM liquidacion_detalle
       WHERE liquidacion_id IN (
         SELECT id FROM liquidaciones WHERE semana_inicio = $1 AND semana_fin = $2
       )`,
      [semana_inicio, semana_fin]
    );
    await client.query('DELETE FROM liquidaciones WHERE semana_inicio = $1 AND semana_fin = $2', [semana_inicio, semana_fin]);

    for (const item of resumen) {
      const created = await client.query(
        `INSERT INTO liquidaciones(semana_inicio, semana_fin, estibador_personal_id, total, estado, created_by)
         VALUES($1,$2,$3,$4,$5,$6)
         RETURNING id`,
        [semana_inicio, semana_fin, item.personal_id, item.total, 'pendiente', req.user.id]
      );

      const liquidacionId = created.rows[0].id;
      for (const detalle of item.detalles) {
        await client.query(
          `INSERT INTO liquidacion_detalle(liquidacion_id, viaje_id, asignacion_id, monto)
           VALUES($1,$2,$3,$4)`,
          [liquidacionId, detalle.viaje_id, detalle.asignacion_id, detalle.monto]
        );
      }

      // Guardar ajustes semanales aplicados (sobrantes/faltantes)
      if (item.ajustes && item.ajustes.length > 0) {
        for (const ajuste of item.ajustes) {
          // Crear aplicación
          const aplicacion = await client.query(
            `INSERT INTO ajustes_aplicaciones(
              ajuste_id, personal_id, referencia_tipo, referencia_inicio, referencia_fin,
              cuota_numero, monto_aplicado, created_by
            ) VALUES($1, $2, 'liquidacion_semanal', $3, $4, $5, $6, $7)
            RETURNING id`,
            [ajuste.ajuste_id, item.personal_id, semana_inicio, semana_fin, 
             ajuste.cuota_numero, ajuste.monto, req.user.id]
          );

          // Insertar en detalle de liquidación
          await client.query(
            `INSERT INTO liquidacion_ajustes_detalle(
              liquidacion_id, ajuste_id, aplicacion_id, tipo, detalle, monto
            ) VALUES($1, $2, $3, $4, $5, $6)`,
            [liquidacionId, ajuste.ajuste_id, aplicacion.rows[0].id, ajuste.tipo, ajuste.detalle, ajuste.monto]
          );

          // Actualizar cuota actual del ajuste
          await client.query(
            'UPDATE ajustes_personal SET cuota_actual = $1 WHERE id = $2',
            [ajuste.cuota_numero, ajuste.ajuste_id]
          );

          // Si no es en cuotas (aplicación única) o es la última cuota, marcar como finalizado
          if (!ajuste.en_cuotas || (ajuste.en_cuotas && ajuste.cuota_numero >= ajuste.cantidad_cuotas)) {
            await client.query(
              'UPDATE ajustes_personal SET estado = $1 WHERE id = $2',
              ['finalizado', ajuste.ajuste_id]
            );
          }
        }
      }
    }

    const viajeIds = new Set();
    for (const item of resumen) {
      for (const detalle of item.detalles) viajeIds.add(Number(detalle.viaje_id));
    }

    const estadoLiquidadoId = await getEstadoIdByName('liquidado');
    if (estadoLiquidadoId && viajeIds.size > 0) {
      await client.query(
        'UPDATE viajes SET estado_viaje_id=$1, updated_at=now() WHERE id = ANY($2::int[])',
        [estadoLiquidadoId, Array.from(viajeIds)]
      );
    }

    await client.query('COMMIT');

    const liquidaciones = await listLiquidaciones(semana_inicio, semana_fin);

    await auditLog(req.user.id, 'liquidaciones', null, 'generate_week', {
      semana_inicio,
      semana_fin,
      total_liquidaciones: liquidaciones.length
    });

    res.status(201).json({
      ok: true,
      semana_inicio,
      semana_fin,
      total_liquidaciones: liquidaciones.length,
      liquidaciones
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'server error' });
  } finally {
    client.release();
  }
});

app.get('/api/liquidaciones', authMiddleware, requireModulePermission('liquidaciones', 'can_access'), async (req, res) => {
  try {
    const { semana_inicio, semana_fin } = req.query;
    if ((semana_inicio && !semana_fin) || (!semana_inicio && semana_fin)) {
      return res.status(400).json({ error: 'debe enviar semana_inicio y semana_fin juntos' });
    }

    if (semana_inicio && (!isValidDate(semana_inicio) || !isValidDate(semana_fin))) {
      return res.status(400).json({ error: 'fechas invalidas (YYYY-MM-DD)' });
    }

    const liquidaciones = await listLiquidaciones(semana_inicio || null, semana_fin || null);
    res.json(liquidaciones);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.delete('/api/liquidaciones', authMiddleware, requireModulePermission('liquidaciones', 'can_delete'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { semana_inicio, semana_fin } = req.query;
    if (!semana_inicio || !semana_fin) {
      return res.status(400).json({ error: 'debe enviar semana_inicio y semana_fin' });
    }

    if (!isValidDate(semana_inicio) || !isValidDate(semana_fin)) {
      return res.status(400).json({ error: 'fechas invalidas (YYYY-MM-DD)' });
    }

    const pagosRegistrados = await client.query(
      `SELECT l.id AS liquidacion_id, p.nombre AS estibador_nombre
       FROM liquidaciones l
       JOIN personal p ON p.id = l.estibador_personal_id
       JOIN pagos pg ON pg.liquidacion_id = l.id
       WHERE l.semana_inicio = $1
         AND l.semana_fin = $2
         AND LOWER(COALESCE(pg.estado, '')) = 'pagado'
       GROUP BY l.id, p.nombre
       ORDER BY p.nombre ASC`,
      [semana_inicio, semana_fin]
    );

    if (pagosRegistrados.rowCount > 0) {
      const personasBloqueadas = pagosRegistrados.rows.map((row) => row.estibador_nombre).join(', ');
      return res.status(409).json({
        error: `No se puede eliminar la liquidacion semanal porque ya existen pagos registrados (${personasBloqueadas}). Primero elimina el pago de esa(s) persona(s).`
      });
    }

    await client.query('BEGIN');

    // Obtener ajustes que se van a eliminar para revertir cuota_actual
    const ajustesAEliminar = await client.query(
      `SELECT DISTINCT aa.ajuste_id, aa.cuota_numero
       FROM ajustes_aplicaciones aa
       JOIN liquidacion_ajustes_detalle lad ON lad.aplicacion_id = aa.id
       WHERE lad.liquidacion_id IN (
         SELECT id FROM liquidaciones WHERE semana_inicio = $1 AND semana_fin = $2
       )`,
      [semana_inicio, semana_fin]
    );

    // Borrar liquidacion_ajustes_detalle primero
    await client.query(
      `DELETE FROM liquidacion_ajustes_detalle
       WHERE liquidacion_id IN (
         SELECT id FROM liquidaciones WHERE semana_inicio = $1 AND semana_fin = $2
       )`,
      [semana_inicio, semana_fin]
    );

    // Borrar ajustes_aplicaciones de liquidaciones semanales
    await client.query(
      `DELETE FROM ajustes_aplicaciones
       WHERE referencia_tipo = 'liquidacion_semanal'
         AND referencia_inicio = $1
         AND referencia_fin = $2`,
      [semana_inicio, semana_fin]
    );

    // Revertir cuota_actual de los ajustes eliminados
    for (const ajuste of ajustesAEliminar.rows) {
      await client.query(
        `UPDATE ajustes_personal
         SET cuota_actual = cuota_actual - 1,
             estado = CASE 
               WHEN estado = 'finalizado' AND en_cuotas = TRUE THEN 'activo'
               ELSE estado
             END
         WHERE id = $1`,
        [ajuste.ajuste_id]
      );
    }

    await client.query(
      `DELETE FROM liquidacion_detalle
       WHERE liquidacion_id IN (
         SELECT id FROM liquidaciones WHERE semana_inicio = $1 AND semana_fin = $2
       )`,
      [semana_inicio, semana_fin]
    );

    const deleted = await client.query(
      'DELETE FROM liquidaciones WHERE semana_inicio = $1 AND semana_fin = $2 RETURNING id',
      [semana_inicio, semana_fin]
    );

    await client.query('COMMIT');

    await auditLog(req.user.id, 'liquidaciones', null, 'delete_week', {
      semana_inicio,
      semana_fin,
      total_liquidaciones_eliminadas: deleted.rowCount
    });

    res.json({
      ok: true,
      semana_inicio,
      semana_fin,
      total_liquidaciones_eliminadas: deleted.rowCount
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'server error' });
  } finally {
    client.release();
  }
});

app.get('/api/liquidaciones/:id/detalle', authMiddleware, requireModulePermission('liquidaciones', 'can_access'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    // Obtener datos base de la liquidación
    const liquidacion = await db.query(
      `SELECT l.id, l.estibador_personal_id, p.nombre AS estibador_nombre
       FROM liquidaciones l
       JOIN personal p ON p.id = l.estibador_personal_id
       WHERE l.id = $1`,
      [id]
    );
    
    if (liquidacion.rowCount === 0) {
      return res.status(404).json({ error: 'liquidacion no encontrada' });
    }
    
    const estibadorPersonalId = liquidacion.rows[0].estibador_personal_id;
    const estibadorNombre = liquidacion.rows[0].estibador_nombre;
    
    // Unir detalles de viajes y ajustes
    const result = await db.query(
      `SELECT 
         ld.id,
         'viaje' AS detalle_tipo,
         ld.liquidacion_id,
         ld.viaje_id,
         v.viaje_id AS referencia,
         v.fecha,
         NULL AS detalle,
         $2 AS estibador_nombre,
         ld.monto,
         ld.created_at,
         CASE WHEN EXISTS (
           SELECT 1
           FROM biometrico_marcas bm
           WHERE bm.personal_id = $3
             AND bm.fecha = v.fecha
             AND bm.aplica_pago = TRUE
         ) THEN TRUE ELSE FALSE END AS justificado_txt,
         (
           SELECT JSON_AGG(JSON_BUILD_OBJECT('id', r.id, 'nombre', r.nombre, 'tipo', r.tipo))
           FROM viajes_rutas vr
           JOIN rutas r ON r.id = vr.ruta_id
           WHERE vr.viaje_id = v.id
         ) AS rutas_asociadas
       FROM liquidacion_detalle ld
       JOIN viajes v ON v.id = ld.viaje_id
       WHERE ld.liquidacion_id = $1
       
       UNION ALL
       
       SELECT 
         lad.id,
         'ajuste' AS detalle_tipo,
         lad.liquidacion_id,
         NULL AS viaje_id,
         CONCAT(
           CASE WHEN lad.tipo = 'sobrante' THEN '+ Sobrante' ELSE '- Faltante' END
         ) AS referencia,
         ap.fecha_inicio AS fecha,
         lad.detalle,
         $2 AS estibador_nombre,
         CASE WHEN lad.tipo = 'sobrante' THEN lad.monto ELSE -lad.monto END AS monto,
         lad.created_at,
         CASE WHEN EXISTS (
           SELECT 1
           FROM biometrico_marcas bm
           WHERE bm.personal_id = $3
             AND bm.fecha = ap.fecha_inicio
             AND bm.aplica_pago = TRUE
         ) THEN TRUE ELSE FALSE END AS justificado_txt,
         NULL AS rutas_asociadas
       FROM liquidacion_ajustes_detalle lad
       JOIN ajustes_personal ap ON ap.id = lad.ajuste_id
       WHERE lad.liquidacion_id = $1
       
       ORDER BY created_at ASC, id ASC`,
      [id, estibadorNombre, estibadorPersonalId]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Ajustes personal (sobrantes y faltantes)
app.get('/api/ajustes-personal', authMiddleware, requireModulePermission('ajustes_personal', 'can_access'), async (req, res) => {
  try {
    const r = await db.query(
      `SELECT ap.id, ap.personal_id, ap.tipo, ap.detalle, ap.valor_total,
              ap.en_cuotas, ap.cantidad_cuotas, ap.cuota_actual, ap.frecuencia,
              ap.fecha_inicio, ap.estado, ap.created_at, ap.viaje_id,
              p.documento, p.nombre, p.apellidos
       FROM ajustes_personal ap
       JOIN personal p ON p.id = ap.personal_id
       ORDER BY ap.id DESC`
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/ajustes-personal', authMiddleware, requireModulePermission('ajustes_personal', 'can_modify'), async (req, res) => {
  try {
    const { personal_id, tipo, detalle, valor_total, en_cuotas, cantidad_cuotas, frecuencia, fecha_inicio, estado } = req.body;

    if (!hasValue(personal_id)) return res.status(400).json({ error: 'personal_id es obligatorio' });
    if (!hasValue(tipo)) return res.status(400).json({ error: 'tipo es obligatorio' });
    if (!hasValue(detalle)) return res.status(400).json({ error: 'detalle es obligatorio' });
    if (!hasValue(valor_total)) return res.status(400).json({ error: 'valor_total es obligatorio' });
    if (!hasValue(frecuencia)) return res.status(400).json({ error: 'frecuencia es obligatoria' });
    if (!hasValue(fecha_inicio)) return res.status(400).json({ error: 'fecha_inicio es obligatoria' });

    const personalExists = await db.query('SELECT id FROM personal WHERE id=$1', [Number(personal_id)]);
    if (personalExists.rowCount === 0) return res.status(404).json({ error: 'personal no encontrado' });

    const cuotas = en_cuotas === true ? Number(cantidad_cuotas || 1) : 1;

    const result = await db.query(
      `INSERT INTO ajustes_personal(personal_id, tipo, detalle, valor_total, en_cuotas, cantidad_cuotas, frecuencia, fecha_inicio, estado, created_by)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, personal_id, tipo, detalle, valor_total, en_cuotas, cantidad_cuotas, cuota_actual, frecuencia, fecha_inicio, estado, created_at`,
      [Number(personal_id), tipo, detalle, Number(valor_total), en_cuotas === true, cuotas, frecuencia, fecha_inicio, estado || 'activo', req.user.id]
    );

    await auditLog(req.user.id, 'ajustes_personal', result.rows[0].id, 'create', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.put('/api/ajustes-personal/:id', authMiddleware, requireModulePermission('ajustes_personal', 'can_modify'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { personal_id, tipo, detalle, valor_total, en_cuotas, cantidad_cuotas, frecuencia, fecha_inicio, estado } = req.body;

    const exists = await db.query('SELECT id FROM ajustes_personal WHERE id=$1', [id]);
    if (exists.rowCount === 0) return res.status(404).json({ error: 'ajuste no encontrado' });

    if (hasValue(personal_id)) {
      const personalExists = await db.query('SELECT id FROM personal WHERE id=$1', [Number(personal_id)]);
      if (personalExists.rowCount === 0) return res.status(404).json({ error: 'personal no encontrado' });
    }

    const cuotas = en_cuotas === true ? Number(cantidad_cuotas || 1) : 1;

    const result = await db.query(
      `UPDATE ajustes_personal
       SET personal_id = COALESCE($1, personal_id),
           tipo = COALESCE($2, tipo),
           detalle = COALESCE($3, detalle),
           valor_total = COALESCE($4, valor_total),
           en_cuotas = COALESCE($5, en_cuotas),
           cantidad_cuotas = COALESCE($6, cantidad_cuotas),
           frecuencia = COALESCE($7, frecuencia),
           fecha_inicio = COALESCE($8, fecha_inicio),
           estado = COALESCE($9, estado),
           updated_at = now()
       WHERE id = $10
       RETURNING id, personal_id, tipo, detalle, valor_total, en_cuotas, cantidad_cuotas, cuota_actual, frecuencia, fecha_inicio, estado, created_at`,
      [
        hasValue(personal_id) ? Number(personal_id) : null,
        hasValue(tipo) ? tipo : null,
        hasValue(detalle) ? detalle : null,
        hasValue(valor_total) ? Number(valor_total) : null,
        hasValue(en_cuotas) ? (en_cuotas === true) : null,
        hasValue(cantidad_cuotas) ? cuotas : null,
        hasValue(frecuencia) ? frecuencia : null,
        hasValue(fecha_inicio) ? fecha_inicio : null,
        hasValue(estado) ? estado : null,
        id
      ]
    );

    await auditLog(req.user.id, 'ajustes_personal', id, 'update', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.put('/api/ajustes-personal/:id/estado', authMiddleware, requireModulePermission('ajustes_personal', 'can_modify'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { estado } = req.body;

    if (!hasValue(estado)) return res.status(400).json({ error: 'estado es obligatorio' });

    const exists = await db.query('SELECT id FROM ajustes_personal WHERE id=$1', [id]);
    if (exists.rowCount === 0) return res.status(404).json({ error: 'ajuste no encontrado' });

    const result = await db.query(
      `UPDATE ajustes_personal
       SET estado = $1, updated_at = now()
       WHERE id = $2
       RETURNING id, personal_id, tipo, detalle, valor_total, en_cuotas, cantidad_cuotas, cuota_actual, frecuencia, fecha_inicio, estado, created_at`,
      [estado, id]
    );

    await auditLog(req.user.id, 'ajustes_personal', id, 'update_estado', { nuevo_estado: estado });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.delete('/api/ajustes-personal/:id', authMiddleware, requireModulePermission('ajustes_personal', 'can_delete'), async (req, res) => {
  try {
    const id = Number(req.params.id);

    const exists = await db.query('SELECT id FROM ajustes_personal WHERE id=$1', [id]);
    if (exists.rowCount === 0) return res.status(404).json({ error: 'ajuste no encontrado' });

    await db.query('DELETE FROM ajustes_personal WHERE id=$1', [id]);

    await auditLog(req.user.id, 'ajustes_personal', id, 'delete', null);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/pagos', authMiddleware, requireModulePermission('pagos', 'can_access'), async (req, res) => {
  try {
    const r = await db.query(
      `SELECT pg.id, pg.liquidacion_id, pg.fecha_pago, pg.banco_id, b.nombre AS banco_nombre,
              pg.comprobante, pg.monto, pg.estado, pg.created_at,
              l.semana_inicio, l.semana_fin, p.nombre AS estibador_nombre
       FROM pagos pg
       JOIN liquidaciones l ON l.id = pg.liquidacion_id
       JOIN personal p ON p.id = l.estibador_personal_id
       LEFT JOIN bancos b ON b.id = pg.banco_id
       ORDER BY pg.id DESC`
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/pagos', authMiddleware, requireModulePermission('pagos', 'can_modify'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { liquidacion_id, fecha_pago, banco_id, comprobante, monto } = req.body;

    if (!hasValue(liquidacion_id)) return res.status(400).json({ error: 'liquidacion_id es obligatorio' });
    if (!isValidDate(fecha_pago)) return res.status(400).json({ error: 'fecha_pago invalida (YYYY-MM-DD)' });
    if (!hasValue(banco_id)) return res.status(400).json({ error: 'banco_id es obligatorio' });

    const liquidacion = await client.query(
      'SELECT id, total, estado FROM liquidaciones WHERE id=$1',
      [Number(liquidacion_id)]
    );
    if (liquidacion.rowCount === 0) return res.status(404).json({ error: 'liquidacion no encontrada' });

    if (String(liquidacion.rows[0].estado || '').toLowerCase() === 'pagado') {
      return res.status(400).json({ error: 'la liquidacion ya esta pagada' });
    }

    const txtStatus = await getLiquidacionTxtStatus(client, Number(liquidacion_id));
    if (txtStatus !== 'Justificado') {
      return res.status(409).json({
        error: `no se puede registrar el pago: la liquidacion esta '${txtStatus}' en justificacion TXT`
      });
    }

    const banco = await client.query('SELECT id FROM bancos WHERE id=$1 AND activo=TRUE', [Number(banco_id)]);
    if (banco.rowCount === 0) return res.status(400).json({ error: 'banco invalido' });

    const amount = hasValue(monto) ? Number(monto) : Number(liquidacion.rows[0].total);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'monto invalido' });
    }

    await client.query('BEGIN');

    const created = await client.query(
      `INSERT INTO pagos(liquidacion_id, fecha_pago, banco_id, comprobante, monto, estado, created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [Number(liquidacion_id), fecha_pago, Number(banco_id), comprobante || null, amount, 'pagado', req.user.id]
    );

    await client.query(
      `UPDATE liquidaciones
       SET estado='pagado'
       WHERE id=$1`,
      [Number(liquidacion_id)]
    );

    const estadoPagadoId = await getEstadoIdByName('pagado');
    if (estadoPagadoId) {
      await client.query(
        `UPDATE viajes
         SET estado_viaje_id=$1, updated_at=now()
         WHERE id IN (
           SELECT DISTINCT ld.viaje_id
           FROM liquidacion_detalle ld
           WHERE ld.liquidacion_id = $2
         )`,
        [estadoPagadoId, Number(liquidacion_id)]
      );
    }

    await client.query('COMMIT');

    await auditLog(req.user.id, 'pagos', created.rows[0].id, 'create', {
      liquidacion_id: Number(liquidacion_id),
      fecha_pago,
      banco_id: Number(banco_id),
      monto: amount
    });

    res.status(201).json(created.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err?.code === '23505') {
      return res.status(400).json({ error: 'ya existe un pago para esta liquidacion' });
    }
    console.error(err);
    res.status(500).json({ error: 'server error' });
  } finally {
    client.release();
  }
});

app.put('/api/pagos/:id', authMiddleware, requireModulePermission('pagos', 'can_modify'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { fecha_pago, banco_id, comprobante, monto } = req.body;

    const pago = await db.query(
      `SELECT id, liquidacion_id
       FROM pagos
       WHERE id=$1`,
      [id]
    );
    if (pago.rowCount === 0) return res.status(404).json({ error: 'pago no encontrado' });

    const txtStatus = await getLiquidacionTxtStatus(db, Number(pago.rows[0].liquidacion_id));
    if (txtStatus !== 'Justificado') {
      return res.status(409).json({
        error: `no se puede actualizar el pago: la liquidacion esta '${txtStatus}' en justificacion TXT`
      });
    }

    if (!isValidDate(fecha_pago)) return res.status(400).json({ error: 'fecha_pago invalida (YYYY-MM-DD)' });
    if (!hasValue(banco_id)) return res.status(400).json({ error: 'banco_id es obligatorio' });

    const banco = await db.query('SELECT id FROM bancos WHERE id=$1 AND activo=TRUE', [Number(banco_id)]);
    if (banco.rowCount === 0) return res.status(400).json({ error: 'banco invalido' });

    const amount = Number(monto);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'monto invalido' });
    }

    const updated = await db.query(
      `UPDATE pagos
       SET fecha_pago=$1,
           banco_id=$2,
           comprobante=$3,
           monto=$4,
           estado='pagado'
       WHERE id=$5
       RETURNING *`,
      [fecha_pago, Number(banco_id), comprobante || null, amount, id]
    );

    await auditLog(req.user.id, 'pagos', id, 'update', {
      liquidacion_id: Number(pago.rows[0].liquidacion_id),
      fecha_pago,
      banco_id: Number(banco_id),
      monto: amount
    });

    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.delete('/api/pagos/:id', authMiddleware, requireModulePermission('pagos', 'can_delete'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    const id = Number(req.params.id);

    const pago = await client.query(
      `SELECT id, liquidacion_id
       FROM pagos
       WHERE id=$1`,
      [id]
    );
    if (pago.rowCount === 0) return res.status(404).json({ error: 'pago no encontrado' });

    const liquidacionId = Number(pago.rows[0].liquidacion_id);

    await client.query('BEGIN');

    await client.query('DELETE FROM pagos WHERE id=$1', [id]);

    await client.query(
      `UPDATE liquidaciones
       SET estado='pendiente'
       WHERE id=$1`,
      [liquidacionId]
    );

    const estadoLiquidadoId = await getEstadoIdByName('liquidado');
    if (estadoLiquidadoId) {
      await client.query(
        `UPDATE viajes
         SET estado_viaje_id=$1, updated_at=now()
         WHERE id IN (
           SELECT DISTINCT ld.viaje_id
           FROM liquidacion_detalle ld
           WHERE ld.liquidacion_id = $2
         )`,
        [estadoLiquidadoId, liquidacionId]
      );
    }

    await client.query('COMMIT');

    await auditLog(req.user.id, 'pagos', id, 'delete', {
      liquidacion_id: liquidacionId
    });

    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'server error' });
  } finally {
    client.release();
  }
});

// Roles mensuales IESS
app.get('/api/roles-mensuales', authMiddleware, requireModulePermission('roles_mensuales', 'can_access'), async (req, res) => {
  try {
    const { periodo_mes } = req.query;
    
    let query = `
      SELECT rm.id, rm.periodo_mes, rm.periodo_inicio, rm.periodo_fin,
             rm.personal_id, p.nombre, p.apellidos, p.documento,
             rm.estado, rm.total_ingresos, rm.total_egresos, rm.neto_pagar,
             rm.created_at, rm.updated_at
      FROM roles_mensuales rm
      JOIN personal p ON p.id = rm.personal_id
    `;
    const params = [];
    
    if (periodo_mes) {
      query += ' WHERE rm.periodo_mes = $1';
      params.push(periodo_mes);
    }
    
    query += ' ORDER BY rm.id DESC';
    
    const r = await db.query(query, params);
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/roles-mensuales/:id/detalle', authMiddleware, requireModulePermission('roles_mensuales', 'can_access'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    const rol = await db.query(
      `SELECT rm.*, p.nombre, p.apellidos, p.documento
       FROM roles_mensuales rm
       JOIN personal p ON p.id = rm.personal_id
       WHERE rm.id = $1`,
      [id]
    );
    
    if (rol.rowCount === 0) return res.status(404).json({ error: 'rol mensual no encontrado' });
    
    const detalle = await db.query(
      `SELECT id, seccion, concepto, valor
       FROM roles_mensuales_detalle
       WHERE rol_mensual_id = $1
       ORDER BY id ASC`,
      [id]
    );
    
    const ajustes = await db.query(
      `SELECT rad.id, rad.tipo, rad.detalle, rad.monto,
              ap.personal_id, ap.cuota_actual, ap.cantidad_cuotas
       FROM rol_ajustes_detalle rad
       JOIN ajustes_personal ap ON ap.id = rad.ajuste_id
       WHERE rad.rol_mensual_id = $1
       ORDER BY rad.id ASC`,
      [id]
    );
    
    res.json({
      ...rol.rows[0],
      detalle: detalle.rows,
      ajustes: ajustes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/roles-mensuales/generar', authMiddleware, requireModulePermission('roles_mensuales', 'can_modify'), async (req, res) => {
  try {
    const { periodo_mes } = req.body;
    
    if (!periodo_mes || !/^\d{4}-\d{2}$/.test(periodo_mes)) {
      return res.status(400).json({ error: 'periodo_mes debe tener formato YYYY-MM' });
    }
    
    // Calcular inicio y fin del mes
    const [year, month] = periodo_mes.split('-').map(Number);
    const periodo_inicio = `${periodo_mes}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const periodo_fin = `${periodo_mes}-${String(lastDay).padStart(2, '0')}`;
    
    // Obtener personal afiliado al IESS
    const personal = await db.query(
      `SELECT id, nombre, apellidos, documento, sueldo_iess, sueldo_real,
              descuenta_iess, cobra_decimo_tercero, cobra_decimo_cuarto, cobra_fondo_reserva
       FROM personal
       WHERE afiliado_iess = TRUE AND activo = TRUE
       ORDER BY nombre ASC`
    );
    
    if (personal.rowCount === 0) {
      return res.status(400).json({ error: 'no hay personal afiliado al IESS' });
    }
    
    const rolesGenerados = [];
    
    for (const p of personal.rows) {
      // Verificar si ya existe rol para este personal en este periodo
      const existe = await db.query(
        'SELECT id FROM roles_mensuales WHERE personal_id = $1 AND periodo_mes = $2',
        [p.id, periodo_mes]
      );
      
      if (existe.rowCount > 0) continue;
      
      const sueldoIess = Number(p.sueldo_iess || 0);
      const sueldoReal = Number(p.sueldo_real || 0);
      
      let total_ingresos = sueldoReal;
      let total_egresos = 0;
      
      // Calcular aportes IESS si descuenta
      if (p.descuenta_iess) {
        const aportePersonal = sueldoIess * 0.0945; // 9.45%
        total_egresos += aportePersonal;
      }
      
      const neto_pagar = total_ingresos - total_egresos;
      
      // Crear rol mensual
      const rolResult = await db.query(
        `INSERT INTO roles_mensuales(
          periodo_mes, periodo_inicio, periodo_fin, personal_id,
          estado, total_ingresos, total_egresos, neto_pagar, generated_by
        ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [periodo_mes, periodo_inicio, periodo_fin, p.id, 'borrador', 
         total_ingresos, total_egresos, neto_pagar, req.user.id]
      );
      
      const rolId = rolResult.rows[0].id;
      
      // Insertar detalle de ingresos
      await db.query(
        `INSERT INTO roles_mensuales_detalle(rol_mensual_id, seccion, concepto, valor)
         VALUES($1, 'ingresos', 'Sueldo', $2)`,
        [rolId, sueldoReal]
      );
      
      // Insertar detalle de egresos
      if (p.descuenta_iess) {
        const aportePersonal = sueldoIess * 0.0945;
        await db.query(
          `INSERT INTO roles_mensuales_detalle(rol_mensual_id, seccion, concepto, valor)
           VALUES($1, 'egresos', 'Aporte Personal IESS (9.45%)', $2)`,
          [rolId, aportePersonal]
        );
      }
      
      // Aplicar ajustes mensuales activos
      // Excluir ajustes de cuota única que ya fueron aplicados en un rol anterior
      const ajustes = await db.query(
        `SELECT id, tipo, detalle, valor_total, en_cuotas, cantidad_cuotas, cuota_actual
         FROM ajustes_personal
         WHERE personal_id = $1 
           AND estado = 'activo'
           AND frecuencia = 'mensual'
           AND fecha_inicio <= $2
           AND (
             en_cuotas = TRUE
             OR NOT EXISTS (
               SELECT 1 FROM ajustes_aplicaciones aa
               WHERE aa.ajuste_id = ajustes_personal.id
             )
           )`,
        [p.id, periodo_fin]
      );
      
      for (const ajuste of ajustes.rows) {
        const montoAplicar = ajuste.en_cuotas 
          ? Number(ajuste.valor_total) / Number(ajuste.cantidad_cuotas)
          : Number(ajuste.valor_total);
        
        // Crear aplicación
        const aplicacion = await db.query(
          `INSERT INTO ajustes_aplicaciones(
            ajuste_id, personal_id, referencia_tipo, referencia_inicio, referencia_fin,
            cuota_numero, monto_aplicado, created_by
          ) VALUES($1, $2, 'rol_mensual', $3, $4, $5, $6, $7)
          RETURNING id`,
          [ajuste.id, p.id, periodo_inicio, periodo_fin, 
           ajuste.cuota_actual + 1, montoAplicar, req.user.id]
        );
        
        // Insertar en detalle del rol
        await db.query(
          `INSERT INTO rol_ajustes_detalle(
            rol_mensual_id, ajuste_id, aplicacion_id, tipo, detalle, monto
          ) VALUES($1, $2, $3, $4, $5, $6)`,
          [rolId, ajuste.id, aplicacion.rows[0].id, ajuste.tipo, ajuste.detalle, montoAplicar]
        );
        
        // Aplicar ajuste a los totales: sobrantes suman a ingresos, faltantes suman a egresos
        if (ajuste.tipo === 'sobrante') {
          total_ingresos += montoAplicar;
        } else if (ajuste.tipo === 'faltante') {
          total_egresos += montoAplicar;
        }
        
        // Actualizar cuota actual del ajuste
        const nuevaCuotaActual = ajuste.cuota_actual + 1;
        await db.query(
          'UPDATE ajustes_personal SET cuota_actual = $1 WHERE id = $2',
          [nuevaCuotaActual, ajuste.id]
        );
        
        // Si no es en cuotas (aplicación única) o es la última cuota, marcar como finalizado
        if (!ajuste.en_cuotas || (ajuste.en_cuotas && nuevaCuotaActual >= ajuste.cantidad_cuotas)) {
          await db.query(
            'UPDATE ajustes_personal SET estado = $1 WHERE id = $2',
            ['finalizado', ajuste.id]
          );
        }
      }
      
      // Recalcular neto_pagar después de aplicar ajustes
      const neto_pagar_final = total_ingresos - total_egresos;
      
      // Actualizar totales del rol mensual
      await db.query(
        `UPDATE roles_mensuales
         SET total_ingresos = $1, total_egresos = $2, neto_pagar = $3
         WHERE id = $4`,
        [total_ingresos, total_egresos, neto_pagar_final, rolId]
      );
      
      rolesGenerados.push(rolResult.rows[0]);
    }
    
    await auditLog(req.user.id, 'roles_mensuales', null, 'generar', {
      periodo_mes,
      cantidad: rolesGenerados.length
    });
    
    res.json({ 
      ok: true, 
      mensaje: `${rolesGenerados.length} roles generados`,
      roles: rolesGenerados
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.delete('/api/roles-mensuales', authMiddleware, requireModulePermission('roles_mensuales', 'can_delete'), async (req, res) => {
  try {
    const { periodo_mes } = req.query;
    
    if (!periodo_mes) {
      return res.status(400).json({ error: 'periodo_mes es requerido' });
    }
    
    // Obtener ajustes que se van a eliminar para revertir cuota_actual
    const ajustesAEliminar = await db.query(
      `SELECT DISTINCT aa.ajuste_id, aa.cuota_numero
       FROM ajustes_aplicaciones aa
       JOIN rol_ajustes_detalle rad ON rad.aplicacion_id = aa.id
       JOIN roles_mensuales rm ON rm.id = rad.rol_mensual_id
       WHERE rm.periodo_mes = $1`,
      [periodo_mes]
    );

    // Revertir cuota_actual de los ajustes antes de borrar
    for (const ajuste of ajustesAEliminar.rows) {
      await db.query(
        `UPDATE ajustes_personal
         SET cuota_actual = cuota_actual - 1,
             estado = CASE 
               WHEN estado = 'finalizado' AND en_cuotas = TRUE THEN 'activo'
               ELSE estado
             END
         WHERE id = $1`,
        [ajuste.ajuste_id]
      );
    }

    // Borrar ajustes_aplicaciones de roles mensuales del periodo
    await db.query(
      `DELETE FROM ajustes_aplicaciones
       WHERE referencia_tipo = 'rol_mensual'
         AND referencia_inicio >= $1::date
         AND referencia_fin < ($1::date + INTERVAL '1 month')`,
      [periodo_mes + '-01']
    );
    
    const result = await db.query(
      'DELETE FROM roles_mensuales WHERE periodo_mes = $1 RETURNING id',
      [periodo_mes]
    );
    
    await auditLog(req.user.id, 'roles_mensuales', null, 'delete_periodo', {
      periodo_mes,
      cantidad: result.rowCount
    });
    
    res.json({ ok: true, eliminados: result.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.put('/api/roles-mensuales/:id/estado', authMiddleware, requireModulePermission('roles_mensuales', 'can_modify'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { estado } = req.body;
    
    if (!hasValue(estado)) {
      return res.status(400).json({ error: 'estado es requerido' });
    }
    
    const result = await db.query(
      `UPDATE roles_mensuales
       SET estado = $1, updated_at = now()
       WHERE id = $2
       RETURNING *`,
      [estado, id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'rol mensual no encontrado' });
    }
    
    await auditLog(req.user.id, 'roles_mensuales', id, 'update_estado', { nuevo_estado: estado });
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.delete('/api/roles-mensuales/:id', authMiddleware, requireModulePermission('roles_mensuales', 'can_delete'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    const exists = await db.query('SELECT id FROM roles_mensuales WHERE id = $1', [id]);
    if (exists.rowCount === 0) {
      return res.status(404).json({ error: 'rol mensual no encontrado' });
    }

    // Obtener ajustes que se van a eliminar para revertir cuota_actual
    const ajustesAEliminar = await db.query(
      `SELECT DISTINCT aa.ajuste_id, aa.cuota_numero
       FROM ajustes_aplicaciones aa
       JOIN rol_ajustes_detalle rad ON rad.aplicacion_id = aa.id
       WHERE rad.rol_mensual_id = $1`,
      [id]
    );

    // Revertir cuota_actual de los ajustes antes de borrar
    for (const ajuste of ajustesAEliminar.rows) {
      await db.query(
        `UPDATE ajustes_personal
         SET cuota_actual = cuota_actual - 1,
             estado = CASE 
               WHEN estado = 'finalizado' AND en_cuotas = TRUE THEN 'activo'
               ELSE estado
             END
         WHERE id = $1`,
        [ajuste.ajuste_id]
      );
    }

    // Borrar ajustes_aplicaciones asociadas
    await db.query(
      `DELETE FROM ajustes_aplicaciones
       WHERE id IN (
         SELECT aplicacion_id
         FROM rol_ajustes_detalle
         WHERE rol_mensual_id = $1
       )`,
      [id]
    );
    
    await db.query('DELETE FROM roles_mensuales WHERE id = $1', [id]);
    
    await auditLog(req.user.id, 'roles_mensuales', id, 'delete', null);
    
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Pagos de roles mensuales
app.get('/api/pagos/roles-mensuales', authMiddleware, requireModulePermission('pagos', 'can_access'), async (req, res) => {
  try {
    const r = await db.query(
      `SELECT prm.id, prm.rol_mensual_id, prm.fecha_pago, prm.banco_id, b.nombre AS banco_nombre,
              prm.comprobante, prm.monto, prm.estado, prm.estado_previo_rol, prm.created_at,
              rm.periodo_mes, rm.personal_id, p.nombre AS personal_nombre, p.documento
       FROM pagos_roles_mensuales prm
       JOIN roles_mensuales rm ON rm.id = prm.rol_mensual_id
       JOIN personal p ON p.id = rm.personal_id
       LEFT JOIN bancos b ON b.id = prm.banco_id
       ORDER BY prm.id DESC`
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/pagos/roles-mensuales', authMiddleware, requireModulePermission('pagos', 'can_modify'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { rol_mensual_id, fecha_pago, banco_id, comprobante, monto } = req.body;
    
    if (!hasValue(rol_mensual_id)) return res.status(400).json({ error: 'rol_mensual_id es obligatorio' });
    if (!isValidDate(fecha_pago)) return res.status(400).json({ error: 'fecha_pago invalida (YYYY-MM-DD)' });
    if (!hasValue(banco_id)) return res.status(400).json({ error: 'banco_id es obligatorio' });
    
    await client.query('BEGIN');
    
    const rol = await client.query(
      'SELECT id, estado, neto_pagar FROM roles_mensuales WHERE id = $1',
      [Number(rol_mensual_id)]
    );
    
    if (rol.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'rol mensual no encontrado' });
    }
    
    if (String(rol.rows[0].estado || '').toLowerCase() === 'pagado') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'el rol mensual ya esta pagado' });
    }
    
    const banco = await client.query('SELECT id FROM bancos WHERE id = $1 AND activo = TRUE', [Number(banco_id)]);
    if (banco.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'banco invalido' });
    }
    
    const amount = hasValue(monto) ? Number(monto) : Number(rol.rows[0].neto_pagar);
    if (!Number.isFinite(amount) || amount <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'monto invalido' });
    }
    
    const estadoPrevio = String(rol.rows[0].estado || 'borrador');
    
    const created = await client.query(
      `INSERT INTO pagos_roles_mensuales(
        rol_mensual_id, fecha_pago, banco_id, comprobante, monto, estado_previo_rol, estado, created_by
      ) VALUES($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [Number(rol_mensual_id), fecha_pago, Number(banco_id), comprobante || null, 
       amount, estadoPrevio, 'pagado', req.user.id]
    );
    
    await client.query(
      'UPDATE roles_mensuales SET estado = $1, updated_at = now(), paid_by = $2 WHERE id = $3',
      ['pagado', req.user.id, Number(rol_mensual_id)]
    );
    
    await client.query('COMMIT');
    
    await auditLog(req.user.id, 'pagos_roles_mensuales', created.rows[0].id, 'create', created.rows[0]);
    
    res.status(201).json(created.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'server error' });
  } finally {
    client.release();
  }
});

app.put('/api/pagos/roles-mensuales/:id', authMiddleware, requireModulePermission('pagos', 'can_modify'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { fecha_pago, banco_id, comprobante, monto } = req.body;
    
    const exists = await db.query('SELECT id FROM pagos_roles_mensuales WHERE id = $1', [id]);
    if (exists.rowCount === 0) {
      return res.status(404).json({ error: 'pago de rol no encontrado' });
    }
    
    if (hasValue(fecha_pago) && !isValidDate(fecha_pago)) {
      return res.status(400).json({ error: 'fecha_pago invalida' });
    }
    
    if (hasValue(banco_id)) {
      const banco = await db.query('SELECT id FROM bancos WHERE id = $1 AND activo = TRUE', [Number(banco_id)]);
      if (banco.rowCount === 0) {
        return res.status(400).json({ error: 'banco invalido' });
      }
    }
    
    const result = await db.query(
      `UPDATE pagos_roles_mensuales
       SET fecha_pago = COALESCE($1, fecha_pago),
           banco_id = COALESCE($2, banco_id),
           comprobante = COALESCE($3, comprobante),
           monto = COALESCE($4, monto)
       WHERE id = $5
       RETURNING *`,
      [
        hasValue(fecha_pago) ? fecha_pago : null,
        hasValue(banco_id) ? Number(banco_id) : null,
        hasValue(comprobante) ? comprobante : null,
        hasValue(monto) ? Number(monto) : null,
        id
      ]
    );
    
    await auditLog(req.user.id, 'pagos_roles_mensuales', id, 'update', result.rows[0]);
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.delete('/api/pagos/roles-mensuales/:id', authMiddleware, requireModulePermission('pagos', 'can_delete'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    const id = Number(req.params.id);
    
    await client.query('BEGIN');
    
    const pago = await client.query(
      'SELECT id, rol_mensual_id, estado_previo_rol FROM pagos_roles_mensuales WHERE id = $1',
      [id]
    );
    
    if (pago.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'pago de rol no encontrado' });
    }
    
    const rolId = Number(pago.rows[0].rol_mensual_id);
    const estadoPrevio = String(pago.rows[0].estado_previo_rol || 'borrador');
    
    await client.query('DELETE FROM pagos_roles_mensuales WHERE id = $1', [id]);
    
    await client.query(
      'UPDATE roles_mensuales SET estado = $1, updated_at = now(), paid_by = NULL WHERE id = $2',
      [estadoPrevio, rolId]
    );
    
    await client.query('COMMIT');
    
    await auditLog(req.user.id, 'pagos_roles_mensuales', id, 'delete', { rol_mensual_id: rolId });
    
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'server error' });
  } finally {
    client.release();
  }
});

app.get('/api/auditoria', authMiddleware, requireAdmin, requireModulePermission('reportes', 'can_access'), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 100), 500);
    const r = await db.query(
      `SELECT id, user_id, entidad, entidad_id, accion, fecha_hora, detalle
       FROM auditoria
       ORDER BY id DESC
       LIMIT $1`,
      [limit]
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/reportes/pagos-estibador', authMiddleware, requireModulePermission('reportes', 'can_access'), async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const validationError = validateDateRange(desde, hasta);
    if (validationError) return res.status(400).json({ error: validationError });

    const result = await db.query(
      `SELECT l.estibador_personal_id AS personal_id,
              p.nombre AS estibador_nombre,
              COUNT(pg.id)::int AS total_pagos,
              COALESCE(SUM(pg.monto), 0)::numeric(12,2) AS total_pagado
       FROM pagos pg
       JOIN liquidaciones l ON l.id = pg.liquidacion_id
       JOIN personal p ON p.id = l.estibador_personal_id
       WHERE pg.fecha_pago BETWEEN $1 AND $2
       GROUP BY l.estibador_personal_id, p.nombre
       ORDER BY total_pagado DESC, p.nombre ASC`,
      [desde, hasta]
    );

    res.json({ desde, hasta, rows: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/reportes/rutas-choferes', authMiddleware, requireModulePermission('reportes', 'can_access'), async (req, res) => {
  try {
    const { desde, hasta, chofer_id, ruta_id } = req.query;
    const validationError = validateDateRange(desde, hasta);
    if (validationError) return res.status(400).json({ error: validationError });

    const conditions = ['v.fecha BETWEEN $1 AND $2'];
    const params = [desde, hasta];

    if (hasValue(chofer_id)) {
      params.push(Number(chofer_id));
      conditions.push(`v.conductor_id = $${params.length}`);
    }

    if (hasValue(ruta_id)) {
      params.push(Number(ruta_id));
      conditions.push(`r.id = $${params.length}`);
    }

    const result = await db.query(
      `WITH rutas_viaje AS (
         SELECT vr.viaje_id, vr.ruta_id
         FROM viajes_rutas vr
         UNION
         SELECT v.id AS viaje_id, v.ruta_id
         FROM viajes v
         WHERE NOT EXISTS (
           SELECT 1 FROM viajes_rutas vr2 WHERE vr2.viaje_id = v.id AND vr2.ruta_id = v.ruta_id
         )
       )
       SELECT v.id AS viaje_db_id,
              v.viaje_id,
              v.fecha,
              p.id AS chofer_id,
              p.nombre AS chofer_nombre,
              c.placa,
              r.id AS ruta_id,
              r.nombre AS ruta_nombre,
              r.tipo AS ruta_tipo,
              COALESCE(r.valor_a_pagar, 0)::numeric(12,2) AS valor_a_pagar
       FROM viajes v
       JOIN personal p ON p.id = v.conductor_id
       JOIN camiones c ON c.id = v.camion_id
       JOIN rutas_viaje rv ON rv.viaje_id = v.id
       JOIN rutas r ON r.id = rv.ruta_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY v.fecha DESC, p.nombre ASC, v.id DESC, r.nombre ASC`,
      params
    );

    res.json({ desde, hasta, rows: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/reportes/gastos-viaje', authMiddleware, requireModulePermission('reportes', 'can_access'), async (req, res) => {
  try {
    const { desde, hasta, camion_id, chofer_id, ruta_id } = req.query;
    const validationError = validateDateRange(desde, hasta);
    if (validationError) return res.status(400).json({ error: validationError });

    const conditions = ['v.fecha BETWEEN $1 AND $2'];
    const params = [desde, hasta];

    if (hasValue(camion_id)) {
      params.push(Number(camion_id));
      conditions.push(`v.camion_id = $${params.length}`);
    }

    if (hasValue(chofer_id)) {
      params.push(Number(chofer_id));
      conditions.push(`v.conductor_id = $${params.length}`);
    }

    if (hasValue(ruta_id)) {
      params.push(Number(ruta_id));
      conditions.push(`EXISTS (SELECT 1 FROM rutas_viaje rvf WHERE rvf.viaje_id = v.id AND rvf.ruta_id = $${params.length})`);
    }

    const result = await db.query(
      `WITH rutas_viaje AS (
         SELECT vr.viaje_id, vr.ruta_id
         FROM viajes_rutas vr
         UNION
         SELECT v.id AS viaje_id, v.ruta_id
         FROM viajes v
         WHERE NOT EXISTS (
           SELECT 1 FROM viajes_rutas vr2 WHERE vr2.viaje_id = v.id AND vr2.ruta_id = v.ruta_id
         )
       ),
       rutas_agregadas AS (
         SELECT rv.viaje_id,
                STRING_AGG(DISTINCT r.nombre, ', ' ORDER BY r.nombre) AS rutas_nombres
         FROM rutas_viaje rv
         JOIN rutas r ON r.id = rv.ruta_id
         GROUP BY rv.viaje_id
       ),
       gastos_por_viaje AS (
         SELECT vg.viaje_ref_id,
                COALESCE(SUM(vg.valor), 0)::numeric(12,2) AS total_gastos
         FROM viaje_gastos vg
         GROUP BY vg.viaje_ref_id
       )
       SELECT v.id AS viaje_db_id,
              v.viaje_id,
              v.fecha,
              p.id AS chofer_id,
              p.nombre AS chofer_nombre,
              c.id AS camion_id,
        c.nombre AS camion_nombre,
              c.placa,
              COALESCE(ra.rutas_nombres, rt.nombre) AS ruta_nombre,
              COALESCE(gv.total_gastos, 0)::numeric(12,2) AS total_gastos
       FROM viajes v
       JOIN personal p ON p.id = v.conductor_id
       JOIN camiones c ON c.id = v.camion_id
       JOIN rutas rt ON rt.id = v.ruta_id
       LEFT JOIN rutas_agregadas ra ON ra.viaje_id = v.id
       LEFT JOIN gastos_por_viaje gv ON gv.viaje_ref_id = v.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY v.fecha DESC, v.id DESC`,
      params
    );

    res.json({ desde, hasta, rows: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/reportes/gastos-viaje/:viajeId/detalle', authMiddleware, requireModulePermission('reportes', 'can_access'), async (req, res) => {
  try {
    const viajeId = Number(req.params.viajeId);
    if (!Number.isFinite(viajeId) || viajeId <= 0) {
      return res.status(400).json({ error: 'viajeId invalido' });
    }

    const viaje = await db.query('SELECT id FROM viajes WHERE id = $1', [viajeId]);
    if (viaje.rowCount === 0) return res.status(404).json({ error: 'viaje no encontrado' });

    const detalle = await db.query(
      `SELECT id, viaje_ref_id, tipo_gasto, valor, observacion, numero_comprobante, created_at
       FROM viaje_gastos
       WHERE viaje_ref_id = $1
       ORDER BY id DESC`,
      [viajeId]
    );

    res.json({ viaje_id: viajeId, rows: detalle.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/reportes/viajes-facturar', authMiddleware, requireModulePermission('reportes', 'can_access'), async (req, res) => {
  try {
    const { desde, hasta, chofer_id, camion_id, ruta_id, tipo_ruta } = req.query;
    const validationError = validateDateRange(desde, hasta);
    if (validationError) return res.status(400).json({ error: validationError });

    const conditions = ['v.fecha BETWEEN $1 AND $2'];
    const params = [desde, hasta];

    if (hasValue(chofer_id)) {
      params.push(Number(chofer_id));
      conditions.push(`v.conductor_id = $${params.length}`);
    }
    if (hasValue(camion_id)) {
      params.push(Number(camion_id));
      conditions.push(`v.camion_id = $${params.length}`);
    }
    if (hasValue(ruta_id)) {
      params.push(Number(ruta_id));
      conditions.push(`r.id = $${params.length}`);
    }
    if (hasValue(tipo_ruta)) {
      params.push(tipo_ruta);
      conditions.push(`r.tipo = $${params.length}`);
    }

    const result = await db.query(
      `WITH rutas_viaje AS (
         SELECT vr.viaje_id, vr.ruta_id
         FROM viajes_rutas vr
         UNION
         SELECT v.id AS viaje_id, v.ruta_id
         FROM viajes v
         WHERE NOT EXISTS (
           SELECT 1 FROM viajes_rutas vr2 WHERE vr2.viaje_id = v.id AND vr2.ruta_id = v.ruta_id
         )
       )
       SELECT v.id AS viaje_db_id,
              v.viaje_id,
              v.fecha,
              p.id AS chofer_id,
              p.nombre AS chofer_nombre,
              c.id AS camion_id,
              c.nombre AS camion_nombre,
              c.placa,
              r.id AS ruta_id,
              r.nombre AS ruta_nombre,
              r.tipo AS ruta_tipo,
              COALESCE(r.valor_a_cobrar, 0)::numeric(12,2) AS valor_a_cobrar
       FROM viajes v
       JOIN personal p ON p.id = v.conductor_id
       JOIN camiones c ON c.id = v.camion_id
       JOIN rutas_viaje rv ON rv.viaje_id = v.id
       JOIN rutas r ON r.id = rv.ruta_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY v.fecha DESC, v.id DESC, r.nombre ASC`,
      params
    );

    res.json({ desde, hasta, rows: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/reportes/costos-operacion', authMiddleware, requireModulePermission('reportes', 'can_access'), async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const validationError = validateDateRange(desde, hasta);
    if (validationError) return res.status(400).json({ error: validationError });

    const baseResult = await db.query(
      `SELECT v.id, v.fecha, v.camion_id, c.nombre AS camion_nombre, c.placa,
              v.ruta_id, r.nombre AS ruta_nombre,
              COALESCE(g.total_gastos, 0)::numeric(12,2) AS total_gastos,
              COALESCE(cr.total_carga, 0)::numeric(12,2) AS total_carga
       FROM viajes v
       JOIN camiones c ON c.id = v.camion_id
       JOIN rutas r ON r.id = v.ruta_id
       LEFT JOIN (
         SELECT viaje_ref_id, SUM(valor)::numeric(12,2) AS total_gastos
         FROM viaje_gastos
         GROUP BY viaje_ref_id
       ) g ON g.viaje_ref_id = v.id
       LEFT JOIN (
         SELECT viaje_ref_id, SUM(valor_carga)::numeric(12,2) AS total_carga
         FROM viaje_carga
         GROUP BY viaje_ref_id
       ) cr ON cr.viaje_ref_id = v.id
       WHERE v.fecha BETWEEN $1 AND $2`,
      [desde, hasta]
    );

    const rows = baseResult.rows;

    const rutaMap = new Map();
    const camionMap = new Map();
    const dailyUsageMap = new Map();

    for (const row of rows) {
      const rutaKey = String(row.ruta_id);
      const camionKey = String(row.camion_id);
      const fechaKey = formatDateKey(row.fecha);
      const gastos = Number(row.total_gastos || 0);
      const carga = Number(row.total_carga || 0);

      const rutaCurrent = rutaMap.get(rutaKey) || {
        ruta_id: row.ruta_id,
        ruta_nombre: row.ruta_nombre,
        viajes: 0,
        total_gastos: 0,
        total_carga: 0
      };
      rutaCurrent.viajes += 1;
      rutaCurrent.total_gastos += gastos;
      rutaCurrent.total_carga += carga;
      rutaMap.set(rutaKey, rutaCurrent);

      const camionCurrent = camionMap.get(camionKey) || {
        camion_id: row.camion_id,
        camion_nombre: row.camion_nombre,
        placa: row.placa,
        viajes: 0,
        total_gastos: 0,
        total_carga: 0
      };
      camionCurrent.viajes += 1;
      camionCurrent.total_gastos += gastos;
      camionCurrent.total_carga += carga;
      camionMap.set(camionKey, camionCurrent);

      if (!fechaKey) continue;

      const dailyCurrent = dailyUsageMap.get(fechaKey) || {
        fecha: fechaKey,
        camiones: new Set(),
        viajes: 0
      };
      dailyCurrent.camiones.add(Number(row.camion_id));
      dailyCurrent.viajes += 1;
      dailyUsageMap.set(fechaKey, dailyCurrent);
    }

    const formatTotals = (item) => ({
      ...item,
      total_gastos: round2(item.total_gastos),
      total_carga: round2(item.total_carga)
    });

    const costos_por_ruta = Array.from(rutaMap.values())
      .map(formatTotals)
      .sort((a, b) => b.total_gastos - a.total_gastos);

    const costos_por_camion = Array.from(camionMap.values())
      .map(formatTotals)
      .sort((a, b) => b.total_gastos - a.total_gastos);

    const uso_diario = Array.from(dailyUsageMap.values())
      .map((item) => ({
        fecha: item.fecha,
        camiones_usados: item.camiones.size,
        viajes: item.viajes
      }))
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

    res.json({ desde, hasta, costos_por_ruta, costos_por_camion, uso_diario });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/reportes/uso-camiones-mes', authMiddleware, requireModulePermission('reportes', 'can_access'), async (req, res) => {
  try {
    const monthValue = String(req.query.mes || '');
    const monthRange = getMonthDateRange(monthValue);
    if (!monthRange) return res.status(400).json({ error: 'mes debe tener formato YYYY-MM' });

    const result = await db.query(
      `SELECT v.fecha, v.camion_id
       FROM viajes v
       WHERE v.fecha BETWEEN $1 AND $2`,
      [monthRange.start, monthRange.end]
    );

    const dailyUsageMap = new Map();
    for (const row of result.rows) {
      const fechaKey = formatDateKey(row.fecha);
      if (!fechaKey) continue;

      const current = dailyUsageMap.get(fechaKey) || {
        fecha: fechaKey,
        camiones: new Set(),
        viajes: 0
      };
      current.camiones.add(Number(row.camion_id));
      current.viajes += 1;
      dailyUsageMap.set(fechaKey, current);
    }

    const uso_diario = Array.from(dailyUsageMap.values())
      .map((item) => ({
        fecha: item.fecha,
        camiones_usados: item.camiones.size,
        viajes: item.viajes
      }))
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

    res.json({ mes: monthValue, desde: monthRange.start, hasta: monthRange.end, uso_diario });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/reportes/inconsistencias', authMiddleware, requireModulePermission('reportes', 'can_access'), async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const validationError = validateDateRange(desde, hasta);
    if (validationError) return res.status(400).json({ error: validationError });

    const estibadoresSinAsignacion = await db.query(
      `SELECT bm.id AS marca_id, bm.fecha, bm.personal_id, p.nombre AS estibador_nombre,
              bm.biometrico_id, bm.horas_reales_trabajo
       FROM biometrico_marcas bm
       JOIN personal p ON p.id = bm.personal_id
       LEFT JOIN viaje_personal vp ON vp.personal_id = bm.personal_id
       LEFT JOIN viajes v ON v.id = vp.viaje_id AND v.fecha = bm.fecha
       WHERE bm.aplica_pago = TRUE
         AND bm.fecha BETWEEN $1 AND $2
         AND v.id IS NULL
       ORDER BY bm.fecha DESC, p.nombre ASC`,
      [desde, hasta]
    );

    const viajesSinEstiba = await db.query(
      `SELECT v.id AS viaje_db_id, v.viaje_id, v.fecha, v.tipo_operacion,
              c.placa, r.nombre AS ruta_nombre,
              COALESCE(cnt.asignaciones, 0)::int AS asignaciones
       FROM viajes v
       JOIN camiones c ON c.id = v.camion_id
       JOIN rutas r ON r.id = v.ruta_id
       LEFT JOIN (
         SELECT viaje_id, COUNT(*) AS asignaciones
         FROM viaje_personal
         GROUP BY viaje_id
       ) cnt ON cnt.viaje_id = v.id
       WHERE v.fecha BETWEEN $1 AND $2
         AND COALESCE(cnt.asignaciones, 0) = 0
       ORDER BY v.fecha DESC, v.id DESC`,
      [desde, hasta]
    );

    res.json({
      desde,
      hasta,
      estibadores_pagables_sin_asignacion: estibadoresSinAsignacion.rows,
      viajes_sin_estibadores: viajesSinEstiba.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Simple CRUD: drivers
app.get('/api/drivers', authMiddleware, requireModulePermission('bitacora', 'can_access'), async (req, res) => {
  const r = await db.query('SELECT id, name, dni FROM drivers ORDER BY id');
  res.json(r.rows);
});

app.post('/api/drivers', authMiddleware, requireModulePermission('bitacora', 'can_modify'), async (req, res) => {
  const { name, dni } = req.body;
  const r = await db.query('INSERT INTO drivers(name,dni) VALUES($1,$2) RETURNING id,name,dni', [name, dni]);
  res.json(r.rows[0]);
});

// Genera el siguiente ID de viaje con nomenclatura V-numero secuencial
app.get('/api/viajes/next-id', authMiddleware, requireModulePermission('bitacora', 'can_access'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT viaje_id FROM viajes ORDER BY id DESC LIMIT 1`
    );

    let nextNumber = 1;
    if (result.rowCount > 0) {
      const lastViajeId = String(result.rows[0].viaje_id || '');
      // Extrae el número de viaje_id (ej: "V-1" -> 1, "V-50-R5" -> 50)
      const match = lastViajeId.match(/V-(\d+)/);
      if (match) {
        const lastNumber = Number(match[1]);
        if (Number.isInteger(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }
    }

    // Formatea: V-1, V-2, V-3, etc
    const nextId = `V-${nextNumber}`;
    res.json({ next_id: nextId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Fase 2: Bitacora de viajes
app.get('/api/viajes', authMiddleware, requireModulePermission('bitacora', 'can_access'), async (req, res) => {
  try {
    const { fecha, ruta_id, camion_id, conductor_id } = req.query;
    
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;
    
    if (fecha) {
      whereConditions.push(`DATE(v.fecha) = $${paramIndex}`);
      params.push(fecha);
      paramIndex++;
    }
    
    if (ruta_id) {
      whereConditions.push(`(v.ruta_id = $${paramIndex} OR EXISTS (SELECT 1 FROM viajes_rutas vr WHERE vr.viaje_id = v.id AND vr.ruta_id = $${paramIndex}))`);
      params.push(Number(ruta_id));
      paramIndex++;
    }
    
    if (camion_id) {
      whereConditions.push(`v.camion_id = $${paramIndex}`);
      params.push(Number(camion_id));
      paramIndex++;
    }
    
    if (conductor_id) {
      whereConditions.push(`v.conductor_id = $${paramIndex}`);
      params.push(Number(conductor_id));
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    const r = await db.query(
      `SELECT v.id, v.viaje_id, v.fecha, v.fecha AS fecha_desde, v.fecha_hasta, v.camion_id, c.placa, c.nombre AS camion_nombre,
              v.conductor_id, p.nombre AS conductor_nombre,
              v.ruta_id, rt.nombre AS ruta_nombre, rt.tipo AS ruta_tipo,
              v.estado_viaje_id, ev.nombre AS estado_nombre,
              v.tipo_operacion, v.km_inicial, v.km_final, v.observacion, v.created_at, v.updated_at,
              (
                SELECT JSON_AGG(JSON_BUILD_OBJECT('id', r2.id, 'nombre', r2.nombre, 'tipo', r2.tipo))
                FROM viajes_rutas vr
                JOIN rutas r2 ON r2.id = vr.ruta_id
                WHERE vr.viaje_id = v.id
              ) AS rutas_asociadas
       FROM viajes v
       JOIN camiones c ON c.id = v.camion_id
       JOIN personal p ON p.id = v.conductor_id
       JOIN rutas rt ON rt.id = v.ruta_id
       JOIN estados_viaje ev ON ev.id = v.estado_viaje_id
       ${whereClause}
       ORDER BY v.fecha DESC, v.id DESC`,
      params
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/viajes', authMiddleware, requireModulePermission('bitacora', 'can_modify'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    const missingCatalogs = await validatePhase1ForTrips();
    if (missingCatalogs.length > 0) {
      return res.status(400).json({
        error: 'No se puede registrar viajes hasta completar Fase 1',
        missing_catalogs: missingCatalogs
      });
    }

    const {
      viaje_id,
      fecha,
      fecha_desde,
      fecha_hasta,
      camion_id,
      conductor_id,
      ruta_id,
      estado_viaje_id,
      tipo_operacion,
      km_inicial,
      km_final,
      observacion
    } = req.body;

    const fechaDesde = fecha_desde || fecha;
    const fechaHasta = fecha_hasta || fecha;

    const paidWeek = await getPaidWeekOverlap(fechaDesde, fechaHasta);
    if (paidWeek) {
      return res.status(409).json({
        error: `no se puede crear/modificar informacion en semana pagada (${String(paidWeek.semana_inicio).slice(0, 10)} a ${String(paidWeek.semana_fin).slice(0, 10)})`
      });
    }

    const rutaIds = Array.isArray(req.body.ruta_ids)
      ? [...new Set(req.body.ruta_ids.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))]
      : [];

    const rutasSeleccionadas = rutaIds.length > 0 ? rutaIds : [Number(ruta_id)];
    if (rutasSeleccionadas.length === 0 || !Number.isInteger(rutasSeleccionadas[0])) {
      return res.status(400).json({ error: 'ruta_id es obligatorio' });
    }

    await client.query('BEGIN');

    // Validar datos del viaje
    const validationError = await validateViajeCoreData({
      viaje_id: String(viaje_id),
      fecha: fechaDesde,
      fecha_desde: fechaDesde,
      fecha_hasta: fechaHasta,
      camion_id,
      conductor_id,
      ruta_id: rutasSeleccionadas[0],
      estado_viaje_id,
      tipo_operacion,
      km_inicial,
      km_final,
      observacion
    });
    if (validationError) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: validationError });
    }

    // Crear un solo viaje
    const created = await client.query(
      `INSERT INTO viajes(viaje_id, fecha, fecha_hasta, camion_id, conductor_id, ruta_id, estado_viaje_id, tipo_operacion, km_inicial, km_final, observacion)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        String(viaje_id),
        fechaDesde,
        fechaHasta,
        Number(camion_id),
        Number(conductor_id),
        Number(rutasSeleccionadas[0]),
        Number(estado_viaje_id),
        tipo_operacion || 'carga',
        Number(km_inicial || 0),
        Number(km_final || 0),
        observacion || null
      ]
    );

    const viajeCreado = created.rows[0];

    // Insertar todas las rutas asociadas en viajes_rutas
    for (const rutaId of rutasSeleccionadas) {
      await client.query(
        `INSERT INTO viajes_rutas (viaje_id, ruta_id) VALUES ($1, $2) ON CONFLICT (viaje_id, ruta_id) DO NOTHING`,
        [viajeCreado.id, rutaId]
      );
    }

    await client.query('COMMIT');

    await auditLog(req.user.id, 'viajes', viajeCreado.id, 'create', {
      viaje_id: viajeCreado.viaje_id,
      fecha_desde: viajeCreado.fecha,
      fecha_hasta: viajeCreado.fecha_hasta,
      rutas: rutasSeleccionadas
    });

    return res.status(201).json(viajeCreado);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    console.error(err);
    res.status(500).json({ error: 'server error' });
  } finally {
    client.release();
  }
});

app.put('/api/viajes/:id', authMiddleware, requireModulePermission('bitacora', 'can_modify'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const exists = await db.query('SELECT id FROM viajes WHERE id=$1', [id]);
    if (exists.rowCount === 0) {
      return res.status(404).json({ error: 'viaje no encontrado' });
    }

    const lock = await isViajeLocked(id);
    if (lock.locked) {
      return res.status(409).json({ error: `viaje bloqueado por estado ${lock.estado}` });
    }

    const validationError = await validateViajeCoreData(req.body, id);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const {
      viaje_id,
      fecha,
      fecha_desde,
      fecha_hasta,
      camion_id,
      conductor_id,
      ruta_id,
      estado_viaje_id,
      tipo_operacion,
      km_inicial,
      km_final,
      observacion
    } = req.body;

    const fechaDesde = fecha_desde || fecha;
    const fechaHasta = fecha_hasta || fecha;

    const paidWeek = await getPaidWeekOverlap(fechaDesde, fechaHasta);
    if (paidWeek) {
      return res.status(409).json({
        error: `no se puede crear/modificar informacion en semana pagada (${String(paidWeek.semana_inicio).slice(0, 10)} a ${String(paidWeek.semana_fin).slice(0, 10)})`
      });
    }

    const rutaIds = Array.isArray(req.body.ruta_ids)
      ? [...new Set(req.body.ruta_ids.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))]
      : [];

    const rutasSeleccionadas = rutaIds.length > 0 ? rutaIds : [Number(ruta_id)];

    const updated = await db.query(
      `UPDATE viajes
       SET viaje_id=$1, fecha=$2, fecha_hasta=$3, camion_id=$4, conductor_id=$5, ruta_id=$6, estado_viaje_id=$7,
           tipo_operacion=$8, km_inicial=$9, km_final=$10, observacion=$11, updated_at=now()
       WHERE id=$12
       RETURNING *`,
      [
        String(viaje_id),
        fechaDesde,
        fechaHasta,
        Number(camion_id),
        Number(conductor_id),
        Number(rutasSeleccionadas[0]),
        Number(estado_viaje_id),
        tipo_operacion || 'carga',
        Number(km_inicial || 0),
        Number(km_final || 0),
        observacion || null,
        id
      ]
    );

    // Actualizar las rutas asociadas en viajes_rutas
    await db.query('DELETE FROM viajes_rutas WHERE viaje_id = $1', [id]);
    for (const rutaId of rutasSeleccionadas) {
      await db.query(
        'INSERT INTO viajes_rutas (viaje_id, ruta_id) VALUES ($1, $2) ON CONFLICT (viaje_id, ruta_id) DO NOTHING',
        [id, rutaId]
      );
    }

    await auditLog(req.user.id, 'viajes', id, 'update', {
      viaje_id: updated.rows[0].viaje_id,
      fecha_desde: updated.rows[0].fecha,
      fecha_hasta: updated.rows[0].fecha_hasta,
      rutas: rutasSeleccionadas
    });

    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.delete('/api/viajes/:id', authMiddleware, requireModulePermission('bitacora', 'can_delete'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    const id = Number(req.params.id);
    const exists = await client.query('SELECT id, viaje_id, fecha, fecha_hasta FROM viajes WHERE id=$1', [id]);
    if (exists.rowCount === 0) {
      return res.status(404).json({ error: 'viaje no encontrado' });
    }

    const lock = await isViajeLocked(id);
    if (lock.locked) {
      return res.status(409).json({ error: `viaje bloqueado por estado ${lock.estado}` });
    }

    const liquidacionesPagadas = await client.query(
      `SELECT DISTINCT l.id
       FROM liquidacion_detalle ld
       JOIN liquidaciones l ON l.id = ld.liquidacion_id
       JOIN pagos pg ON pg.liquidacion_id = l.id
       WHERE ld.viaje_id = $1
         AND LOWER(COALESCE(pg.estado, '')) = 'pagado'`,
      [id]
    );

    if (liquidacionesPagadas.rowCount > 0) {
      return res.status(409).json({ error: 'no se puede eliminar: el viaje pertenece a una liquidacion pagada' });
    }

    await client.query('BEGIN');

    const detallesEliminados = await client.query(
      `DELETE FROM liquidacion_detalle
       WHERE viaje_id = $1
       RETURNING liquidacion_id`,
      [id]
    );

    const liquidacionIds = [...new Set(detallesEliminados.rows.map((row) => Number(row.liquidacion_id)).filter((value) => Number.isInteger(value)))];

    if (liquidacionIds.length > 0) {
      await client.query(
        `UPDATE liquidaciones l
         SET total = COALESCE(src.total, 0)
         FROM (
           SELECT ld.liquidacion_id, COALESCE(SUM(ld.monto), 0) AS total
           FROM liquidacion_detalle ld
           WHERE ld.liquidacion_id = ANY($1::int[])
           GROUP BY ld.liquidacion_id
         ) src
         WHERE l.id = src.liquidacion_id`,
        [liquidacionIds]
      );

      await client.query(
        `DELETE FROM liquidaciones l
         WHERE l.id = ANY($1::int[])
           AND NOT EXISTS (
             SELECT 1
             FROM liquidacion_detalle ld
             WHERE ld.liquidacion_id = l.id
           )`,
        [liquidacionIds]
      );
    }

    const deleted = await client.query('DELETE FROM viajes WHERE id=$1 RETURNING id', [id]);
    if (deleted.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'viaje no encontrado' });
    }

    await client.query('COMMIT');

    await auditLog(req.user.id, 'viajes', id, 'delete', {
      viaje_id: exists.rows[0].viaje_id,
      fecha_desde: exists.rows[0].fecha,
      fecha_hasta: exists.rows[0].fecha_hasta,
      liquidacion_detalle_eliminado: detallesEliminados.rowCount
    });

    res.json({ ok: true });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    if (err?.code === '23503' || err?.code === '23001') {
      return res.status(409).json({ error: 'no se puede eliminar: el viaje tiene registros asociados en liquidaciones' });
    }
    console.error(err);
    res.status(500).json({ error: 'server error' });
  } finally {
    client.release();
  }
});

app.get('/api/viajes/:id/gastos', authMiddleware, requireModulePermission('bitacora', 'can_access'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = await db.query('SELECT * FROM viaje_gastos WHERE viaje_ref_id=$1 ORDER BY id DESC', [id]);
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/viajes/:id/personal', authMiddleware, requireModulePermission('bitacora', 'can_access'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const viaje = await db.query('SELECT id, fecha FROM viajes WHERE id=$1', [id]);
    if (viaje.rowCount === 0) return res.status(404).json({ error: 'viaje no encontrado' });

    const result = await db.query(
      `SELECT vp.viaje_id, vp.personal_id, p.nombre, p.documento,
              CASE WHEN EXISTS (
                SELECT 1
                FROM biometrico_marcas bm
                WHERE bm.personal_id = vp.personal_id
                  AND bm.fecha = $2
                  AND bm.aplica_pago = TRUE
              ) THEN TRUE ELSE FALSE END AS justificado_txt
       FROM viaje_personal vp
       JOIN personal p ON p.id = vp.personal_id
       WHERE vp.viaje_id = $1
       ORDER BY p.nombre ASC`,
      [id, viaje.rows[0].fecha]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/viajes/:id/personal', authMiddleware, requireModulePermission('bitacora', 'can_modify'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { personal_id } = req.body;
    if (!hasValue(personal_id)) return res.status(400).json({ error: 'personal_id es obligatorio' });

    const viaje = await db.query('SELECT id FROM viajes WHERE id=$1', [id]);
    if (viaje.rowCount === 0) return res.status(404).json({ error: 'viaje no encontrado' });

    const lock = await isViajeLocked(id);
    if (lock.locked) return res.status(409).json({ error: `viaje bloqueado por estado ${lock.estado}` });

    const personal = await db.query(
      `SELECT p.id
       FROM personal p
       JOIN personal_role_assignments pra ON pra.personal_id = p.id
       JOIN personal_roles pr ON pr.id = pra.role_id
       WHERE p.id = $1
         AND p.activo = TRUE
         AND pr.activo = TRUE
         AND LOWER(pr.nombre) = 'estibador'`,
      [Number(personal_id)]
    );
    if (personal.rowCount === 0) {
      return res.status(400).json({ error: 'personal invalido (debe existir y tener rol Estibador)' });
    }

    await db.query(
      `INSERT INTO viaje_personal(viaje_id, personal_id, created_by)
       VALUES($1,$2,$3)
       ON CONFLICT (viaje_id, personal_id) DO NOTHING`,
      [id, Number(personal_id), req.user.id]
    );

    await auditLog(req.user.id, 'viaje_personal', null, 'create', {
      viaje_id: id,
      personal_id: Number(personal_id)
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.delete('/api/viajes/:id/personal/:personalId', authMiddleware, requireModulePermission('bitacora', 'can_delete'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const personalId = Number(req.params.personalId);

    const viaje = await db.query('SELECT id FROM viajes WHERE id=$1', [id]);
    if (viaje.rowCount === 0) return res.status(404).json({ error: 'viaje no encontrado' });

    const lock = await isViajeLocked(id);
    if (lock.locked) return res.status(409).json({ error: `viaje bloqueado por estado ${lock.estado}` });

    const deleted = await db.query(
      `DELETE FROM viaje_personal
       WHERE viaje_id=$1 AND personal_id=$2
       RETURNING viaje_id, personal_id`,
      [id, personalId]
    );
    if (deleted.rowCount === 0) return res.status(404).json({ error: 'asignacion no encontrada' });

    await auditLog(req.user.id, 'viaje_personal', null, 'delete', {
      viaje_id: id,
      personal_id: personalId
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/viajes/:id/gastos', authMiddleware, requireModulePermission('bitacora', 'can_modify'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const exists = await db.query('SELECT id FROM viajes WHERE id=$1', [id]);
    if (exists.rowCount === 0) return res.status(404).json({ error: 'viaje no encontrado' });

    const lock = await isViajeLocked(id);
    if (lock.locked) return res.status(409).json({ error: `viaje bloqueado por estado ${lock.estado}` });

    const { tipo_gasto, valor, observacion, numero_comprobante } = req.body;
    if (!hasValue(tipo_gasto)) return res.status(400).json({ error: 'tipo_gasto es obligatorio' });
    if (!hasValue(valor)) return res.status(400).json({ error: 'valor es obligatorio' });

    const created = await db.query(
      `INSERT INTO viaje_gastos(viaje_ref_id, tipo_gasto, valor, observacion, numero_comprobante)
       VALUES($1,$2,$3,$4,$5)
       RETURNING *`,
      [id, tipo_gasto, Number(valor), observacion || null, numero_comprobante || null]
    );

    await auditLog(req.user.id, 'viaje_gastos', created.rows[0].id, 'create', {
      viaje_id: id,
      tipo_gasto,
      valor: Number(valor)
    });

    res.status(201).json(created.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.put('/api/viajes/:id/gastos/:gastoId', authMiddleware, requireModulePermission('bitacora', 'can_modify'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const gastoId = Number(req.params.gastoId);

    const exists = await db.query('SELECT id FROM viajes WHERE id=$1', [id]);
    if (exists.rowCount === 0) return res.status(404).json({ error: 'viaje no encontrado' });

    const lock = await isViajeLocked(id);
    if (lock.locked) return res.status(409).json({ error: `viaje bloqueado por estado ${lock.estado}` });

    const gasto = await db.query('SELECT id, viaje_ref_id FROM viaje_gastos WHERE id=$1', [gastoId]);
    if (gasto.rowCount === 0 || Number(gasto.rows[0].viaje_ref_id) !== id) {
      return res.status(404).json({ error: 'gasto no encontrado para el viaje' });
    }

    const { tipo_gasto, valor, observacion, numero_comprobante } = req.body;
    if (!hasValue(tipo_gasto)) return res.status(400).json({ error: 'tipo_gasto es obligatorio' });
    if (!hasValue(valor)) return res.status(400).json({ error: 'valor es obligatorio' });

    const updated = await db.query(
      `UPDATE viaje_gastos
       SET tipo_gasto=$1, valor=$2, observacion=$3, numero_comprobante=$4
       WHERE id=$5
       RETURNING *`,
      [tipo_gasto, Number(valor), observacion || null, numero_comprobante || null, gastoId]
    );

    await auditLog(req.user.id, 'viaje_gastos', gastoId, 'update', {
      viaje_id: id,
      tipo_gasto,
      valor: Number(valor)
    });

    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.delete('/api/viajes/:id/gastos/:gastoId', authMiddleware, requireModulePermission('bitacora', 'can_delete'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const gastoId = Number(req.params.gastoId);

    const exists = await db.query('SELECT id FROM viajes WHERE id=$1', [id]);
    if (exists.rowCount === 0) return res.status(404).json({ error: 'viaje no encontrado' });

    const lock = await isViajeLocked(id);
    if (lock.locked) return res.status(409).json({ error: `viaje bloqueado por estado ${lock.estado}` });

    const deleted = await db.query(
      `DELETE FROM viaje_gastos
       WHERE id=$1 AND viaje_ref_id=$2
       RETURNING id`,
      [gastoId, id]
    );

    if (deleted.rowCount === 0) {
      return res.status(404).json({ error: 'gasto no encontrado para el viaje' });
    }

    await auditLog(req.user.id, 'viaje_gastos', gastoId, 'delete', { viaje_id: id });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/viajes/:id/carga', authMiddleware, requireModulePermission('bitacora', 'can_access'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = await db.query(
      `SELECT vc.*, p.nombre AS producto_nombre
       FROM viaje_carga vc
       JOIN productos p ON p.id = vc.producto_id
       WHERE vc.viaje_ref_id=$1
       ORDER BY vc.id DESC`,
      [id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/viajes/:id/carga', authMiddleware, requireModulePermission('bitacora', 'can_modify'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const exists = await db.query(
      `SELECT v.id, r.tipo AS ruta_tipo
       FROM viajes v
       JOIN rutas r ON r.id = v.ruta_id
       WHERE v.id=$1`,
      [id]
    );
    if (exists.rowCount === 0) return res.status(404).json({ error: 'viaje no encontrado' });

    const lock = await isViajeLocked(id);
    if (lock.locked) return res.status(409).json({ error: `viaje bloqueado por estado ${lock.estado}` });

    const { producto_id, cantidad, valor_carga } = req.body;
    if (!hasValue(valor_carga)) return res.status(400).json({ error: 'valor_carga es obligatorio' });

    const isRutaCorta = normalizeOperacion(exists.rows[0].ruta_tipo) === 'corta';

    let productoId = hasValue(producto_id) ? Number(producto_id) : null;
    let cantidadValue = hasValue(cantidad) ? Number(cantidad) : null;

    if (isRutaCorta) {
      if (!Number.isFinite(Number(valor_carga))) {
        return res.status(400).json({ error: 'valor_carga invalido' });
      }

      if (!Number.isFinite(cantidadValue) || cantidadValue <= 0) {
        cantidadValue = 1;
      }

      if (!Number.isInteger(productoId) || productoId <= 0) {
        productoId = await getOrCreateRutaCortaProductoId();
      }
    } else {
      // Ruta larga: permitir AMBOS tipos de carga
      // - Con producto_id + cantidad (carga de ruta larga estándar)
      // - Sin producto_id pero con valor_carga (carga de ruta corta dentro de ruta larga)
      
      if (!Number.isFinite(Number(valor_carga))) {
        return res.status(400).json({ error: 'valor_carga invalido' });
      }

      // Si tiene producto_id, es carga de ruta larga
      if (hasValue(producto_id)) {
        if (!hasValue(cantidad)) return res.status(400).json({ error: 'cantidad es obligatoria para carga de ruta larga' });
        if (!Number.isFinite(Number(cantidad)) || Number(cantidad) <= 0) {
          return res.status(400).json({ error: 'cantidad debe ser mayor a 0' });
        }
        const producto = await db.query('SELECT id FROM productos WHERE id=$1 AND activo=TRUE', [Number(producto_id)]);
        if (producto.rowCount === 0) return res.status(400).json({ error: 'producto invalido' });

        productoId = Number(producto_id);
        cantidadValue = Number(cantidad);
      } else {
        // Si NO tiene producto_id es carga de ruta corta (solo valor)
        // Usar producto default de ruta corta y cantidad 1
        cantidadValue = 1;
        productoId = await getOrCreateRutaCortaProductoId();
      }
    }

    const created = await db.query(
      `INSERT INTO viaje_carga(viaje_ref_id, producto_id, cantidad, valor_carga)
       VALUES($1,$2,$3,$4)
       RETURNING *`,
      [id, productoId, cantidadValue, Number(valor_carga)]
    );

    await auditLog(req.user.id, 'viaje_carga', created.rows[0].id, 'create', {
      viaje_id: id,
      producto_id: productoId,
      cantidad: cantidadValue,
      valor_carga: Number(valor_carga)
    });

    res.status(201).json(created.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.put('/api/viajes/:id/carga/:cargaId', authMiddleware, requireModulePermission('bitacora', 'can_modify'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cargaId = Number(req.params.cargaId);

    const exists = await db.query(
      `SELECT v.id, r.tipo AS ruta_tipo
       FROM viajes v
       JOIN rutas r ON r.id = v.ruta_id
       WHERE v.id=$1`,
      [id]
    );
    if (exists.rowCount === 0) return res.status(404).json({ error: 'viaje no encontrado' });

    const lock = await isViajeLocked(id);
    if (lock.locked) return res.status(409).json({ error: `viaje bloqueado por estado ${lock.estado}` });

    const carga = await db.query('SELECT id, viaje_ref_id FROM viaje_carga WHERE id=$1', [cargaId]);
    if (carga.rowCount === 0 || Number(carga.rows[0].viaje_ref_id) !== id) {
      return res.status(404).json({ error: 'carga no encontrada para el viaje' });
    }

    const { producto_id, cantidad, valor_carga } = req.body;
    if (!hasValue(valor_carga)) return res.status(400).json({ error: 'valor_carga es obligatorio' });

    const isRutaCorta = normalizeOperacion(exists.rows[0].ruta_tipo) === 'corta';

    let productoId = hasValue(producto_id) ? Number(producto_id) : null;
    let cantidadValue = hasValue(cantidad) ? Number(cantidad) : null;

    if (isRutaCorta) {
      if (!Number.isFinite(Number(valor_carga))) {
        return res.status(400).json({ error: 'valor_carga invalido' });
      }

      if (!Number.isFinite(cantidadValue) || cantidadValue <= 0) {
        cantidadValue = 1;
      }

      if (!Number.isInteger(productoId) || productoId <= 0) {
        productoId = await getOrCreateRutaCortaProductoId();
      }
    } else {
      // Ruta larga: permitir AMBOS tipos de carga
      // - Con producto_id + cantidad (carga de ruta larga estándar)
      // - Sin producto_id pero con valor_carga (carga de ruta corta dentro de ruta larga)
      
      if (!Number.isFinite(Number(valor_carga))) {
        return res.status(400).json({ error: 'valor_carga invalido' });
      }

      // Si tiene producto_id, es carga de ruta larga
      if (hasValue(producto_id)) {
        if (!hasValue(cantidad)) return res.status(400).json({ error: 'cantidad es obligatoria para carga de ruta larga' });
        if (!Number.isFinite(Number(cantidad)) || Number(cantidad) <= 0) {
          return res.status(400).json({ error: 'cantidad debe ser mayor a 0' });
        }
        const producto = await db.query('SELECT id FROM productos WHERE id=$1 AND activo=TRUE', [Number(producto_id)]);
        if (producto.rowCount === 0) return res.status(400).json({ error: 'producto invalido' });

        productoId = Number(producto_id);
        cantidadValue = Number(cantidad);
      } else {
        // Si NO tiene producto_id es carga de ruta corta (solo valor)
        // Usar producto default de ruta corta y cantidad 1
        cantidadValue = 1;
        productoId = await getOrCreateRutaCortaProductoId();
      }
    }

    const updated = await db.query(
      `UPDATE viaje_carga
       SET producto_id=$1, cantidad=$2, valor_carga=$3
       WHERE id=$4
       RETURNING *`,
      [productoId, cantidadValue, Number(valor_carga), cargaId]
    );

    await auditLog(req.user.id, 'viaje_carga', cargaId, 'update', {
      viaje_id: id,
      producto_id: productoId,
      cantidad: cantidadValue,
      valor_carga: Number(valor_carga)
    });

    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.delete('/api/viajes/:id/carga/:cargaId', authMiddleware, requireModulePermission('bitacora', 'can_delete'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cargaId = Number(req.params.cargaId);

    const exists = await db.query('SELECT id FROM viajes WHERE id=$1', [id]);
    if (exists.rowCount === 0) return res.status(404).json({ error: 'viaje no encontrado' });

    const lock = await isViajeLocked(id);
    if (lock.locked) return res.status(409).json({ error: `viaje bloqueado por estado ${lock.estado}` });

    const deleted = await db.query(
      `DELETE FROM viaje_carga
       WHERE id=$1 AND viaje_ref_id=$2
       RETURNING id`,
      [cargaId, id]
    );

    if (deleted.rowCount === 0) {
      return res.status(404).json({ error: 'carga no encontrada para el viaje' });
    }

    await auditLog(req.user.id, 'viaje_carga', cargaId, 'delete', { viaje_id: id });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/viajes/:id/viaticos-ajuste', authMiddleware, requireModulePermission('bitacora', 'can_modify'), async (req, res) => {
  try {
    const viajeId = Number(req.params.id);
    
    // Verificar que el viaje existe
    const viajeResult = await db.query(
      `SELECT v.id, v.viaje_id, v.conductor_id, v.ruta_id
       FROM viajes v
       WHERE v.id=$1`,
      [viajeId]
    );
    if (viajeResult.rowCount === 0) return res.status(404).json({ error: 'viaje no encontrado' });
    
    const viaje = viajeResult.rows[0];
    if (!viaje.conductor_id) return res.status(400).json({ error: 'el viaje no tiene conductor asignado' });
    
    const { banco_id, valor_transferencia, comprobante, tipo_ajuste, diferencia } = req.body;
    
    if (!hasValue(banco_id)) return res.status(400).json({ error: 'banco_id es obligatorio' });
    if (!hasValue(valor_transferencia)) return res.status(400).json({ error: 'valor_transferencia es obligatorio' });
    if (!hasValue(tipo_ajuste)) return res.status(400).json({ error: 'tipo_ajuste es obligatorio' });
    
    const tipoNormalizado = String(tipo_ajuste).toLowerCase();
    if (!['faltante', 'sobrante'].includes(tipoNormalizado)) {
      return res.status(400).json({ error: 'tipo_ajuste debe ser "faltante" o "sobrante"' });
    }
    
    // Crear el ajuste en la tabla ajustes_personal
    const detalle = `${tipoNormalizado === 'faltante' ? 'Faltante' : 'Sobrante'} por ruta larga - Viaje #${viaje.viaje_id}`;
    
    const ajusteResult = await db.query(
      `INSERT INTO ajustes_personal (
        personal_id, tipo, detalle, valor_total, en_cuotas, cantidad_cuotas, 
        frecuencia, fecha_inicio, estado, viaje_id, banco_id, comprobante_viatico
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        viaje.conductor_id,
        tipoNormalizado,
        detalle,
        Number(diferencia || 0),
        false,
        1,
        'mensual',
        new Date().toISOString().slice(0, 10),
        'activo',
        viajeId,
        Number(banco_id),
        comprobante || null
      ]
    );
    
    if (ajusteResult.rowCount === 0) {
      return res.status(500).json({ error: 'no se pudo crear el ajuste' });
    }
    
    await auditLog(req.user.id, 'ajustes_personal', ajusteResult.rows[0].id, 'create', {
      tipo: tipoNormalizado,
      viaje_id: viajeId,
      conductor_id: viaje.conductor_id,
      diferencia: Number(diferencia || 0)
    });
    
    res.status(201).json(ajusteResult.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Compat endpoint
app.get('/api/trips', authMiddleware, requireModulePermission('bitacora', 'can_access'), async (req, res) => {
  const r = await db.query('SELECT * FROM viajes ORDER BY id DESC');
  res.json(r.rows);
});

// Settlements (liquidaciones)
app.get('/api/settlements', authMiddleware, requireModulePermission('liquidaciones', 'can_access'), async (req, res) => {
  try {
    const r = await db.query(
      `SELECT s.id, s.driver_id, d.name AS driver_name, s.period_start, s.period_end, s.total_amount, s.created_at
       FROM settlements s
       JOIN drivers d ON d.id = s.driver_id
       ORDER BY s.id DESC`
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/settlements', authMiddleware, requireModulePermission('liquidaciones', 'can_modify'), async (req, res) => {
  try {
    const { driver_id, period_start, period_end } = req.body;

    if (!driver_id || !period_start || !period_end) {
      return res.status(400).json({ error: 'driver_id, period_start y period_end son obligatorios' });
    }

    const driver = await db.query('SELECT id FROM drivers WHERE id=$1', [driver_id]);
    if (driver.rowCount === 0) {
      return res.status(404).json({ error: 'chofer no encontrado' });
    }

    const totalResult = await db.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric(12,2) AS total
       FROM trips
       WHERE driver_id = $1 AND date BETWEEN $2 AND $3`,
      [driver_id, period_start, period_end]
    );

    const total = Number(totalResult.rows[0].total || 0);

    const created = await db.query(
      `INSERT INTO settlements(driver_id, period_start, period_end, total_amount)
       VALUES($1, $2, $3, $4)
       RETURNING *`,
      [driver_id, period_start, period_end, total]
    );

    res.status(201).json(created.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Simple init endpoint to create admin if not exists (safe for dev only)
app.post('/api/init-admin', async (req, res) => {
  try {
    const { email, password } = req.body;
    const r = await db.query('SELECT id FROM users WHERE email=$1', [email]);
    if (r.rowCount > 0) return res.json({ ok: true, message: 'exists' });
    const hash = await bcrypt.hash(password, 10);
    await db.query('INSERT INTO users(email,password_hash,role) VALUES($1,$2,$3)', [email, hash, 'admin']);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

async function startServer() {
  try {
    await db.ensureSchema();
    app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
  } catch (err) {
    console.error('No se pudo inicializar la base de datos', err);
    process.exit(1);
  }
}

startServer();



