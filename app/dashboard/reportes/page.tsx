'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp, TrendingDown, Package, Users, DollarSign, ShoppingCart } from 'lucide-react'

interface VentaMensual { mes: string; anio: number; total: number; cantidad: number }
interface ProductoTop { nombre: string; cantidad: number; total: number }
interface ClienteTop { razon_social: string; total_compras: number; monto_total: number }

const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const ANOS = [2024, 2025, 2026, 2027]

function getFechasMes(anio: number, mes: number) {
  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
  const hasta = new Date(anio, mes, 0).toISOString().split('T')[0]
  return { desde, hasta }
}

export default function DashboardPage() {
  const supabase = createClient()
  const hoy = new Date()

  // Periodo comparativo A (principal)
  const [anioA, setAnioA] = useState(hoy.getFullYear())
  const [mesA, setMesA] = useState(hoy.getMonth() + 1)

  // Periodo comparativo B
  const [anioB, setAnioB] = useState(hoy.getFullYear() - 1)
  const [mesB, setMesB] = useState(hoy.getMonth() + 1)

  const [cargando, setCargando] = useState(true)
  const [ventasMensuales, setVentasMensuales] = useState<VentaMensual[]>([])
  const [resumenA, setResumenA] = useState({ ventas: 0, cantidad: 0, costos: 0, egresos: 0 })
  const [resumenB, setResumenB] = useState({ ventas: 0, cantidad: 0, costos: 0, egresos: 0 })
  const [productosTop, setProductosTop] = useState<ProductoTop[]>([])
  const [clientesTop, setClientesTop] = useState<ClienteTop[]>([])

  // Genera los últimos 12 meses móviles terminando en el mes actual
  function ultimos12Meses() {
    const meses = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
      meses.push({ mes: d.getMonth() + 1, anio: d.getFullYear(), label: MESES_CORTOS[d.getMonth()] })
    }
    return meses
  }

  async function getResumenPeriodo(anio: number, mes: number) {
    const { desde, hasta } = getFechasMes(anio, mes)

    const { data: comprobantes } = await supabase
      .from('comprobantes').select('id, total')
      .eq('estado', 'emitido').in('tipo', ['factura_a', 'factura_b', 'factura_c'])
      .gte('fecha', desde).lte('fecha', hasta)

    const ventas = comprobantes?.reduce((a, c) => a + Number(c.total), 0) || 0
    const cantidad = comprobantes?.length || 0

    const { data: costosData } = await supabase.from('costos')
      .select('monto').gte('fecha', desde).lte('fecha', hasta)
    const costos = costosData?.reduce((a, c) => a + Number(c.monto), 0) || 0

    const { data: sesiones } = await supabase.from('sesiones_caja').select('id')
      .gte('fecha_apertura', desde + 'T00:00:00').lte('fecha_apertura', hasta + 'T23:59:59')
    let egresos = 0
    if (sesiones && sesiones.length > 0) {
      const { data: egresosData } = await supabase.from('egresos_caja').select('monto')
        .in('sesion_caja_id', sesiones.map(s => s.id))
      egresos = egresosData?.reduce((a, e) => a + Number(e.monto), 0) || 0
    }

    return { ventas, cantidad, costos, egresos }
  }

  async function cargarDatos() {
    setCargando(true)

    // Últimos 12 meses para el gráfico
    const meses12 = ultimos12Meses()
    const ventasPorMes: VentaMensual[] = []

    for (const m of meses12) {
      const { desde, hasta } = getFechasMes(m.anio, m.mes)
      const { data: comps } = await supabase
        .from('comprobantes').select('total')
        .eq('estado', 'emitido').in('tipo', ['factura_a', 'factura_b', 'factura_c'])
        .gte('fecha', desde).lte('fecha', hasta)
      ventasPorMes.push({
        mes: m.label, anio: m.anio,
        total: comps?.reduce((a, c) => a + Number(c.total), 0) || 0,
        cantidad: comps?.length || 0,
      })
    }
    setVentasMensuales(ventasPorMes)

    // Resúmenes comparativos
    const [rA, rB] = await Promise.all([
      getResumenPeriodo(anioA, mesA),
      getResumenPeriodo(anioB, mesB),
    ])
    setResumenA(rA)
    setResumenB(rB)

    // Top productos (año actual)
    const inicioAnio = `${hoy.getFullYear()}-01-01`
    const { data: compIds } = await supabase.from('comprobantes').select('id')
      .eq('estado', 'emitido').in('tipo', ['factura_a', 'factura_b', 'factura_c'])
      .gte('fecha', inicioAnio)

    if (compIds && compIds.length > 0) {
      const { data: items } = await supabase.from('items_comprobante')
        .select('descripcion, cantidad, subtotal')
        .in('comprobante_id', compIds.map(c => c.id))

      const prodMap: Record<string, { cantidad: number; total: number }> = {}
      items?.forEach(item => {
        if (!prodMap[item.descripcion]) prodMap[item.descripcion] = { cantidad: 0, total: 0 }
        prodMap[item.descripcion].cantidad += Number(item.cantidad)
        prodMap[item.descripcion].total += Number(item.subtotal)
      })
      setProductosTop(
        Object.entries(prodMap).map(([nombre, data]) => ({ nombre, ...data }))
          .sort((a, b) => b.total - a.total).slice(0, 10)
      )
    }

    // Top clientes (año actual)
    const { data: compClientes } = await supabase.from('comprobantes')
      .select('cliente_id, total, clientes(razon_social)')
      .eq('estado', 'emitido').in('tipo', ['factura_a', 'factura_b', 'factura_c'])
      .gte('fecha', inicioAnio).not('cliente_id', 'is', null)

    if (compClientes) {
      const clienteMap: Record<string, { razon_social: string; total_compras: number; monto_total: number }> = {}
      compClientes.forEach((c: any) => {
        if (!c.cliente_id) return
        if (!clienteMap[c.cliente_id]) clienteMap[c.cliente_id] = { razon_social: c.clientes?.razon_social || '—', total_compras: 0, monto_total: 0 }
        clienteMap[c.cliente_id].total_compras++
        clienteMap[c.cliente_id].monto_total += Number(c.total)
      })
      setClientesTop(Object.values(clienteMap).sort((a, b) => b.monto_total - a.monto_total).slice(0, 10))
    }

    setCargando(false)
  }

  useEffect(() => { cargarDatos() }, [anioA, mesA, anioB, mesB])

  const maxVenta = Math.max(...ventasMensuales.map(v => v.total), 1)

  function pctCambio(actual: number, anterior: number) {
    if (anterior === 0) return actual > 0 ? 100 : 0
    return ((actual - anterior) / anterior * 100)
  }

  const diffVentas   = pctCambio(resumenA.ventas, resumenB.ventas)
  const diffCantidad = pctCambio(resumenA.cantidad, resumenB.cantidad)
  const totalEgresosA = resumenA.costos + resumenA.egresos
  const totalEgresosB = resumenB.costos + resumenB.egresos
  const balanceA = resumenA.ventas - totalEgresosA
  const balanceB = resumenB.ventas - totalEgresosB

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-medium text-[#0F172A]">Dashboard</h1>
        <p className="text-sm text-[#64748B] mt-0.5">Resumen general del negocio</p>
      </div>

      {/* Comparativo de periodos */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <h2 className="text-sm font-medium text-[#0F172A]">Comparativo de periodos</h2>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748B] font-medium">Periodo A:</span>
              <select value={mesA} onChange={e => setMesA(Number(e.target.value))}
                className="h-8 px-2 rounded-lg border border-[#E2E8F0] text-xs text-[#64748B] focus:outline-none focus:border-[#00B4D8] bg-white">
                {MESES_CORTOS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
              <select value={anioA} onChange={e => setAnioA(Number(e.target.value))}
                className="h-8 px-2 rounded-lg border border-[#E2E8F0] text-xs text-[#64748B] focus:outline-none focus:border-[#00B4D8] bg-white">
                {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <span className="text-xs text-[#94A3B8]">vs</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748B] font-medium">Periodo B:</span>
              <select value={mesB} onChange={e => setMesB(Number(e.target.value))}
                className="h-8 px-2 rounded-lg border border-[#E2E8F0] text-xs text-[#64748B] focus:outline-none focus:border-[#00B4D8] bg-white">
                {MESES_CORTOS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
              <select value={anioB} onChange={e => setAnioB(Number(e.target.value))}
                className="h-8 px-2 rounded-lg border border-[#E2E8F0] text-xs text-[#64748B] focus:outline-none focus:border-[#00B4D8] bg-white">
                {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
        </div>

        {cargando ? (
          <p className="text-sm text-[#94A3B8] text-center py-4">Cargando...</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Ventas */}
            <div className="bg-[#F8FAFB] rounded-xl p-4">
              <p className="text-xs text-[#64748B] mb-3 flex items-center gap-1.5">
                <ShoppingCart size={13} /> Ventas
              </p>
              <p className="text-lg font-medium text-green-500">${resumenA.ventas.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-[#94A3B8] mt-0.5">vs ${resumenB.ventas.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
              <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${diffVentas >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {diffVentas >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {diffVentas >= 0 ? '+' : ''}{diffVentas.toFixed(1)}%
              </div>
            </div>

            {/* Cantidad */}
            <div className="bg-[#F8FAFB] rounded-xl p-4">
              <p className="text-xs text-[#64748B] mb-3 flex items-center gap-1.5">
                <Package size={13} /> Cantidad ventas
              </p>
              <p className="text-lg font-medium text-[#00B4D8]">{resumenA.cantidad}</p>
              <p className="text-xs text-[#94A3B8] mt-0.5">vs {resumenB.cantidad}</p>
              <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${diffCantidad >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {diffCantidad >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {diffCantidad >= 0 ? '+' : ''}{diffCantidad.toFixed(1)}%
              </div>
            </div>

            {/* Egresos + costos */}
            <div className="bg-[#F8FAFB] rounded-xl p-4">
              <p className="text-xs text-[#64748B] mb-3 flex items-center gap-1.5">
                <TrendingDown size={13} /> Egresos + Costos
              </p>
              <p className="text-lg font-medium text-red-500">${totalEgresosA.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-[#94A3B8] mt-0.5">vs ${totalEgresosB.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
              <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${totalEgresosA <= totalEgresosB ? 'text-green-500' : 'text-red-500'}`}>
                {totalEgresosA <= totalEgresosB ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                {pctCambio(totalEgresosA, totalEgresosB) >= 0 ? '+' : ''}{pctCambio(totalEgresosA, totalEgresosB).toFixed(1)}%
              </div>
            </div>

            {/* Balance */}
            <div className="bg-[#F8FAFB] rounded-xl p-4">
              <p className="text-xs text-[#64748B] mb-3 flex items-center gap-1.5">
                <DollarSign size={13} /> Balance
              </p>
              <p className={`text-lg font-medium ${balanceA >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {balanceA < 0 ? '-' : ''}${Math.abs(balanceA).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-[#94A3B8] mt-0.5">vs ${balanceB.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
              <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${pctCambio(balanceA, balanceB) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {pctCambio(balanceA, balanceB) >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {pctCambio(balanceA, balanceB) >= 0 ? '+' : ''}{pctCambio(balanceA, balanceB).toFixed(1)}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Gráfico 12 meses móviles */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
        <h2 className="text-sm font-medium text-[#0F172A] mb-6">Ventas — ultimos 12 meses</h2>
        {cargando ? (
          <div className="h-48 flex items-center justify-center text-sm text-[#94A3B8]">Cargando...</div>
        ) : (
          <div className="flex items-end gap-2 h-48">
            {ventasMensuales.map((v, i) => {
              const altura = (v.total / maxVenta) * 100
              const esActual = i === 11
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  {v.total > 0 && (
                    <div className="absolute bottom-full mb-2 bg-[#0F172A] text-white text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                      ${v.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      <br />{v.cantidad} {v.cantidad === 1 ? 'venta' : 'ventas'}
                    </div>
                  )}
                  <div className="w-full rounded-t-md transition-all duration-300"
                    style={{
                      height: `${Math.max(altura, v.total > 0 ? 4 : 0)}%`,
                      backgroundColor: esActual ? '#00B4D8' : '#E0F7FC',
                      minHeight: v.total > 0 ? '4px' : '0'
                    }}
                  />
                  <span className={`text-xs ${esActual ? 'text-[#00B4D8] font-medium' : 'text-[#94A3B8]'}`}>
                    {v.mes}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Ingresos vs Egresos visual */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
        <h2 className="text-sm font-medium text-[#0F172A] mb-4">Ingresos vs Costos — {MESES_CORTOS[mesA-1]} {anioA}</h2>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-green-600 font-medium">Ingresos</span>
              <span className="text-green-600 font-medium">${resumenA.ventas.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="w-full bg-[#F1F5F9] rounded-full h-3">
              <div className="h-3 rounded-full bg-green-400 transition-all"
                style={{ width: resumenA.ventas + totalEgresosA > 0 ? `${(resumenA.ventas / (resumenA.ventas + totalEgresosA)) * 100}%` : '0%' }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-red-500 font-medium">Egresos de caja</span>
              <span className="text-red-500 font-medium">${resumenA.egresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="w-full bg-[#F1F5F9] rounded-full h-3">
              <div className="h-3 rounded-full bg-red-400 transition-all"
                style={{ width: resumenA.ventas + totalEgresosA > 0 ? `${(resumenA.egresos / (resumenA.ventas + totalEgresosA)) * 100}%` : '0%' }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-red-500 font-medium">Costos</span>
              <span className="text-red-500 font-medium">${resumenA.costos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="w-full bg-[#F1F5F9] rounded-full h-3">
              <div className="h-3 rounded-full bg-red-300 transition-all"
                style={{ width: resumenA.ventas + totalEgresosA > 0 ? `${(resumenA.costos / (resumenA.ventas + totalEgresosA)) * 100}%` : '0%' }} />
            </div>
          </div>
          <div className={`flex justify-between text-sm font-medium pt-2 border-t border-[#E2E8F0] ${balanceA >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            <span>Balance</span>
            <span>{balanceA < 0 ? '-' : ''}${Math.abs(balanceA).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top productos */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E2E8F0]">
            <Package size={16} className="text-[#00B4D8]" />
            <h2 className="text-sm font-medium text-[#0F172A]">Productos mas vendidos</h2>
          </div>
          {cargando ? (
            <p className="text-sm text-[#94A3B8] text-center py-8">Cargando...</p>
          ) : productosTop.length === 0 ? (
            <p className="text-sm text-[#94A3B8] text-center py-8">Sin ventas registradas</p>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {productosTop.map((p, i) => (
                <div key={p.nombre} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-xs font-medium text-[#94A3B8] w-5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#0F172A] truncate">{p.nombre}</p>
                    <p className="text-xs text-[#94A3B8]">{p.cantidad} unidades</p>
                  </div>
                  <p className="text-sm font-medium text-green-500">
                    ${p.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top clientes */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E2E8F0]">
            <Users size={16} className="text-[#00B4D8]" />
            <h2 className="text-sm font-medium text-[#0F172A]">Mejores clientes</h2>
          </div>
          {cargando ? (
            <p className="text-sm text-[#94A3B8] text-center py-8">Cargando...</p>
          ) : clientesTop.length === 0 ? (
            <p className="text-sm text-[#94A3B8] text-center py-8">Sin ventas con cliente asignado</p>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {clientesTop.map((c, i) => (
                <div key={c.razon_social} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-xs font-medium text-[#94A3B8] w-5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#0F172A] truncate">{c.razon_social}</p>
                    <p className="text-xs text-[#94A3B8]">{c.total_compras} {c.total_compras === 1 ? 'compra' : 'compras'}</p>
                  </div>
                  <p className="text-sm font-medium text-green-500">
                    ${c.monto_total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
