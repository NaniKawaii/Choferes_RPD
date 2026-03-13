-- Inicializacion minima de tablas para la aplicacion

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drivers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  dni TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bancos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS personal_roles (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS personal (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  apellidos TEXT,
  documento TEXT,
  banco_id INTEGER REFERENCES bancos(id),
  numero_cuenta TEXT,
  celular TEXT,
  direccion TEXT,
  correo TEXT,
  afiliado_iess BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_afiliacion_iess DATE,
  sueldo_iess NUMERIC(12,2),
  sueldo_real NUMERIC(12,2),
  descuenta_iess BOOLEAN NOT NULL DEFAULT FALSE,
  cobra_decimo_tercero BOOLEAN NOT NULL DEFAULT FALSE,
  cobra_decimo_cuarto BOOLEAN NOT NULL DEFAULT FALSE,
  cobra_fondo_reserva BOOLEAN NOT NULL DEFAULT FALSE,
  user_id INTEGER REFERENCES users(id),
  personal_role_id INTEGER REFERENCES personal_roles(id),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE personal
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);

ALTER TABLE personal
ADD COLUMN IF NOT EXISTS apellidos TEXT;

ALTER TABLE personal
ADD COLUMN IF NOT EXISTS celular TEXT;

ALTER TABLE personal
ADD COLUMN IF NOT EXISTS direccion TEXT;

ALTER TABLE personal
ADD COLUMN IF NOT EXISTS correo TEXT;

ALTER TABLE personal
ADD COLUMN IF NOT EXISTS afiliado_iess BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE personal
ADD COLUMN IF NOT EXISTS fecha_afiliacion_iess DATE;

ALTER TABLE personal
ADD COLUMN IF NOT EXISTS sueldo_iess NUMERIC(12,2);

ALTER TABLE personal
ADD COLUMN IF NOT EXISTS sueldo_real NUMERIC(12,2);

ALTER TABLE personal
ADD COLUMN IF NOT EXISTS descuenta_iess BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE personal
ADD COLUMN IF NOT EXISTS cobra_decimo_tercero BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE personal
ADD COLUMN IF NOT EXISTS cobra_decimo_cuarto BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE personal
ADD COLUMN IF NOT EXISTS cobra_fondo_reserva BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS personal_role_assignments (
  id SERIAL PRIMARY KEY,
  personal_id INTEGER NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES personal_roles(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (personal_id, role_id)
);

INSERT INTO personal_role_assignments(personal_id, role_id)
SELECT p.id, p.personal_role_id
FROM personal p
WHERE p.personal_role_id IS NOT NULL
ON CONFLICT (personal_id, role_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS camiones (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  placa TEXT NOT NULL UNIQUE,
  kilometraje_inicial NUMERIC(12,2) NOT NULL DEFAULT 0,
  tonelaje_max_quintales NUMERIC(12,2) NOT NULL DEFAULT 0,
  rendimiento_esperado NUMERIC(12,2),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rutas (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL,
  distancia_km NUMERIC(12,2) DEFAULT 0,
  valor_a_cobrar NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_a_pagar NUMERIC(12,2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE rutas
ADD COLUMN IF NOT EXISTS valor_a_cobrar NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE rutas
ADD COLUMN IF NOT EXISTS valor_a_pagar NUMERIC(12,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rutas'
      AND column_name = 'valor'
  ) THEN
    EXECUTE '
      UPDATE rutas
      SET valor_a_cobrar = valor
      WHERE valor_a_cobrar IS DISTINCT FROM valor
    ';
  END IF;
END $$;

ALTER TABLE rutas
DROP COLUMN IF EXISTS valor;

CREATE TABLE IF NOT EXISTS estados_viaje (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS productos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  unidad_medida TEXT,
  peso_quintales_unidad NUMERIC(12,4) DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metricas_ruta_larga (
  id SERIAL PRIMARY KEY,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  tipo_operacion TEXT NOT NULL,
  valor_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metricas_ruta_corta (
  id SERIAL PRIMARY KEY,
  condicion_valor_carga NUMERIC(12,2) NOT NULL DEFAULT 0,
  condicion_valor_carga_desde NUMERIC(12,2),
  condicion_valor_carga_hasta NUMERIC(12,2),
  numero_personas INTEGER NOT NULL DEFAULT 1,
  valor_pagar NUMERIC(12,2) NOT NULL DEFAULT 0,
  tipo_operacion TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE metricas_ruta_corta
ADD COLUMN IF NOT EXISTS numero_personas INTEGER NOT NULL DEFAULT 1;

ALTER TABLE metricas_ruta_corta
ADD COLUMN IF NOT EXISTS condicion_valor_carga_desde NUMERIC(12,2);

ALTER TABLE metricas_ruta_corta
ADD COLUMN IF NOT EXISTS condicion_valor_carga_hasta NUMERIC(12,2);

UPDATE metricas_ruta_corta
SET condicion_valor_carga_desde = 0,
    condicion_valor_carga_hasta = condicion_valor_carga
WHERE condicion_valor_carga_desde IS NULL
   OR condicion_valor_carga_hasta IS NULL;

CREATE TABLE IF NOT EXISTS viajes (
  id SERIAL PRIMARY KEY,
  viaje_id TEXT NOT NULL UNIQUE,
  fecha DATE NOT NULL,
  fecha_hasta DATE,
  camion_id INTEGER NOT NULL REFERENCES camiones(id) ON DELETE RESTRICT,
  conductor_id INTEGER NOT NULL REFERENCES personal(id) ON DELETE RESTRICT,
  ruta_id INTEGER NOT NULL REFERENCES rutas(id) ON DELETE RESTRICT,
  estado_viaje_id INTEGER NOT NULL REFERENCES estados_viaje(id) ON DELETE RESTRICT,
  tipo_operacion TEXT NOT NULL,
  km_inicial NUMERIC(12,2) NOT NULL DEFAULT 0,
  km_final NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE viajes
ADD COLUMN IF NOT EXISTS fecha_hasta DATE;

UPDATE viajes
SET fecha_hasta = fecha
WHERE fecha_hasta IS NULL;

CREATE TABLE IF NOT EXISTS viaje_gastos (
  id SERIAL PRIMARY KEY,
  viaje_ref_id INTEGER NOT NULL REFERENCES viajes(id) ON DELETE CASCADE,
  tipo_gasto TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacion TEXT,
  numero_comprobante TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS viaje_carga (
  id SERIAL PRIMARY KEY,
  viaje_ref_id INTEGER NOT NULL REFERENCES viajes(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_carga NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS biometrico_imports (
  id SERIAL PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL UNIQUE,
  import_date DATE,
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  errors_json JSONB,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS biometrico_marcas (
  id SERIAL PRIMARY KEY,
  import_id INTEGER NOT NULL REFERENCES biometrico_imports(id) ON DELETE CASCADE,
  personal_id INTEGER NOT NULL REFERENCES personal(id) ON DELETE RESTRICT,
  biometrico_id TEXT NOT NULL,
  nombre_txt TEXT,
  departamento_txt TEXT,
  fecha DATE NOT NULL,
  primera_perforacion TIME NOT NULL,
  ultima_perforacion TIME NOT NULL,
  numero_perforaciones INTEGER NOT NULL,
  horas_reales_trabajo NUMERIC(8,2) NOT NULL,
  aplica_pago BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (personal_id, fecha, primera_perforacion, ultima_perforacion)
);

CREATE TABLE IF NOT EXISTS asignacion_estiba (
  id SERIAL PRIMARY KEY,
  viaje_id INTEGER NOT NULL REFERENCES viajes(id) ON DELETE CASCADE,
  marca_id INTEGER NOT NULL REFERENCES biometrico_marcas(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (viaje_id, marca_id)
);

CREATE TABLE IF NOT EXISTS viaje_personal (
  id SERIAL PRIMARY KEY,
  viaje_id INTEGER NOT NULL REFERENCES viajes(id) ON DELETE CASCADE,
  personal_id INTEGER NOT NULL REFERENCES personal(id) ON DELETE RESTRICT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (viaje_id, personal_id)
);

INSERT INTO viaje_personal(viaje_id, personal_id, created_by)
SELECT ae.viaje_id, bm.personal_id, ae.created_by
FROM asignacion_estiba ae
JOIN biometrico_marcas bm ON bm.id = ae.marca_id
ON CONFLICT (viaje_id, personal_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS liquidaciones (
  id SERIAL PRIMARY KEY,
  semana_inicio DATE NOT NULL,
  semana_fin DATE NOT NULL,
  estibador_personal_id INTEGER NOT NULL REFERENCES personal(id) ON DELETE RESTRICT,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (semana_inicio, semana_fin, estibador_personal_id)
);

CREATE TABLE IF NOT EXISTS liquidacion_detalle (
  id SERIAL PRIMARY KEY,
  liquidacion_id INTEGER NOT NULL REFERENCES liquidaciones(id) ON DELETE CASCADE,
  viaje_id INTEGER NOT NULL REFERENCES viajes(id) ON DELETE RESTRICT,
  asignacion_id INTEGER REFERENCES asignacion_estiba(id) ON DELETE SET NULL,
  monto NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ajustes_personal (
  id SERIAL PRIMARY KEY,
  personal_id INTEGER NOT NULL REFERENCES personal(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL,
  detalle TEXT NOT NULL,
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  en_cuotas BOOLEAN NOT NULL DEFAULT FALSE,
  cantidad_cuotas INTEGER NOT NULL DEFAULT 1,
  frecuencia TEXT NOT NULL,
  fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  estado TEXT NOT NULL DEFAULT 'activo',
  cuota_actual INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ajustes_aplicaciones (
  id SERIAL PRIMARY KEY,
  ajuste_id INTEGER NOT NULL REFERENCES ajustes_personal(id) ON DELETE CASCADE,
  personal_id INTEGER NOT NULL REFERENCES personal(id) ON DELETE RESTRICT,
  referencia_tipo TEXT NOT NULL,
  referencia_inicio DATE NOT NULL,
  referencia_fin DATE NOT NULL,
  cuota_numero INTEGER NOT NULL DEFAULT 1,
  monto_aplicado NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (ajuste_id, referencia_tipo, referencia_inicio, referencia_fin)
);

CREATE TABLE IF NOT EXISTS liquidacion_ajustes_detalle (
  id SERIAL PRIMARY KEY,
  liquidacion_id INTEGER NOT NULL REFERENCES liquidaciones(id) ON DELETE CASCADE,
  ajuste_id INTEGER NOT NULL REFERENCES ajustes_personal(id) ON DELETE RESTRICT,
  aplicacion_id INTEGER NOT NULL REFERENCES ajustes_aplicaciones(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL,
  detalle TEXT NOT NULL,
  monto NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles_mensuales (
  id SERIAL PRIMARY KEY,
  periodo_mes TEXT NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fin DATE NOT NULL,
  personal_id INTEGER NOT NULL REFERENCES personal(id) ON DELETE RESTRICT,
  estado TEXT NOT NULL DEFAULT 'borrador',
  total_ingresos NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_egresos NUMERIC(12,2) NOT NULL DEFAULT 0,
  neto_pagar NUMERIC(12,2) NOT NULL DEFAULT 0,
  generated_by INTEGER REFERENCES users(id),
  approved_by INTEGER REFERENCES users(id),
  paid_by INTEGER REFERENCES users(id),
  verified_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (personal_id, periodo_inicio, periodo_fin)
);

CREATE TABLE IF NOT EXISTS roles_mensuales_detalle (
  id SERIAL PRIMARY KEY,
  rol_mensual_id INTEGER NOT NULL REFERENCES roles_mensuales(id) ON DELETE CASCADE,
  seccion TEXT NOT NULL,
  concepto TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rol_ajustes_detalle (
  id SERIAL PRIMARY KEY,
  rol_mensual_id INTEGER NOT NULL REFERENCES roles_mensuales(id) ON DELETE CASCADE,
  ajuste_id INTEGER NOT NULL REFERENCES ajustes_personal(id) ON DELETE RESTRICT,
  aplicacion_id INTEGER NOT NULL REFERENCES ajustes_aplicaciones(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL,
  detalle TEXT NOT NULL,
  monto NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pagos (
  id SERIAL PRIMARY KEY,
  liquidacion_id INTEGER NOT NULL REFERENCES liquidaciones(id) ON DELETE RESTRICT,
  fecha_pago DATE NOT NULL,
  banco_id INTEGER REFERENCES bancos(id) ON DELETE RESTRICT,
  comprobante TEXT,
  monto NUMERIC(12,2) NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pagado',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (liquidacion_id)
);

CREATE TABLE IF NOT EXISTS pagos_roles_mensuales (
  id SERIAL PRIMARY KEY,
  rol_mensual_id INTEGER NOT NULL REFERENCES roles_mensuales(id) ON DELETE RESTRICT,
  fecha_pago DATE NOT NULL,
  banco_id INTEGER REFERENCES bancos(id) ON DELETE RESTRICT,
  comprobante TEXT,
  monto NUMERIC(12,2) NOT NULL,
  estado_previo_rol TEXT NOT NULL DEFAULT 'borrador',
  estado TEXT NOT NULL DEFAULT 'pagado',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (rol_mensual_id)
);

ALTER TABLE ajustes_personal
  ADD COLUMN IF NOT EXISTS fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE;

ALTER TABLE ajustes_personal
  ADD COLUMN IF NOT EXISTS viaje_id INTEGER REFERENCES viajes(id) ON DELETE SET NULL;

ALTER TABLE ajustes_personal
  ADD COLUMN IF NOT EXISTS banco_id INTEGER REFERENCES bancos(id) ON DELETE SET NULL;

ALTER TABLE ajustes_personal
  ADD COLUMN IF NOT EXISTS comprobante_viatico TEXT;

ALTER TABLE pagos_roles_mensuales
  ADD COLUMN IF NOT EXISTS estado_previo_rol TEXT NOT NULL DEFAULT 'borrador';

CREATE TABLE IF NOT EXISTS auditoria (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  entidad TEXT NOT NULL,
  entidad_id INTEGER,
  accion TEXT NOT NULL,
  fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT now(),
  detalle JSONB
);

CREATE TABLE IF NOT EXISTS empresa_config (
  id INTEGER PRIMARY KEY,
  logo_data_url TEXT,
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CHECK (id = 1)
);

INSERT INTO empresa_config(id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS admin_module_permissions (
  id SERIAL PRIMARY KEY,
  personal_id INTEGER NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  can_access BOOLEAN NOT NULL DEFAULT TRUE,
  can_modify BOOLEAN NOT NULL DEFAULT TRUE,
  can_delete BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (personal_id, module_key)
);

CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER REFERENCES drivers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  origin TEXT,
  destination TEXT,
  amount NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settlements (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER REFERENCES drivers(id) ON DELETE CASCADE,
  period_start DATE,
  period_end DATE,
  total_amount NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla para relacion muchos-a-muchos entre viajes y rutas
CREATE TABLE IF NOT EXISTS viajes_rutas (
  id SERIAL PRIMARY KEY,
  viaje_id INTEGER NOT NULL REFERENCES viajes(id) ON DELETE CASCADE,
  ruta_id INTEGER NOT NULL REFERENCES rutas(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (viaje_id, ruta_id)
);
