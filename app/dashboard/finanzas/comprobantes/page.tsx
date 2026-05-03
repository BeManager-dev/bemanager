'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, ChevronDown, FileText, FileQuestion } from 'lucide-react'
import React from 'react'

interface Comprobante {
  id: string
  tipo: string
  numero: number
  fecha: string
  total: number
  estado: string
  clientes: { razon_social: string } | null
  puntos_venta: { nombre: string } | null
}

interface Cotizacion {
  id: string
  numero: number
  fecha: string
  total: number
  estado: string
  clientes: { razon_social: string } | null
  puntos_venta: { nombre: string } | null
}

interface ItemDetalle {
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

const POR_PAGINA = 50

const LABEL_TIPO: Record<string, string> = {
  factura_a: 'Factura A', factura_b: 'Factura B', factura_c: 'Factura C',
  nota_credito_a: 'NC A', nota_credito_b: 'NC B', nota_credito_c: 'NC C',
  nota_debito_a: 'ND A', nota_debito_b: 'ND B', nota_debito_c: 'ND C',
}

function badgeEstado(estado: string) {
  const map: Record<string, string> = {
    emitido: 'bg-green-50 text-green-600',
    pendiente: 'bg-yellow-50 text-yellow-600',
    anulado: 'bg-red-50 text-red-500',
    aceptada: 'bg-[#E0F7FC] text-[#00B4D8]',
    rechazada: 'bg-red-50 text-red-500',
    facturada: 'bg-purple-50 text-purple-600',
    vencida: 'bg-gray-100 text-gray-500',
    borrador: 'bg-gray-100 text-gray-500',
  }
  return map[estado] || 'bg-gray-100 text-gray-500'
}

export default function ComprobantesPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'facturas' | 'cotizaciones'>('facturas')
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([])
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [detalle, setDetalle] = useState<string | null>(null)
  const [items, setItems] = useState<Record<string, ItemDetalle[]>>({})

