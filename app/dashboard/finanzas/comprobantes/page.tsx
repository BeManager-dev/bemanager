'use client'

import React from 'react'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, ChevronDown, FileText, FileQuestion, Printer } from 'lucide-react'

interface Comprobante {
  id: string; tipo: string; numero: number; fecha: string; total: number
  estado: string; descuento_pct: number; descuento_monto: number; iva_monto: number; subtotal: number
  clientes: { razon_social: string; cuit: string | null; dni: string | null } | null
  puntos_venta: { nombre: string; numero: number } | null
}

interface Cotizacion {
  id: string; numero: number; fecha: string; total: number; estado: string
  descuento_pct: number; descuento_monto: number; subtotal: number
  clientes: { razon_social: string; cuit: string | null; dni: string | null } | null
  puntos_venta: { nombre: string; numero: number } | null
}

interface ItemDetalle {
  descripcion: string; cantidad: number; precio_unitario: number; subtotal: number; alicuota_iva: number
}

const POR_PAGINA = 50

const LABEL_TIPO: Record<string, string> = {
  factura_a: 'Factura A', factura_b: 'Factura B', factura_c: 'Factura C',
  nota_credito_a: 'NC A', nota_credito_b: 'NC B', nota_credito_c: 'NC C',
  nota_debito_a: 'ND A', nota_debito_b: 'ND B', nota_debito_c: 'ND C',
}

function badgeEstado(estado: string) {
  const map: Record<string, string> = {
    emitido: 'bg-green-50 text-green-600', pendiente: 'bg-yellow-50 text-yellow-600',
    anulado: 'bg-red-50 text-red-500', aceptada: 'bg-[#E0F7FC] text-[#00B4D8]',
    rechazada: 'bg-red-50 text-red-500', facturada: 'bg-purple-50 text-purple-600',
    vencida: 'bg-gray-100 text-gray-500', borrador: 'bg-gray-100 text-gray-500',
  }
  return map[estado] || 'bg-gray-100 text-gray-500'
}

