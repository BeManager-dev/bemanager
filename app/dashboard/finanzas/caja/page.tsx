'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Lock, Unlock, TrendingDown, CreditCard, ArrowRightLeft, Banknote, X, History, ChevronDown } from 'lucide-react'

interface SesionCaja {
  id: string; estado: string; fecha_apertura: string; fecha_cierre: string | null
  monto_inicial: number; monto_final_declarado: number | null
  monto_final_sistema: number | null; diferencia: number | null
  punto_venta: { nombre: string } | null
  usuario_apertura: { nombre: string; apellido: string } | null
  usuario_cierre: { nombre: string; apellido: string } | null
}
interface VentaCaja { medio_pago: string; monto: number }
interface EgresoCaja { id: string; descripcion: string; monto: number; categoria: string; created_at: string }
interface PuntoVenta { id: string; nombre: string; deposito_id: string }
interface CategoriaEgreso { id: string; nombre: string }

export default function CajaPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'caja' | 'historial'>('caja')
  const [sesion, setSesion] = useState<SesionCaja | null>(null)
  const [historial, setHistorial] = useState<SesionCaja[]>([])
  const [ventas, setVentas] = useState<VentaCaja[]>([])
  const [egresos, setEgresos] = useState<EgresoCaja[]>([])
  const [puntosVenta, setPuntosVenta] = useState<PuntoVenta[]>([])
  const [puntoVenta, setPuntoVenta] = useState<PuntoVenta | null>(null)
  const [esAdmin, setEsAdmin] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [montoInicial, setMontoInicial] = useState(0)
  const [montoCierre, setMontoCierre] = useState(0)
  const [mostrarApertura, setMostrarApertura] = useState(false)
  const [mostrarCierre, setMostrarCierre] = useState(false)
  const [mostrarEgreso, setMostrarEgreso] = useState(false)
  const [sesionDetalle, setSesionDetalle] = useState<string | null>(null)
  const [egresosHistorial, setEgresosHistorial] = useState<Record<string, EgresoCaja[]>>({})
  const [categoriasEgreso, setCategoriasEgreso] = useState<CategoriaEgreso[]>([])
  const [nuevoEgreso, setNuevoEgreso] = useState({ descripcion: '', monto: 0, categoria_id: '' })

  async function cargarCategoriasEgreso() {
    const { data } = await supabase.from('categorias_egreso').select('id, nombre').eq('activo', true).order('nombre')
    setCategoriasEgreso(data || [])
    if (data && data.length > 0) setNuevoEgreso(p => ({ ...p, categoria_id: data[0].id }))
  }

  async function cargarDatos() {
    setCargando(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol, punto_venta_id, punto_venta:puntos_venta(id, nombre, deposito_id)')
      .eq('id', user.id).single()

    const admin = perfil?.rol === 'admin'
    setEsAdmin(admin)

    let pvs: PuntoVenta[] = []
    let pv: PuntoVenta | null = null

    if (admin) {
      const { data } = await supabase.from('puntos_venta').select('id, nombre, deposito_id').eq('activo', true).order('nombre')
      pvs = data || []; setPuntosVenta(pvs)
      pv = puntoVenta || pvs[0] || null
    } else {
      pv = (perfil?.punto_venta as any) || null
    }

    if (!puntoVenta && pv) setPuntoVenta(pv)
    const pvActual = puntoVenta || pv
    if (!pvActual) { setCargando(false); return }

    const { data: sesionData } = await supabase
      .from('sesiones_caja')
      .select('id, estado, fecha_apertura, fecha_cierre, monto_inicial, monto_final_declarado, monto_final_sistema, diferencia, punto_venta:puntos_venta(nombre), usuario_apertura:perfiles!sesiones_caja_usuario_apertura_id_fkey(nombre, apellido), usuario_cierre:perfiles!sesiones_caja_usuario_cierre_id_fkey(nombre, apellido)')
      .eq('punto_venta_id', pvActual.id).eq('estado', 'abierta').maybeSingle()

    setSesion(sesionData as any)

    if (sesionData) {
      const { data: comprobantes } = await supabase.from('comprobantes').select('id')
        .eq('punto_venta_id', pvActual.id).eq('estado', 'emitido')
        .in('tipo', ['factura_a', 'factura_b', 'factura_c'])
        .gte('created_at', sesionData.fecha_apertura)

      if (comprobantes && comprobantes.length > 0) {
        const { data: pagos } = await supabase.from('pagos_comprobante').select('medio_pago, monto')
          .in('comprobante_id', comprobantes.map(c => c.id))
        setVentas(pagos || [])
      } else setVentas([])

      const { data: egresosData } = await supabase.from('egresos_caja')
        .select('id, descripcion, monto, categoria, created_at')
        .eq('sesion_caja_id', sesionData.id).order('created_at', { ascending: false })
      setEgresos(egresosData || [])
    }

    const { data: historialData } = await supabase
      .from('sesiones_caja')
      .select('id, estado, fecha_apertura, fecha_cierre, monto_inicial, monto_final_declarado, monto_final_sistema, diferencia, punto_venta:puntos_venta(nombre), usuario_apertura:perfiles!sesiones_caja_usuario_apertura_id_fkey(nombre, apellido), usuario_cierre:perfiles!sesiones_caja_usuario_cierre_id_fkey(nombre, apellido)')
      .eq('punto_venta_id', pvActual.id).eq('estado', 'cerrada')
      .order('fecha_apertura', { ascending: false }).limit(30)
    setHistorial((historialData as any) || [])
    setCargando(false)
  }

  useEffect(() => { cargarCategoriasEgreso() }, [])
  useEffect(() => { cargarDatos() }, [puntoVenta])

  async function abrirCaja() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !puntoVenta) return
    await supabase.from('sesiones_caja').insert({
      punto_venta_id: puntoVenta.id, usuario_apertura_id: user.id,
      monto_inicial: montoInicial, estado: 'abierta',
    })
    setMostrarApertura(false); cargarDatos()
  }

  async function cerrarCaja() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !sesion) return
    await supabase.from('sesiones_caja').update({
      estado: 'cerrada', fecha_cierre: new Date().toISOString(),
      usuario_cierre_id: user.id, monto_final_declarado: montoCierre,
      monto_final_sistema: resumenEfectivo.saldo_efectivo,
      diferencia: montoCierre - resumenEfectivo.saldo_efectivo,
    }).eq('id', sesion.id)
    setMostrarCierre(false); cargarDatos()
  }

  async function agregarEgreso() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !sesion || !nuevoEgreso.descripcion || nuevoEgreso.monto <= 0) return
    const catNombre = categoriasEgreso.find(c => c.id === nuevoEgreso.categoria_id)?.nombre || 'gasto_general'
    await supabase.from('egresos_caja').insert({
      sesion_caja_id: sesion.id, descripcion: nuevoEgreso.descripcion,
      monto: nuevoEgreso.monto, categoria: catNombre, usuario_id: user.id,
    })
    setNuevoEgreso(p => ({ ...p, descripcion: '', monto: 0 }))
    setMostrarEgreso(false); cargarDatos()
  }

  async function verDetalleHistorial(sesionId: string) {
    if (sesionDetalle === sesionId) { setSesionDetalle(null); return }
    setSesionDetalle(sesionId)
    if (!egresosHistorial[sesionId]) {
      const { data } = await supabase.from('egresos_caja')
        .select('id, descripcion, monto, categoria, created_at').eq('sesion_caja_id', sesionId).order('created_at')
      setEgresosHistorial(prev => ({ ...prev, [sesionId]: data || [] }))
    }
  }

  const ventasEfectivo      = ventas.filter(v => v.medio_pago === 'efectivo').reduce((a, v) => a + Number(v.monto), 0)
  const ventasDebito        = ventas.filter(v => v.medio_pago === 'debito').reduce((a, v) => a + Number(v.monto), 0)
  const ventasCredito       = ventas.filter(v => v.medio_pago === 'credito').reduce((a, v) => a + Number(v.monto), 0)
  const ventasTransferencia = ventas.filter(v => v.medio_pago === 'transferencia').reduce((a, v) => a + Number(v.monto), 0)
  const totalVentas         = ventas.reduce((a, v) => a + Number(v.monto), 0)
  const totalEgresos        = egresos.reduce((a, e) => a + Number(e.monto), 0)
  const resumenEfectivo = {
    monto_inicial: sesion?.monto_inicial || 0,
    ventas_efectivo: ventasEfectivo,
    egresos: totalEgresos,
    saldo_efectivo: (sesion?.monto_inicial || 0) + ventasEfectivo - totalEgresos,
  }

  if (cargando) return <div className="flex items-center justify-center h-64 text-sm text-[#94A3B8]">Cargando...</div>
  if (!puntoVenta && !esAdmin) return <div className="flex items-center justify-center h-64 text-sm text-[#94A3B8]">Sin punto de venta asignado</div>

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-medium text-[#0F172A]">Caja</h1>
          {esAdmin && puntosVenta.length > 0 ? (
            <select value={puntoVenta?.id || ''} onChange={e => setPuntoVenta(puntosVenta.find(p => p.id === e.target.value) || null)}
              className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#00B4D8] bg-white">
              {puntosVenta.map(pv => <option key={pv.id} value={pv.id}>{pv.nombre}</option>)}
            </select>
          ) : (
            <span className="text-sm text-[#64748B]">{puntoVenta?.nombre}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {sesion && tab === 'caja' && (
            <>
              <button onClick={() => setMostrarEgreso(true)}
                className="flex items-center gap-2 h-10 px-4 border border-[#E2E8F0] bg-white hover:bg-[#F8FAFB] text-sm text-[#64748B] rounded-lg transition-colors">
                <TrendingDown size={15} /> Egreso
              </button>
              <button onClick={() => setMostrarCierre(true)}
                className="flex items-center gap-2 h-10 px-4 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors">
                <Lock size={15} /> Cerrar caja
              </button>
            </>
          )}
          {!sesion && tab === 'caja' && (
            <button onClick={() => setMostrarApertura(true)}
              className="flex items-center gap-2 h-10 px-4 bg-[#00B4D8] hover:bg-[#0096B4] text-white text-sm font-medium rounded-lg transition-colors">
              <Unlock size={15} /> Abrir caja
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 bg-[#F8FAFB] rounded-xl p-1 border border-[#E2E8F0] w-fit">
        {[
          { id: 'caja',      label: 'Caja actual', icon: Banknote },
          ...(esAdmin ? [{ id: 'historial', label: 'Historial', icon: History }] : []),
        ].map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-white text-[#0F172A] shadow-sm border border-[#E2E8F0]' : 'text-[#64748B] hover:text-[#0F172A]'
              }`}>
              <Icon size={15} />{t.label}
            </button>
          )
        })}
      </div>

      {tab === 'caja' && (
        !sesion ? (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center">
            <Lock size={40} className="text-[#94A3B8] mx-auto mb-3" strokeWidth={1} />
            <p className="text-sm font-medium text-[#0F172A] mb-1">Caja cerrada</p>
            <p className="text-sm text-[#94A3B8]">Abri la caja para empezar a registrar movimientos</p>
          </div>
        ) : (
          <>
            <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <p className="text-sm text-green-700 font-medium">
                Caja abierta desde las {new Date(sesion.fecha_apertura).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                {sesion.usuario_apertura && ` por ${(sesion.usuario_apertura as any).nombre} ${(sesion.usuario_apertura as any).apellido}`}
              </p>
            </div>

            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
              <h2 className="text-sm font-medium text-[#0F172A] mb-4 flex items-center gap-2">
                <Banknote size={16} className="text-[#00B4D8]" /> Resumen de efectivo
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-[#64748B]">Monto inicial</span><span className="text-[#0F172A]">${resumenEfectivo.monto_inicial.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between text-sm"><span className="text-[#64748B]">Ventas en efectivo</span><span className="text-green-600">+${resumenEfectivo.ventas_efectivo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between text-sm"><span className="text-[#64748B]">Egresos</span><span className="text-red-500">-${resumenEfectivo.egresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between text-base font-medium pt-3 border-t border-[#E2E8F0]">
                  <span className="text-[#0F172A]">Efectivo en caja</span>
                  <span className="text-[#00B4D8]">${resumenEfectivo.saldo_efectivo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
              <h2 className="text-sm font-medium text-[#0F172A] mb-4 flex items-center gap-2">
                <CreditCard size={16} className="text-[#00B4D8]" /> Ventas de la sesion
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Efectivo', valor: ventasEfectivo, icon: Banknote, color: 'text-green-600' },
                  { label: 'Debito', valor: ventasDebito, icon: CreditCard, color: 'text-blue-500' },
                  { label: 'Credito', valor: ventasCredito, icon: CreditCard, color: 'text-purple-500' },
                  { label: 'Transferencia', valor: ventasTransferencia, icon: ArrowRightLeft, color: 'text-orange-500' },
                ].map(m => {
                  const Icon = m.icon
                  return (
                    <div key={m.label} className="bg-[#F8FAFB] rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2"><Icon size={14} className={m.color} /><span className="text-xs text-[#64748B]">{m.label}</span></div>
                      <p className={`text-lg font-medium ${m.color}`}>${m.valor.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between text-sm font-medium mt-4 pt-4 border-t border-[#E2E8F0]">
                <span className="text-[#0F172A]">Total vendido</span>
                <span className="text-[#00B4D8]">${totalVentas.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
                <h2 className="text-sm font-medium text-[#0F172A]">Egresos de la sesion</h2>
                <span className="text-sm font-medium text-red-500">-${totalEgresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
              {egresos.length === 0 ? (
                <p className="text-sm text-[#94A3B8] text-center py-6">Sin egresos registrados</p>
              ) : (
                <div className="divide-y divide-[#E2E8F0]">
                  {egresos.map(e => (
                    <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1">
                        <p className="text-sm text-[#0F172A]">{e.descripcion}</p>
                        <p className="text-xs text-[#94A3B8]">{e.categoria} - {new Date(e.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <p className="text-sm font-medium text-red-500">-${Number(e.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )
      )}

      {tab === 'historial' && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0]">
            <h2 className="text-sm font-medium text-[#0F172A]">Historial de cierres</h2>
          </div>
          {historial.length === 0 ? (
            <p className="text-sm text-[#94A3B8] text-center py-8">Sin cierres registrados</p>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {historial.map(h => (
                <div key={h.id}>
                  <button onClick={() => verDetalleHistorial(h.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#F8FAFB] transition-colors text-left">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-[#0F172A]">
                          {new Date(h.fecha_apertura + '').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                        {h.diferencia !== null && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            h.diferencia === 0 ? 'bg-green-50 text-green-600'
                            : h.diferencia > 0 ? 'bg-blue-50 text-blue-600'
                            : 'bg-red-50 text-red-500'
                          }`}>
                            {h.diferencia === 0 ? 'Sin diferencia' : `${h.diferencia > 0 ? '+' : ''}$${h.diferencia.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#94A3B8]">
                        {new Date(h.fecha_apertura).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} - {h.fecha_cierre ? new Date(h.fecha_cierre).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''}
                        {(h.usuario_apertura as any) && ` · ${(h.usuario_apertura as any).nombre} ${(h.usuario_apertura as any).apellido}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-[#00B4D8]">${(h.monto_final_sistema || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                      <p className="text-xs text-[#94A3B8]">efectivo sistema</p>
                    </div>
                    <ChevronDown size={16} className={`text-[#94A3B8] transition-transform ${sesionDetalle === h.id ? 'rotate-180' : ''}`} />
                  </button>
                  {sesionDetalle === h.id && (
                    <div className="px-5 pb-4 bg-[#F8FAFB] border-t border-[#E2E8F0]">
                      <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Efectivo</p>
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm"><span className="text-[#64748B]">Inicial</span><span>${(h.monto_inicial || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-[#64748B]">Sistema</span><span>${(h.monto_final_sistema || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-[#64748B]">Declarado</span><span>${(h.monto_final_declarado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Egresos</p>
                          {egresosHistorial[h.id] ? (
                            egresosHistorial[h.id].length === 0 ? <p className="text-sm text-[#94A3B8]">Sin egresos</p> : (
                              <div className="space-y-1">
                                {egresosHistorial[h.id].map(e => (
                                  <div key={e.id} className="flex justify-between text-sm">
                                    <span className="text-[#64748B] truncate max-w-32">{e.descripcion}</span>
                                    <span className="text-red-500">-${Number(e.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                  </div>
                                ))}
                              </div>
                            )
                          ) : <p className="text-sm text-[#94A3B8]">Cargando...</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {mostrarApertura && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-base font-medium text-[#0F172A]">Abrir caja — {puntoVenta?.nombre}</h2>
              <button onClick={() => setMostrarApertura(false)} className="p-1.5 rounded-lg hover:bg-[#F8FAFB] text-[#64748B]"><X size={18} /></button>
            </div>
            <div className="px-6 py-5">
              <label className="block text-sm text-[#64748B] mb-1.5">Monto inicial en efectivo</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">$</span>
                <input type="number" min={0} step={0.01} value={montoInicial === 0 ? "" : montoInicial} onChange={e => setMontoInicial(Number(e.target.value))}
                  className="w-full h-10 pl-7 pr-3 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setMostrarApertura(false)} className="flex-1 h-10 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] hover:bg-[#F8FAFB] transition-colors">Cancelar</button>
              <button onClick={abrirCaja} className="flex-1 h-10 bg-[#00B4D8] hover:bg-[#0096B4] text-white text-sm font-medium rounded-lg transition-colors">Abrir caja</button>
            </div>
          </div>
        </div>
      )}

      {mostrarEgreso && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-base font-medium text-[#0F172A]">Registrar egreso</h2>
              <button onClick={() => setMostrarEgreso(false)} className="p-1.5 rounded-lg hover:bg-[#F8FAFB] text-[#64748B]"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm text-[#64748B] mb-1.5">Categoria</label>
                <select value={nuevoEgreso.categoria_id} onChange={e => setNuevoEgreso(p => ({ ...p, categoria_id: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:border-[#00B4D8] bg-white">
                  {categoriasEgreso.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#64748B] mb-1.5">Descripcion *</label>
                <input value={nuevoEgreso.descripcion} onChange={e => setNuevoEgreso(p => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Ej: Pago cadete, compra bolsas..."
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#64748B] mb-1.5">Monto *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">$</span>
                  <input type="number" min={0} step={0.01} value={nuevoEgreso.monto === 0 ? "" : nuevoEgreso.monto} onChange={e => setNuevoEgreso(p => ({ ...p, monto: Number(e.target.value) }))}
                    className="w-full h-10 pl-7 pr-3 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setMostrarEgreso(false)} className="flex-1 h-10 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] hover:bg-[#F8FAFB] transition-colors">Cancelar</button>
              <button onClick={agregarEgreso} className="flex-1 h-10 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors">Registrar egreso</button>
            </div>
          </div>
        </div>
      )}

      {mostrarCierre && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-base font-medium text-[#0F172A]">Cerrar caja</h2>
              <button onClick={() => setMostrarCierre(false)} className="p-1.5 rounded-lg hover:bg-[#F8FAFB] text-[#64748B]"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-[#F8FAFB] rounded-xl p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-[#64748B]">Efectivo esperado</span>
                  <span className="font-medium">${resumenEfectivo.saldo_efectivo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-[#64748B] mb-1.5">Efectivo contado</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">$</span>
                  <input type="number" min={0} step={0.01} value={montoCierre === 0 ? "" : montoCierre} onChange={e => setMontoCierre(Number(e.target.value))}
                    className="w-full h-10 pl-7 pr-3 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                  />
                </div>
              </div>
              {montoCierre > 0 && (
                <div className={`flex justify-between text-sm font-medium px-3 py-2 rounded-lg ${
                  montoCierre === resumenEfectivo.saldo_efectivo ? 'bg-green-50 text-green-600'
                  : montoCierre > resumenEfectivo.saldo_efectivo ? 'bg-blue-50 text-blue-600'
                  : 'bg-red-50 text-red-500'
                }`}>
                  <span>Diferencia</span>
                  <span>{montoCierre - resumenEfectivo.saldo_efectivo >= 0 ? '+' : ''}${(montoCierre - resumenEfectivo.saldo_efectivo).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setMostrarCierre(false)} className="flex-1 h-10 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] hover:bg-[#F8FAFB] transition-colors">Cancelar</button>
              <button onClick={cerrarCaja} className="flex-1 h-10 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors">Confirmar cierre</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
