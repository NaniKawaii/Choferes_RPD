export const CATALOG_MENU_ITEMS = [
  { key: 'personal_roles', label: 'Roles' },
  { key: 'bancos', label: 'Bancos' },
  { key: 'personal', label: 'Personal' },
  { key: 'camiones', label: 'Camiones' },
  { key: 'rutas', label: 'Rutas' },
  { key: 'estados_viaje', label: 'Estados de viaje' },
  { key: 'productos', label: 'Productos' },
  { key: 'metricas_ruta_larga', label: 'Métricas ruta larga' },
  { key: 'metricas_ruta_corta', label: 'Métricas ruta corta' },
  { key: 'admin_access', label: 'Accesos Admin' },
  { key: 'empresa_logo', label: 'Logo empresa' }
]

export const ACCESS_MODULE_KEYS = ['dashboard', 'bitacora', 'biometrico', 'liquidaciones', 'pagos', 'reportes', 'base_datos', 'empresa_logo', 'admin_access']

export const MENU_ITEMS = [
  { key: 'dashboard', label: 'Dashboard' },
  ...CATALOG_MENU_ITEMS,
  { key: 'bitacora', label: 'Bitácora de viajes' },
  { key: 'biometrico', label: 'Importar TXT biométrico' },
  { key: 'liquidaciones', label: 'Liquidación semanal' },
  { key: 'pagos', label: 'Pagos' },
  { key: 'reportes', label: 'Reportes' }
]

export const MAIN_MENU_ITEMS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'bitacora', label: 'Bitácora de viajes' },
  { key: 'biometrico', label: 'Importar TXT biométrico' },
  { key: 'liquidaciones', label: 'Liquidación semanal' },
  { key: 'pagos', label: 'Pagos' },
  { key: 'reportes', label: 'Reportes' }
]

export const CATALOGS = {
  bancos: {
    title: 'Bancos',
    fields: [
      { key: 'nombre', label: 'Nombre', type: 'text', required: true },
      { key: 'activo', label: 'Activo', type: 'boolean' }
    ],
    columns: ['id', 'nombre', 'activo']
  },
  personal_roles: {
    title: 'Roles',
    fields: [
      { key: 'nombre', label: 'Nombre', type: 'text', required: true },
      { key: 'activo', label: 'Activo', type: 'boolean' }
    ],
    columns: ['id', 'nombre', 'activo']
  },
  personal: {
    title: 'Personal',
    fields: [
      { key: 'nombre', label: 'Nombre', type: 'text', required: true },
      { key: 'documento', label: 'Documento', type: 'text' },
      { key: 'banco_id', label: 'Banco', type: 'select', source: 'bancos', sourceLabel: 'nombre' },
      { key: 'numero_cuenta', label: 'Nro Cuenta', type: 'text' },
      { key: 'personal_role_ids', label: 'Roles', type: 'multi_select_dropdown', source: 'personal_roles', sourceLabel: 'nombre', required: true },
      { key: 'email', label: 'Correo (solo Admin)', type: 'text' },
      { key: 'password', label: 'Contraseña (solo Admin)', type: 'password' },
      { key: 'activo', label: 'Activo', type: 'boolean' }
    ],
    columns: ['id', 'nombre', 'documento', 'banco_id', 'numero_cuenta', 'email', 'personal_role_ids', 'activo']
  },
  camiones: {
    title: 'Camiones',
    fields: [
      { key: 'nombre', label: 'Nombre', type: 'text', required: true },
      { key: 'placa', label: 'Placa', type: 'text', required: true },
      { key: 'kilometraje_inicial', label: 'Km inicial', type: 'number' },
      { key: 'tonelaje_max_quintales', label: 'Tonelaje máx (qq)', type: 'number' },
      { key: 'rendimiento_esperado', label: 'Rendimiento esperado', type: 'number' },
      { key: 'activo', label: 'Activo', type: 'boolean' }
    ],
    columns: ['id', 'nombre', 'placa', 'kilometraje_inicial', 'tonelaje_max_quintales', 'rendimiento_esperado', 'activo']
  },
  rutas: {
    title: 'Rutas',
    fields: [
      { key: 'nombre', label: 'Nombre', type: 'text', required: true },
      { key: 'tipo', label: 'Tipo', type: 'select_static', options: ['larga', 'corta', 'mixta'], required: true },
      { key: 'distancia_km', label: 'Distancia KM', type: 'number' },
      { key: 'activo', label: 'Activo', type: 'boolean' }
    ],
    columns: ['id', 'nombre', 'tipo', 'distancia_km', 'activo']
  },
  estados_viaje: {
    title: 'Estados de viaje',
    fields: [
      { key: 'nombre', label: 'Nombre', type: 'text', required: true },
      { key: 'activo', label: 'Activo', type: 'boolean' }
    ],
    columns: ['id', 'nombre', 'activo']
  },
  productos: {
    title: 'Productos',
    fields: [
      { key: 'nombre', label: 'Nombre', type: 'text', required: true },
      { key: 'unidad_medida', label: 'Unidad', type: 'text' },
      { key: 'peso_quintales_unidad', label: 'Peso por unidad (qq)', type: 'number' },
      { key: 'activo', label: 'Activo', type: 'boolean' }
    ],
    columns: ['id', 'nombre', 'unidad_medida', 'peso_quintales_unidad', 'activo']
  },
  metricas_ruta_larga: {
    title: 'Métricas de ruta larga',
    fields: [
      { key: 'producto_id', label: 'Producto', type: 'select', source: 'productos', sourceLabel: 'nombre', required: true },
      { key: 'tipo_operacion', label: 'Operación', type: 'select_static', options: ['carga', 'descarga', 'mixto'], required: true },
      { key: 'valor_unitario', label: 'Valor unitario', type: 'number', required: true },
      { key: 'activo', label: 'Activo', type: 'boolean' }
    ],
    columns: ['id', 'producto_id', 'tipo_operacion', 'valor_unitario', 'activo']
  },
  metricas_ruta_corta: {
    title: 'Métricas de ruta corta',
    fields: [
      { key: 'condicion_valor_carga_desde', label: 'Condición valor carga desde', type: 'number', required: true },
      { key: 'condicion_valor_carga_hasta', label: 'Condición valor carga hasta', type: 'number', required: true },
      { key: 'valor_pagar', label: 'Valor pagar', type: 'number', required: true },
      { key: 'tipo_operacion', label: 'Operación', type: 'select_static', options: ['carga', 'descarga', 'mixto'], required: true },
      { key: 'activo', label: 'Activo', type: 'boolean' }
    ],
    columns: ['id', 'condicion_valor_carga_desde', 'condicion_valor_carga_hasta', 'valor_pagar', 'tipo_operacion', 'activo']
  }
}