export default function ComprobantesPage() {
  const supabase = createClient()
  const hoy = new Date()
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]
  const hoyStr = hoy.toISOString().split('T')[0]

  const [tab, setTab] = useState<'facturas' | 'cotizaciones'>('facturas')
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([])
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [fechaDesde, setFechaDesde] = useState(primerDiaMes)
  const [fechaHasta, setFechaHasta] = useState(hoyStr)
  const [detalle, setDetalle] = useState<string | null>(null)
  const [items, setItems] = useState<Record<string, ItemDetalle[]>>({})
  const printRef = useRef<HTMLDivElement>(null)

  async function cargarComprobantes() {
    setCargando(true)
    let query = supabase
      .from('comprobantes')
      .select('id, tipo, numero, fecha, total, estado, descuento_pct, descuento_monto, iva_monto, subtotal, clientes(razon_social, cuit, dni), puntos_venta(nombre, numero)', { count: 'exact' })
      .order('fecha', { ascending: false })
      .order('numero', { ascending: false })
      .gte('fecha', fechaDesde)
      .lte('fecha', fechaHasta)
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
      .select('id, numero, fecha, total, estado, descuento_pct, descuento_monto, subtotal, clientes(razon_social, cuit, dni), puntos_venta(nombre, numero)', { count: 'exact' })
      .order('fecha', { ascending: false })
      .order('numero', { ascending: false })
      .gte('fecha', fechaDesde)
      .lte('fecha', fechaHasta)
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
  }, [tab, pagina, filtroTipo, filtroEstado, fechaDesde, fechaHasta])

  const totalPaginas = Math.ceil(total / POR_PAGINA)

  async function verDetalle(id: string, esCotizacion: boolean) {
    if (detalle === id) { setDetalle(null); return }
    setDetalle(id)
    if (!items[id]) {
      const tabla = esCotizacion ? 'items_cotizacion' : 'items_comprobante'
      const campo = esCotizacion ? 'cotizacion_id' : 'comprobante_id'
      const { data } = await supabase.from(tabla)
        .select('descripcion, cantidad, precio_unitario, subtotal, alicuota_iva').eq(campo, id)
      setItems(prev => ({ ...prev, [id]: data || [] }))
    }
  }

  function imprimirComprobante(c: any, itemsComp: ItemDetalle[], esCotizacion: boolean) {
    const ventana = window.open('', '_blank')
    if (!ventana) return
    const tipo = esCotizacion ? 'Cotizacion' : (LABEL_TIPO[c.tipo] || c.tipo)
    const numero = String(c.numero).padStart(8, '0')
    const pvNumero = c.puntos_venta?.numero ? String(c.puntos_venta.numero).padStart(4, '0') : '0001'
    const fechaFormateada = new Date(c.fecha + 'T00:00:00').toLocaleDateString('es-AR')
    const cliente = c.clientes?.razon_social || 'Consumidor final'
    const docCliente = c.clientes?.cuit || c.clientes?.dni || ''

    const itemsHTML = itemsComp.map(item => `
      <tr>
        <td style="padding: 4px 8px; border-bottom: 1px solid #eee;">${item.descripcion}</td>
        <td style="padding: 4px 8px; text-align: center; border-bottom: 1px solid #eee;">${item.cantidad}</td>
        <td style="padding: 4px 8px; text-align: right; border-bottom: 1px solid #eee;">$${Number(item.precio_unitario).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
        <td style="padding: 4px 8px; text-align: right; border-bottom: 1px solid #eee;">$${Number(item.subtotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('')

    const netoSinIva = !esCotizacion ? Number(c.total) - Number(c.iva_monto) : 0

    ventana.document.write(`
      <html>
      <head>
        <title>${tipo} ${pvNumero}-${numero}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 12px; color: #000; padding: 20px; max-width: 800px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #000; }
          .empresa { font-size: 20px; font-weight: bold; }
          .tipo-box { border: 2px solid #000; padding: 10px 20px; text-align: center; }
          .tipo-letra { font-size: 36px; font-weight: bold; }
          .tipo-nombre { font-size: 14px; }
          .numero { font-size: 14px; margin-top: 5px; }
          .datos { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
          .dato-group { border: 1px solid #ccc; padding: 8px; border-radius: 4px; }
          .dato-label { font-size: 10px; color: #666; margin-bottom: 2px; }
          .dato-valor { font-size: 12px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          th { background: #f5f5f5; padding: 6px 8px; text-align: left; border-bottom: 2px solid #000; font-size: 11px; }
          .totales { margin-left: auto; width: 250px; }
          .total-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
          .total-final { font-size: 16px; font-weight: bold; border-top: 2px solid #000; padding-top: 5px; margin-top: 5px; }
          .pie { text-align: center; margin-top: 20px; font-size: 11px; color: #666; border-top: 1px solid #ccc; padding-top: 10px; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="empresa">BeHappy</div>
            <div style="font-size: 11px; color: #666; margin-top: 4px;">Indumentaria</div>
            <div style="font-size: 11px; margin-top: 8px;">${c.puntos_venta?.nombre || ''}</div>
          </div>
          <div class="tipo-box">
            <div class="tipo-letra">${esCotizacion ? 'C' : (c.tipo?.split('_')[1] || 'X').toUpperCase()}</div>
            <div class="tipo-nombre">${tipo}</div>
            <div class="numero">N° ${pvNumero}-${numero}</div>
          </div>
        </div>

        <div class="datos">
          <div class="dato-group">
            <div class="dato-label">Cliente</div>
            <div class="dato-valor">${cliente}</div>
            ${docCliente ? `<div style="font-size: 11px; color: #666;">${docCliente}</div>` : ''}
          </div>
          <div class="dato-group">
            <div class="dato-label">Fecha</div>
            <div class="dato-valor">${fechaFormateada}</div>
            ${esCotizacion ? `<div style="font-size: 11px; color: #666;">Valida 15 dias</div>` : ''}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Descripcion</th>
              <th style="text-align: center;">Cant.</th>
              <th style="text-align: right;">Precio unit.</th>
              <th style="text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>${itemsHTML}</tbody>
        </table>

        <div class="totales">
          ${Number(c.descuento_pct) > 0 ? `
            <div class="total-row"><span>Subtotal</span><span>$${Number(c.subtotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
            <div class="total-row" style="color: green;"><span>Descuento (${c.descuento_pct}%)</span><span>-$${Number(c.descuento_monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
          ` : ''}
          ${!esCotizacion ? `
            <div class="total-row"><span>Neto</span><span>$${netoSinIva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
            <div class="total-row"><span>IVA 21%</span><span>$${Number(c.iva_monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
          ` : ''}
          <div class="total-row total-final"><span>TOTAL</span><span>$${Number(c.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span></div>
        </div>

        <div class="pie">Gracias por su compra — BeHappy Indumentaria</div>
        <script>window.onload = () => { window.print(); }</script>
      </body>
      </html>
    `)
    ventana.document.close()
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
              <Icon size={15} />{t.label}
            </button>
          )
        })}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <input type="date" value={fechaDesde} onChange={e => { setFechaDesde(e.target.value); setPagina(1) }}
              className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] focus:outline-none focus:border-[#00B4D8] bg-white" />
            <span className="text-sm text-[#94A3B8]">hasta</span>
            <input type="date" value={fechaHasta} onChange={e => { setFechaHasta(e.target.value); setPagina(1) }}
              className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] focus:outline-none focus:border-[#00B4D8] bg-white" />
          </div>
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
          {(filtroTipo || filtroEstado || fechaDesde !== primerDiaMes || fechaHasta !== hoyStr) && (
            <button onClick={() => { setFiltroTipo(''); setFiltroEstado(''); setFechaDesde(primerDiaMes); setFechaHasta(hoyStr); setPagina(1) }}
              className="h-9 px-3 rounded-lg text-sm text-[#94A3B8] hover:text-[#64748B] transition-colors">
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
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
                  <tr className="hover:bg-[#F8FAFB] transition-colors">
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
                      <p className="text-sm text-[#64748B]">{c.puntos_venta?.nombre || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-sm font-medium text-[#0F172A]">${Number(c.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${badgeEstado(c.estado)}`}>{c.estado}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={async () => {
                          await verDetalle(c.id, tab === 'cotizaciones')
                          if (!items[c.id]) {
                            const tabla = tab === 'cotizaciones' ? 'items_cotizacion' : 'items_comprobante'
                            const campo = tab === 'cotizaciones' ? 'cotizacion_id' : 'comprobante_id'
                            const { data } = await supabase.from(tabla).select('descripcion, cantidad, precio_unitario, subtotal, alicuota_iva').eq(campo, c.id)
                            const its = data || []
                            setItems(prev => ({ ...prev, [c.id]: its }))
                            imprimirComprobante(c, its, tab === 'cotizaciones')
                          } else {
                            imprimirComprobante(c, items[c.id], tab === 'cotizaciones')
                          }
                        }}
                          title="Imprimir"
                          className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#00B4D8] transition-colors">
                          <Printer size={15} />
                        </button>
                        <button onClick={() => verDetalle(c.id, tab === 'cotizaciones')}
                          className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] transition-colors">
                          <ChevronDown size={15} className={`transition-transform ${detalle === c.id ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {detalle === c.id && (
                    <tr>
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