  async function cargarComprobantes() {
    setCargando(true)
    let query = supabase
      .from('comprobantes')
      .select('id, tipo, numero, fecha, total, estado, clientes(razon_social), puntos_venta(nombre)', { count: 'exact' })
      .order('fecha', { ascending: false })
      .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)
    if (filtroTipo) query = query.eq('tipo', filtroTipo)
    if (filtroEstado) query = query.eq('estado', filtroEstado)
    const { data, count } = await query
    setComprobantes((data as any) || [])
    setTotal(count || 0)
    setCargando(false)
  }

  async function cargarCotizaciones() {
    setCargando(true)
    let query = supabase
      .from('cotizaciones')
      .select('id, numero, fecha, total, estado, clientes(razon_social), puntos_venta(nombre)', { count: 'exact' })
      .order('fecha', { ascending: false })
      .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)
    if (filtroEstado) query = query.eq('estado', filtroEstado)
    const { data, count } = await query
    setCotizaciones((data as any) || [])
    setTotal(count || 0)
    setCargando(false)
  }

  useEffect(() => {
    if (tab === 'facturas') cargarComprobantes()
    else cargarCotizaciones()
  }, [tab, pagina, filtroTipo, filtroEstado])

  const totalPaginas = Math.ceil(total / POR_PAGINA)

  async function verDetalle(id: string, esCotizacion: boolean) {
    if (detalle === id) { setDetalle(null); return }
    setDetalle(id)
    if (!items[id]) {
      const tabla = esCotizacion ? 'items_cotizacion' : 'items_comprobante'
      const campo = esCotizacion ? 'cotizacion_id' : 'comprobante_id'
      const { data } = await supabase.from(tabla).select('descripcion, cantidad, precio_unitario, subtotal').eq(campo, id)
      setItems(prev => ({ ...prev, [id]: data || [] }))
    }
  }

  const lista = tab === 'facturas' ? comprobantes : cotizaciones

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-[#0F172A]">Comprobantes</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{total} registros</p>
        </div>
      </div>

      <div className="flex gap-1 bg-[#F8FAFB] rounded-xl p-1 border border-[#E2E8F0] w-fit">
        {[
          { id: 'facturas',     label: 'Facturas',     icon: FileText     },
          { id: 'cotizaciones', label: 'Cotizaciones', icon: FileQuestion },
        ].map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => { setTab(t.id as any); setPagina(1); setDetalle(null) }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-white text-[#0F172A] shadow-sm border border-[#E2E8F0]' : 'text-[#64748B] hover:text-[#0F172A]'
              }`}>
              <Icon size={15} />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex flex-wrap gap-3">
          {tab === 'facturas' && (
            <select value={filtroTipo} onChange={e => { setFiltroTipo(e.target.value); setPagina(1) }}
              className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] focus:outline-none focus:border-[#00B4D8] bg-white">
              <option value="">Todos los tipos</option>
              <option value="factura_a">Factura A</option>
              <option value="factura_b">Factura B</option>
              <option value="factura_c">Factura C</option>
              <option value="nota_credito_a">Nota Credito A</option>
              <option value="nota_credito_b">Nota Credito B</option>
              <option value="nota_credito_c">Nota Credito C</option>
              <option value="nota_debito_a">Nota Debito A</option>
              <option value="nota_debito_b">Nota Debito B</option>
              <option value="nota_debito_c">Nota Debito C</option>
            </select>
          )}
          <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPagina(1) }}
            className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] focus:outline-none focus:border-[#00B4D8] bg-white">
            <option value="">Todos los estados</option>
            {tab === 'facturas' ? (
              <>
                <option value="emitido">Emitido</option>
                <option value="pendiente">Pendiente</option>
                <option value="anulado">Anulado</option>
              </>
            ) : (
              <>
                <option value="aceptada">Aceptada</option>
                <option value="borrador">Borrador</option>
                <option value="rechazada">Rechazada</option>
                <option value="vencida">Vencida</option>
                <option value="facturada">Facturada</option>
              </>
            )}
          </select>
          {(filtroTipo || filtroEstado) && (
            <button onClick={() => { setFiltroTipo(''); setFiltroEstado(''); setPagina(1) }}
              className="h-9 px-3 rounded-lg text-sm text-[#94A3B8] hover:text-[#64748B] transition-colors">
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFB]">
              <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">N</th>
              <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">Tipo</th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Fecha</th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Cliente</th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Sucursal</th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Total</th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {cargando ? (
              <tr><td colSpan={8} className="text-center py-12 text-sm text-[#94A3B8]">Cargando...</td></tr>
            ) : lista.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-sm text-[#94A3B8]">Sin registros</td></tr>
            ) : (
              lista.map((c: any) => (
                  <React.Fragment key={c.id}>
                  <tr key={c.id} className="hover:bg-[#F8FAFB] transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-mono font-medium text-[#0F172A]">{String(c.numero).padStart(8, '0')}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[#64748B]">{tab === 'facturas' ? LABEL_TIPO[c.tipo] : 'Cotizacion'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-sm text-[#64748B]">{new Date(c.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-sm text-[#64748B]">{c.clientes?.razon_social || 'Consumidor final'}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-sm text-[#64748B]">{c.puntos_venta?.nombre || 'Sin asignar'}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-sm font-medium text-[#0F172A]">${Number(c.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${badgeEstado(c.estado)}`}>{c.estado}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => verDetalle(c.id, tab === 'cotizaciones')}
                        className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] transition-colors">
                        <ChevronDown size={15} className={`transition-transform ${detalle === c.id ? 'rotate-180' : ''}`} />
                      </button>
                    </td>
                  </tr>
                  {detalle === c.id && (
                    <tr key={c.id + '-det'}>
                      <td colSpan={8} className="px-8 py-3 bg-[#F8FAFB] border-t border-[#E2E8F0]">
                        {items[c.id] ? (
                          items[c.id].length === 0 ? (
                            <p className="text-sm text-[#94A3B8]">Sin items</p>
                          ) : (
                            <table className="w-full">
                              <thead>
                                <tr>
                                  <th className="text-left text-xs text-[#94A3B8] pb-2">Producto</th>
                                  <th className="text-right text-xs text-[#94A3B8] pb-2">Cant.</th>
                                  <th className="text-right text-xs text-[#94A3B8] pb-2">Precio unit.</th>
                                  <th className="text-right text-xs text-[#94A3B8] pb-2">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items[c.id].map((item, i) => (
                                  <tr key={i}>
                                    <td className="text-sm text-[#0F172A] py-1">{item.descripcion}</td>
                                    <td className="text-sm text-[#64748B] text-right py-1">{item.cantidad}</td>
                                    <td className="text-sm text-[#64748B] text-right py-1">${Number(item.precio_unitario).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                    <td className="text-sm font-medium text-[#0F172A] text-right py-1">${Number(item.subtotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )
                        ) : (
                          <p className="text-sm text-[#94A3B8]">Cargando...</p>
                        )}
                      </td>
                    </tr>
                  )}
              </React.Fragment>
            ))
          )}
        </tbody>
      </table>

        {totalPaginas > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#E2E8F0]">
            <p className="text-sm text-[#64748B]">Mostrando {((pagina - 1) * POR_PAGINA) + 1}-{Math.min(pagina * POR_PAGINA, total)} de {total}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}
                className="p-1.5 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFB] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft size={16} className="text-[#64748B]" />
              </button>
              <span className="text-sm text-[#64748B]">{pagina} / {totalPaginas}</span>
              <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}
                className="p-1.5 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFB] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <ChevronRight size={16} className="text-[#64748B]" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
