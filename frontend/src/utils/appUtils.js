import { ACCESS_MODULE_KEYS, CATALOGS } from '../constants/appConfig'

export function createFullAccessMatrix() {
  const matrix = {}
  for (const key of ACCESS_MODULE_KEYS) {
    matrix[key] = { can_access: true, can_modify: true, can_delete: true }
  }
  return matrix
}

export function createInitialFormValues(catalogKey) {
  const fields = CATALOGS[catalogKey]?.fields || []
  const form = {}
  for (const field of fields) {
    if (field.type === 'boolean') form[field.key] = true
    else if (field.type === 'multi_select_dropdown') form[field.key] = []
    else form[field.key] = ''
  }
  return form
}

export function createInitialViajeForm() {
  return {
    viaje_id: '',
    fecha_desde: '',
    fecha_hasta: '',
    camion_id: '',
    conductor_id: '',
    ruta_id: '',
    ruta_ids: [],
    estado_viaje_id: '',
    tipo_operacion: 'carga',
    km_inicial: '',
    km_final: '',
    observacion: ''
  }
}

export function getCurrentWeekRange() {
  const today = new Date()
  const mondayOffset = (today.getDay() + 6) % 7

  const start = new Date(today)
  start.setDate(today.getDate() - mondayOffset)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  const formatDate = (value) => value.toISOString().slice(0, 10)
  return { start: formatDate(start), end: formatDate(end) }
}

export function getMonthWeekRange(weekOption, referenceDate = new Date()) {
  const week = Math.min(Math.max(Number(weekOption) || 1, 1), 4)
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()

  const startByWeek = { 1: 1, 2: 8, 3: 15, 4: 22 }
  const startDay = startByWeek[week]
  const endDay = week === 4 ? lastDay : Math.min(startDay + 6, lastDay)

  const start = new Date(year, month, startDay)
  const end = new Date(year, month, endDay)
  const formatDate = (value) => value.toISOString().slice(0, 10)

  return { start: formatDate(start), end: formatDate(end) }
}

export function getPresetDateRange(presetKey, referenceDate = new Date()) {
  const end = new Date(referenceDate)
  const start = new Date(referenceDate)

  if (presetKey === 'hoy') {
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10)
    }
  }

  if (presetKey === 'semana') {
    return getCurrentWeekRange()
  }

  if (presetKey === 'mes') {
    start.setMonth(start.getMonth() - 1)
  } else if (presetKey === '3 meses') {
    start.setMonth(start.getMonth() - 3)
  } else if (presetKey === '6 meses') {
    start.setMonth(start.getMonth() - 6)
  } else if (presetKey === 'año') {
    start.setFullYear(start.getFullYear() - 1)
  } else {
    return getCurrentWeekRange()
  }

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  }
}

export function hasValue(value) {
  if (value === undefined || value === null) return false
  if (typeof value === 'string' && value.trim() === '') return false
  return true
}
