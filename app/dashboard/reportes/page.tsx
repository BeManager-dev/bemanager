'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart2, TrendingUp, Package, Users, DollarSign, ShoppingCart } from 'lucide-react'

interface VentaMensual { mes: string; total: number; cantidad: number }
interface ProductoTop { nombre: string; cantidad: number; total: number }
interface ClienteTop { razon_social: string; total_compras: number; monto_total: number }
interface ResumenGeneral { ventas_hoy: number; ventas_mes: number; ticket_promedio: number; compras_mes: number }

export default function ReportesPage() {
  const supabase = createClient()
  const [cargando, setCargando] = useState(true)
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [resumen, setResumen] = useState<ResumenGeneral>({ ventas_hoy: 0, ventas_mes: 0, ticket_promedio: 0, compras_mes: 0 })
  const [ventasMensuales, setVentasMensuales] = useState<VentaMensual[]>([])
  const [productosTop, setProductosTop] = useState<ProductoTop[]>([])
  const [clientesTop, setClientesTop] = useState<ClienteTop[]>([])

  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

  async function cargarDatos() {
    setCargando(true)
    const hoy = new Date()
    const hoyStr = hoy.toISOString().split('T')[0]
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]
    const inicioAnio = `${anio}-01-01`
    const finAnio = `${anio}-12-31`

    // Comprobantes del año
    const { data: comprobantes } = await supabase
      .from('comprobantes')
      .select('id, fecha, total, cliente_id')
      .eq('estado', 'emitido')
      .in('tipo', ['factura_a', 'factura_b', 'factura_c'])
      .gte('fecha', inicioAnio)
      .lte('fecha', finAnio)

    if (comprobantes) {
      const ventasHoy = comprobantes.filter(c => c.fecha === hoyStr).reduce((a, c) => a + Number(c.total), 0)
      const compMes = comprobantes.filter(c => c.fecha >= inicioMes)
      const ventasMes = compMes.reduce((a, c) => a + Number(c.total), 0)
      const cantMes = compMes.length
      setResumen({
        ventas_hoy: ventasHoy,
        ventas_mes: ventasMes,
        ticket_promedio: cantMes > 0 ? ventasMes / cantMes : 0,
        compras_mes: cantMes,
      })

      // Ventas por mes
      const porMes: Record<number, { total: number; cantidad: number }> = {}
      for (let i = 1; i <= 12; i++) porMes[i] = { total: 0, cantidad: 0 }
      comprobantes.forEach(c => {
        const mes = new Date(c.fecha + 'T00:00:00').getMonth() + 1
        porMes[mes].total += Number(c.total)
        porMes[mes].cantidad++
      })
      setVentasMensuales(
        Object.entries(porMes).map(([mes, data]) => ({
          mes: meses[Number(mes) - 1],
          total: data.total,
          cantidad: data.cantidad,
        }))
      )

      // Top clientes — con los comprobantes que tienen cliente_id
      const idsComprobantes = comprobantes.map(c => c.id)
      if (idsComprobantes.length > 0) {
        const compConCliente = comprobantes.filter(c => c.cliente_id)
        if (compConCliente.length > 0) {
          const clienteIds = [...new Set(compConCliente.map(c => c.cliente_id!))]
          const { data: clientes } = await supabase
            .from('clientes')
            .select('id, razon_social')
            .in('id', clienteIds)

          const clienteMap: Record<string, string> = {}
          clientes?.forEach(c => { clienteMap[c.id] = c.razon_social })

          const stats: Record<string, { razon_social: string; total_compras: number; monto_total: number }> = {}
          compConCliente.forEach(c => {
            if (!c.cliente_id) return
            if (!stats[c.cliente_id]) stats[c.cliente_id] = { razon_social: clienteMap[c.cliente_id] || '—', total_compras: 0, monto_total: 0 }
            stats[c.cliente_id].total_compras++
            stats[c.cliente_id].monto_total += Number(c.total)
          })
          setClientesTop(Object.values(stats).sort((a, b) => b.monto_total - a.monto_total).slice(0, 10))
        } else {
          setClientesTop([])
        }

        // Top productos — traer items de los comprobantes del año
        const { data: items } = await supabase
          .from('items_comprobante')
          .select('descripcion, cantidad, subtotal')
          .in('comprobante_id', idsComprobantes)

        if (items) {
          const prodMap: Record<string, { cantidad: number; total: number }> = {}
          items.forEach(item => {
            if (!prodMap[item.descripcion]) prodMap[item.descripcion] = { cantidad: 0, total: 0 }
            prodMap[item.descripcion].cantidad += Number(item.cantidad)
            prodMap[item.descripcion].total += Number(item.subtotal)
          })
          setProductosTop(
            Object.entries(prodMap)
              .map(([nombre, data]) => ({ nombre, ...data }))
              .sort((a, b) => b.total - a.total)
              .slice(0, 10)
          )
        }
      }
    }

    setCargando(false)
  }

  useEffect(() => { cargarDatos() }, [anio])

  const maxVenta = Math.max(...ventasMensuales.map(v => v.total), 1)

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-[#0F172A]">Reportes</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Resumen de ventas y métricas</p>
        </div>
        <select value={anio} onChange={e => setAnio(Number(e.target.value))}
          className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] focus:outline-none focus:border-[#00B4D8] bg-white">
          {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Tarjetas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Ventas hoy',      valor: resumen.ventas_hoy,       icon: ShoppingCart, prefix: '$', color: 'text-[#00B4D8]'  },
          { label: 'Ventas este mes', valor: resumen.ventas_mes,       icon: TrendingUp,   prefix: '$', color: 'text-green-500'  },
          { label: 'Ticket promedio', valor: resumen.ticket_promedio,  icon: DollarSign,   prefix: '$', color: 'text-purple-500' },
          { label: 'Ventas del mes',  valor: resumen.compras_mes,      icon: Package,      prefix: '',  color: 'text-orange-500' },
        ].map(card => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white rounded-xl border border-[#E2E8F0] p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-[#64748B]">{card.label}</p>
                <div className="w-8 h-8 rounded-lg bg-[#F8FAFB] flex items-center justify-center">
                  <Icon size={16} className={card.color} />
                </div>
              </div>
              <p className={`text-2xl font-medium ${card.color}`}>
                {card.prefix}{card.valor.toLocaleString('es-AR', {
                  minimumFractionDigits: card.prefix === '$' ? 2 : 0,
                  maximumFractionDigits: card.prefix === '$' ? 2 : 0,
                })}
              </p>
            </div>
          )
        })}
      </div>

      {/* Gráfico ventas mensuales */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
        <div className="flex items-center gap-2 mb-6">
          <BarChart2 size={18} className="text-[#00B4D8]" />
          <h2 className="text-sm font-medium text-[#0F172A]">Ventas mensuales {anio}</h2>
        </div>
        {cargando ? (
          <div className="h-48 flex items-center justify-center text-sm text-[#94A3B8]">Cargando...</div>
        ) : (
          <div className="flex items-end gap-2 h-48">
            {ventasMensuales.map((v, i) => {
              const altura = (v.total / maxVenta) * 100
              const esActual = i === new Date().getMonth() && anio === new Date().getFullYear()
              return (
                <div key={v.mes} className="flex-1 flex flex-col items-center gap-1 group relative">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top productos */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E2E8F0]">
            <Package size={16} className="text-[#00B4D8]" />
            <h2 className="text-sm font-medium text-[#0F172A]">Productos más vendidos</h2>
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
                  <p className="text-sm font-medium text-[#00B4D8]">
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
            <p className="text-sm text-[#94A3B8] text-center py-8">Sin ventas con cliente asignado aún</p>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {clientesTop.map((c, i) => (
                <div key={c.razon_social} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-xs font-medium text-[#94A3B8] w-5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#0F172A] truncate">{c.razon_social}</p>
                    <p className="text-xs text-[#94A3B8]">{c.total_compras} {c.total_compras === 1 ? 'compra' : 'compras'}</p>
                  </div>
                  <p className="text-sm font-medium text-[#00B4D8]">
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
