import React, { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { ACCESS_MODULE_KEYS, CATALOG_MENU_ITEMS, CATALOGS, MAIN_MENU_ITEMS, MENU_ITEMS } from './constants/appConfig'
import {
  createFullAccessMatrix,
  createInitialFormValues,
  createInitialViajeForm,
  getCurrentWeekRange,
  getMonthWeekRange,
  getPresetDateRange,
  hasValue
} from './utils/appUtils'
import { EyeIcon, LogoutIcon, PencilIcon, RefreshIcon, SaveIcon, TrashIcon } from './components/icons'

const API = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:4000/api`
const DASHBOARD_PRESETS = ['hoy', 'semana', 'mes', '3 meses', '6 meses', 'año']

export default function App() {
  const weekRangeDefault = useMemo(() => getCurrentWeekRange(), [])
  const catalogViewKeys = useMemo(() => CATALOG_MENU_ITEMS.map((item) => item.key), [])

  const [token, setToken] = useState(localStorage.getItem('token'))
  const [currentView, setCurrentView] = useState('dashboard')
  const [email, setEmail] = useState('admin@example.com')
  const [password, setPassword] = useState('root')
  const [error, setError] = useState('')
  const [multiSelectOpenKey, setMultiSelectOpenKey] = useState('')
  const [multiSelectSearch, setMultiSelectSearch] = useState({})

  const [catalogRows, setCatalogRows] = useState({})
  const [formValues, setFormValues] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [personalViewMode, setPersonalViewMode] = useState('list')
  const [personalSearchDocumento, setPersonalSearchDocumento] = useState('')
  const [personalSearchNombre, setPersonalSearchNombre] = useState('')
  const [personalSearchRol, setPersonalSearchRol] = useState('')
  const [personalSearchEstado, setPersonalSearchEstado] = useState('')
  const [personalFilterRolId, setPersonalFilterRolId] = useState('')
  const [personalFilterEstado, setPersonalFilterEstado] = useState('')

  const [viajes, setViajes] = useState([])
  const [nextViajeId, setNextViajeId] = useState('')
  const [viajeForm, setViajeForm] = useState(createInitialViajeForm())
  const [editingViajeId, setEditingViajeId] = useState(null)
  const [selectedViajeId, setSelectedViajeId] = useState('')
  const [bitacoraTab, setBitacoraTab] = useState('gestion')
  const [gastos, setGastos] = useState([])
  const [cargas, setCargas] = useState([])
  const [viajePersonal, setViajePersonal] = useState([])
  const [viajePersonalId, setViajePersonalId] = useState('')
  const [editingGastoId, setEditingGastoId] = useState(null)
  const [editingCargaId, setEditingCargaId] = useState(null)
  const [gastoForm, setGastoForm] = useState({ tipo_gasto: '', valor: '', observacion: '', numero_comprobante: '' })
  const [cargaForm, setCargaForm] = useState({ producto_id: '', cantidad: '', valor_carga: '' })
  const [bitacoraMessage, setBitacoraMessage] = useState('')

  const [biometricoFile, setBiometricoFile] = useState(null)
  const [biometricoImports, setBiometricoImports] = useState([])
  const [biometricoMarcas, setBiometricoMarcas] = useState([])
  const [biometricoFecha, setBiometricoFecha] = useState('')
  const [biometricoMessage, setBiometricoMessage] = useState('')
  const [popupErrors, setPopupErrors] = useState([])

  const [asignacionFecha, setAsignacionFecha] = useState('')
  const [asignacionViajeId, setAsignacionViajeId] = useState('')
  const [asignacionMarcaId, setAsignacionMarcaId] = useState('')
  const [asignacionData, setAsignacionData] = useState({ marcas: [], viajes: [], asignaciones: [] })
  const [asignacionMessage, setAsignacionMessage] = useState('')

  const [liquidacionSemana, setLiquidacionSemana] = useState('1')
  const [liquidaciones, setLiquidaciones] = useState([])
  const [selectedLiquidacionId, setSelectedLiquidacionId] = useState('')
  const [liquidacionDetalle, setLiquidacionDetalle] = useState([])
  const [liquidacionMessage, setLiquidacionMessage] = useState('')

  const [pagos, setPagos] = useState([])
  const [editingPagoId, setEditingPagoId] = useState(null)
  const [pagoForm, setPagoForm] = useState({
    liquidacion_id: '',
    fecha_pago: new Date().toISOString().slice(0, 10),
    banco_id: '',
    comprobante: '',
    monto: ''
  })
  const [pagoMessage, setPagoMessage] = useState('')
  const [rolesPagoOptions, setRolesPagoOptions] = useState([])
  const [pagosRolesMensuales, setPagosRolesMensuales] = useState([])
  const [editingPagoRolId, setEditingPagoRolId] = useState(null)
  const [pagoRolForm, setPagoRolForm] = useState({
    rol_mensual_id: '',
    fecha_pago: new Date().toISOString().slice(0, 10),
    banco_id: '',
    comprobante: '',
    monto: ''
  })

  const [ajustesRows, setAjustesRows] = useState([])
  const [ajusteForm, setAjusteForm] = useState({
    personal_id: '',
    tipo: 'faltante',
    detalle: '',
    valor_total: '',
    en_cuotas: false,
    cantidad_cuotas: '1',
    frecuencia: 'semanal',
    fecha_inicio: new Date().toISOString().slice(0, 10),
    estado: 'activo'
  })
  const [editingAjusteId, setEditingAjusteId] = useState(null)
  const [ajustesFiltroPersonalId, setAjustesFiltroPersonalId] = useState('')
  const [ajustesFiltroTipo, setAjustesFiltroTipo] = useState('')
  const [ajustesFiltroEstado, setAjustesFiltroEstado] = useState('')
  const [ajustesFiltroFrecuencia, setAjustesFiltroFrecuencia] = useState('')
  const [ajustesMessage, setAjustesMessage] = useState('')

  const [rolesPeriodoMes, setRolesPeriodoMes] = useState(new Date().toISOString().slice(0, 7))
  const [rolesRows, setRolesRows] = useState([])
  const [selectedRolId, setSelectedRolId] = useState('')
  const [rolDetalle, setRolDetalle] = useState(null)
  const [rolesMessage, setRolesMessage] = useState('')

  const [reporteDesde, setReporteDesde] = useState(weekRangeDefault.start)
  const [reporteHasta, setReporteHasta] = useState(weekRangeDefault.end)
  const [reportePagos, setReportePagos] = useState([])
  const [reporteCostosRuta, setReporteCostosRuta] = useState([])
  const [reporteCostosCamion, setReporteCostosCamion] = useState([])
  const [reporteEstibadoresSinAsignacion, setReporteEstibadoresSinAsignacion] = useState([])
  const [reporteViajesSinEstibadores, setReporteViajesSinEstibadores] = useState([])
  const [reporteMessage, setReporteMessage] = useState('')
  const [dashboardDesde, setDashboardDesde] = useState(weekRangeDefault.start)
  const [dashboardHasta, setDashboardHasta] = useState(weekRangeDefault.end)
  const [dashboardPreset, setDashboardPreset] = useState('semana')
  const [dashboardCamionUso, setDashboardCamionUso] = useState([])
  const [dashboardUsoDiario, setDashboardUsoDiario] = useState([])
  const [dashboardCalendarMonth, setDashboardCalendarMonth] = useState(weekRangeDefault.start.slice(0, 7))
  const [dashboardCalendarSelectedDate, setDashboardCalendarSelectedDate] = useState('')
  const [dashboardCalendarLoading, setDashboardCalendarLoading] = useState(false)
  const [dashboardMessage, setDashboardMessage] = useState('')
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [empresaLogo, setEmpresaLogo] = useState('')
  const [empresaLogoMessage, setEmpresaLogoMessage] = useState('')
  const [myAccess, setMyAccess] = useState(createFullAccessMatrix())
  const [adminAccessRows, setAdminAccessRows] = useState([])
  const [selectedAdminAccessId, setSelectedAdminAccessId] = useState('')
  const [adminAccessForm, setAdminAccessForm] = useState(createFullAccessMatrix())
  const [adminAccessMessage, setAdminAccessMessage] = useState('')

  const databaseMenuOpen = catalogViewKeys.includes(currentView)

  function canAccessModule(moduleKey) {
    return myAccess?.[moduleKey]?.can_access !== false
  }

  function canModifyModule(moduleKey) {
    return myAccess?.[moduleKey]?.can_modify !== false
  }

  function canDeleteModule(moduleKey) {
    return myAccess?.[moduleKey]?.can_delete !== false
  }

  function authHeaders() {
    return { Authorization: `Bearer ${token}` }
  }

  function handleUnauthorizedSession() {
    logout()
    setError('Sesión expirada o inválida. Inicia sesión nuevamente.')
  }

  useEffect(() => {
    if (token) refreshAll()
  }, [token])

  useEffect(() => {
    fetchEmpresaLogoPublic()
  }, [])

  useEffect(() => {
    if (!CATALOGS[currentView]) return
    setEditingId(null)
    setFormValues(createInitialFormValues(currentView))
    if (currentView === 'personal') {
      setPersonalViewMode('list')
    }
  }, [currentView])

  useEffect(() => {
    if (!selectedViajeId) {
      setGastos([])
      setCargas([])
      setViajePersonal([])
      return
    }
    fetchViajeDetalles(selectedViajeId)
  }, [selectedViajeId])

  useEffect(() => {
    if (!selectedLiquidacionId) {
      setLiquidacionDetalle([])
      return
    }
    fetchLiquidacionDetalle(selectedLiquidacionId)
  }, [selectedLiquidacionId])

  useEffect(() => {
    if (!multiSelectOpenKey) return

    function handleOutsideClick(event) {
      if (event.target instanceof Element && event.target.closest('.multi-dropdown')) {
        return
      }
      setMultiSelectOpenKey('')
      setMultiSelectSearch((prev) => ({ ...prev, [multiSelectOpenKey]: '' }))
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [multiSelectOpenKey])

  useEffect(() => {
    if (!token) return
    if (currentView !== 'liquidaciones') return
    fetchLiquidaciones(liquidacionSemana)
  }, [currentView, token, liquidacionSemana])

  useEffect(() => {
    if (!token) return
    if (currentView !== 'admin_access') return
    fetchAdminAccessRows()
  }, [currentView, token])

  useEffect(() => {
    if (!token) return
    if (currentView !== 'ajustes_personal') return
    fetchAjustesPersonal()
  }, [currentView, token])

  useEffect(() => {
    if (!token) return
    if (currentView !== 'roles_mensuales') return
    fetchRolesMensuales(rolesPeriodoMes)
  }, [currentView, token, rolesPeriodoMes])

  useEffect(() => {
    if (!token) return
    if (currentView !== 'pagos') return
    fetchPagos()
    fetchPagosRolesMensuales()
    fetchRolesPagoOptions()
  }, [currentView, token])

  useEffect(() => {
    if (!token) return
    if (currentView !== 'dashboard') return
    cargarDashboardCamiones(dashboardDesde, dashboardHasta)
  }, [currentView, token])

  useEffect(() => {
    if (!token) return
    if (currentView !== 'bitacora') return
    if (bitacoraTab !== 'gestion') return
    if (editingViajeId) return
    fetchNextViajeId()
  }, [currentView, token, bitacoraTab, editingViajeId])

  useEffect(() => {
    if (!token) return
    if (currentView !== 'dashboard') return
    cargarDashboardCalendarioMes(dashboardCalendarMonth)
  }, [currentView, token, dashboardCalendarMonth])

  useEffect(() => {
    if (!token) return
    const isCatalogView = CATALOG_MENU_ITEMS.some((item) => item.key === currentView)
    if (isCatalogView) {
      if (!canAccessModule('base_datos')) {
        setCurrentView('dashboard')
        return
      }
      if (currentView === 'empresa_logo' && !canAccessModule('empresa_logo')) {
        setCurrentView('dashboard')
        return
      }
      if (currentView === 'admin_access' && !canAccessModule('admin_access')) {
        setCurrentView('dashboard')
      }
      return
    }
    if (!canAccessModule(currentView)) {
      setCurrentView('dashboard')
    }
  }, [myAccess, currentView, token])

  async function login() {
    try {
      setError('')
      const r = await axios.post(`${API}/login`, { email, password })
      localStorage.setItem('token', r.data.token)
      setToken(r.data.token)
    } catch {
      setError('No se pudo iniciar sesión')
    }
  }

  async function refreshAll() {
    try {
      await Promise.all([
        ...Object.keys(CATALOGS).map(fetchCatalog),
        fetchViajes(),
        fetchBiometricoImports(),
        fetchBiometricoMarcas(),
        fetchAjustesPersonal(),
        fetchRolesMensuales(rolesPeriodoMes),
        fetchPagos(),
        fetchPagosRolesMensuales(),
        fetchRolesPagoOptions(),
        fetchEmpresaLogo(),
        fetchMyAccess()
      ])
    } catch (err) {
      if (err?.response?.status === 401) {
        handleUnauthorizedSession()
        return
      }
      throw err
    }
  }

  async function fetchCatalog(catalogKey) {
    try {
      const r = await axios.get(`${API}/catalogs/${catalogKey}`, { headers: authHeaders() })
      setCatalogRows((prev) => ({ ...prev, [catalogKey]: r.data || [] }))
    } catch (err) {
      if (err?.response?.status === 401) {
        handleUnauthorizedSession()
        return
      }
      throw err
    }
  }

  async function fetchEmpresaLogo() {
    try {
      const r = await axios.get(`${API}/empresa/logo`, { headers: authHeaders() })
      setEmpresaLogo(String(r.data?.logo_data_url || ''))
    } catch (err) {
      if (err?.response?.status === 401) {
        handleUnauthorizedSession()
        return
      }
      throw err
    }
  }

  async function fetchEmpresaLogoPublic() {
    try {
      const r = await axios.get(`${API}/public/empresa/logo`)
      setEmpresaLogo(String(r.data?.logo_data_url || ''))
    } catch {
      setEmpresaLogo('')
    }
  }

  async function fetchMyAccess() {
    try {
      const r = await axios.get(`${API}/me/access`, { headers: authHeaders() })
      setMyAccess({ ...createFullAccessMatrix(), ...(r.data?.modules || {}) })
    } catch {
      setMyAccess(createFullAccessMatrix())
    }
  }

  async function fetchAdminAccessRows() {
    const r = await axios.get(`${API}/admin-access/admins`, { headers: authHeaders() })
    const rows = r.data || []
    setAdminAccessRows(rows)
    if (!selectedAdminAccessId && rows[0]) {
      const firstId = String(rows[0].id)
      setSelectedAdminAccessId(firstId)
      await fetchAdminAccessDetail(firstId)
    }
  }

  async function fetchAdminAccessDetail(personalId) {
    if (!personalId) return
    const r = await axios.get(`${API}/admin-access/${personalId}`, { headers: authHeaders() })
    setAdminAccessForm({ ...createFullAccessMatrix(), ...(r.data?.modules || {}) })
  }

  async function saveAdminAccess() {
    if (!selectedAdminAccessId) return
    try {
      setAdminAccessMessage('')
      await axios.put(`${API}/admin-access/${selectedAdminAccessId}`, { modules: adminAccessForm }, { headers: authHeaders() })
      await fetchMyAccess()
      setAdminAccessMessage('Accesos actualizados correctamente.')
    } catch (err) {
      setAdminAccessMessage(err?.response?.data?.error || 'No se pudieron guardar los accesos')
    }
  }

  async function saveEmpresaLogo(file) {
    if (!file) return
    try {
      setEmpresaLogoMessage('')
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
        reader.readAsDataURL(file)
      })

      const r = await axios.put(`${API}/empresa/logo`, { logo_data_url: dataUrl }, { headers: authHeaders() })
      setEmpresaLogo(String(r.data?.logo_data_url || ''))
      setEmpresaLogoMessage('Logo actualizado correctamente.')
    } catch (err) {
      setEmpresaLogoMessage(err?.response?.data?.error || 'No se pudo guardar el logo')
    }
  }

  async function removeEmpresaLogo() {
    try {
      setEmpresaLogoMessage('')
      await axios.put(`${API}/empresa/logo`, { logo_data_url: null }, { headers: authHeaders() })
      setEmpresaLogo('')
      setEmpresaLogoMessage('Logo eliminado correctamente.')
    } catch (err) {
      setEmpresaLogoMessage(err?.response?.data?.error || 'No se pudo eliminar el logo')
    }
  }

  async function fetchViajes() {
    try {
      const r = await axios.get(`${API}/viajes`, { headers: authHeaders() })
      const data = r.data || []
      setViajes(data)
      if (!selectedViajeId && data[0]) setSelectedViajeId(String(data[0].id))
    } catch (err) {
      if (err?.response?.status === 401) {
        handleUnauthorizedSession()
        return
      }
      throw err
    }
  }

  async function fetchViajeDetalles(viajeId) {
    const [gastosResponse, cargaResponse, personalResponse] = await Promise.all([
      axios.get(`${API}/viajes/${viajeId}/gastos`, { headers: authHeaders() }),
      axios.get(`${API}/viajes/${viajeId}/carga`, { headers: authHeaders() }),
      axios.get(`${API}/viajes/${viajeId}/personal`, { headers: authHeaders() })
    ])
    setGastos(gastosResponse.data || [])
    setCargas(cargaResponse.data || [])
    setViajePersonal(personalResponse.data || [])
  }

  async function fetchBiometricoImports() {
    try {
      const r = await axios.get(`${API}/biometrico/imports`, { headers: authHeaders() })
      setBiometricoImports(r.data || [])
    } catch (err) {
      if (err?.response?.status === 401) {
        handleUnauthorizedSession()
        return
      }
      throw err
    }
  }

  async function fetchBiometricoMarcas(fecha = biometricoFecha) {
    try {
      const query = fecha ? `?fecha=${encodeURIComponent(fecha)}` : ''
      const r = await axios.get(`${API}/biometrico/marcas${query}`, { headers: authHeaders() })
      setBiometricoMarcas(r.data || [])
    } catch (err) {
      if (err?.response?.status === 401) {
        handleUnauthorizedSession()
        return
      }
      throw err
    }
  }

  async function fetchAsignaciones(fecha = asignacionFecha) {
    if (!fecha) {
      setAsignacionMessage('Selecciona una fecha para cargar asignaciones.')
      return
    }

    const r = await axios.get(`${API}/asignaciones?fecha=${encodeURIComponent(fecha)}`, { headers: authHeaders() })
    setAsignacionData({
      marcas: r.data?.marcas || [],
      viajes: r.data?.viajes || [],
      asignaciones: r.data?.asignaciones || []
    })
  }

  async function saveAsignacion() {
    if (!asignacionViajeId || !asignacionMarcaId) {
      setAsignacionMessage('Selecciona un viaje y un estibador para asignar.')
      return
    }

    try {
      setAsignacionMessage('')
      await axios.post(`${API}/asignaciones`, {
        viaje_id: Number(asignacionViajeId),
        marca_id: Number(asignacionMarcaId)
      }, { headers: authHeaders() })

      await fetchAsignaciones(asignacionFecha)
      setAsignacionMessage('Asignación registrada correctamente.')
    } catch (err) {
      setAsignacionMessage(err?.response?.data?.error || 'No se pudo registrar la asignación')
    }
  }

  async function removeAsignacion(id) {
    try {
      setAsignacionMessage('')
      await axios.delete(`${API}/asignaciones/${id}`, { headers: authHeaders() })
      await fetchAsignaciones(asignacionFecha)
      setAsignacionMessage('Asignación eliminada correctamente.')
    } catch (err) {
      setAsignacionMessage(err?.response?.data?.error || 'No se pudo eliminar la asignación')
    }
  }

  async function fetchLiquidaciones(semanaSeleccionada = liquidacionSemana) {
    try {
      const { start: semanaInicio, end: semanaFin } = getMonthWeekRange(semanaSeleccionada)
      setLiquidacionMessage('')
      const query = `?semana_inicio=${encodeURIComponent(semanaInicio)}&semana_fin=${encodeURIComponent(semanaFin)}`
      const r = await axios.get(`${API}/liquidaciones${query}`, { headers: authHeaders() })
      const data = r.data || []
      setLiquidaciones(data)
      setSelectedLiquidacionId(data[0] ? String(data[0].id) : '')
      if (data.length === 0) setLiquidacionMessage('No hay liquidaciones para el rango seleccionado.')
    } catch (err) {
      setLiquidacionMessage(err?.response?.data?.error || 'No se pudo consultar liquidaciones')
    }
  }

  async function generarLiquidaciones() {
    if (!canModifyModule('liquidaciones')) {
      setLiquidacionMessage('No tienes permiso para modificar en Liquidaciones')
      return
    }
    try {
      const { start: semanaInicio, end: semanaFin } = getMonthWeekRange(liquidacionSemana)
      setLiquidacionMessage('')
      const r = await axios.post(`${API}/liquidaciones/generar`, {
        semana_inicio: semanaInicio,
        semana_fin: semanaFin
      }, { headers: authHeaders() })

      const data = r.data?.liquidaciones || []
      setLiquidaciones(data)
      setSelectedLiquidacionId(data[0] ? String(data[0].id) : '')
      setLiquidacionMessage(`Liquidaciones generadas: ${data.length}`)
    } catch (err) {
      setLiquidacionMessage(err?.response?.data?.error || 'No se pudo generar liquidaciones')
    }
  }

  async function eliminarLiquidacionesSemana() {
    if (!canDeleteModule('liquidaciones')) {
      setLiquidacionMessage('No tienes permiso para eliminar en Liquidaciones')
      return
    }
    const { start: semanaInicio, end: semanaFin } = getMonthWeekRange(liquidacionSemana)
    const confirmed = window.confirm(`¿Seguro que deseas eliminar las liquidaciones de ${semanaInicio} a ${semanaFin}?`)
    if (!confirmed) return

    try {
      setLiquidacionMessage('')
      const query = `?semana_inicio=${encodeURIComponent(semanaInicio)}&semana_fin=${encodeURIComponent(semanaFin)}`
      await axios.delete(`${API}/liquidaciones${query}`, { headers: authHeaders() })
      setSelectedLiquidacionId('')
      setLiquidacionDetalle([])
      await Promise.all([
        fetchLiquidaciones(liquidacionSemana),
        fetchPagos()
      ])
      setLiquidacionMessage('Liquidaciones de la semana eliminadas correctamente.')
    } catch (err) {
      setLiquidacionMessage(err?.response?.data?.error || 'No se pudo eliminar la liquidación semanal')
    }
  }

  async function fetchLiquidacionDetalle(liquidacionId) {
    try {
      const r = await axios.get(`${API}/liquidaciones/${liquidacionId}/detalle`, { headers: authHeaders() })
      setLiquidacionDetalle(r.data || [])
    } catch (err) {
      setLiquidacionMessage(err?.response?.data?.error || 'No se pudo cargar el detalle')
      setLiquidacionDetalle([])
    }
  }

  async function fetchPagos() {
    try {
      const r = await axios.get(`${API}/pagos`, { headers: authHeaders() })
      setPagos(r.data || [])
    } catch (err) {
      if (err?.response?.status === 401) {
        handleUnauthorizedSession()
        return
      }
      setPagos([])
    }
  }

  async function fetchPagosRolesMensuales() {
    try {
      const r = await axios.get(`${API}/pagos/roles-mensuales`, { headers: authHeaders() })
      setPagosRolesMensuales(r.data || [])
    } catch (err) {
      if (err?.response?.status === 401) {
        handleUnauthorizedSession()
        return
      }
      setPagosRolesMensuales([])
    }
  }

  async function fetchNextViajeId() {
    try {
      const r = await axios.get(`${API}/viajes/next-id`, { headers: authHeaders() })
      setNextViajeId(String(r.data?.next_id || ''))
    } catch (err) {
      if (err?.response?.status === 401) {
        handleUnauthorizedSession()
        return
      }
      setNextViajeId('')
    }
  }

  async function fetchRolesPagoOptions() {
    try {
      const r = await axios.get(`${API}/roles-mensuales`, { headers: authHeaders() })
      const rows = (r.data || []).filter((item) => String(item.estado || '').toLowerCase() !== 'pagado')
      setRolesPagoOptions(rows)
    } catch (err) {
      if (err?.response?.status === 401) {
        handleUnauthorizedSession()
        return
      }
      setRolesPagoOptions([])
    }
  }

  async function fetchAjustesPersonal() {
    try {
      const r = await axios.get(`${API}/ajustes-personal`, { headers: authHeaders() })
      setAjustesRows(r.data || [])
    } catch (err) {
      if (err?.response?.status === 401) {
        handleUnauthorizedSession()
        return
      }
      setAjustesRows([])
    }
  }

  async function saveAjustePersonal() {
    if (!canModifyModule('ajustes_personal')) {
      setAjustesMessage('No tienes permiso para modificar en Sobrantes y faltantes')
      return
    }

    if (!ajusteForm.personal_id || !ajusteForm.tipo || !ajusteForm.detalle || !ajusteForm.valor_total || !ajusteForm.frecuencia || !ajusteForm.fecha_inicio) {
      setAjustesMessage('Completa los campos obligatorios del ajuste')
      return
    }

    if (ajusteForm.en_cuotas && Number(ajusteForm.cantidad_cuotas || 0) <= 0) {
      setAjustesMessage('Cantidad de cuotas debe ser mayor a 0')
      return
    }

    try {
      setAjustesMessage('')
      const payload = {
        personal_id: Number(ajusteForm.personal_id),
        tipo: ajusteForm.tipo,
        detalle: ajusteForm.detalle,
        valor_total: Number(ajusteForm.valor_total),
        en_cuotas: ajusteForm.en_cuotas === true,
        cantidad_cuotas: ajusteForm.en_cuotas ? Number(ajusteForm.cantidad_cuotas || 1) : 1,
        frecuencia: ajusteForm.frecuencia,
        fecha_inicio: ajusteForm.fecha_inicio,
        estado: ajusteForm.estado
      }

      if (editingAjusteId) await axios.put(`${API}/ajustes-personal/${editingAjusteId}`, payload, { headers: authHeaders() })
      else await axios.post(`${API}/ajustes-personal`, payload, { headers: authHeaders() })

      setAjusteForm({
        personal_id: '',
        tipo: 'faltante',
        detalle: '',
        valor_total: '',
        en_cuotas: false,
        cantidad_cuotas: '1',
        frecuencia: 'semanal',
        fecha_inicio: new Date().toISOString().slice(0, 10),
        estado: 'activo'
      })
      setEditingAjusteId(null)
      await fetchAjustesPersonal()
      setAjustesMessage(editingAjusteId ? 'Ajuste actualizado correctamente.' : 'Ajuste creado correctamente.')
    } catch (err) {
      setAjustesMessage(err?.response?.data?.error || 'No se pudo guardar el ajuste')
    }
  }

  function startEditAjuste(item) {
    setEditingAjusteId(item.id)
    setAjusteForm({
      personal_id: String(item.personal_id || ''),
      tipo: item.tipo || 'faltante',
      detalle: item.detalle || '',
      valor_total: String(item.valor_total ?? ''),
      en_cuotas: item.en_cuotas === true,
      cantidad_cuotas: String(item.cantidad_cuotas || 1),
      frecuencia: item.frecuencia || 'semanal',
      fecha_inicio: String(item.fecha_inicio || '').slice(0, 10),
      estado: item.estado || 'activo'
    })
  }

  async function changeAjusteEstado(item, estado) {
    if (!canModifyModule('ajustes_personal')) {
      setAjustesMessage('No tienes permiso para modificar en Sobrantes y faltantes')
      return
    }

    try {
      setAjustesMessage('')
      await axios.put(`${API}/ajustes-personal/${item.id}/estado`, { estado }, { headers: authHeaders() })
      await fetchAjustesPersonal()
      setAjustesMessage('Estado de ajuste actualizado.')
    } catch (err) {
      setAjustesMessage(err?.response?.data?.error || 'No se pudo cambiar estado del ajuste')
    }
  }

  async function removeAjustePersonal(item) {
    if (!canDeleteModule('ajustes_personal')) {
      setAjustesMessage('No tienes permiso para eliminar en Sobrantes y faltantes')
      return
    }

    const confirmed = window.confirm('¿Seguro que deseas eliminar este ajuste?')
    if (!confirmed) return

    try {
      setAjustesMessage('')
      await axios.delete(`${API}/ajustes-personal/${item.id}`, { headers: authHeaders() })
      await fetchAjustesPersonal()
      if (editingAjusteId === item.id) {
        setEditingAjusteId(null)
        setAjusteForm({
          personal_id: '',
          tipo: 'faltante',
          detalle: '',
          valor_total: '',
          en_cuotas: false,
          cantidad_cuotas: '1',
          frecuencia: 'semanal',
          fecha_inicio: new Date().toISOString().slice(0, 10),
          estado: 'activo'
        })
      }
      setAjustesMessage('Ajuste eliminado correctamente.')
    } catch (err) {
      setAjustesMessage(err?.response?.data?.error || 'No se pudo eliminar el ajuste')
    }
  }


  async function fetchRolesMensuales(periodoMes = rolesPeriodoMes) {
    try {
      const query = `?periodo_mes=${encodeURIComponent(periodoMes)}`
      const r = await axios.get(`${API}/roles-mensuales${query}`, { headers: authHeaders() })
      const rows = r.data || []
      setRolesRows(rows)
      if (!selectedRolId && rows[0]) {
        const firstId = String(rows[0].id)
        setSelectedRolId(firstId)
        await fetchRolMensualDetalle(firstId)
      }
      if (!rows[0]) {
        setSelectedRolId('')
        setRolDetalle(null)
      }
    } catch (err) {
      if (err?.response?.status === 401) {
        handleUnauthorizedSession()
        return
      }
      setRolesRows([])
      setSelectedRolId('')
      setRolDetalle(null)
    }
  }

  async function fetchRolMensualDetalle(rolId) {
    if (!rolId) {
      setRolDetalle(null)
      return
    }

    try {
      const r = await axios.get(`${API}/roles-mensuales/${rolId}/detalle`, { headers: authHeaders() })
      setRolDetalle(r.data || null)
    } catch (err) {
      setRolDetalle(null)
      setRolesMessage(err?.response?.data?.error || 'No se pudo cargar detalle de rol')
    }
  }

  async function generarRolesMensuales() {
    if (!canModifyModule('roles_mensuales')) {
      setRolesMessage('No tienes permiso para modificar en Roles mensuales IESS')
      return
    }

    if (!rolesPeriodoMes) {
      setRolesMessage('Selecciona el período mensual')
      return
    }

    try {
      setRolesMessage('')
      await axios.post(`${API}/roles-mensuales/generar`, { periodo_mes: rolesPeriodoMes }, { headers: authHeaders() })
      await fetchRolesMensuales(rolesPeriodoMes)
      setRolesMessage('Roles mensuales generados correctamente.')
    } catch (err) {
      setRolesMessage(err?.response?.data?.error || 'No se pudieron generar roles mensuales')
    }
  }

  async function eliminarRolesMensuales() {
    if (!canModifyModule('roles_mensuales')) {
      setRolesMessage('No tienes permiso para modificar en Roles mensuales IESS')
      return
    }

    if (!rolesPeriodoMes) {
      setRolesMessage('Selecciona el período mensual')
      return
    }

    const confirmed = window.confirm(`¿Seguro que deseas eliminar los roles mensuales del período ${rolesPeriodoMes}?`)
    if (!confirmed) return

    try {
      setRolesMessage('')
      await axios.delete(`${API}/roles-mensuales?periodo_mes=${encodeURIComponent(rolesPeriodoMes)}`, { headers: authHeaders() })
      await fetchRolesMensuales(rolesPeriodoMes)
      setRolesMessage('Roles mensuales eliminados correctamente.')
    } catch (err) {
      setRolesMessage(err?.response?.data?.error || 'No se pudieron eliminar roles mensuales')
    }
  }

  async function updateRolMensualEstado(rolId, estado) {
    if (!canModifyModule('roles_mensuales')) {
      setRolesMessage('No tienes permiso para modificar en Roles mensuales IESS')
      return
    }

    try {
      setRolesMessage('')
      await axios.put(`${API}/roles-mensuales/${rolId}/estado`, { estado }, { headers: authHeaders() })
      await fetchRolesMensuales(rolesPeriodoMes)
      await fetchRolMensualDetalle(rolId)
      setRolesMessage('Estado del rol actualizado.')
    } catch (err) {
      setRolesMessage(err?.response?.data?.error || 'No se pudo actualizar estado del rol')
    }
  }

  async function eliminarRolMensual(rolId) {
    if (!canDeleteModule('roles_mensuales')) {
      setRolesMessage('No tienes permiso para eliminar en Roles mensuales IESS')
      return
    }

    const confirmed = window.confirm('¿Seguro que deseas eliminar este rol mensual?')
    if (!confirmed) return

    try {
      setRolesMessage('')
      await axios.delete(`${API}/roles-mensuales/${rolId}`, { headers: authHeaders() })
      await Promise.all([
        fetchRolesMensuales(rolesPeriodoMes),
        fetchRolesPagoOptions(),
        fetchPagosRolesMensuales()
      ])
      if (String(selectedRolId) === String(rolId)) {
        setSelectedRolId('')
        setRolDetalle(null)
      }
      setRolesMessage('Rol mensual eliminado correctamente.')
    } catch (err) {
      setRolesMessage(err?.response?.data?.error || 'No se pudo eliminar el rol mensual')
    }
  }

  async function registrarPago() {
    if (!canModifyModule('pagos')) {
      setPagoMessage('No tienes permiso para modificar en Pagos')
      return
    }
    if (!pagoForm.liquidacion_id || !pagoForm.fecha_pago || !pagoForm.banco_id) {
      setPagoMessage('Liquidación, fecha y banco son obligatorios.')
      return
    }

    const selectedLiquidacion = (liquidaciones || []).find((item) => String(item.id) === String(pagoForm.liquidacion_id))
    const selectedTxtStatus = String(selectedLiquidacion?.justificacion_txt || '').trim().toLowerCase()
    if (selectedLiquidacion && selectedTxtStatus !== 'justificado') {
      setPagoMessage(`No se puede registrar el pago: liquidación con estado TXT '${selectedLiquidacion.justificacion_txt || 'Pendiente TXT'}'.`)
      return
    }

    try {
      setPagoMessage('')
      const payload = {
        liquidacion_id: Number(pagoForm.liquidacion_id),
        fecha_pago: pagoForm.fecha_pago,
        banco_id: Number(pagoForm.banco_id),
        comprobante: pagoForm.comprobante || null,
        monto: pagoForm.monto === '' ? null : Number(pagoForm.monto)
      }

      if (editingPagoId) {
        await axios.put(`${API}/pagos/${editingPagoId}`, {
          fecha_pago: payload.fecha_pago,
          banco_id: payload.banco_id,
          comprobante: payload.comprobante,
          monto: payload.monto
        }, { headers: authHeaders() })
      } else {
        await axios.post(`${API}/pagos`, payload, { headers: authHeaders() })
      }

      await Promise.all([
        fetchPagos(),
        fetchLiquidaciones(liquidacionSemana)
      ])

      setEditingPagoId(null)
      setPagoForm({
        liquidacion_id: '',
        fecha_pago: new Date().toISOString().slice(0, 10),
        banco_id: '',
        comprobante: '',
        monto: ''
      })
      setPagoMessage(editingPagoId ? 'Pago actualizado correctamente.' : 'Pago registrado correctamente.')
    } catch (err) {
      setPagoMessage(err?.response?.data?.error || 'No se pudo registrar el pago')
    }
  }

  function startEditPago(item) {
    setEditingPagoId(item.id)
    setPagoForm({
      liquidacion_id: String(item.liquidacion_id),
      fecha_pago: String(item.fecha_pago || '').slice(0, 10),
      banco_id: String(item.banco_id || ''),
      comprobante: item.comprobante || '',
      monto: String(item.monto ?? '')
    })
  }

  async function removePago(id) {
    if (!canDeleteModule('pagos')) {
      setPagoMessage('No tienes permiso para eliminar en Pagos')
      return
    }
    const confirmed = window.confirm('¿Seguro que deseas eliminar este pago?')
    if (!confirmed) return

    try {
      setPagoMessage('')
      await axios.delete(`${API}/pagos/${id}`, { headers: authHeaders() })
      await Promise.all([
        fetchPagos(),
        fetchLiquidaciones(liquidacionSemana)
      ])
      if (editingPagoId === id) {
        setEditingPagoId(null)
        setPagoForm({
          liquidacion_id: '',
          fecha_pago: new Date().toISOString().slice(0, 10),
          banco_id: '',
          comprobante: '',
          monto: ''
        })
      }
      setPagoMessage('Pago eliminado correctamente.')
    } catch (err) {
      setPagoMessage(err?.response?.data?.error || 'No se pudo eliminar el pago')
    }
  }

  async function registrarPagoRolMensual() {
    if (!canModifyModule('pagos')) {
      setPagoMessage('No tienes permiso para modificar en Pagos')
      return
    }
    if (!pagoRolForm.rol_mensual_id || !pagoRolForm.fecha_pago || !pagoRolForm.banco_id) {
      setPagoMessage('Rol mensual, fecha y banco son obligatorios.')
      return
    }

    try {
      setPagoMessage('')
      const payload = {
        rol_mensual_id: Number(pagoRolForm.rol_mensual_id),
        fecha_pago: pagoRolForm.fecha_pago,
        banco_id: Number(pagoRolForm.banco_id),
        comprobante: pagoRolForm.comprobante || null,
        monto: pagoRolForm.monto === '' ? null : Number(pagoRolForm.monto)
      }

      if (editingPagoRolId) {
        await axios.put(`${API}/pagos/roles-mensuales/${editingPagoRolId}`, {
          fecha_pago: payload.fecha_pago,
          banco_id: payload.banco_id,
          comprobante: payload.comprobante,
          monto: payload.monto
        }, { headers: authHeaders() })
      } else {
        await axios.post(`${API}/pagos/roles-mensuales`, payload, { headers: authHeaders() })
      }

      await Promise.all([
        fetchPagosRolesMensuales(),
        fetchRolesPagoOptions(),
        fetchRolesMensuales(rolesPeriodoMes)
      ])

      setEditingPagoRolId(null)
      setPagoRolForm({
        rol_mensual_id: '',
        fecha_pago: new Date().toISOString().slice(0, 10),
        banco_id: '',
        comprobante: '',
        monto: ''
      })
      setPagoMessage(editingPagoRolId ? 'Pago de rol actualizado correctamente.' : 'Pago de rol registrado correctamente.')
    } catch (err) {
      setPagoMessage(err?.response?.data?.error || 'No se pudo registrar el pago del rol mensual')
    }
  }

  function startEditPagoRolMensual(item) {
    setEditingPagoRolId(item.id)
    setPagoRolForm({
      rol_mensual_id: String(item.rol_mensual_id),
      fecha_pago: String(item.fecha_pago || '').slice(0, 10),
      banco_id: String(item.banco_id || ''),
      comprobante: item.comprobante || '',
      monto: String(item.monto ?? '')
    })
  }

  async function removePagoRolMensual(id) {
    if (!canDeleteModule('pagos')) {
      setPagoMessage('No tienes permiso para eliminar en Pagos')
      return
    }

    const confirmed = window.confirm('¿Seguro que deseas eliminar este pago de rol mensual?')
    if (!confirmed) return

    try {
      setPagoMessage('')
      await axios.delete(`${API}/pagos/roles-mensuales/${id}`, { headers: authHeaders() })
      await Promise.all([
        fetchPagosRolesMensuales(),
        fetchRolesPagoOptions(),
        fetchRolesMensuales(rolesPeriodoMes)
      ])
      if (editingPagoRolId === id) {
        setEditingPagoRolId(null)
        setPagoRolForm({
          rol_mensual_id: '',
          fecha_pago: new Date().toISOString().slice(0, 10),
          banco_id: '',
          comprobante: '',
          monto: ''
        })
      }
      setPagoMessage('Pago de rol mensual eliminado correctamente.')
    } catch (err) {
      setPagoMessage(err?.response?.data?.error || 'No se pudo eliminar el pago de rol mensual')
    }
  }

  async function cargarDashboardCamiones(desdeValue = dashboardDesde, hastaValue = dashboardHasta) {
    if (!desdeValue || !hastaValue) {
      setDashboardMessage('Selecciona desde y hasta para consultar el dashboard.')
      return
    }

    if (desdeValue > hastaValue) {
      setDashboardMessage('La fecha desde no puede ser mayor que hasta.')
      return
    }

    try {
      setDashboardLoading(true)
      setDashboardMessage('')
      const query = `desde=${encodeURIComponent(desdeValue)}&hasta=${encodeURIComponent(hastaValue)}`
      const r = await axios.get(`${API}/reportes/costos-operacion?${query}`, { headers: authHeaders() })
      setDashboardCamionUso(r.data?.costos_por_camion || [])
    } catch (err) {
      setDashboardMessage(err?.response?.data?.error || 'No se pudo cargar el uso de camiones en dashboard')
      setDashboardCamionUso([])
    } finally {
      setDashboardLoading(false)
    }
  }

  async function cargarDashboardCalendarioMes(monthValue = dashboardCalendarMonth) {
    if (!monthValue) return
    try {
      setDashboardCalendarLoading(true)
      const query = `mes=${encodeURIComponent(monthValue)}`
      const r = await axios.get(`${API}/reportes/uso-camiones-mes?${query}`, { headers: authHeaders() })
      setDashboardUsoDiario(r.data?.uso_diario || [])
      setDashboardCalendarSelectedDate('')
    } catch (err) {
      setDashboardUsoDiario([])
      setDashboardMessage(err?.response?.data?.error || 'No se pudo cargar el calendario de camiones')
    } finally {
      setDashboardCalendarLoading(false)
    }
  }

  async function aplicarDashboardPreset(presetKey) {
    const range = getPresetDateRange(presetKey)
    setDashboardPreset(presetKey)
    setDashboardDesde(range.start)
    setDashboardHasta(range.end)
    await cargarDashboardCamiones(range.start, range.end)
  }

  async function cargarReportes() {
    if (!reporteDesde || !reporteHasta) {
      setReporteMessage('Selecciona desde y hasta para consultar reportes.')
      return
    }

    if (reporteDesde > reporteHasta) {
      setReporteMessage('La fecha desde no puede ser mayor que hasta.')
      return
    }

    try {
      setReporteMessage('')
      const query = `desde=${encodeURIComponent(reporteDesde)}&hasta=${encodeURIComponent(reporteHasta)}`

      const [pagosResult, costosResult, inconsistenciasResult] = await Promise.all([
        axios.get(`${API}/reportes/pagos-estibador?${query}`, { headers: authHeaders() }),
        axios.get(`${API}/reportes/costos-operacion?${query}`, { headers: authHeaders() }),
        axios.get(`${API}/reportes/inconsistencias?${query}`, { headers: authHeaders() })
      ])

      setReportePagos(pagosResult.data?.rows || [])
      setReporteCostosRuta(costosResult.data?.costos_por_ruta || [])
      setReporteCostosCamion(costosResult.data?.costos_por_camion || [])
      setReporteEstibadoresSinAsignacion(inconsistenciasResult.data?.estibadores_pagables_sin_asignacion || [])
      setReporteViajesSinEstibadores(inconsistenciasResult.data?.viajes_sin_estibadores || [])
    } catch (err) {
      setReporteMessage(err?.response?.data?.error || 'No se pudieron cargar los reportes')
      setReportePagos([])
      setReporteCostosRuta([])
      setReporteCostosCamion([])
      setReporteEstibadoresSinAsignacion([])
      setReporteViajesSinEstibadores([])
    }
  }

  function normalizePayload(catalogKey) {
    const payload = {}
    for (const field of CATALOGS[catalogKey].fields) {
      const value = formValues[field.key]
      if (field.type === 'boolean') payload[field.key] = Boolean(value)
      else if (field.type === 'number') payload[field.key] = value === '' ? null : Number(value)
      else if (field.type === 'date') payload[field.key] = hasValue(value) ? String(value) : null
      else if (field.type === 'select') payload[field.key] = value === '' ? null : Number(value)
      else if (field.type === 'multi_select_dropdown') payload[field.key] = Array.isArray(value) ? value.map((item) => Number(item)).filter((item) => Number.isInteger(item)) : []
      else payload[field.key] = value
    }

    if (catalogKey === 'personal') {
      if (!hasValue(payload.correo)) payload.correo = null
      payload.email = payload.correo
      if (!hasValue(payload.password)) payload.password = null
    }

    return payload
  }

  function validateForm(catalogKey) {
    for (const field of CATALOGS[catalogKey].fields.filter((f) => f.required)) {
      const value = formValues[field.key]
      if (field.type === 'multi_select_dropdown' && (!Array.isArray(value) || value.length === 0)) {
        return `Completa el campo obligatorio: ${field.label}`
      }
      if (value === '' || value === null || value === undefined) {
        return `Completa el campo obligatorio: ${field.label}`
      }
    }
    return ''
  }

  async function saveCatalogItem() {
    try {
      const validationError = validateForm(currentView)
      if (validationError) return setError(validationError)

      if (currentView === 'personal') {
        const adminRole = (catalogRows.personal_roles || []).find((role) => String(role.nombre || '').toLowerCase() === 'admin')
        const selectedRoleIds = Array.isArray(formValues.personal_role_ids)
          ? formValues.personal_role_ids.map((value) => Number(value))
          : []
        const isAdminSelected = adminRole ? selectedRoleIds.includes(Number(adminRole.id)) : false

        if (isAdminSelected && !hasValue(formValues.correo)) {
          return setError('Correo es obligatorio para rol Admin')
        }

        if (isAdminSelected && !editingId && !hasValue(formValues.password)) {
          return setError('Clave es obligatoria para rol Admin')
        }
      }

      setError('')
      const payload = normalizePayload(currentView)
      if (editingId) await axios.put(`${API}/catalogs/${currentView}/${editingId}`, payload, { headers: authHeaders() })
      else await axios.post(`${API}/catalogs/${currentView}`, payload, { headers: authHeaders() })

      await fetchCatalog(currentView)
      setEditingId(null)
      setFormValues(createInitialFormValues(currentView))
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo guardar el catálogo')
    }
  }

  function startEditCatalog(row) {
    const values = {}
    for (const field of CATALOGS[currentView].fields) {
      const value = row[field.key]
      if (field.type === 'boolean') values[field.key] = value !== false
      else if (field.type === 'date') values[field.key] = value ? String(value).slice(0, 10) : ''
      else if (field.type === 'multi_select_dropdown') {
        if (Array.isArray(value)) values[field.key] = value.map((item) => String(item))
        else if (row.personal_role_id) values[field.key] = [String(row.personal_role_id)]
        else values[field.key] = []
      } else values[field.key] = (value ?? '')
    }
    setEditingId(row.id)
    setFormValues(values)
  }

  function resolvePersonalRoleNames(roleIds) {
    const roles = catalogRows.personal_roles || []
    const ids = Array.isArray(roleIds) ? roleIds.map((value) => Number(value)) : []
    return roles
      .filter((role) => ids.includes(Number(role.id)))
      .map((role) => String(role.nombre || ''))
      .filter((name) => name)
  }

  function isAdminSelectedInForm() {
    const adminRole = (catalogRows.personal_roles || []).find((role) => String(role.nombre || '').toLowerCase() === 'admin')
    const selectedRoleIds = Array.isArray(formValues.personal_role_ids)
      ? formValues.personal_role_ids.map((value) => Number(value))
      : []
    return adminRole ? selectedRoleIds.includes(Number(adminRole.id)) : false
  }

  function validatePersonalForm() {
    if (!hasValue(formValues.documento)) return 'Cédula es obligatoria'
    if (!hasValue(formValues.nombre)) return 'Nombres es obligatorio'
    if (!hasValue(formValues.apellidos)) return 'Apellidos es obligatorio'
    if (!hasValue(formValues.banco_id)) return 'Banco es obligatorio'
    if (!hasValue(formValues.numero_cuenta)) return 'Número de cuenta es obligatorio'

    const selectedRoleIds = Array.isArray(formValues.personal_role_ids)
      ? formValues.personal_role_ids.filter((value) => hasValue(value))
      : []
    if (selectedRoleIds.length === 0) return 'Debe seleccionar al menos un rol'

    const isAdminSelected = isAdminSelectedInForm()
    if (isAdminSelected) {
      if (!hasValue(formValues.direccion)) return 'Dirección es obligatoria para rol Admin'
      if (!hasValue(formValues.correo)) return 'Correo es obligatorio para rol Admin'

      const mustRequirePassword = !editingId || (editingId && !hasValue(formValues.user_id))
      if (mustRequirePassword && !hasValue(formValues.password)) return 'Clave es obligatoria para rol Admin'

      if (hasValue(formValues.password)) {
        const password = String(formValues.password)
        const validPassword = password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password)
        if (!validPassword) return 'Clave debe tener al menos 8 caracteres y combinación alfanumérica'
      }
    }

    if (formValues.afiliado_iess) {
      if (!hasValue(formValues.fecha_afiliacion_iess)) return 'Fecha afiliación IESS es obligatoria'
      const sueldoIess = Number(formValues.sueldo_iess)
      const sueldoReal = Number(formValues.sueldo_real)
      if (!Number.isFinite(sueldoIess) || sueldoIess < 0) return 'Sueldo IESS debe ser numérico y mayor o igual a 0'
      if (!Number.isFinite(sueldoReal) || sueldoReal < 0) return 'Sueldo Real debe ser numérico y mayor o igual a 0'
    }

    return ''
  }

  async function savePersonalItem() {
    try {
      const validationError = validatePersonalForm()
      if (validationError) return setError(validationError)

      setError('')
      const payload = normalizePayload('personal')
      if (editingId) await axios.put(`${API}/catalogs/personal/${editingId}`, payload, { headers: authHeaders() })
      else await axios.post(`${API}/catalogs/personal`, payload, { headers: authHeaders() })

      await fetchCatalog('personal')
      setEditingId(null)
      setFormValues(createInitialFormValues('personal'))
      setPersonalViewMode('list')
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo guardar el personal')
    }
  }

  function startCreatePersonal() {
    setEditingId(null)
    setFormValues(createInitialFormValues('personal'))
    setError('')
    setPersonalViewMode('create')
  }

  function startEditPersonal(row) {
    const values = {}
    for (const field of CATALOGS.personal.fields) {
      const value = row[field.key]
      if (field.type === 'boolean') values[field.key] = value === true
      else if (field.type === 'date') values[field.key] = value ? String(value).slice(0, 10) : ''
      else if (field.type === 'multi_select_dropdown') {
        values[field.key] = Array.isArray(value) ? value.map((item) => String(item)) : []
      } else {
        values[field.key] = value ?? ''
      }
    }
    values.password = ''
    values.user_id = row.user_id ?? null

    setEditingId(row.id)
    setFormValues(values)
    setError('')
    setPersonalViewMode('create')
  }

  async function togglePersonalActivo(row) {
    if (!canModifyModule('base_datos')) {
      setError('No tienes permiso para modificar en Base de datos')
      return
    }

    try {
      setError('')
      await axios.put(`${API}/catalogs/personal/${row.id}`, { activo: !row.activo }, { headers: authHeaders() })
      await fetchCatalog('personal')
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo cambiar el estado')
    }
  }

  async function removeCatalogItem(id) {
    if (!canDeleteModule('base_datos')) {
      setError('No tienes permiso para eliminar en Base de datos')
      return
    }
    await axios.delete(`${API}/catalogs/${currentView}/${id}`, { headers: authHeaders() })
    await fetchCatalog(currentView)
  }

  async function saveViaje() {
    if (!canModifyModule('bitacora')) {
      setBitacoraMessage('No tienes permiso para modificar en Bitácora')
      return
    }
    try {
      setBitacoraMessage('')
      const commonPayload = {
        ...viajeForm,
        fecha: viajeForm.fecha_desde,
        camion_id: Number(viajeForm.camion_id),
        conductor_id: Number(viajeForm.conductor_id),
        estado_viaje_id: Number(viajeForm.estado_viaje_id),
        km_inicial: Number(viajeForm.km_inicial || 0),
        km_final: Number(viajeForm.km_final || 0)
      }

      if (editingViajeId) {
        await axios.put(`${API}/viajes/${editingViajeId}`, {
          ...commonPayload,
          ruta_id: Number(viajeForm.ruta_id)
        }, { headers: authHeaders() })
      } else {
        const selectedRutaIds = Array.isArray(viajeForm.ruta_ids)
          ? viajeForm.ruta_ids.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
          : []

        await axios.post(`${API}/viajes`, {
          ...commonPayload,
          ruta_id: selectedRutaIds[0] || Number(viajeForm.ruta_id),
          ruta_ids: selectedRutaIds
        }, { headers: authHeaders() })
      }

      setViajeForm(createInitialViajeForm())
      setEditingViajeId(null)
      await fetchViajes()
      await fetchNextViajeId()
      setBitacoraMessage(editingViajeId ? 'Viaje actualizado correctamente.' : 'Viaje(s) guardado(s) correctamente.')
    } catch (err) {
      setBitacoraMessage(err?.response?.data?.error || 'No se pudo guardar el viaje')
    }
  }

  function startEditViaje(viaje) {
    setViajeForm({
      viaje_id: viaje.viaje_id,
      fecha_desde: String(viaje.fecha_desde || viaje.fecha || '').slice(0, 10),
      fecha_hasta: String(viaje.fecha_hasta || viaje.fecha || '').slice(0, 10),
      camion_id: String(viaje.camion_id),
      conductor_id: String(viaje.conductor_id),
      ruta_id: String(viaje.ruta_id),
      ruta_ids: [String(viaje.ruta_id)],
      estado_viaje_id: String(viaje.estado_viaje_id),
      tipo_operacion: viaje.tipo_operacion || 'carga',
      km_inicial: String(viaje.km_inicial ?? ''),
      km_final: String(viaje.km_final ?? ''),
      observacion: viaje.observacion || ''
    })
    setEditingViajeId(viaje.id)
  }

  async function removeViaje(viaje) {
    if (!canDeleteModule('bitacora')) {
      setBitacoraMessage('No tienes permiso para eliminar en Bitácora')
      return
    }
    const confirmed = window.confirm(`¿Seguro que deseas eliminar el viaje ${viaje.viaje_id}?`)
    if (!confirmed) return

    try {
      setBitacoraMessage('')
      await axios.delete(`${API}/viajes/${viaje.id}`, { headers: authHeaders() })

      if (String(selectedViajeId) === String(viaje.id)) {
        setSelectedViajeId('')
        setGastos([])
        setCargas([])
        setViajePersonal([])
      }

      if (editingViajeId === viaje.id) {
        setEditingViajeId(null)
        setViajeForm(createInitialViajeForm())
      }

      await fetchViajes()
      setBitacoraMessage('Viaje eliminado correctamente.')
    } catch (err) {
      setBitacoraMessage(err?.response?.data?.error || 'No se pudo eliminar el viaje')
    }
  }

  async function saveGasto() {
    if (!canModifyModule('bitacora')) {
      setBitacoraMessage('No tienes permiso para modificar en Bitácora')
      return
    }
    if (!selectedViajeId) return
    try {
      const payload = { ...gastoForm, valor: Number(gastoForm.valor || 0) }
      if (editingGastoId) {
        await axios.put(`${API}/viajes/${selectedViajeId}/gastos/${editingGastoId}`, payload, { headers: authHeaders() })
      } else {
        await axios.post(`${API}/viajes/${selectedViajeId}/gastos`, payload, { headers: authHeaders() })
      }
      setGastoForm({ tipo_gasto: '', valor: '', observacion: '', numero_comprobante: '' })
      setEditingGastoId(null)
      await fetchViajeDetalles(selectedViajeId)
    } catch (err) {
      setBitacoraMessage(err?.response?.data?.error || 'No se pudo registrar gasto')
    }
  }

  function startEditGasto(gasto) {
    setGastoForm({
      tipo_gasto: gasto.tipo_gasto || '',
      valor: String(gasto.valor ?? ''),
      observacion: gasto.observacion || '',
      numero_comprobante: gasto.numero_comprobante || ''
    })
    setEditingGastoId(gasto.id)
  }

  async function removeGasto(gastoId) {
    if (!canDeleteModule('bitacora')) {
      setBitacoraMessage('No tienes permiso para eliminar en Bitácora')
      return
    }
    if (!selectedViajeId) return
    try {
      await axios.delete(`${API}/viajes/${selectedViajeId}/gastos/${gastoId}`, { headers: authHeaders() })
      if (editingGastoId === gastoId) {
        setEditingGastoId(null)
        setGastoForm({ tipo_gasto: '', valor: '', observacion: '', numero_comprobante: '' })
      }
      await fetchViajeDetalles(selectedViajeId)
    } catch (err) {
      setBitacoraMessage(err?.response?.data?.error || 'No se pudo eliminar gasto')
    }
  }

  async function saveCarga() {
    if (!canModifyModule('bitacora')) {
      setBitacoraMessage('No tienes permiso para modificar en Bitácora')
      return
    }
    if (!selectedViajeId) return
    try {
      const selectedViaje = (viajes || []).find((viaje) => String(viaje.id) === String(selectedViajeId))
      const ruta = (catalogRows.rutas || []).find((item) => Number(item.id) === Number(selectedViaje?.ruta_id))
      const rutaTipo = String(selectedViaje?.ruta_tipo || ruta?.tipo || '').toLowerCase()
      const isRutaCorta = rutaTipo === 'corta'

      const payload = {
        valor_carga: Number(cargaForm.valor_carga || 0)
      }

      if (isRutaCorta) {
        payload.cantidad = 1
      } else {
        payload.producto_id = Number(cargaForm.producto_id)
        payload.cantidad = Number(cargaForm.cantidad || 0)
      }

      if (editingCargaId) {
        await axios.put(`${API}/viajes/${selectedViajeId}/carga/${editingCargaId}`, payload, { headers: authHeaders() })
      } else {
        await axios.post(`${API}/viajes/${selectedViajeId}/carga`, payload, { headers: authHeaders() })
      }
      setCargaForm({ producto_id: '', cantidad: '', valor_carga: '' })
      setEditingCargaId(null)
      await fetchViajeDetalles(selectedViajeId)
    } catch (err) {
      setBitacoraMessage(err?.response?.data?.error || 'No se pudo registrar carga')
    }
  }

  function startEditCarga(carga) {
    setCargaForm({
      producto_id: String(carga.producto_id ?? ''),
      cantidad: String(carga.cantidad ?? ''),
      valor_carga: String(carga.valor_carga ?? '')
    })
    setEditingCargaId(carga.id)
  }

  async function removeCarga(cargaId) {
    if (!canDeleteModule('bitacora')) {
      setBitacoraMessage('No tienes permiso para eliminar en Bitácora')
      return
    }
    if (!selectedViajeId) return
    try {
      await axios.delete(`${API}/viajes/${selectedViajeId}/carga/${cargaId}`, { headers: authHeaders() })
      if (editingCargaId === cargaId) {
        setEditingCargaId(null)
        setCargaForm({ producto_id: '', cantidad: '', valor_carga: '' })
      }
      await fetchViajeDetalles(selectedViajeId)
    } catch (err) {
      setBitacoraMessage(err?.response?.data?.error || 'No se pudo eliminar carga')
    }
  }

  async function uploadBiometricoTxt() {
    if (!canModifyModule('biometrico')) {
      setBiometricoMessage('No tienes permiso para modificar en Biométrico')
      return
    }
    if (!biometricoFile) {
      setBiometricoMessage('Selecciona un archivo TXT primero.')
      return
    }

    try {
      setBiometricoMessage('')
      setPopupErrors([])
      const formData = new FormData()
      formData.append('file', biometricoFile)
      await axios.post(`${API}/biometrico/import`, formData, {
        headers: {
          ...authHeaders(),
          'Content-Type': 'multipart/form-data'
        }
      })
      setBiometricoFile(null)
      await Promise.all([fetchBiometricoImports(), fetchBiometricoMarcas()])
      setBiometricoMessage('Importación exitosa.')
    } catch (err) {
      const details = err?.response?.data?.details
      if (Array.isArray(details) && details.length > 0) {
        setPopupErrors(details)
      }
      setBiometricoMessage(err?.response?.data?.error || 'Error importando archivo')
    }
  }

  async function removeBiometricoImport(importId) {
    if (!canDeleteModule('biometrico')) {
      setBiometricoMessage('No tienes permiso para eliminar en Biométrico')
      return
    }
    const confirmed = window.confirm('¿Seguro que deseas eliminar esta importación y sus registros asociados?')
    if (!confirmed) return

    try {
      setBiometricoMessage('')
      await axios.delete(`${API}/biometrico/imports/${importId}`, { headers: authHeaders() })
      await Promise.all([fetchBiometricoImports(), fetchBiometricoMarcas(biometricoFecha)])
      setBiometricoMessage('Importación eliminada correctamente.')
    } catch (err) {
      setBiometricoMessage(err?.response?.data?.error || 'No se pudo eliminar la importación')
    }
  }

  async function removeBiometricoMarca(marcaId) {
    if (!canDeleteModule('biometrico')) {
      setBiometricoMessage('No tienes permiso para eliminar en Biométrico')
      return
    }
    const confirmed = window.confirm('¿Seguro que deseas eliminar este registro biométrico?')
    if (!confirmed) return

    try {
      setBiometricoMessage('')
      await axios.delete(`${API}/biometrico/marcas/${marcaId}`, { headers: authHeaders() })
      await Promise.all([fetchBiometricoImports(), fetchBiometricoMarcas(biometricoFecha)])
      setBiometricoMessage('Registro biométrico eliminado correctamente.')
    } catch (err) {
      setBiometricoMessage(err?.response?.data?.error || 'No se pudo eliminar el registro biométrico')
    }
  }

  function logout() {
    localStorage.removeItem('token')
    setToken('')
    setCurrentView('dashboard')
    setCatalogRows({})
    setFormValues({})
    setEditingId(null)
    setViajes([])
    setSelectedViajeId('')
    setGastos([])
    setCargas([])
    setViajePersonal([])
    setViajePersonalId('')
    setEditingGastoId(null)
    setEditingCargaId(null)
    setBiometricoImports([])
    setBiometricoMarcas([])
    setPopupErrors([])
    setAsignacionFecha('')
    setAsignacionViajeId('')
    setAsignacionMarcaId('')
    setAsignacionData({ marcas: [], viajes: [], asignaciones: [] })
    setAsignacionMessage('')
    setLiquidacionSemana('1')
    setLiquidaciones([])
    setSelectedLiquidacionId('')
    setLiquidacionDetalle([])
    setLiquidacionMessage('')
    setPagos([])
    setEditingPagoId(null)
    setPagoForm({
      liquidacion_id: '',
      fecha_pago: new Date().toISOString().slice(0, 10),
      banco_id: '',
      comprobante: '',
      monto: ''
    })
    setPagoMessage('')
    setReporteDesde(weekRangeDefault.start)
    setReporteHasta(weekRangeDefault.end)
    setReportePagos([])
    setReporteCostosRuta([])
    setReporteCostosCamion([])
    setReporteEstibadoresSinAsignacion([])
    setReporteViajesSinEstibadores([])
    setReporteMessage('')
    setDashboardDesde(weekRangeDefault.start)
    setDashboardHasta(weekRangeDefault.end)
    setDashboardPreset('semana')
    setDashboardCamionUso([])
    setDashboardUsoDiario([])
    setDashboardCalendarMonth(weekRangeDefault.start.slice(0, 7))
    setDashboardCalendarSelectedDate('')
    setDashboardCalendarLoading(false)
    setDashboardMessage('')
    setDashboardLoading(false)
    setMyAccess(createFullAccessMatrix())
    setAdminAccessRows([])
    setSelectedAdminAccessId('')
    setAdminAccessForm(createFullAccessMatrix())
    setAdminAccessMessage('')
  }

  const dashboardStats = useMemo(() => {
    const totalCatalogRecords = Object.keys(CATALOGS).reduce((acc, key) => acc + (catalogRows[key]?.length || 0), 0)
    return {
      totalCatalogs: Object.keys(CATALOGS).length,
      totalRecords: totalCatalogRecords,
      totalViajes: viajes.length,
      totalMarcas: biometricoMarcas.length,
      missingCatalogs: Object.keys(CATALOGS).filter((key) => (catalogRows[key]?.length || 0) === 0).length
    }
  }, [catalogRows, viajes, biometricoMarcas])

  const dashboardTopCamiones = useMemo(() => {
    return [...(dashboardCamionUso || [])]
      .sort((a, b) => Number(b.viajes || 0) - Number(a.viajes || 0))
      .slice(0, 8)
  }, [dashboardCamionUso])

  const dashboardTotalViajesPeriodo = useMemo(() => {
    return (dashboardCamionUso || []).reduce((acc, row) => acc + Number(row.viajes || 0), 0)
  }, [dashboardCamionUso])

  const dashboardTotalGastosPeriodo = useMemo(() => {
    return (dashboardCamionUso || []).reduce((acc, row) => acc + Number(row.total_gastos || 0), 0)
  }, [dashboardCamionUso])

  const dashboardCostPieData = useMemo(() => {
    const palette = ['#dc2626', '#ef4444', '#f87171', '#fb7185', '#f43f5e', '#be123c']
    const sorted = [...(dashboardCamionUso || [])]
      .sort((a, b) => Number(b.total_gastos || 0) - Number(a.total_gastos || 0))

    if (sorted.length === 0) return { slices: [], total: 0 }

    const total = sorted.reduce((acc, row) => acc + Number(row.total_gastos || 0), 0)
    if (total <= 0) return { slices: [], total: 0 }

    const top = sorted.slice(0, 5)
    const others = sorted.slice(5)

    const slices = top.map((row, index) => {
      const value = Number(row.total_gastos || 0)
      return {
        id: `camion-${row.camion_id}`,
        label: `${row.placa} · ${row.camion_nombre}`,
        value,
        percent: (value / total) * 100,
        color: palette[index % palette.length]
      }
    })

    const othersValue = others.reduce((acc, row) => acc + Number(row.total_gastos || 0), 0)
    if (othersValue > 0) {
      slices.push({
        id: 'otros',
        label: 'Otros camiones',
        value: othersValue,
        percent: (othersValue / total) * 100,
        color: '#9ca3af'
      })
    }

    return { slices, total }
  }, [dashboardCamionUso])

  const dashboardDailyUsageMap = useMemo(() => {
    const map = {}
    for (const item of dashboardUsoDiario || []) {
      const dateKey = String(item.fecha || '').slice(0, 10)
      if (!dateKey) continue
      map[dateKey] = Number(item.camiones_usados || 0)
    }
    return map
  }, [dashboardUsoDiario])

  const dashboardCalendarMonthLabel = useMemo(() => {
    const [yearRaw, monthRaw] = String(dashboardCalendarMonth || '').split('-')
    const year = Number(yearRaw)
    const month = Number(monthRaw)
    if (!Number.isInteger(year) || !Number.isInteger(month)) return ''
    const monthDate = new Date(year, month - 1, 1)
    return monthDate.toLocaleDateString('es-EC', { month: 'long', year: 'numeric' })
  }, [dashboardCalendarMonth])

  const dashboardCalendarWeeks = useMemo(() => {
    const [yearRaw, monthRaw] = String(dashboardCalendarMonth || '').split('-')
    const year = Number(yearRaw)
    const month = Number(monthRaw)
    if (!Number.isInteger(year) || !Number.isInteger(month)) return []

    const firstDate = new Date(year, month - 1, 1)
    const daysInMonth = new Date(year, month, 0).getDate()
    const firstDayOffset = (firstDate.getDay() + 6) % 7
    const cells = []

    for (let index = 0; index < firstDayOffset; index += 1) {
      cells.push(null)
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const count = Number(dashboardDailyUsageMap[dateKey] || 0)

      cells.push({
        key: dateKey,
        day,
        count,
        hasUsage: count > 0,
        noUsage: count === 0
      })
    }

    while (cells.length % 7 !== 0) {
      cells.push(null)
    }

    const weeks = []
    for (let index = 0; index < cells.length; index += 7) {
      weeks.push(cells.slice(index, index + 7))
    }
    return weeks
  }, [dashboardCalendarMonth, dashboardDailyUsageMap])

  const dashboardCalendarMonthStats = useMemo(() => {
    const days = dashboardCalendarWeeks.flat().filter(Boolean)
    return {
      usedDays: days.filter((day) => day.hasUsage).length,
      noUsageDays: days.filter((day) => day.noUsage).length
    }
  }, [dashboardCalendarWeeks])

  const dashboardSelectedDayUsage = useMemo(() => {
    if (!dashboardCalendarSelectedDate) return null
    const count = Number(dashboardDailyUsageMap[dashboardCalendarSelectedDate] || 0)
    return {
      date: dashboardCalendarSelectedDate,
      count
    }
  }, [dashboardCalendarSelectedDate, dashboardDailyUsageMap])

  function moveDashboardCalendarMonth(step) {
    const [yearRaw, monthRaw] = String(dashboardCalendarMonth || '').split('-')
    const year = Number(yearRaw)
    const month = Number(monthRaw)
    if (!Number.isInteger(year) || !Number.isInteger(month)) return

    const shifted = new Date(year, month - 1 + step, 1)
    const nextMonth = `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`
    setDashboardCalendarMonth(nextMonth)
    setDashboardCalendarSelectedDate('')
  }

  const conductores = useMemo(() => {
    const roles = catalogRows.personal_roles || []
    const choferRole = roles.find((r) => String(r.nombre || '').toLowerCase() === 'chofer')
    const people = catalogRows.personal || []
    if (!choferRole) return []
    return people.filter((p) => {
      const roleIds = Array.isArray(p.personal_role_ids)
        ? p.personal_role_ids.map((value) => Number(value))
        : (p.personal_role_id ? [Number(p.personal_role_id)] : [])
      return roleIds.includes(Number(choferRole.id)) && p.activo
    })
  }, [catalogRows])

  const estibadores = useMemo(() => {
    const roles = catalogRows.personal_roles || []
    const estibadorRole = roles.find((r) => String(r.nombre || '').toLowerCase() === 'estibador')
    const people = catalogRows.personal || []
    if (!estibadorRole) return []
    return people.filter((p) => {
      const roleIds = Array.isArray(p.personal_role_ids)
        ? p.personal_role_ids.map((value) => Number(value))
        : (p.personal_role_id ? [Number(p.personal_role_id)] : [])
      return roleIds.includes(Number(estibadorRole.id)) && p.activo
    })
  }, [catalogRows])

  async function addViajePersonal() {
    if (!canModifyModule('bitacora')) {
      setBitacoraMessage('No tienes permiso para modificar en Bitácora')
      return
    }
    if (!selectedViajeId || !viajePersonalId) return
    try {
      await axios.post(`${API}/viajes/${selectedViajeId}/personal`, { personal_id: Number(viajePersonalId) }, { headers: authHeaders() })
      setViajePersonalId('')
      await fetchViajeDetalles(selectedViajeId)
    } catch (err) {
      setBitacoraMessage(err?.response?.data?.error || 'No se pudo asignar personal al viaje')
    }
  }

  async function removeViajePersonal(personalId) {
    if (!canDeleteModule('bitacora')) {
      setBitacoraMessage('No tienes permiso para eliminar en Bitácora')
      return
    }
    if (!selectedViajeId) return
    try {
      await axios.delete(`${API}/viajes/${selectedViajeId}/personal/${personalId}`, { headers: authHeaders() })
      await fetchViajeDetalles(selectedViajeId)
    } catch (err) {
      setBitacoraMessage(err?.response?.data?.error || 'No se pudo quitar personal del viaje')
    }
  }

  function SearchableSelect({ value, onChange, options, placeholder, disabled = false, allowEmpty = true }) {
    const containerRef = useRef(null)
    const [isOpen, setIsOpen] = useState(false)
    const [searchText, setSearchText] = useState('')

    const normalizedValue = value === undefined || value === null ? '' : String(value)
    const selected = options.find((item) => String(item.value) === normalizedValue)
    const lowerSearch = searchText.trim().toLowerCase()

    const filteredOptions = useMemo(() => {
      if (!lowerSearch) return options
      return options.filter((item) => {
        const labelText = String(item.label || '').toLowerCase()
        const extraText = String(item.searchText || '').toLowerCase()
        return labelText.includes(lowerSearch) || extraText.includes(lowerSearch)
      })
    }, [options, lowerSearch])

    useEffect(() => {
      if (!isOpen) return
      function handleClickOutside(event) {
        if (containerRef.current && !containerRef.current.contains(event.target)) {
          setIsOpen(false)
          setSearchText('')
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen])

    function handleSelect(nextValue) {
      onChange(nextValue)
      setIsOpen(false)
      setSearchText('')
    }

    return (
      <div className={`search-select ${disabled ? 'disabled' : ''}`} ref={containerRef}>
        <button
          type="button"
          className="search-select-trigger"
          onClick={() => {
            if (disabled) return
            setIsOpen((prev) => !prev)
          }}
          disabled={disabled}
        >
          <span>{selected ? selected.label : placeholder}</span>
          <span>{isOpen ? '▴' : '▾'}</span>
        </button>
        {isOpen && (
          <div className="search-select-menu">
            <input
              className="search-select-input"
              type="text"
              placeholder="Buscar..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              autoFocus
            />
            <div className="search-select-options">
              {allowEmpty ? (
                <button type="button" className="search-select-option" onClick={() => handleSelect('')}>
                  {placeholder}
                </button>
              ) : null}
              {filteredOptions.map((item) => (
                <button
                  type="button"
                  key={String(item.value)}
                  className={`search-select-option ${String(item.value) === normalizedValue ? 'active' : ''}`}
                  onClick={() => handleSelect(String(item.value))}
                >
                  {item.label}
                </button>
              ))}
              {filteredOptions.length === 0 ? <div className="search-select-empty">Sin resultados</div> : null}
            </div>
          </div>
        )}
      </div>
    )
  }

  function resolveDisplayValue(catalogKey, fieldKey, row) {
    const field = CATALOGS[catalogKey].fields.find((item) => item.key === fieldKey)
    const value = row[fieldKey]
    if (!field) return String(value ?? '-')
    if (field.type === 'boolean') return value ? 'Sí' : 'No'
    if (field.type === 'multi_select_dropdown') {
      const options = catalogRows[field.source] || []
      const roleIds = Array.isArray(value)
        ? value.map((item) => Number(item))
        : (row.personal_role_id ? [Number(row.personal_role_id)] : [])
      const labels = options.filter((item) => roleIds.includes(Number(item.id))).map((item) => item[field.sourceLabel])
      return labels.length > 0 ? labels.join(', ') : '-'
    }
    if (field.type === 'select' && value) {
      const options = catalogRows[field.source] || []
      const match = options.find((item) => Number(item.id) === Number(value))
      if (match) return `${match[field.sourceLabel]} (#${match.id})`
    }
    return String(value ?? '-')
  }

  function renderCatalogInput(field) {
    const isPersonalAdminField = currentView === 'personal' && field.key === 'password'
    if (isPersonalAdminField) {
      const roles = catalogRows.personal_roles || []
      const adminRole = roles.find((role) => String(role.nombre || '').toLowerCase() === 'admin')
      const selectedRoleIds = Array.isArray(formValues.personal_role_ids)
        ? formValues.personal_role_ids.map((value) => Number(value))
        : []
      const isAdminSelected = adminRole ? selectedRoleIds.includes(Number(adminRole.id)) : false
      if (!isAdminSelected) return null
    }

    const isPersonalIessField = currentView === 'personal' && ['fecha_afiliacion_iess', 'sueldo_iess', 'sueldo_real', 'descuenta_iess', 'cobra_decimo_tercero', 'cobra_decimo_cuarto', 'cobra_fondo_reserva'].includes(field.key)
    if (isPersonalIessField && !formValues.afiliado_iess) {
      return null
    }

    const value = formValues[field.key]

    if (field.type === 'boolean') {
      return (
        <label className="switch-field" key={field.key}>
          <span>{field.label}</span>
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => setFormValues((prev) => ({ ...prev, [field.key]: e.target.checked }))} />
        </label>
      )
    }

    if (field.type === 'select') {
      const options = catalogRows[field.source] || []
      return (
        <SearchableSelect
          key={field.key}
          value={value ?? ''}
          onChange={(nextValue) => setFormValues((prev) => ({ ...prev, [field.key]: nextValue }))}
          placeholder={field.label}
          options={options.map((item) => ({ value: String(item.id), label: String(item[field.sourceLabel] || '') }))}
        />
      )
    }

    if (field.type === 'select_static') {
      return (
        <SearchableSelect
          key={field.key}
          value={value ?? ''}
          onChange={(nextValue) => setFormValues((prev) => ({ ...prev, [field.key]: nextValue }))}
          placeholder={field.label}
          options={field.options.map((item) => ({ value: String(item), label: String(item) }))}
        />
      )
    }

    if (field.type === 'multi_select_dropdown') {
      const options = catalogRows[field.source] || []
      const selectedValues = Array.isArray(value) ? value.map((item) => String(item)) : []
      const selectedLabels = options
        .filter((item) => selectedValues.includes(String(item.id)))
        .map((item) => item[field.sourceLabel])
      const dropdownKey = `${currentView}-${field.key}`
      const isOpen = multiSelectOpenKey === dropdownKey
      const searchText = String(multiSelectSearch[dropdownKey] || '').trim().toLowerCase()
      const filteredOptions = options.filter((item) => String(item[field.sourceLabel] || '').toLowerCase().includes(searchText))

      function toggleDropdown() {
        if (isOpen) {
          setMultiSelectOpenKey('')
          setMultiSelectSearch((prev) => ({ ...prev, [dropdownKey]: '' }))
          return
        }
        setMultiSelectOpenKey(dropdownKey)
      }

      return (
        <div className="multi-dropdown" key={field.key}>
          <button
            type="button"
            className="multi-dropdown-trigger"
            onClick={toggleDropdown}
          >
            <span>{selectedLabels.length > 0 ? selectedLabels.join(', ') : field.label}</span>
            <span>{isOpen ? '▴' : '▾'}</span>
          </button>

          {isOpen && (
            <div className="multi-dropdown-menu">
              <input
                className="multi-dropdown-search"
                type="text"
                placeholder="Buscar..."
                value={multiSelectSearch[dropdownKey] || ''}
                onChange={(event) => setMultiSelectSearch((prev) => ({ ...prev, [dropdownKey]: event.target.value }))}
              />
              {filteredOptions.map((item) => {
                const checked = selectedValues.includes(String(item.id))
                return (
                  <label className="multi-dropdown-option" key={item.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setFormValues((prev) => {
                          const current = Array.isArray(prev[field.key]) ? prev[field.key].map((entry) => String(entry)) : []
                          const exists = current.includes(String(item.id))
                          const next = exists
                            ? current.filter((entry) => entry !== String(item.id))
                            : [...current, String(item.id)]
                          return { ...prev, [field.key]: next }
                        })
                      }}
                    />
                    <span>{item[field.sourceLabel]}</span>
                  </label>
                )
              })}
              {filteredOptions.length === 0 ? <div className="search-select-empty">Sin resultados</div> : null}
            </div>
          )}
        </div>
      )
    }

    return (
      <input
        key={field.key}
        type={field.type === 'number' ? 'number' : (field.type === 'password' ? 'password' : (field.type === 'date' ? 'date' : 'text'))}
        step={field.type === 'number' ? '0.01' : undefined}
        placeholder={field.label}
        value={value ?? ''}
        onChange={(e) => setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
      />
    )
  }

  function renderCatalogView(catalogKey) {
    const catalog = CATALOGS[catalogKey]
    const rows = catalogRows[catalogKey] || []
    const catalogModuleKey = catalogKey === 'empresa_logo' ? 'empresa_logo' : 'base_datos'
    const canModifyCatalog = canModifyModule(catalogModuleKey)
    const canDeleteCatalog = canDeleteModule(catalogModuleKey)

    return (
      <section className="view-section">
        <div className="card form-card">
          <h3>{editingId ? `Editar ${catalog.title}` : `Nuevo ${catalog.title}`}</h3>
          <div className="form-grid">{catalog.fields.map(renderCatalogInput)}</div>
          {canModifyCatalog ? (
            <div className="actions-row">
              <button onClick={saveCatalogItem} title={editingId ? 'Actualizar' : 'Guardar'} aria-label={editingId ? 'Actualizar' : 'Guardar'}>{editingId ? 'Actualizar' : <SaveIcon />}</button>
              {editingId ? <button className="secondary-button" onClick={() => { setEditingId(null); setFormValues(createInitialFormValues(catalogKey)) }}>Cancelar</button> : null}
            </div>
          ) : null}
          {error ? <p className="helper-text">{error}</p> : null}
        </div>

        <div className="card">
          <h3>Listado</h3>
          <table>
            <thead>
              <tr>
                {catalog.columns.map((column) => <th key={column}>{column}</th>)}
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {catalog.columns.map((column) => <td key={`${row.id}-${column}`}>{resolveDisplayValue(catalogKey, column, row)}</td>)}
                  <td className="table-actions">
                    {canModifyCatalog ? <button className="small-button" onClick={() => startEditCatalog(row)} title="Editar" aria-label="Editar"><PencilIcon /></button> : null}
                    {canDeleteCatalog ? <button className="small-button danger" onClick={() => removeCatalogItem(row.id)} title="Eliminar" aria-label="Eliminar"><TrashIcon /></button> : null}
                    {!canModifyCatalog && !canDeleteCatalog ? '-' : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    )
  }

  function renderPersonalView() {
    const rows = catalogRows.personal || []
    const roles = catalogRows.personal_roles || []
    const bancos = catalogRows.bancos || []
    const canModifyCatalog = canModifyModule('base_datos')

    const normalizedDocumento = String(personalSearchDocumento || '').trim().toLowerCase()
    const normalizedNombre = String(personalSearchNombre || '').trim().toLowerCase()
    const normalizedRol = String(personalSearchRol || '').trim().toLowerCase()
    const normalizedEstado = String(personalSearchEstado || '').trim().toLowerCase()

    const filteredRows = rows.filter((row) => {
      const fullName = `${String(row.nombre || '')} ${String(row.apellidos || '')}`.trim().toLowerCase()
      const roleNames = resolvePersonalRoleNames(row.personal_role_ids).join(', ').toLowerCase()
      const estadoLabel = row.activo ? 'activo' : 'inactivo'

      if (normalizedDocumento && !String(row.documento || '').toLowerCase().includes(normalizedDocumento)) return false
      if (normalizedNombre && !fullName.includes(normalizedNombre)) return false
      if (normalizedRol && !roleNames.includes(normalizedRol)) return false
      if (normalizedEstado && !estadoLabel.includes(normalizedEstado)) return false

      if (personalFilterRolId) {
        const roleIds = Array.isArray(row.personal_role_ids) ? row.personal_role_ids.map((value) => Number(value)) : []
        if (!roleIds.includes(Number(personalFilterRolId))) return false
      }

      if (personalFilterEstado) {
        const target = personalFilterEstado === 'activo'
        if (Boolean(row.activo) !== target) return false
      }

      return true
    })

    const isAdminSelected = isAdminSelectedInForm()
    const selectedBanco = bancos.find((item) => Number(item.id) === Number(formValues.banco_id))

    if (personalViewMode === 'create') {
      return (
        <section className="view-section">
          <div className="card form-card">
            <div className="section-header-inline">
              <h3>{editingId ? 'Editar personal' : 'Crear nuevo personal'}</h3>
              <button className="personal-header-button personal-header-button-secondary" onClick={() => { setPersonalViewMode('list'); setEditingId(null); setError('') }}>Volver al listado</button>
            </div>

            <h4 className="form-subtitle">Información personal</h4>
            <div className="form-grid">
              {renderCatalogInput(CATALOGS.personal.fields.find((field) => field.key === 'documento'))}
              {renderCatalogInput(CATALOGS.personal.fields.find((field) => field.key === 'nombre'))}
              {renderCatalogInput(CATALOGS.personal.fields.find((field) => field.key === 'apellidos'))}
              {renderCatalogInput(CATALOGS.personal.fields.find((field) => field.key === 'banco_id'))}
              {renderCatalogInput(CATALOGS.personal.fields.find((field) => field.key === 'numero_cuenta'))}
              {renderCatalogInput(CATALOGS.personal.fields.find((field) => field.key === 'celular'))}
            </div>

            <h4 className="form-subtitle">Roles y acceso</h4>
            <div className="form-grid">
              {renderCatalogInput(CATALOGS.personal.fields.find((field) => field.key === 'personal_role_ids'))}
              {renderCatalogInput(CATALOGS.personal.fields.find((field) => field.key === 'direccion'))}
              {renderCatalogInput(CATALOGS.personal.fields.find((field) => field.key === 'correo'))}
              {isAdminSelected ? renderCatalogInput(CATALOGS.personal.fields.find((field) => field.key === 'password')) : null}
            </div>

            <h4 className="form-subtitle">Información laboral</h4>
            <div className="form-grid">
              {renderCatalogInput(CATALOGS.personal.fields.find((field) => field.key === 'afiliado_iess'))}
              {renderCatalogInput(CATALOGS.personal.fields.find((field) => field.key === 'fecha_afiliacion_iess'))}
              {renderCatalogInput(CATALOGS.personal.fields.find((field) => field.key === 'sueldo_iess'))}
              {renderCatalogInput(CATALOGS.personal.fields.find((field) => field.key === 'sueldo_real'))}
              {renderCatalogInput(CATALOGS.personal.fields.find((field) => field.key === 'descuenta_iess'))}
              {renderCatalogInput(CATALOGS.personal.fields.find((field) => field.key === 'cobra_decimo_tercero'))}
              {renderCatalogInput(CATALOGS.personal.fields.find((field) => field.key === 'cobra_decimo_cuarto'))}
              {renderCatalogInput(CATALOGS.personal.fields.find((field) => field.key === 'cobra_fondo_reserva'))}
            </div>

            <h4 className="form-subtitle">Estado</h4>
            <div className="form-grid">
              {renderCatalogInput(CATALOGS.personal.fields.find((field) => field.key === 'activo'))}
            </div>

            <div className="actions-row">
              {canModifyCatalog ? <button onClick={savePersonalItem}>{editingId ? 'Actualizar personal' : 'Guardar personal'}</button> : null}
              <button className="secondary-button" onClick={() => { setEditingId(null); setFormValues(createInitialFormValues('personal')) }}>Limpiar</button>
            </div>

            <p className="helper-text">
              Banco seleccionado: {selectedBanco ? selectedBanco.nombre : 'sin banco'} · Roles: {resolvePersonalRoleNames(formValues.personal_role_ids).join(', ') || 'sin roles'}
            </p>
            {error ? <p className="helper-text">{error}</p> : null}
          </div>
        </section>
      )
    }

    return (
      <section className="view-section">
        <div className="card form-card">
          <div className="section-header-inline">
            <h3>Listado de personal</h3>
            {canModifyCatalog ? <button className="personal-header-button personal-header-button-primary" onClick={startCreatePersonal} title="Nuevo Personal" aria-label="Nuevo Personal">+ Nuevo Personal</button> : null}
          </div>

          <div className="form-grid">
            <input placeholder="Buscar por cédula" value={personalSearchDocumento} onChange={(event) => setPersonalSearchDocumento(event.target.value)} />
            <input placeholder="Buscar por nombre" value={personalSearchNombre} onChange={(event) => setPersonalSearchNombre(event.target.value)} />
            <input placeholder="Buscar por rol" value={personalSearchRol} onChange={(event) => setPersonalSearchRol(event.target.value)} />
            <input placeholder="Buscar por estado" value={personalSearchEstado} onChange={(event) => setPersonalSearchEstado(event.target.value)} />
            <SearchableSelect
              value={personalFilterRolId}
              onChange={setPersonalFilterRolId}
              placeholder="Filtrar por rol"
              options={roles.map((role) => ({ value: String(role.id), label: role.nombre }))}
            />
            <SearchableSelect
              value={personalFilterEstado}
              onChange={setPersonalFilterEstado}
              placeholder="Filtrar por estado"
              options={[
                { value: 'activo', label: 'Activo' },
                { value: 'inactivo', label: 'Inactivo' }
              ]}
            />
          </div>
          {error ? <p className="helper-text">{error}</p> : null}
        </div>

        <div className="card">
          <h3>Personal registrado</h3>
          <table>
            <thead>
              <tr>
                <th>Cédula</th>
                <th>Nombres</th>
                <th>Apellidos</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.documento || '-'}</td>
                  <td>{row.nombre || '-'}</td>
                  <td>{row.apellidos || '-'}</td>
                  <td>{resolvePersonalRoleNames(row.personal_role_ids).join(', ') || '-'}</td>
                  <td>{row.activo ? 'Activo' : 'Inactivo'}</td>
                  <td className="table-actions">
                    {canModifyCatalog ? <button className="small-button" onClick={() => startEditPersonal(row)} title="Editar" aria-label="Editar"><PencilIcon /></button> : null}
                    {canModifyCatalog ? (
                      <button className="small-button" onClick={() => togglePersonalActivo(row)} title={row.activo ? 'Inactivar' : 'Activar'} aria-label={row.activo ? 'Inactivar' : 'Activar'}>
                        {row.activo ? 'Inactivar' : 'Activar'}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    )
  }

  function renderBitacoraView() {
    const selectedViaje = (viajes || []).find((viaje) => String(viaje.id) === String(selectedViajeId))
    const rutaSelected = (catalogRows.rutas || []).find((item) => Number(item.id) === Number(selectedViaje?.ruta_id))
    const rutaTipo = String(selectedViaje?.ruta_tipo || rutaSelected?.tipo || '').toLowerCase()
    const isRutaCorta = rutaTipo === 'corta'
    const totalGastos = (gastos || []).reduce((acc, item) => acc + Number(item.valor || 0), 0)
    const rutasActivas = (catalogRows.rutas || []).filter((ruta) => ruta.activo)
    const selectedRutaIds = Array.isArray(viajeForm.ruta_ids) ? viajeForm.ruta_ids.map((value) => String(value)) : []
    const selectedRutaLabels = rutasActivas
      .filter((ruta) => selectedRutaIds.includes(String(ruta.id)))
      .map((ruta) => ruta.nombre)
    const canModifyBitacora = canModifyModule('bitacora')
    const canDeleteBitacora = canDeleteModule('bitacora')

    return (
      <section className="view-section">
        <div className="card bitacora-tabs-card">
          <div className="bitacora-tabs">
            <button className={`bitacora-tab ${bitacoraTab === 'gestion' ? 'active' : ''}`} onClick={() => setBitacoraTab('gestion')}>Gestión de viajes</button>
            <button className={`bitacora-tab ${bitacoraTab === 'detalle' ? 'active' : ''}`} onClick={() => setBitacoraTab('detalle')}>Detalle del viaje</button>
          </div>
        </div>

        {bitacoraTab === 'gestion' ? (
          <>
            <div className="card form-card">
              <h3>{editingViajeId ? 'Editar viaje' : 'Crear viaje'}</h3>
              {!editingViajeId ? <p className="helper-text">El ID del viaje se genera automáticamente.</p> : null}
              <div className="form-grid">
                {!editingViajeId ? <input value={nextViajeId} readOnly placeholder="Siguiente Viaje ID" aria-label="Siguiente Viaje ID" /> : null}
                {editingViajeId ? <input value={viajeForm.viaje_id} readOnly aria-label="Viaje ID" /> : null}
                <input type="date" value={viajeForm.fecha_desde} onChange={(e) => setViajeForm((prev) => ({ ...prev, fecha_desde: e.target.value }))} />
                <input type="date" value={viajeForm.fecha_hasta} onChange={(e) => setViajeForm((prev) => ({ ...prev, fecha_hasta: e.target.value }))} />
                <SearchableSelect
                  value={viajeForm.camion_id}
                  onChange={(nextValue) => setViajeForm((prev) => ({ ...prev, camion_id: nextValue }))}
                  placeholder="Camión"
                  options={(catalogRows.camiones || []).filter((c) => c.activo).map((c) => ({ value: String(c.id), label: `${c.placa} - ${c.nombre}` }))}
                />
                <SearchableSelect
                  value={viajeForm.conductor_id}
                  onChange={(nextValue) => setViajeForm((prev) => ({ ...prev, conductor_id: nextValue }))}
                  placeholder="Conductor"
                  options={conductores.map((p) => ({ value: String(p.id), label: p.nombre }))}
                />
                {editingViajeId ? (
                  <SearchableSelect
                    value={viajeForm.ruta_id}
                    onChange={(nextValue) => setViajeForm((prev) => ({ ...prev, ruta_id: nextValue }))}
                    placeholder="Ruta"
                    options={rutasActivas.map((r) => ({ value: String(r.id), label: r.nombre }))}
                  />
                ) : (
                  <div className="multi-dropdown">
                    {(() => {
                      const dropdownKey = 'viajes-rutas'
                      const isOpen = multiSelectOpenKey === dropdownKey
                      const searchText = String(multiSelectSearch[dropdownKey] || '').trim().toLowerCase()
                      const filteredRutas = rutasActivas.filter((ruta) => String(ruta.nombre || '').toLowerCase().includes(searchText))
                      const toggleDropdown = () => {
                        if (isOpen) {
                          setMultiSelectOpenKey('')
                          setMultiSelectSearch((prev) => ({ ...prev, [dropdownKey]: '' }))
                          return
                        }
                        setMultiSelectOpenKey(dropdownKey)
                      }

                      return (
                        <>
                          <button
                            type="button"
                            className="multi-dropdown-trigger"
                            onClick={toggleDropdown}
                          >
                            <span>{selectedRutaLabels.length > 0 ? selectedRutaLabels.join(', ') : 'Rutas'}</span>
                            <span>{isOpen ? '▴' : '▾'}</span>
                          </button>

                          {isOpen && (
                            <div className="multi-dropdown-menu">
                              <input
                                className="multi-dropdown-search"
                                type="text"
                                placeholder="Buscar..."
                                value={multiSelectSearch[dropdownKey] || ''}
                                onChange={(event) => setMultiSelectSearch((prev) => ({ ...prev, [dropdownKey]: event.target.value }))}
                              />
                              {filteredRutas.map((ruta) => {
                                const checked = selectedRutaIds.includes(String(ruta.id))
                                return (
                                  <label className="multi-dropdown-option" key={ruta.id}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        setViajeForm((prev) => {
                                          const current = Array.isArray(prev.ruta_ids) ? prev.ruta_ids.map((value) => String(value)) : []
                                          const exists = current.includes(String(ruta.id))
                                          const next = exists
                                            ? current.filter((value) => value !== String(ruta.id))
                                            : [...current, String(ruta.id)]
                                          return { ...prev, ruta_ids: next }
                                        })
                                      }}
                                    />
                                    <span>{ruta.nombre}</span>
                                  </label>
                                )
                              })}
                              {filteredRutas.length === 0 ? <div className="search-select-empty">Sin resultados</div> : null}
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                )}
                <SearchableSelect
                  value={viajeForm.estado_viaje_id}
                  onChange={(nextValue) => setViajeForm((prev) => ({ ...prev, estado_viaje_id: nextValue }))}
                  placeholder="Estado de viaje"
                  options={(catalogRows.estados_viaje || []).filter((r) => r.activo).map((r) => ({ value: String(r.id), label: r.nombre }))}
                />
                <SearchableSelect
                  value={viajeForm.tipo_operacion}
                  onChange={(nextValue) => setViajeForm((prev) => ({ ...prev, tipo_operacion: nextValue }))}
                  placeholder="Tipo de operación"
                  allowEmpty={false}
                  options={[
                    { value: 'carga', label: 'Carga' },
                    { value: 'descarga', label: 'Descarga' },
                    { value: 'mixto', label: 'Mixto' }
                  ]}
                />
                <input type="number" step="0.01" placeholder="KM inicial" value={viajeForm.km_inicial} onChange={(e) => setViajeForm((prev) => ({ ...prev, km_inicial: e.target.value }))} />
                <input type="number" step="0.01" placeholder="KM final" value={viajeForm.km_final} onChange={(e) => setViajeForm((prev) => ({ ...prev, km_final: e.target.value }))} />
                <input placeholder="Observación" value={viajeForm.observacion} onChange={(e) => setViajeForm((prev) => ({ ...prev, observacion: e.target.value }))} />
              </div>
              <div className="actions-row">
                {canModifyBitacora ? <button onClick={saveViaje} title={editingViajeId ? 'Actualizar viaje' : 'Crear viaje'} aria-label={editingViajeId ? 'Actualizar viaje' : 'Crear viaje'}>{editingViajeId ? 'Actualizar viaje' : <SaveIcon />}</button> : null}
                {editingViajeId && canModifyBitacora ? <button className="secondary-button" onClick={() => { setEditingViajeId(null); setViajeForm(createInitialViajeForm()); fetchNextViajeId() }}>Cancelar edición</button> : null}
              </div>
              {bitacoraMessage ? <p className="helper-text">{bitacoraMessage}</p> : null}
            </div>

            <div className="card">
              <h3>Ver viajes</h3>
              <table>
                <thead>
                  <tr>
                    <th>Viaje ID</th>
                    <th>Fecha</th>
                    <th>Placa</th>
                    <th>Conductor</th>
                    <th>KM</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {viajes.map((v) => (
                    <tr key={v.id}>
                      <td>{v.viaje_id}</td>
                      <td>{String(v.fecha_desde || v.fecha || '').slice(0, 10)} → {String(v.fecha_hasta || v.fecha || '').slice(0, 10)}</td>
                      <td>{v.placa}</td>
                      <td>{v.conductor_nombre}</td>
                      <td>{v.km_inicial} → {v.km_final}</td>
                      <td className="table-actions">
                        {canModifyBitacora ? <button className="small-button" onClick={() => startEditViaje(v)} title="Editar viaje" aria-label="Editar viaje"><PencilIcon /></button> : null}
                        {canDeleteBitacora ? <button className="small-button danger" onClick={() => removeViaje(v)} title="Eliminar viaje" aria-label="Eliminar viaje"><TrashIcon /></button> : null}
                        <button
                          className="small-button"
                          title="Abrir detalle"
                          aria-label="Abrir detalle"
                          onClick={() => {
                            setSelectedViajeId(String(v.id))
                            setBitacoraTab('detalle')
                          }}
                        >
                          <EyeIcon />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="card form-card">
              <h3>Detalle del viaje</h3>
              <div className="form-grid">
                <SearchableSelect
                  value={selectedViajeId}
                  onChange={setSelectedViajeId}
                  placeholder="Selecciona viaje"
                  options={viajes.map((v) => ({ value: String(v.id), label: v.viaje_id }))}
                />
                <button className="secondary-button" onClick={() => setBitacoraTab('gestion')}>Volver a gestión</button>
              </div>
              {selectedViaje ? (
                <p className="helper-text">Viaje seleccionado: {selectedViaje.viaje_id} · {selectedViaje.placa} · {String(selectedViaje.fecha_desde || selectedViaje.fecha || '').slice(0, 10)} → {String(selectedViaje.fecha_hasta || selectedViaje.fecha || '').slice(0, 10)}</p>
              ) : (
                <p className="helper-text">Selecciona un viaje para gestionar gastos y carga.</p>
              )}
            </div>

            <div className="card">
              <h3>Agregar gastos</h3>
              <div className="form-grid">
                <input placeholder="Tipo gasto" value={gastoForm.tipo_gasto} onChange={(e) => setGastoForm((prev) => ({ ...prev, tipo_gasto: e.target.value }))} />
                <input type="number" step="0.01" placeholder="Valor" value={gastoForm.valor} onChange={(e) => setGastoForm((prev) => ({ ...prev, valor: e.target.value }))} />
                <input placeholder="Observación" value={gastoForm.observacion} onChange={(e) => setGastoForm((prev) => ({ ...prev, observacion: e.target.value }))} />
                <input placeholder="Comprobante" value={gastoForm.numero_comprobante} onChange={(e) => setGastoForm((prev) => ({ ...prev, numero_comprobante: e.target.value }))} />
                {canModifyBitacora ? <button onClick={saveGasto}>{editingGastoId ? 'Actualizar gasto' : 'Agregar gasto'}</button> : null}
                {editingGastoId && canModifyBitacora ? <button className="secondary-button" onClick={() => { setEditingGastoId(null); setGastoForm({ tipo_gasto: '', valor: '', observacion: '', numero_comprobante: '' }) }}>Cancelar edición</button> : null}
              </div>
              <table>
                <thead><tr><th>Tipo</th><th>Valor</th><th>Observación</th><th>Comprobante</th><th>Acciones</th></tr></thead>
                <tbody>
                  {gastos.map((g) => (
                    <tr key={g.id}>
                      <td>{g.tipo_gasto}</td>
                      <td>{g.valor}</td>
                      <td>{g.observacion || '-'}</td>
                      <td>{g.numero_comprobante || '-'}</td>
                      <td className="table-actions">
                        {canModifyBitacora ? <button className="small-button" onClick={() => startEditGasto(g)} title="Editar" aria-label="Editar"><PencilIcon /></button> : null}
                        {canDeleteBitacora ? <button className="small-button danger" onClick={() => removeGasto(g.id)} title="Eliminar" aria-label="Eliminar"><TrashIcon /></button> : null}
                        {!canModifyBitacora && !canDeleteBitacora ? '-' : null}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td><strong>Total</strong></td>
                    <td><strong>{totalGastos.toFixed(2)}</strong></td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="card">
              <h3>Agregar carga</h3>
              <div className="form-grid">
                {!isRutaCorta ? (
                  <>
                    <SearchableSelect
                      value={cargaForm.producto_id}
                      onChange={(nextValue) => setCargaForm((prev) => ({ ...prev, producto_id: nextValue }))}
                      placeholder="Producto"
                      options={(catalogRows.productos || []).filter((p) => p.activo).map((p) => ({ value: String(p.id), label: p.nombre }))}
                    />
                    <input type="number" step="0.01" placeholder="Cantidad" value={cargaForm.cantidad} onChange={(e) => setCargaForm((prev) => ({ ...prev, cantidad: e.target.value }))} />
                  </>
                ) : null}
                <input type="number" step="0.01" placeholder="Valor carga" value={cargaForm.valor_carga} onChange={(e) => setCargaForm((prev) => ({ ...prev, valor_carga: e.target.value }))} />
                {canModifyBitacora ? <button onClick={saveCarga}>{editingCargaId ? 'Actualizar carga' : (isRutaCorta ? 'Agregar valor de carga' : 'Agregar carga')}</button> : null}
                {editingCargaId && canModifyBitacora ? <button className="secondary-button" onClick={() => { setEditingCargaId(null); setCargaForm({ producto_id: '', cantidad: '', valor_carga: '' }) }}>Cancelar edición</button> : null}
              </div>
              <table>
                <thead><tr><th>Producto</th><th>Cantidad</th><th>Valor carga</th><th>Acciones</th></tr></thead>
                <tbody>
                  {cargas.map((c) => (
                    <tr key={c.id}>
                      <td>{c.producto_nombre || c.producto_id}</td>
                      <td>{c.cantidad}</td>
                      <td>{c.valor_carga}</td>
                      <td className="table-actions">
                        {canModifyBitacora ? <button className="small-button" onClick={() => startEditCarga(c)} title="Editar" aria-label="Editar"><PencilIcon /></button> : null}
                        {canDeleteBitacora ? <button className="small-button danger" onClick={() => removeCarga(c.id)} title="Eliminar" aria-label="Eliminar"><TrashIcon /></button> : null}
                        {!canModifyBitacora && !canDeleteBitacora ? '-' : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h3>Personal en la ruta</h3>
              <div className="form-grid">
                <SearchableSelect
                  value={viajePersonalId}
                  onChange={setViajePersonalId}
                  placeholder="Selecciona estibador"
                  options={estibadores.map((p) => ({ value: String(p.id), label: p.nombre }))}
                />
                {canModifyBitacora ? <button onClick={addViajePersonal}>Agregar personal</button> : null}
              </div>
              <table>
                <thead><tr><th>Nombre</th><th>Documento</th><th>Estado TXT</th><th>Acciones</th></tr></thead>
                <tbody>
                  {viajePersonal.map((item) => (
                    <tr key={`${item.viaje_id}-${item.personal_id}`}>
                      <td>{item.nombre}</td>
                      <td>{item.documento || '-'}</td>
                      <td>{item.justificado_txt ? 'Justificado' : 'Pendiente TXT'}</td>
                      <td className="table-actions">
                        {canDeleteBitacora ? <button className="small-button danger" onClick={() => removeViajePersonal(item.personal_id)} title="Quitar" aria-label="Quitar"><TrashIcon /></button> : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    )
  }

  function renderBiometricoView() {
    const canModifyBiometrico = canModifyModule('biometrico')
    const canDeleteBiometrico = canDeleteModule('biometrico')

    return (
      <section className="view-section">
        <div className="card form-card">
          <h3>Subir archivo TXT biométrico</h3>
          <div className="form-grid">
            <input type="file" accept=".txt" onChange={(e) => setBiometricoFile(e.target.files?.[0] || null)} />
            {canModifyBiometrico ? <button onClick={uploadBiometricoTxt}>Importar TXT</button> : null}
          </div>
          {biometricoMessage ? <p className="helper-text">{biometricoMessage}</p> : null}
        </div>

        <div className="card">
          <h3>Importaciones</h3>
          <table>
            <thead><tr><th>ID</th><th>Archivo</th><th>Estado</th><th>Filas</th><th>Válidas</th><th>Fecha</th><th>Acción</th></tr></thead>
            <tbody>
              {biometricoImports.map((imp) => (
                <tr key={imp.id}>
                  <td>{imp.id}</td>
                  <td>{imp.file_name}</td>
                  <td>{imp.status}</td>
                  <td>{imp.total_rows}</td>
                  <td>{imp.valid_rows}</td>
                  <td>{String(imp.created_at || '').slice(0, 19).replace('T', ' ')}</td>
                  <td className="table-actions">
                    {canDeleteBiometrico ? <button className="small-button danger" onClick={() => removeBiometricoImport(imp.id)} title="Eliminar" aria-label="Eliminar"><TrashIcon /></button> : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Marcas importadas</h3>
          <div className="form-grid">
            <input type="date" value={biometricoFecha} onChange={(e) => setBiometricoFecha(e.target.value)} />
            <button onClick={() => fetchBiometricoMarcas(biometricoFecha)}>Filtrar</button>
            <button className="secondary-button" onClick={() => { setBiometricoFecha(''); fetchBiometricoMarcas('') }}>Limpiar</button>
          </div>
          <table>
            <thead><tr><th>Fecha</th><th>Personal</th><th>ID biométrico</th><th>Entrada</th><th>Salida</th><th>Horas</th><th>Aplica pago</th><th>Acción</th></tr></thead>
            <tbody>
              {biometricoMarcas.map((m) => (
                <tr key={m.id}>
                  <td>{String(m.fecha || '').slice(0, 10)}</td>
                  <td>{m.personal_nombre}</td>
                  <td>{m.biometrico_id}</td>
                  <td>{String(m.primera_perforacion || '').slice(0, 5)}</td>
                  <td>{String(m.ultima_perforacion || '').slice(0, 5)}</td>
                  <td>{m.horas_reales_trabajo}</td>
                  <td>{m.aplica_pago ? 'Sí' : 'No'}</td>
                  <td className="table-actions">
                    {canDeleteBiometrico ? <button className="small-button danger" onClick={() => removeBiometricoMarca(m.id)} title="Eliminar" aria-label="Eliminar"><TrashIcon /></button> : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    )
  }

  function renderAsignacionEstibaView() {
    const marcasPagables = (asignacionData.marcas || []).filter((item) => item.aplica_pago)
    const canModifyBitacora = canModifyModule('bitacora')
    const canDeleteBitacora = canDeleteModule('bitacora')

    return (
      <section className="view-section">
        <div className="card form-card">
          <h3>Asignar estibadores del TXT a viajes del día</h3>
          <div className="form-grid">
            <input type="date" value={asignacionFecha} onChange={(e) => setAsignacionFecha(e.target.value)} />
            <button onClick={() => fetchAsignaciones(asignacionFecha)}>Cargar fecha</button>
            <SearchableSelect
              value={asignacionViajeId}
              onChange={setAsignacionViajeId}
              placeholder="Viaje del día"
              options={(asignacionData.viajes || []).map((v) => ({ value: String(v.id), label: `${v.viaje_id} · ${v.placa} · ${v.ruta_nombre}` }))}
            />
            <SearchableSelect
              value={asignacionMarcaId}
              onChange={setAsignacionMarcaId}
              placeholder="Estibador detectado (pagable)"
              options={marcasPagables.map((m) => ({ value: String(m.id), label: `${m.personal_nombre} · ${m.biometrico_id} · ${m.horas_reales_trabajo}h` }))}
            />
            {canModifyBitacora ? <button onClick={saveAsignacion}>Asignar</button> : null}
          </div>
          {asignacionMessage ? <p className="helper-text">{asignacionMessage}</p> : null}
        </div>

        <div className="card">
          <h3>Viajes del día</h3>
          <table>
            <thead><tr><th>Viaje ID</th><th>Placa</th><th>Ruta</th><th>Estado</th><th>Estibadores</th></tr></thead>
            <tbody>
              {(asignacionData.viajes || []).map((v) => (
                <tr key={v.id}>
                  <td>{v.viaje_id}</td>
                  <td>{v.placa}</td>
                  <td>{v.ruta_nombre}</td>
                  <td>{v.estado_nombre}</td>
                  <td>{v.estibadores_asignados}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Estibadores del TXT ({asignacionFecha || 'sin fecha'})</h3>
          <table>
            <thead><tr><th>Nombre</th><th>ID biométrico</th><th>Horas</th><th>Aplica pago</th><th>Asignaciones</th></tr></thead>
            <tbody>
              {(asignacionData.marcas || []).map((m) => (
                <tr key={m.id}>
                  <td>{m.personal_nombre}</td>
                  <td>{m.biometrico_id}</td>
                  <td>{m.horas_reales_trabajo}</td>
                  <td>{m.aplica_pago ? 'Sí' : 'No'}</td>
                  <td>{m.asignaciones_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Asignaciones registradas</h3>
          <table>
            <thead><tr><th>Viaje</th><th>Estibador</th><th>ID biométrico</th><th>Fecha</th><th>Acción</th></tr></thead>
            <tbody>
              {(asignacionData.asignaciones || []).map((a) => (
                <tr key={a.id}>
                  <td>{a.viaje_codigo}</td>
                  <td>{a.estibador_nombre}</td>
                  <td>{a.biometrico_id}</td>
                  <td>{String(a.fecha || '').slice(0, 10)}</td>
                  <td>{canDeleteBitacora ? <button className="small-button danger" onClick={() => removeAsignacion(a.id)} title="Eliminar" aria-label="Eliminar"><TrashIcon /></button> : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    )
  }

  function renderLiquidacionesView() {
    const { start: semanaInicio, end: semanaFin } = getMonthWeekRange(liquidacionSemana)
    const mesActualLabel = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(new Date())
    const canModifyLiquidaciones = canModifyModule('liquidaciones')
    const canDeleteLiquidaciones = canDeleteModule('liquidaciones')

    return (
      <section className="view-section">
        <div className="card form-card">
          <h3>Generar liquidación semanal automática</h3>
          <div className="form-grid">
            <SearchableSelect
              value={liquidacionSemana}
              onChange={setLiquidacionSemana}
              placeholder="Semana"
              allowEmpty={false}
              options={[
                { value: '1', label: 'Semana 1 (1-7)' },
                { value: '2', label: 'Semana 2 (8-14)' },
                { value: '3', label: 'Semana 3 (15-21)' },
                { value: '4', label: 'Semana 4 (22-fin de mes)' }
              ]}
            />
            {canModifyLiquidaciones ? <button onClick={generarLiquidaciones}>Generar liquidación</button> : null}
            <button className="secondary-button" onClick={() => fetchLiquidaciones(liquidacionSemana)}>Consultar semana</button>
            {canDeleteLiquidaciones ? <button className="secondary-button" onClick={eliminarLiquidacionesSemana} title="Eliminar semana" aria-label="Eliminar semana"><TrashIcon /></button> : null}
          </div>
          <p className="helper-text">Mes: {mesActualLabel} · Rango aplicado: {semanaInicio} → {semanaFin}</p>
          {liquidacionMessage ? <p className="helper-text">{liquidacionMessage}</p> : null}
        </div>

        <div className="card">
          <h3>Resumen por estibador</h3>
          <table>
            <thead><tr><th>Estibador</th><th>Cuenta banco</th><th>Semana</th><th>Total</th><th>Estado</th><th>Justificación TXT</th><th>Detalle</th></tr></thead>
            <tbody>
              {liquidaciones.map((item) => (
                <tr key={item.id}>
                  <td>{item.estibador_nombre}</td>
                  <td>{item.numero_cuenta || '-'}</td>
                  <td>{String(item.semana_inicio || '').slice(0, 10)} → {String(item.semana_fin || '').slice(0, 10)}</td>
                  <td>{item.total}</td>
                  <td>{item.estado}</td>
                  <td>{item.justificacion_txt || '-'}</td>
                  <td><button className="small-button" title="Ver detalle" aria-label="Ver detalle" onClick={() => setSelectedLiquidacionId(String(item.id))}><EyeIcon /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Detalle de liquidación {selectedLiquidacionId ? `#${selectedLiquidacionId}` : ''}</h3>
          <table>
            <thead><tr><th>Tipo</th><th>Referencia</th><th>Fecha</th><th>Detalle</th><th>Estibador</th><th>Monto</th><th>TXT</th></tr></thead>
            <tbody>
              {liquidacionDetalle.map((row) => (
                <tr key={row.id}>
                  <td>{String(row.detalle_tipo || '').toLowerCase() === 'ajuste' ? 'Ajuste' : 'Viaje'}</td>
                  <td>{row.referencia || row.viaje_codigo || '-'}</td>
                  <td>{String(row.fecha || '').slice(0, 10)}</td>
                  <td>{row.detalle || '-'}</td>
                  <td>{row.estibador_nombre}</td>
                  <td>{row.monto}</td>
                  <td>{row.justificado_txt === null || row.justificado_txt === undefined ? '-' : (row.justificado_txt ? 'Justificado' : 'Pendiente TXT')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    )
  }

  function renderPagosView() {
    const liquidacionesPendientes = (liquidaciones || []).filter((item) => String(item.estado || '').toLowerCase() !== 'pagado')
    const liquidacionesPendientesJustificadas = liquidacionesPendientes.filter((item) => String(item.justificacion_txt || '').trim().toLowerCase() === 'justificado')
    const pagoEnEdicion = (pagos || []).find((item) => item.id === editingPagoId)
    const pagoRolEnEdicion = (pagosRolesMensuales || []).find((item) => item.id === editingPagoRolId)
    const canModifyPagos = canModifyModule('pagos')
    const canDeletePagos = canDeleteModule('pagos')

    return (
      <section className="view-section">
        <div className="card form-card">
          <h3>{editingPagoId ? 'Editar pago de liquidación' : 'Registrar pago de liquidación'}</h3>
          <div className="form-grid">
            <SearchableSelect
              value={pagoForm.liquidacion_id}
              disabled={Boolean(editingPagoId)}
              onChange={(nextValue) => setPagoForm((prev) => ({ ...prev, liquidacion_id: nextValue }))}
              placeholder="Liquidación pendiente"
              options={[
                ...(pagoEnEdicion ? [{ value: String(pagoEnEdicion.liquidacion_id), label: `#${pagoEnEdicion.liquidacion_id} · ${pagoEnEdicion.estibador_nombre} · Total ${pagoEnEdicion.monto}` }] : []),
                ...liquidacionesPendientesJustificadas.map((item) => ({ value: String(item.id), label: `#${item.id} · ${item.estibador_nombre} · Total ${item.total}` }))
              ]}
            />
            <input type="date" value={pagoForm.fecha_pago} onChange={(e) => setPagoForm((prev) => ({ ...prev, fecha_pago: e.target.value }))} />
            <SearchableSelect
              value={pagoForm.banco_id}
              onChange={(nextValue) => setPagoForm((prev) => ({ ...prev, banco_id: nextValue }))}
              placeholder="Banco"
              options={(catalogRows.bancos || []).filter((b) => b.activo).map((banco) => ({ value: String(banco.id), label: banco.nombre }))}
            />
            <input placeholder="Comprobante" value={pagoForm.comprobante} onChange={(e) => setPagoForm((prev) => ({ ...prev, comprobante: e.target.value }))} />
            <input type="number" step="0.01" placeholder="Monto (opcional)" value={pagoForm.monto} onChange={(e) => setPagoForm((prev) => ({ ...prev, monto: e.target.value }))} />
            {canModifyPagos ? <button onClick={registrarPago} title={editingPagoId ? 'Actualizar pago' : 'Registrar pago'} aria-label={editingPagoId ? 'Actualizar pago' : 'Registrar pago'}>{editingPagoId ? 'Actualizar pago' : <SaveIcon />}</button> : null}
            {editingPagoId && canModifyPagos ? (
              <button className="secondary-button" onClick={() => {
                setEditingPagoId(null)
                setPagoForm({
                  liquidacion_id: '',
                  fecha_pago: new Date().toISOString().slice(0, 10),
                  banco_id: '',
                  comprobante: '',
                  monto: ''
                })
              }}>
                Cancelar edición
              </button>
            ) : null}
            <button className="secondary-button" onClick={() => { fetchLiquidaciones(); fetchPagos() }} title="Actualizar datos" aria-label="Actualizar datos"><RefreshIcon /></button>
          </div>
          {!editingPagoId && liquidacionesPendientes.length > 0 && liquidacionesPendientesJustificadas.length === 0 ? (
            <p className="helper-text">No hay liquidaciones justificadas por TXT para registrar pago.</p>
          ) : null}
          {pagoMessage ? <p className="helper-text">{pagoMessage}</p> : null}
        </div>

        <div className="card">
          <h3>Historial de pagos</h3>
          <table>
            <thead><tr><th>ID</th><th>Liquidación</th><th>Estibador</th><th>Banco</th><th>Fecha pago</th><th>Monto</th><th>Estado</th><th>Comprobante</th><th>Acciones</th></tr></thead>
            <tbody>
              {pagos.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>#{item.liquidacion_id}</td>
                  <td>{item.estibador_nombre}</td>
                  <td>{item.banco_nombre || '-'}</td>
                  <td>{String(item.fecha_pago || '').slice(0, 10)}</td>
                  <td>{item.monto}</td>
                  <td>{item.estado}</td>
                  <td>{item.comprobante || '-'}</td>
                  <td className="table-actions">
                    {canModifyPagos ? <button className="small-button" onClick={() => startEditPago(item)} title="Editar" aria-label="Editar"><PencilIcon /></button> : null}
                    {canDeletePagos ? <button className="small-button danger" onClick={() => removePago(item.id)} title="Eliminar" aria-label="Eliminar"><TrashIcon /></button> : null}
                    {!canModifyPagos && !canDeletePagos ? '-' : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card form-card">
          <h3>{editingPagoRolId ? 'Editar pago de rol mensual' : 'Registrar pago de rol mensual'}</h3>
          <div className="form-grid">
            <SearchableSelect
              value={pagoRolForm.rol_mensual_id}
              disabled={Boolean(editingPagoRolId)}
              onChange={(nextValue) => setPagoRolForm((prev) => ({ ...prev, rol_mensual_id: nextValue }))}
              placeholder="Rol mensual pendiente"
              options={[
                ...(pagoRolEnEdicion ? [{
                  value: String(pagoRolEnEdicion.rol_mensual_id),
                  label: `#${pagoRolEnEdicion.rol_mensual_id} · ${pagoRolEnEdicion.documento || 'SIN_DOC'} · ${pagoRolEnEdicion.nombre || ''} ${pagoRolEnEdicion.apellidos || ''} · ${pagoRolEnEdicion.periodo_mes} · Neto ${pagoRolEnEdicion.monto}`
                }] : []),
                ...rolesPagoOptions.map((item) => ({
                  value: String(item.id),
                  label: `#${item.id} · ${item.documento || 'SIN_DOC'} · ${item.nombre || ''} ${item.apellidos || ''} · ${item.periodo_mes} · Neto ${item.neto_pagar}`
                }))
              ]}
            />
            <input type="date" value={pagoRolForm.fecha_pago} onChange={(e) => setPagoRolForm((prev) => ({ ...prev, fecha_pago: e.target.value }))} />
            <SearchableSelect
              value={pagoRolForm.banco_id}
              onChange={(nextValue) => setPagoRolForm((prev) => ({ ...prev, banco_id: nextValue }))}
              placeholder="Banco"
              options={(catalogRows.bancos || []).filter((b) => b.activo).map((banco) => ({ value: String(banco.id), label: banco.nombre }))}
            />
            <input placeholder="Comprobante" value={pagoRolForm.comprobante} onChange={(e) => setPagoRolForm((prev) => ({ ...prev, comprobante: e.target.value }))} />
            <input type="number" step="0.01" placeholder="Monto (opcional)" value={pagoRolForm.monto} onChange={(e) => setPagoRolForm((prev) => ({ ...prev, monto: e.target.value }))} />
            {canModifyPagos ? <button onClick={registrarPagoRolMensual} title={editingPagoRolId ? 'Actualizar pago de rol' : 'Registrar pago de rol'} aria-label={editingPagoRolId ? 'Actualizar pago de rol' : 'Registrar pago de rol'}>{editingPagoRolId ? 'Actualizar pago de rol' : <SaveIcon />}</button> : null}
            {editingPagoRolId && canModifyPagos ? (
              <button className="secondary-button" onClick={() => {
                setEditingPagoRolId(null)
                setPagoRolForm({
                  rol_mensual_id: '',
                  fecha_pago: new Date().toISOString().slice(0, 10),
                  banco_id: '',
                  comprobante: '',
                  monto: ''
                })
              }}>
                Cancelar edición
              </button>
            ) : null}
            <button className="secondary-button" onClick={() => { fetchPagosRolesMensuales(); fetchRolesPagoOptions(); fetchRolesMensuales(rolesPeriodoMes) }} title="Actualizar datos" aria-label="Actualizar datos"><RefreshIcon /></button>
          </div>
        </div>

        <div className="card">
          <h3>Historial de pagos de roles mensuales</h3>
          <table>
            <thead><tr><th>ID</th><th>Rol</th><th>Período</th><th>Empleado</th><th>Banco</th><th>Fecha pago</th><th>Monto</th><th>Estado</th><th>Comprobante</th><th>Acciones</th></tr></thead>
            <tbody>
              {pagosRolesMensuales.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>#{item.rol_mensual_id}</td>
                  <td>{item.periodo_mes}</td>
                  <td>{`${item.documento || 'SIN_DOC'} · ${item.nombre || ''} ${item.apellidos || ''}`.trim()}</td>
                  <td>{item.banco_nombre || '-'}</td>
                  <td>{String(item.fecha_pago || '').slice(0, 10)}</td>
                  <td>{item.monto}</td>
                  <td>{item.estado}</td>
                  <td>{item.comprobante || '-'}</td>
                  <td className="table-actions">
                    {canModifyPagos ? <button className="small-button" onClick={() => startEditPagoRolMensual(item)} title="Editar" aria-label="Editar"><PencilIcon /></button> : null}
                    {canDeletePagos ? <button className="small-button danger" onClick={() => removePagoRolMensual(item.id)} title="Eliminar" aria-label="Eliminar"><TrashIcon /></button> : null}
                    {!canModifyPagos && !canDeletePagos ? '-' : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    )
  }

  function renderAjustesPersonalView() {
    const canModifyAjustes = canModifyModule('ajustes_personal')
    const canDeleteAjustes = canDeleteModule('ajustes_personal')
    const personalOptions = (catalogRows.personal || []).map((item) => ({
      value: String(item.id),
      label: `${item.documento || 'SIN_DOC'} · ${item.nombre || ''} ${item.apellidos || ''}`.trim()
    }))

    const filteredRows = (ajustesRows || []).filter((item) => {
      if (ajustesFiltroPersonalId && Number(item.personal_id) !== Number(ajustesFiltroPersonalId)) return false
      if (ajustesFiltroTipo && String(item.tipo || '').toLowerCase() !== String(ajustesFiltroTipo).toLowerCase()) return false
      if (ajustesFiltroEstado && String(item.estado || '').toLowerCase() !== String(ajustesFiltroEstado).toLowerCase()) return false
      if (ajustesFiltroFrecuencia && String(item.frecuencia || '').toLowerCase() !== String(ajustesFiltroFrecuencia).toLowerCase()) return false
      return true
    })

    return (
      <section className="view-section">
        <div className="card form-card">
          <h3>{editingAjusteId ? 'Editar ajuste' : 'Nuevo ajuste (sobrante/faltante)'}</h3>
          <div className="form-grid">
            <SearchableSelect
              value={ajusteForm.personal_id}
              onChange={(nextValue) => setAjusteForm((prev) => ({ ...prev, personal_id: nextValue }))}
              placeholder="Empleado"
              options={personalOptions}
            />
            <SearchableSelect
              value={ajusteForm.tipo}
              onChange={(nextValue) => setAjusteForm((prev) => ({ ...prev, tipo: nextValue }))}
              placeholder="Tipo"
              allowEmpty={false}
              options={[{ value: 'sobrante', label: 'Sobrante' }, { value: 'faltante', label: 'Faltante' }]}
            />
            <input placeholder="Detalle" value={ajusteForm.detalle} onChange={(e) => setAjusteForm((prev) => ({ ...prev, detalle: e.target.value }))} />
            <input type="number" step="0.01" placeholder="Valor total" value={ajusteForm.valor_total} onChange={(e) => setAjusteForm((prev) => ({ ...prev, valor_total: e.target.value }))} />
            <label className="switch-field">
              <span>En cuotas</span>
              <input type="checkbox" checked={ajusteForm.en_cuotas === true} onChange={(e) => setAjusteForm((prev) => ({ ...prev, en_cuotas: e.target.checked }))} />
            </label>
            {ajusteForm.en_cuotas ? (
              <input type="number" min="1" step="1" placeholder="Cantidad de cuotas" value={ajusteForm.cantidad_cuotas} onChange={(e) => setAjusteForm((prev) => ({ ...prev, cantidad_cuotas: e.target.value }))} />
            ) : null}
            <SearchableSelect
              value={ajusteForm.frecuencia}
              onChange={(nextValue) => setAjusteForm((prev) => ({ ...prev, frecuencia: nextValue }))}
              placeholder="Frecuencia"
              allowEmpty={false}
              options={[{ value: 'semanal', label: 'Semanal' }, { value: 'mensual', label: 'Mensual' }]}
            />
            <input type="date" value={ajusteForm.fecha_inicio} onChange={(e) => setAjusteForm((prev) => ({ ...prev, fecha_inicio: e.target.value }))} />
            <SearchableSelect
              value={ajusteForm.estado}
              onChange={(nextValue) => setAjusteForm((prev) => ({ ...prev, estado: nextValue }))}
              placeholder="Estado"
              allowEmpty={false}
              options={[{ value: 'activo', label: 'Activo' }, { value: 'pausado', label: 'Pausado' }, { value: 'cancelado', label: 'Cancelado' }]}
            />
          </div>
          <div className="actions-row">
            {canModifyAjustes ? <button onClick={saveAjustePersonal}>{editingAjusteId ? 'Actualizar ajuste' : 'Guardar ajuste'}</button> : null}
            <button className="secondary-button" onClick={() => {
              setEditingAjusteId(null)
              setAjusteForm({ personal_id: '', tipo: 'faltante', detalle: '', valor_total: '', en_cuotas: false, cantidad_cuotas: '1', frecuencia: 'semanal', fecha_inicio: new Date().toISOString().slice(0, 10), estado: 'activo' })
            }}>Limpiar</button>
          </div>
          {ajustesMessage ? <p className="helper-text">{ajustesMessage}</p> : null}
        </div>

        <div className="card">
          <h3>Listado de ajustes</h3>
          <div className="form-grid" style={{ marginBottom: 10 }}>
            <SearchableSelect value={ajustesFiltroPersonalId} onChange={setAjustesFiltroPersonalId} placeholder="Filtrar empleado" options={personalOptions} />
            <SearchableSelect value={ajustesFiltroTipo} onChange={setAjustesFiltroTipo} placeholder="Filtrar tipo" options={[{ value: 'sobrante', label: 'Sobrante' }, { value: 'faltante', label: 'Faltante' }]} />
            <SearchableSelect value={ajustesFiltroEstado} onChange={setAjustesFiltroEstado} placeholder="Filtrar estado" options={[{ value: 'activo', label: 'Activo' }, { value: 'pausado', label: 'Pausado' }, { value: 'cancelado', label: 'Cancelado' }, { value: 'finalizado', label: 'Finalizado' }]} />
            <SearchableSelect value={ajustesFiltroFrecuencia} onChange={setAjustesFiltroFrecuencia} placeholder="Filtrar frecuencia" options={[{ value: 'semanal', label: 'Semanal' }, { value: 'mensual', label: 'Mensual' }]} />
          </div>

          <table>
            <thead>
              <tr><th>Empleado</th><th>Tipo</th><th>Detalle</th><th>Valor</th><th>Cuotas</th><th>Frecuencia</th><th>Fecha inicio</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {filteredRows.map((item) => (
                <tr key={item.id}>
                  <td>{`${item.documento || 'SIN_DOC'} · ${item.nombre || ''} ${item.apellidos || ''}`.trim()}</td>
                  <td>{item.tipo}</td>
                  <td>{item.detalle}</td>
                  <td>{Number(item.valor_total || 0).toFixed(2)}</td>
                  <td>{item.en_cuotas ? `${item.cuota_actual || 0}/${item.cantidad_cuotas || 1}` : '1/1'}</td>
                  <td>{item.frecuencia}</td>
                  <td>{String(item.fecha_inicio || '').slice(0, 10)}</td>
                  <td>{item.estado}</td>
                  <td className="table-actions">
                    {canModifyAjustes ? <button className="small-button" onClick={() => startEditAjuste(item)} title="Editar" aria-label="Editar"><PencilIcon /></button> : null}
                    {canModifyAjustes && !['finalizado', 'generado', 'pagado'].includes(String(item.estado || '').toLowerCase()) ? <button className="small-button" onClick={() => changeAjusteEstado(item, item.estado === 'activo' ? 'pausado' : 'activo')}>{item.estado === 'activo' ? 'Pausar' : 'Activar'}</button> : null}
                    {canModifyAjustes && item.estado !== 'cancelado' && !['finalizado', 'generado', 'pagado'].includes(String(item.estado || '').toLowerCase()) ? <button className="small-button danger" onClick={() => changeAjusteEstado(item, 'cancelado')}>Cancelar</button> : null}
                    {canDeleteAjustes && !['finalizado', 'generado', 'pagado'].includes(String(item.estado || '').toLowerCase()) ? <button className="small-button danger" onClick={() => removeAjustePersonal(item)} title="Eliminar" aria-label="Eliminar"><TrashIcon /></button> : null}
                    {canDeleteAjustes && String(item.estado || '').toLowerCase() === 'generado' ? <button className="small-button danger" onClick={() => removeAjustePersonal(item)} title="Borrar generado" aria-label="Borrar generado">Borrar generado</button> : null}
                    {!canModifyAjustes && !canDeleteAjustes ? '-' : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    )
  }

  function renderRolesMensualesView() {
    const canModifyRoles = canModifyModule('roles_mensuales')
    const canDeleteRoles = canDeleteModule('roles_mensuales')

    return (
      <section className="view-section">
        <div className="card form-card">
          <h3>Generación de roles mensuales (afiliados IESS)</h3>
          <div className="form-grid">
            <input type="month" value={rolesPeriodoMes} onChange={(e) => setRolesPeriodoMes(e.target.value)} />
            {canModifyRoles ? <button onClick={generarRolesMensuales}>Generar roles del mes</button> : null}
            {canModifyRoles ? <button className="danger" onClick={eliminarRolesMensuales}>Borrar roles del mes</button> : null}
            <button className="secondary-button" onClick={() => fetchRolesMensuales(rolesPeriodoMes)}>Actualizar</button>
          </div>
          {rolesMessage ? <p className="helper-text">{rolesMessage}</p> : null}
        </div>

        <div className="card">
          <h3>Roles generados</h3>
          <table>
            <thead>
              <tr><th>Empleado</th><th>Período</th><th>Ingresos</th><th>Egresos</th><th>Neto</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {rolesRows.map((item) => (
                <tr key={item.id}>
                  <td>{`${item.documento || 'SIN_DOC'} · ${item.nombre || ''} ${item.apellidos || ''}`.trim()}</td>
                  <td>{item.periodo_mes}</td>
                  <td>{Number(item.total_ingresos || 0).toFixed(2)}</td>
                  <td>{Number(item.total_egresos || 0).toFixed(2)}</td>
                  <td>{Number(item.neto_pagar || 0).toFixed(2)}</td>
                  <td>{item.estado}</td>
                  <td className="table-actions">
                    <button className="small-button" onClick={() => { setSelectedRolId(String(item.id)); fetchRolMensualDetalle(item.id) }}><EyeIcon /></button>
                    {canModifyRoles ? <button className="small-button" onClick={() => updateRolMensualEstado(item.id, 'aprobado')}>Aprobar</button> : null}
                    {canModifyRoles ? <button className="small-button" onClick={() => updateRolMensualEstado(item.id, 'verificado')}>Verificar</button> : null}
                    {canDeleteRoles ? <button className="small-button danger" onClick={() => eliminarRolMensual(item.id)}>Eliminar</button> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Detalle del rol {rolDetalle ? `#${rolDetalle.id}` : ''}</h3>
          {!rolDetalle ? <p className="helper-text">Selecciona un rol para ver el detalle.</p> : (
            <>
              <p className="helper-text">Empleado: {`${rolDetalle.documento || 'SIN_DOC'} · ${rolDetalle.nombre || ''} ${rolDetalle.apellidos || ''}`.trim()} · Estado: {rolDetalle.estado}</p>
              <table>
                <thead><tr><th>Sección</th><th>Concepto</th><th>Valor</th></tr></thead>
                <tbody>
                  {(rolDetalle.detalle || []).map((item) => (
                    <tr key={item.id}><td>{item.seccion}</td><td>{item.concepto}</td><td>{Number(item.valor || 0).toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </section>
    )
  }

  function renderReportesView() {
    return (
      <section className="view-section">
        <div className="card form-card">
          <h3>Reportes básicos</h3>
          <div className="form-grid">
            <input type="date" value={reporteDesde} onChange={(e) => setReporteDesde(e.target.value)} />
            <input type="date" value={reporteHasta} onChange={(e) => setReporteHasta(e.target.value)} />
            <button onClick={cargarReportes}>Consultar reportes</button>
          </div>
          {reporteMessage ? <p className="helper-text">{reporteMessage}</p> : null}
        </div>

        <div className="card">
          <h3>Pagos por estibador</h3>
          <table>
            <thead><tr><th>Estibador</th><th>Total pagos</th><th>Total pagado</th></tr></thead>
            <tbody>
              {reportePagos.map((item) => (
                <tr key={item.personal_id}>
                  <td>{item.estibador_nombre}</td>
                  <td>{item.total_pagos}</td>
                  <td>{item.total_pagado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Resumen por ruta</h3>
          <table>
            <thead><tr><th>Ruta</th><th>Viajes</th><th>Total gastos</th><th>Total carga</th></tr></thead>
            <tbody>
              {reporteCostosRuta.map((item) => (
                <tr key={item.ruta_id}>
                  <td>{item.ruta_nombre}</td>
                  <td>{item.viajes}</td>
                  <td>{item.total_gastos}</td>
                  <td>{item.total_carga}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Resumen por camión</h3>
          <table>
            <thead><tr><th>Camión</th><th>Placa</th><th>Viajes</th><th>Total gastos</th><th>Total carga</th></tr></thead>
            <tbody>
              {reporteCostosCamion.map((item) => (
                <tr key={item.camion_id}>
                  <td>{item.camion_nombre}</td>
                  <td>{item.placa}</td>
                  <td>{item.viajes}</td>
                  <td>{item.total_gastos}</td>
                  <td>{item.total_carga}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Inconsistencias · Estibadores pagables sin asignación</h3>
          <table>
            <thead><tr><th>Fecha</th><th>Estibador</th><th>ID biométrico</th><th>Horas</th></tr></thead>
            <tbody>
              {reporteEstibadoresSinAsignacion.map((item) => (
                <tr key={item.marca_id}>
                  <td>{String(item.fecha || '').slice(0, 10)}</td>
                  <td>{item.estibador_nombre}</td>
                  <td>{item.biometrico_id}</td>
                  <td>{item.horas_reales_trabajo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Inconsistencias · Viajes sin estibadores</h3>
          <table>
            <thead><tr><th>Viaje</th><th>Fecha</th><th>Ruta</th><th>Placa</th><th>Operación</th></tr></thead>
            <tbody>
              {reporteViajesSinEstibadores.map((item) => (
                <tr key={item.viaje_db_id}>
                  <td>{item.viaje_id}</td>
                  <td>{String(item.fecha || '').slice(0, 10)}</td>
                  <td>{item.ruta_nombre}</td>
                  <td>{item.placa}</td>
                  <td>{item.tipo_operacion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    )
  }

  function renderEmpresaLogoView() {
    const canModifyEmpresaLogo = canModifyModule('empresa_logo')
    const canDeleteEmpresaLogo = canDeleteModule('empresa_logo')

    return (
      <section className="view-section">
        <div className="card form-card">
          <h3>Logo de empresa</h3>
          <div className="form-grid">
            {canModifyEmpresaLogo ? (
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null
                  saveEmpresaLogo(file)
                  e.target.value = ''
                }}
              />
            ) : null}
            {canDeleteEmpresaLogo ? <button className="secondary-button" onClick={removeEmpresaLogo} title="Quitar logo" aria-label="Quitar logo"><TrashIcon /></button> : null}
          </div>
          {empresaLogoMessage ? <p className="helper-text">{empresaLogoMessage}</p> : null}
        </div>

        <div className="card">
          <h3>Vista previa</h3>
          {empresaLogo ? (
            <img className="brand-logo-preview" src={empresaLogo} alt="Logo empresa" />
          ) : (
            <p className="helper-text">Aún no hay logo cargado.</p>
          )}
        </div>
      </section>
    )
  }

  function renderAdminAccessView() {
    const canModifyAdminAccess = canModifyModule('admin_access')

    return (
      <section className="view-section">
        <div className="card form-card">
          <h3>Accesos de módulos para Admin</h3>
          <div className="form-grid">
            <SearchableSelect
              value={selectedAdminAccessId}
              onChange={async (nextId) => {
                setSelectedAdminAccessId(nextId)
                await fetchAdminAccessDetail(nextId)
              }}
              placeholder="Selecciona Admin"
              options={adminAccessRows.map((row) => ({ value: String(row.id), label: `${row.nombre} · ${row.email || 'sin correo'}` }))}
            />
            <button className="secondary-button" onClick={fetchAdminAccessRows}>Actualizar lista</button>
            {canModifyAdminAccess ? <button onClick={saveAdminAccess} disabled={!selectedAdminAccessId} title="Guardar accesos" aria-label="Guardar accesos"><SaveIcon /></button> : null}
          </div>
          {adminAccessMessage ? <p className="helper-text">{adminAccessMessage}</p> : null}
        </div>

        <div className="card">
          <h3>Permisos por módulo</h3>
          <table>
            <thead><tr><th>Módulo</th><th>Acceso</th><th>Modificar</th><th>Eliminar</th></tr></thead>
            <tbody>
              {ACCESS_MODULE_KEYS.map((moduleKey) => (
                <tr key={moduleKey}>
                  <td>{moduleKey}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={adminAccessForm[moduleKey]?.can_access !== false}
                      disabled={!canModifyAdminAccess}
                      onChange={(e) => setAdminAccessForm((prev) => ({ ...prev, [moduleKey]: { ...(prev[moduleKey] || {}), can_access: e.target.checked } }))}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={adminAccessForm[moduleKey]?.can_modify !== false}
                      disabled={!canModifyAdminAccess}
                      onChange={(e) => setAdminAccessForm((prev) => ({ ...prev, [moduleKey]: { ...(prev[moduleKey] || {}), can_modify: e.target.checked } }))}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={adminAccessForm[moduleKey]?.can_delete !== false}
                      disabled={!canModifyAdminAccess}
                      onChange={(e) => setAdminAccessForm((prev) => ({ ...prev, [moduleKey]: { ...(prev[moduleKey] || {}), can_delete: e.target.checked } }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    )
  }

  function renderCurrentView() {
    const isCatalogView = CATALOG_MENU_ITEMS.some((item) => item.key === currentView)
    if (isCatalogView) {
      if (!canAccessModule('base_datos')) {
        return <section className="view-section"><div className="card"><p className="helper-text">No tienes acceso a esta vista.</p></div></section>
      }
      if (currentView === 'empresa_logo' && !canAccessModule('empresa_logo')) {
        return <section className="view-section"><div className="card"><p className="helper-text">No tienes acceso a esta vista.</p></div></section>
      }
      if (currentView === 'admin_access' && !canAccessModule('admin_access')) {
        return <section className="view-section"><div className="card"><p className="helper-text">No tienes acceso a esta vista.</p></div></section>
      }
    } else if (currentView !== 'dashboard' && !canAccessModule(currentView)) {
      return <section className="view-section"><div className="card"><p className="helper-text">No tienes acceso a esta vista.</p></div></section>
    }

    if (currentView === 'dashboard') {
      const maxViajes = Math.max(1, ...dashboardTopCamiones.map((item) => Number(item.viajes || 0)))
      const formatMoney = (value) => Number(value || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

      return (
        <section className="view-section">
          <div className="card form-card">
            <h3>Filtros de dashboard</h3>
            <div className="dashboard-presets">
              {DASHBOARD_PRESETS.map((preset) => (
                <button
                  key={preset}
                  className={`preset-button ${dashboardPreset === preset ? 'active' : ''}`}
                  onClick={() => aplicarDashboardPreset(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
            <div className="form-grid dashboard-filters">
              <input type="date" value={dashboardDesde} onChange={(e) => { setDashboardPreset(''); setDashboardDesde(e.target.value) }} />
              <input type="date" value={dashboardHasta} onChange={(e) => { setDashboardPreset(''); setDashboardHasta(e.target.value) }} />
              <button onClick={() => cargarDashboardCamiones(dashboardDesde, dashboardHasta)} title="Filtrar dashboard" aria-label="Filtrar dashboard"><RefreshIcon /></button>
            </div>
            {dashboardMessage ? <p className="helper-text">{dashboardMessage}</p> : null}
          </div>

          <section className="view-grid">
            <article className="stat-card"><h3>Registros catálogo</h3><strong>{dashboardStats.totalRecords}</strong></article>
            <article className="stat-card"><h3>Viajes (período)</h3><strong>{dashboardTotalViajesPeriodo}</strong></article>
            <article className="stat-card"><h3>Camiones usados (período)</h3><strong>{dashboardCamionUso.length}</strong></article>
            <article className="stat-card"><h3>Gasto total (período)</h3><strong>{formatMoney(dashboardTotalGastosPeriodo)}</strong></article>
          </section>

          <div className="dashboard-charts-grid">
            <div className="card">
              <h3>Camiones más usados</h3>
              {dashboardLoading ? <p className="helper-text">Cargando gráfica...</p> : null}
              {!dashboardLoading && dashboardTopCamiones.length === 0 ? <p className="helper-text">Sin datos para el rango seleccionado.</p> : null}
              {!dashboardLoading && dashboardTopCamiones.length > 0 ? (
                <div className="dashboard-chart">
                  {dashboardTopCamiones.map((item) => {
                    const viajesCount = Number(item.viajes || 0)
                    const percent = Math.max(6, Math.round((viajesCount / maxViajes) * 100))
                    return (
                      <div key={item.camion_id} className="dashboard-bar-row">
                        <div className="dashboard-bar-label">{item.placa} · {item.camion_nombre}</div>
                        <div className="dashboard-bar-track">
                          <div className="dashboard-bar-fill" style={{ width: `${percent}%` }} />
                        </div>
                        <div className="dashboard-bar-value">{viajesCount}</div>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </div>

            <div className="card">
              <h3>Gastos por camión</h3>
              {dashboardLoading ? <p className="helper-text">Cargando gráfica...</p> : null}
              {!dashboardLoading && dashboardCostPieData.slices.length === 0 ? <p className="helper-text">Sin datos para el rango seleccionado.</p> : null}
              {!dashboardLoading && dashboardCostPieData.slices.length > 0 ? (
                <div className="dashboard-pie-layout">
                  <div
                    className="dashboard-pie"
                    style={{
                      background: `conic-gradient(${(() => {
                        let current = 0
                        return dashboardCostPieData.slices.map((slice) => {
                          const start = current
                          current += slice.percent
                          return `${slice.color} ${start.toFixed(2)}% ${current.toFixed(2)}%`
                        }).join(', ')
                      })()})`
                    }}
                    aria-label="Distribución de gastos por camión"
                  />
                  <div className="dashboard-pie-legend">
                    {dashboardCostPieData.slices.map((slice) => (
                      <div key={slice.id} className="dashboard-pie-legend-item">
                        <span className="dashboard-pie-dot" style={{ backgroundColor: slice.color }} />
                        <span className="dashboard-pie-text">{slice.label}</span>
                        <span className="dashboard-pie-value">{formatMoney(slice.value)} · {slice.percent.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="card">
            <div className="dashboard-calendar-header">
              <h3>Calendario de uso de camiones</h3>
              <div className="dashboard-calendar-nav">
                <button className="small-button" onClick={() => moveDashboardCalendarMonth(-1)} aria-label="Mes anterior">◀</button>
                <span className="dashboard-calendar-month">{dashboardCalendarMonthLabel || '-'}</span>
                <button className="small-button" onClick={() => moveDashboardCalendarMonth(1)} aria-label="Mes siguiente">▶</button>
              </div>
            </div>

            <div className="dashboard-calendar-grid dashboard-calendar-weekdays">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((dayName) => (
                <div key={dayName} className="dashboard-calendar-weekday">{dayName}</div>
              ))}
            </div>

            <div className="dashboard-calendar-grid">
              {dashboardCalendarWeeks.flat().map((dayCell, index) => {
                if (!dayCell) return <div key={`empty-${index}`} className="dashboard-calendar-empty" />

                const classes = [
                  'dashboard-calendar-day',
                  dayCell.hasUsage ? 'has-usage' : '',
                  dayCell.noUsage ? 'no-usage' : '',
                  dashboardCalendarSelectedDate === dayCell.key ? 'selected' : ''
                ].filter(Boolean).join(' ')

                return (
                  <button
                    key={dayCell.key}
                    className={classes}
                    onClick={() => setDashboardCalendarSelectedDate(dayCell.key)}
                    aria-label={`${dayCell.key}: ${dayCell.count} camiones`}
                  >
                    <span className="dashboard-calendar-day-number">{dayCell.day}</span>
                    <span className="dashboard-calendar-day-count">{dayCell.count}</span>
                  </button>
                )
              })}
            </div>
            {dashboardCalendarLoading ? <p className="helper-text dashboard-calendar-summary">Cargando calendario...</p> : null}

            <p className="helper-text dashboard-calendar-summary">
              Días con camiones: {dashboardCalendarMonthStats.usedDays} · Días sin uso: {dashboardCalendarMonthStats.noUsageDays}
            </p>
            {dashboardSelectedDayUsage ? (
              <p className="helper-text dashboard-calendar-summary">
                {dashboardSelectedDayUsage.date}: {dashboardSelectedDayUsage.count > 0
                  ? `${dashboardSelectedDayUsage.count} camiones usados`
                  : 'Sin uso de camiones'}
              </p>
            ) : null}
          </div>
        </section>
      )
    }

    if (currentView === 'bitacora') return renderBitacoraView()
    if (currentView === 'biometrico') return renderBiometricoView()
    if (currentView === 'liquidaciones') return renderLiquidacionesView()
    if (currentView === 'ajustes_personal') return renderAjustesPersonalView()
    if (currentView === 'roles_mensuales') return renderRolesMensualesView()
    if (currentView === 'pagos') return renderPagosView()
    if (currentView === 'reportes') return renderReportesView()
    if (currentView === 'personal') return renderPersonalView()
    if (currentView === 'admin_access') return renderAdminAccessView()
    if (currentView === 'empresa_logo') return renderEmpresaLogoView()
    return renderCatalogView(currentView)
  }

  if (!token) {
    return (
      <div className="login-page">
        <div className="login-card">
          {empresaLogo ? (
            <img className="login-logo" src={empresaLogo} alt="Logo empresa" />
          ) : (
            <>
              <h1>Sistema Choferes</h1>
              <p>Liquidación logística</p>
            </>
          )}
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" type="password" />
          <button onClick={login}>Ingresar</button>
          {error ? <small className="error-text">{error}</small> : null}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="brand">
            {empresaLogo ? (
              <img className="brand-logo" src={empresaLogo} alt="Logo empresa" />
            ) : (
              <><h2>Logística</h2><span>Robert Ponce Distribución</span></>
            )}
          </div>
          <nav className="menu">
            {MAIN_MENU_ITEMS.filter((item) => canAccessModule(item.key)).map((item) => (
              <button key={item.key} className={`menu-item ${currentView === item.key ? 'active' : ''}`} onClick={() => setCurrentView(item.key)}>{item.label}</button>
            ))}

            {canAccessModule('base_datos') ? (
              <button
                className={`menu-item ${databaseMenuOpen ? 'active' : ''}`}
                onClick={() => setCurrentView(CATALOG_MENU_ITEMS[0].key)}
              >
                Base de datos {databaseMenuOpen ? '▾' : '▸'}
              </button>
            ) : null}

            {databaseMenuOpen && canAccessModule('base_datos') && (
              <div className="submenu">
                {CATALOG_MENU_ITEMS.filter((item) => item.key !== 'empresa_logo' || canAccessModule('empresa_logo')).map((item) => (
                  <button
                    key={item.key}
                    className={`submenu-item ${currentView === item.key ? 'active' : ''}`}
                    onClick={() => setCurrentView(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </nav>
        </aside>

        <main className="content">
          <header className="topbar">
            <h1>{MENU_ITEMS.find((item) => item.key === currentView)?.label}</h1>
            <div className="topbar-actions">
              <button className="refresh-button" onClick={refreshAll} title="Actualizar datos" aria-label="Actualizar datos"><RefreshIcon /></button>
              <button className="logout-button" onClick={logout} title="Salir" aria-label="Salir"><LogoutIcon /></button>
            </div>
          </header>
          {renderCurrentView()}
        </main>
      </div>

      {popupErrors.length > 0 && (
        <div className="popup-overlay">
          <div className="popup-card">
            <h3>Errores de validación del TXT</h3>
            <div className="popup-list">
              {popupErrors.map((item, index) => (
                <p key={`${item.row}-${item.column}-${index}`}>Fila {item.row} · {item.column}: {item.message}</p>
              ))}
            </div>
            <button onClick={() => setPopupErrors([])}>Cerrar</button>
          </div>
        </div>
      )}
    </>
  )
}
