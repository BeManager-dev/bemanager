'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DollarSign, TrendingUp, TrendingDown, CreditCard, Banknote, ArrowRightLeft, BarChart2, Plus, X, Check } from 'lucide-react'

interface ResumenFinanciero {
  ingresos_periodo: number; egresos_periodo: number; costos_periodo: number
  balance_periodo: number; ingresos_hoy: number
  ventas_efectivo: number; ventas_debito: number; ventas_credito: number; ventas_transferencia: number
}

interface Movimiento {
  fecha: string; tipo: 'ingreso' | 'egreso' | 'costo'; descripcion: string; monto: number
  sucursal?: string; medio_pago?: string
}

interface CategoriaCosto { id: string; nombre: string }
interface PuntoVenta { id: string; nombre: string }

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const ANOS = [2024, 2025, 2026, 2027]

function getFechasMes(anio: number, mes: number) {
  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
  const hasta = new Date(anio, mes, 0).toISOString().split('T')[0]
  return { desde, hasta }
}

function FieldError({ mensaje }: { mensaje?: string }) {
  if (!mensaje) return null
  return <p className="text-xs text-red-500 mt-1">{mensaje}</p>
}

export default function FinanzasPage() {
  const supabase = createClient()
  const hoy = new Date()
  const [modoFiltro, setModoFiltro] = useState<'mes' | 'personalizado'>('mes')
  const [mesSeleccionado, setMesSeleccionado] = useState(hoy.getMonth() + 1)
  const [anioSeleccionado, setAnioSeleccionado] = useState(hoy.getFullYear())
  const [fechaDesde, setFechaDesde] = useState(getFechasMes(hoy.getFullYear(), hoy.getMonth() + 1).desde)
  const [fechaHasta, setFechaHasta] = useState(getFechasMes(hoy.getFullYear(), hoy.getMonth() + 1).hasta)
  const [filtroSucursal, setFiltroSucursal] = useState('')
  const [filtroMedioPago, setFiltroMedioPago] = useState('')
  const [cargando, setCargando] = useState(true)
  const [resumen, setResumen] = useState<ResumenFinanciero>({
    ingresos_periodo: 0, egresos_periodo: 0, costos_periodo: 0,
    balance_periodo: 0, ingresos_hoy: 0,
    ventas_efectivo: 0, ventas_debito: 0, ventas_credito: 0, ventas_transferencia: 0,
  })
  const [todosMovimientos, setTodosMovimientos] = useState<Movimiento[]>([])
  const [categoriasCosto, setCategoriasCosto] = useState<CategoriaCosto[]>([])
  const [puntosVenta, setPuntosVenta] = useState<PuntoVenta[]>([])
  const [mostrarFormCosto, setMostrarFormCosto] = useState(false)
  const [agregandoCategoria, setAgregandoCategoria] = useState(false)
  const [nuevaCategoria, setNuevaCategoria] = useState('')
  const [montoStr, setMontoStr] = useState('')
  const [formCosto, setFormCosto] = useState({
    descripcion: '', fecha: hoy.toISOString().split('T')[0],
    categoria_costo_id: '', punto_venta_id: '',
  })
  const [erroresCosto, setErroresCosto] = useState<Record<string, string>>({})
  const [guardandoCosto, setGuardandoCosto] = useState(false)

  const periodoActual = modoFiltro === 'mes'
    ? getFechasMes(anioSeleccionado, mesSeleccionado)
    : { desde: fechaDesde, hasta: fechaHasta }

  const movimientos = todosMovimientos.filter(m => {
    if (filtroSucursal && m.sucursal !== filtroSucursal) return false
    if (filtroMedioPago && m.tipo === 'ingreso' && m.medio_pago !== filtroMedioPago) return false
    if (filtroMedioPago && m.tipo !== 'ingreso') return false
    return true
  })

  async function cargarCatalogos() {
    const { data: cats } = await supabase.from('categorias_costo').select('id, nombre').eq('activo', true).order('nombre')
    setCategoriasCosto(cats || [])
    if (cats && cats.length > 0) setFormCosto(p => ({ ...p, categoria_costo_id: cats[0].id }))
    const { data: pvs } = await supabase.from('puntos_venta').select('id, nombre').eq('activo', true).order('nombre')
    setPuntosVenta(pvs || [])
  }

  async function cargarDatos() {
    setCargando(true)
    const { desde, hasta } = periodoActual
    const hoyStr = hoy.toISOString().split('T')[0]

    const { data: comprobantes } = await supabase
      .from('comprobantes').select('id, total, fecha, puntos_venta(nombre)')
      .eq('estado', 'emitido').in('tipo', ['factura_a', 'factura_b', 'factura_c'])
      .gte('fecha', desde).lte('fecha', hasta)

    const ingresosPeriodo = comprobantes?.reduce((a, c) => a + Number(c.total), 0) || 0
    const ingresosHoy = comprobantes?.filter(c => c.fecha === hoyStr).reduce((a, c) => a + Number(c.total), 0) || 0

    const idsComp = comprobantes?.map(c => c.id) || []
    const ventasPorMedio = { efectivo: 0, debito: 0, credito: 0, transferencia: 0 }
    const pagosMap: Record<string, string> = {}

    if (idsComp.length > 0) {
      const { data: pagosComp } = await supabase.from('pagos_comprobante')
        .select('medio_pago, monto, comprobante_id').in('comprobante_id', idsComp)
      pagosComp?.forEach(p => {
        if (p.medio_pago in ventasPorMedio)
          ventasPorMedio[p.medio_pago as keyof typeof ventasPorMedio] += Number(p.monto)
        pagosMap[p.comprobante_id] = p.medio_pago
      })
    }

    const { data: sesiones } = await supabase.from('sesiones_caja').select('id, punto_venta_id')
      .gte('fecha_apertura', desde + 'T00:00:00').lte('fecha_apertura', hasta + 'T23:59:59')

    const sesionPVMap: Record<string, string> = {}
    sesiones?.forEach(s => { sesionPVMap[s.id] = s.punto_venta_id })

    let egresosCaja = 0
    const movEgresos: Movimiento[] = []
    if (sesiones && sesiones.length > 0) {
      const { data: egresosData } = await supabase.from('egresos_caja')
        .select('descripcion, monto, created_at, sesion_caja_id').in('sesion_caja_id', sesiones.map(s => s.id))
      egresosData?.forEach(e => {
        egresosCaja += Number(e.monto)
        const pvId = sesionPVMap[e.sesion_caja_id]
        const pvNombre = puntosVenta.find(p => p.id === pvId)?.nombre
        movEgresos.push({ fecha: e.created_at.split('T')[0], tipo: 'egreso', descripcion: e.descripcion, monto: Number(e.monto), sucursal: pvNombre })
      })
    }

    const { data: costosData } = await supabase.from('costos')
      .select('descripcion, monto, fecha, categorias_costo(nombre), puntos_venta(nombre)')
      .gte('fecha', desde).lte('fecha', hasta)

    let costosPeriodo = 0
    const movCostos: Movimiento[] = []
    costosData?.forEach((c: any) => {
      costosPeriodo += Number(c.monto)
      movCostos.push({
        fecha: c.fecha, tipo: 'costo',
        descripcion: `${c.categorias_costo?.nombre || 'Costo'} - ${c.descripcion}`,
        monto: Number(c.monto), sucursal: c.puntos_venta?.nombre,
      })
    })

    const movIngresos: Movimiento[] = (comprobantes || []).map((c: any) => ({
      fecha: c.fecha, tipo: 'ingreso' as const, descripcion: 'Venta',
      monto: Number(c.total), sucursal: c.puntos_venta?.nombre, medio_pago: pagosMap[c.id],
    }))

    setResumen({
      ingresos_periodo: ingresosPeriodo, egresos_periodo: egresosCaja,
      costos_periodo: costosPeriodo, balance_periodo: ingresosPeriodo - egresosCaja - costosPeriodo,
      ingresos_hoy: ingresosHoy, ventas_efectivo: ventasPorMedio.efectivo,
      ventas_debito: ventasPorMedio.debito, ventas_credito: ventasPorMedio.credito,
      ventas_transferencia: ventasPorMedio.transferencia,
    })

    const todos = [...movIngresos, ...movEgresos, ...movCostos].sort((a, b) => b.fecha.localeCompare(a.fecha))
    setTodosMovimientos(todos)
    setCargando(false)
  }

  useEffect(() => { cargarCatalogos() }, [])
  useEffect(() => { cargarDatos() }, [modoFiltro, mesSeleccionado, anioSeleccionado, fechaDesde, fechaHasta])

  async function agregarCategoriaInline() {
    if (!nuevaCategoria.trim()) return
    const { data } = await supabase.from('categorias_costo').insert({ nombre: nuevaCategoria }).select('id, nombre').single()
    if (data) {
      setCategoriasCosto(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setFormCosto(p => ({ ...p, categoria_costo_id: data.id }))
      setNuevaCategoria(''); setAgregandoCategoria(false)
    }
  }

  async function guardarCosto() {
    const monto = parseFloat(montoStr)
    const errores: Record<string, string> = {}
    if (!montoStr || isNaN(monto) || monto <= 0) errores.monto = 'Ingresa un monto mayor a 0'
    if (!formCosto.categoria_costo_id) errores.categoria = 'Selecciona una categoria'
    if (!formCosto.descripcion.trim()) errores.descripcion = 'Ingresa una descripcion'
    if (Object.keys(errores).length > 0) { setErroresCosto(errores); return }

    setGuardandoCosto(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setGuardandoCosto(false); return }
    const { error } = await supabase.from('costos').insert({
      descripcion: formCosto.descripcion, monto, fecha: formCosto.fecha,
      categoria_costo_id: formCosto.categoria_costo_id,
      punto_venta_id: formCosto.punto_venta_id || null, usuario_id: user.id,
    })
    if (error) { console.error(error); setGuardandoCosto(false); return }
    setFormCosto({ descripcion: '', fecha: hoy.toISOString().split('T')[0], categoria_costo_id: categoriasCosto[0]?.id || '', punto_venta_id: '' })
    setMontoStr(''); setErroresCosto({})
    setMostrarFormCosto(false); setGuardandoCosto(false); cargarDatos()
  }

  const mediosPago = [
    { label: 'Efectivo', valor: resumen.ventas_efectivo, icon: Banknote, color: 'text-green-500' },
    { label: 'Debito', valor: resumen.ventas_debito, icon: CreditCard, color: 'text-blue-500' },
    { label: 'Credito', valor: resumen.ventas_credito, icon: CreditCard, color: 'text-purple-500' },
    { label: 'Transferencia', valor: resumen.ventas_transferencia, icon: ArrowRightLeft, color: 'text-orange-500' },
  ]

  const totalEgresosYCostos = resumen.egresos_periodo + resumen.costos_periodo

  const accesosRapidos = [
    { label: 'Este mes', onClick: () => { setModoFiltro('mes'); setMesSeleccionado(hoy.getMonth() + 1); setAnioSeleccionado(hoy.getFullYear()) } },
    { label: 'Mes anterior', onClick: () => {
      const m = hoy.getMonth() === 0 ? 12 : hoy.getMonth()
      const a = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear()
      setModoFiltro('mes'); setMesSeleccionado(m); setAnioSeleccionado(a)
    }},
    { label: 'Ultimos 3 meses', onClick: () => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1)
      setModoFiltro('personalizado')
      setFechaDesde(d.toISOString().split('T')[0])
      setFechaHasta(hoy.toISOString().split('T')[0])
    }},
  ]

  return (
    <div className="space-y-6">

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-[#0F172A]">Finanzas</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Ingresos, egresos y balance</p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <div className="flex gap-1">
            {accesosRapidos.map(a => (
              <button key={a.label} onClick={a.onClick}
                className="h-8 px-3 rounded-lg border border-[#E2E8F0] text-xs text-[#64748B] hover:bg-[#F8FAFB] hover:text-[#0F172A] transition-colors bg-white">
                {a.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 bg-[#F8FAFB] rounded-lg p-0.5 border border-[#E2E8F0]">
              <button onClick={() => setModoFiltro('mes')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${modoFiltro === 'mes' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B]'}`}>
                Por mes
              </button>
              <button onClick={() => setModoFiltro('personalizado')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${modoFiltro === 'personalizado' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B]'}`}>
                Personalizado
              </button>
            </div>
            {modoFiltro === 'mes' ? (
              <div className="flex gap-2">
                <select value={mesSeleccionado} onChange={e => setMesSeleccionado(Number(e.target.value))}
                  className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] focus:outline-none focus:border-[#00B4D8] bg-white">
                  {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
                <select value={anioSeleccionado} onChange={e => setAnioSeleccionado(Number(e.target.value))}
                  className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] focus:outline-none focus:border-[#00B4D8] bg-white">
                  {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] focus:outline-none focus:border-[#00B4D8] bg-white" />
                <span className="text-sm text-[#94A3B8]">hasta</span>
                <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] focus:outline-none focus:border-[#00B4D8] bg-white" />
              </div>
            )}
            <button onClick={() => setMostrarFormCosto(true)}
              className="flex items-center gap-2 h-9 px-4 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors">
              <Plus size={15} /> Cargar costo
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Ingresos del periodo', valor: resumen.ingresos_periodo, icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-50' },
          { label: 'Egresos de caja', valor: resumen.egresos_periodo, icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Costos del periodo', valor: resumen.costos_periodo, icon: DollarSign, color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Balance del periodo', valor: resumen.balance_periodo, icon: BarChart2,
            color: resumen.balance_periodo >= 0 ? 'text-green-500' : 'text-red-500',
            bg: resumen.balance_periodo >= 0 ? 'bg-green-50' : 'bg-red-50' },
        ].map(card => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white rounded-xl border border-[#E2E8F0] p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-[#64748B]">{card.label}</p>
                <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                  <Icon size={16} className={card.color} />
                </div>
              </div>
              <p className={`text-2xl font-medium ${card.color}`}>
                {card.valor < 0 ? '-' : ''}${Math.abs(card.valor).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
        <h2 className="text-sm font-medium text-[#0F172A] mb-4">Ventas por medio de pago</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {mediosPago.map(m => {
            const Icon = m.icon
            const pct = resumen.ingresos_periodo > 0 ? (m.valor / resumen.ingresos_periodo * 100) : 0
            return (
              <div key={m.label} className="space-y-2">
                <div className="flex items-center gap-2"><Icon size={15} className={m.color} /><span className="text-sm text-[#64748B]">{m.label}</span></div>
                <p className={`text-lg font-medium ${m.color}`}>${m.valor.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                <div className="w-full bg-[#F1F5F9] rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-[#00B4D8]" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-[#94A3B8]">{pct.toFixed(1)}% del total</p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F0] space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-medium text-[#0F172A]">Movimientos del periodo</h2>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-green-600 font-medium">Ingresos: ${movimientos.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + m.monto, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
<span className="text-red-500 font-medium">Egresos+Costos: ${movimientos.filter(m => m.tipo !== 'ingreso').reduce((a, m) => a + m.monto, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <select value={filtroSucursal} onChange={e => setFiltroSucursal(e.target.value)}
              className="h-8 px-3 rounded-lg border border-[#E2E8F0] text-xs text-[#64748B] focus:outline-none focus:border-[#00B4D8] bg-white">
              <option value="">Todas las sucursales</option>
              {puntosVenta.map(pv => <option key={pv.id} value={pv.nombre}>{pv.nombre}</option>)}
            </select>
            <select value={filtroMedioPago} onChange={e => setFiltroMedioPago(e.target.value)}
              className="h-8 px-3 rounded-lg border border-[#E2E8F0] text-xs text-[#64748B] focus:outline-none focus:border-[#00B4D8] bg-white">
              <option value="">Todos los medios de pago</option>
              <option value="efectivo">Efectivo</option>
              <option value="debito">Debito</option>
              <option value="credito">Credito</option>
              <option value="transferencia">Transferencia</option>
            </select>
            {(filtroSucursal || filtroMedioPago) && (
              <button onClick={() => { setFiltroSucursal(''); setFiltroMedioPago('') }}
                className="h-8 px-3 rounded-lg text-xs text-[#94A3B8] hover:text-[#64748B] transition-colors">
                Limpiar
              </button>
            )}
          </div>
        </div>
        {cargando ? (
          <p className="text-sm text-[#94A3B8] text-center py-8">Cargando...</p>
        ) : movimientos.length === 0 ? (
          <p className="text-sm text-[#94A3B8] text-center py-8">Sin movimientos para esos filtros</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFB]">
                <th className="text-left text-xs font-medium text-[#64748B] px-5 py-3">Descripcion</th>
                <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Sucursal</th>
                <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Medio de pago</th>
                <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Fecha</th>
                <th className="text-right text-xs font-medium text-[#64748B] px-5 py-3">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {movimientos.map((m, i) => (
                <tr key={i} className="hover:bg-[#F8FAFB] transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${m.tipo === 'ingreso' ? 'bg-green-50' : 'bg-red-50'}`}>
                        {m.tipo === 'ingreso' ? <TrendingUp size={13} className="text-green-500" /> : <TrendingDown size={13} className="text-red-500" />}
                      </div>
                      <div>
                        <p className="text-sm text-[#0F172A]">{m.descripcion}</p>
                        <p className="text-xs text-[#94A3B8]">
                          {m.tipo === 'egreso' ? 'Egreso de caja' : m.tipo === 'costo' ? 'Costo' : 'Venta'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm text-[#64748B]">{m.sucursal || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.medio_pago
                      ? <span className="text-xs px-2 py-1 rounded-full bg-[#F8FAFB] border border-[#E2E8F0] text-[#64748B] capitalize">{m.medio_pago}</span>
                      : <p className="text-sm text-[#94A3B8]">—</p>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm text-[#64748B]">{new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</p>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <p className={`text-sm font-medium ${m.tipo === 'ingreso' ? 'text-green-500' : 'text-red-500'}`}>
                      {m.tipo === 'ingreso' ? '+' : '-'}${m.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {mostrarFormCosto && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-base font-medium text-[#0F172A]">Cargar costo</h2>
              <button onClick={() => { setMostrarFormCosto(false); setErroresCosto({}) }} className="p-1.5 rounded-lg hover:bg-[#F8FAFB] text-[#64748B]">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-[#64748B] mb-1.5">Fecha</label>
                  <input type="date" value={formCosto.fecha}
                    onChange={e => setFormCosto(p => ({ ...p, fecha: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#64748B] mb-1.5">Monto *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">$</span>
                    <input
                      type="number" min={0} step={0.01}
                      value={montoStr}
                      onChange={e => { setMontoStr(e.target.value); setErroresCosto(p => ({ ...p, monto: '' })) }}
                      placeholder="0,00"
                      className={`w-full h-10 pl-7 pr-3 rounded-lg border text-sm focus:outline-none focus:ring-1 ${
                        erroresCosto.monto ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : 'border-[#E2E8F0] focus:border-[#00B4D8] focus:ring-[#00B4D8]'
                      }`}
                    />
                  </div>
                  <FieldError mensaje={erroresCosto.monto} />
                </div>
              </div>
              <div>
                <label className="block text-sm text-[#64748B] mb-1.5">Categoria *</label>
                {agregandoCategoria ? (
                  <div className="flex gap-2">
                    <input autoFocus value={nuevaCategoria}
                      onChange={e => setNuevaCategoria(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && agregarCategoriaInline()}
                      placeholder="Nueva categoria..."
                      className="flex-1 h-10 px-3 rounded-lg border border-[#00B4D8] text-sm focus:outline-none focus:ring-1 focus:ring-[#00B4D8]"
                    />
                    <button onClick={agregarCategoriaInline} className="h-10 px-3 rounded-lg bg-[#00B4D8] hover:bg-[#0096B4] text-white"><Check size={15} /></button>
                    <button onClick={() => setAgregandoCategoria(false)} className="h-10 px-3 rounded-lg border border-[#E2E8F0] text-[#64748B]"><X size={15} /></button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select value={formCosto.categoria_costo_id}
                      onChange={e => { setFormCosto(p => ({ ...p, categoria_costo_id: e.target.value })); setErroresCosto(p => ({ ...p, categoria: '' })) }}
                      className={`flex-1 h-10 px-3 rounded-lg border text-sm focus:outline-none focus:border-[#00B4D8] bg-white ${
                        erroresCosto.categoria ? 'border-red-400' : 'border-[#E2E8F0]'
                      }`}>
                      <option value="">Seleccionar...</option>
                      {categoriasCosto.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                    <button onClick={() => setAgregandoCategoria(true)}
                      className="h-10 px-3 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFB] text-[#64748B] hover:text-[#00B4D8] transition-colors">
                      <Plus size={15} />
                    </button>
                  </div>
                )}
                <FieldError mensaje={erroresCosto.categoria} />
              </div>
              <div>
                <label className="block text-sm text-[#64748B] mb-1.5">Descripcion *</label>
                <input value={formCosto.descripcion}
                  onChange={e => { setFormCosto(p => ({ ...p, descripcion: e.target.value })); setErroresCosto(p => ({ ...p, descripcion: '' })) }}
                  placeholder="Ej: Alquiler mes de mayo, factura luz..."
                  className={`w-full h-10 px-3 rounded-lg border text-sm placeholder:text-[#94A3B8] focus:outline-none focus:ring-1 ${
                    erroresCosto.descripcion ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : 'border-[#E2E8F0] focus:border-[#00B4D8] focus:ring-[#00B4D8]'
                  }`}
                />
                <FieldError mensaje={erroresCosto.descripcion} />
              </div>
              <div>
                <label className="block text-sm text-[#64748B] mb-1.5">Sucursal <span className="text-[#94A3B8]">(opcional)</span></label>
                <select value={formCosto.punto_venta_id}
                  onChange={e => setFormCosto(p => ({ ...p, punto_venta_id: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:border-[#00B4D8] bg-white">
                  <option value="">General (todas las sucursales)</option>
                  {puntosVenta.map(pv => <option key={pv.id} value={pv.id}>{pv.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => { setMostrarFormCosto(false); setErroresCosto({}) }}
                className="flex-1 h-10 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] hover:bg-[#F8FAFB] transition-colors">
                Cancelar
              </button>
              <button onClick={guardarCosto} disabled={guardandoCosto}
                className="flex-1 h-10 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
                {guardandoCosto ? 'Guardando...' : 'Registrar costo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
