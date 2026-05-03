'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DollarSign, TrendingUp, TrendingDown, CreditCard, Banknote, ArrowRightLeft, BarChart2 } from 'lucide-react'

interface ResumenFinanciero {
  ingresos_mes: number
  egresos_mes: number
  balance_mes: number
  ingresos_hoy: number
  ventas_efectivo: number
  ventas_debito: number
  ventas_credito: number
  ventas_transferencia: number
}

interface MovimientoReciente {
  fecha: string
  tipo: string
  descripcion: string
  monto: number
  medio_pago: string
}

export default function FinanzasPage() {
  const supabase = createClient()
  const [cargando, setCargando] = useState(true)
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [resumen, setResumen] = useState<ResumenFinanciero>({
    ingresos_mes: 0, egresos_mes: 0, balance_mes: 0, ingresos_hoy: 0,
    ventas_efectivo: 0, ventas_debito: 0, ventas_credito: 0, ventas_transferencia: 0,
  })
  const [movimientos, setMovimientos] = useState<MovimientoReciente[]>([])

  const mesesNombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  async function cargarDatos() {
    setCargando(true)

    const hoy = new Date().toISOString().split('T')[0]
    const inicioMes = `${anio}-${mes.toString().padStart(2, '0')}-01`
    const finMes = new Date(anio, mes, 0).toISOString().split('T')[0]

    // Comprobantes del mes (ingresos)
    const { data: comprobantes } = await supabase
      .from('comprobantes')
      .select('total, fecha')
      .eq('estado', 'emitido')
      .in('tipo', ['factura_a', 'factura_b', 'factura_c'])
      .gte('fecha', inicioMes)
      .lte('fecha', finMes)

    const ingresosMes = comprobantes?.reduce((a, c) => a + Number(c.total), 0) || 0
    const ingresosHoy = comprobantes?.filter(c => c.fecha === hoy).reduce((a, c) => a + Number(c.total), 0) || 0

    // Pagos a proveedores del mes (egresos)
    const { data: pagos } = await supabase
      .from('pagos_proveedor')
      .select('monto, fecha, medio_pago, concepto, proveedores(razon_social)')
      .gte('fecha', inicioMes)
      .lte('fecha', finMes)

    const egresosMes = pagos?.reduce((a, p) => a + Number(p.monto), 0) || 0

    // Ventas por medio de pago — traer pagos de comprobantes del mes
    const idsComp = comprobantes?.map((_, i) => i) || []
    
    // Buscar todos los comprobantes del mes para obtener sus pagos
    const { data: compIds } = await supabase
      .from('comprobantes')
      .select('id')
      .eq('estado', 'emitido')
      .in('tipo', ['factura_a', 'factura_b', 'factura_c'])
      .gte('fecha', inicioMes)
      .lte('fecha', finMes)

    let ventasPorMedio = { efectivo: 0, debito: 0, credito: 0, transferencia: 0 }

    if (compIds && compIds.length > 0) {
      const { data: pagosComp } = await supabase
        .from('pagos_comprobante')
        .select('medio_pago, monto')
        .in('comprobante_id', compIds.map(c => c.id))

      pagosComp?.forEach(p => {
        if (p.medio_pago in ventasPorMedio) {
          ventasPorMedio[p.medio_pago as keyof typeof ventasPorMedio] += Number(p.monto)
        }
      })
    }

    setResumen({
      ingresos_mes:         ingresosMes,
      egresos_mes:          egresosMes,
      balance_mes:          ingresosMes - egresosMes,
      ingresos_hoy:         ingresosHoy,
      ventas_efectivo:      ventasPorMedio.efectivo,
      ventas_debito:        ventasPorMedio.debito,
      ventas_credito:       ventasPorMedio.credito,
      ventas_transferencia: ventasPorMedio.transferencia,
    })

    // Movimientos recientes: ventas + pagos a proveedores
    const movs: MovimientoReciente[] = []

    comprobantes?.forEach(c => {
      movs.push({
        fecha:       c.fecha,
        tipo:        'ingreso',
        descripcion: 'Venta',
        monto:       Number(c.total),
        medio_pago:  '',
      })
    })

    pagos?.forEach((p: any) => {
      movs.push({
        fecha:       p.fecha,
        tipo:        'egreso',
        descripcion: `Pago a ${p.proveedores?.razon_social || 'proveedor'} — ${p.concepto || ''}`,
        monto:       Number(p.monto),
        medio_pago:  p.medio_pago,
      })
    })

    movs.sort((a, b) => b.fecha.localeCompare(a.fecha))
    setMovimientos(movs.slice(0, 30))
    setCargando(false)
  }

  useEffect(() => { cargarDatos() }, [mes, anio])

  const mediosPago = [
    { label: 'Efectivo',      valor: resumen.ventas_efectivo,      icon: Banknote,       color: 'text-green-500'  },
    { label: 'Débito',        valor: resumen.ventas_debito,        icon: CreditCard,     color: 'text-blue-500'   },
    { label: 'Crédito',       valor: resumen.ventas_credito,       icon: CreditCard,     color: 'text-purple-500' },
    { label: 'Transferencia', valor: resumen.ventas_transferencia, icon: ArrowRightLeft, color: 'text-orange-500' },
  ]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-[#0F172A]">Finanzas</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Ingresos, egresos y balance</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={mes} onChange={e => setMes(Number(e.target.value))}
            className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] focus:outline-none focus:border-[#00B4D8] bg-white">
            {mesesNombres.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select value={anio} onChange={e => setAnio(Number(e.target.value))}
            className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] focus:outline-none focus:border-[#00B4D8] bg-white">
            {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* Tarjetas principales */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-[#64748B]">Ingresos del mes</p>
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <TrendingUp size={16} className="text-green-500" />
            </div>
          </div>
          <p className="text-2xl font-medium text-green-500">
            ${resumen.ingresos_mes.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-[#64748B]">Egresos del mes</p>
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <TrendingDown size={16} className="text-red-500" />
            </div>
          </div>
          <p className="text-2xl font-medium text-red-500">
            ${resumen.egresos_mes.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className={`bg-white rounded-xl border p-5 ${resumen.balance_mes >= 0 ? 'border-green-200' : 'border-red-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-[#64748B]">Balance del mes</p>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${resumen.balance_mes >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <BarChart2 size={16} className={resumen.balance_mes >= 0 ? 'text-green-500' : 'text-red-500'} />
            </div>
          </div>
          <p className={`text-2xl font-medium ${resumen.balance_mes >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {resumen.balance_mes >= 0 ? '+' : ''}${resumen.balance_mes.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-[#64748B]">Ventas hoy</p>
            <div className="w-8 h-8 rounded-lg bg-[#E0F7FC] flex items-center justify-center">
              <DollarSign size={16} className="text-[#00B4D8]" />
            </div>
          </div>
          <p className="text-2xl font-medium text-[#00B4D8]">
            ${resumen.ingresos_hoy.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Medios de pago */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
        <h2 className="text-sm font-medium text-[#0F172A] mb-4">Ventas por medio de pago — {mesesNombres[mes-1]} {anio}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {mediosPago.map(m => {
            const Icon = m.icon
            const pct = resumen.ingresos_mes > 0 ? (m.valor / resumen.ingresos_mes * 100) : 0
            return (
              <div key={m.label} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon size={15} className={m.color} />
                  <span className="text-sm text-[#64748B]">{m.label}</span>
                </div>
                <p className={`text-lg font-medium ${m.color}`}>
                  ${m.valor.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
                <div className="w-full bg-[#F1F5F9] rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-[#00B4D8] transition-all"
                    style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-[#94A3B8]">{pct.toFixed(1)}% del total</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Movimientos recientes */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-sm font-medium text-[#0F172A]">Movimientos — {mesesNombres[mes-1]} {anio}</h2>
        </div>
        {cargando ? (
          <p className="text-sm text-[#94A3B8] text-center py-8">Cargando...</p>
        ) : movimientos.length === 0 ? (
          <p className="text-sm text-[#94A3B8] text-center py-8">Sin movimientos en este período</p>
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {movimientos.map((m, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  m.tipo === 'ingreso' ? 'bg-green-50' : 'bg-red-50'
                }`}>
                  {m.tipo === 'ingreso'
                    ? <TrendingUp size={14} className="text-green-500" />
                    : <TrendingDown size={14} className="text-red-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#0F172A] truncate">{m.descripcion}</p>
                  <p className="text-xs text-[#94A3B8]">
                    {new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-AR')}
                    {m.medio_pago && ` · ${m.medio_pago}`}
                  </p>
                </div>
                <p className={`text-sm font-medium shrink-0 ${
                  m.tipo === 'ingreso' ? 'text-green-500' : 'text-red-500'
                }`}>
                  {m.tipo === 'ingreso' ? '+' : '-'}${m.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
