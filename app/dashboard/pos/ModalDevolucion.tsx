'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Search, ChevronRight, ChevronLeft, Package, AlertTriangle, Check, RefreshCw, Ticket, DollarSign } from 'lucide-react'

interface PuntoVenta { id: string; nombre: string; deposito_id: string }
interface Props {
  puntoVenta: PuntoVenta
  esAdmin: boolean
  onCerrar: () => void
  onCambio: (items: ItemDevolucion[], comprobante: any) => void
}

interface ComprobanteBuscado {
  id: string
  tipo: string
  numero: number
  fecha: string
  total: number
  esCotizacion: boolean
  cliente: string | null
  items: ItemComprobante[]
}

interface ItemComprobante {
  id?: string
  producto_id: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  cantidad_devolver: number
}

export interface ItemDevolucion {
  producto_id: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  destino: 'stock' | 'defectuoso'
  motivo_defecto?: string
}

type Paso = 'buscar' | 'seleccionar' | 'items' | 'destino' | 'resultado'
type Resultado = 'cambio' | 'voucher' | 'reembolso'

const LABEL_TIPO: Record<string, string> = {
  factura_a: 'Factura A', factura_b: 'Factura B', factura_c: 'Factura C',
  cotizacion: 'Cotizacion',
}

function generarCodigoVoucher(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let codigo = 'VCH-'
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 8) codigo += '-'
    codigo += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return codigo
}

export default function ModalDevolucion({ puntoVenta, esAdmin, onCerrar, onCambio }: Props) {
  const supabase = createClient()
  const [paso, setPaso] = useState<Paso>('buscar')
  const [busqueda, setBusqueda] = useState('')
  const [comprobantes, setComprobantes] = useState<ComprobanteBuscado[]>([])
  const [buscando, setBuscando] = useState(false)
  const [comprobanteSeleccionado, setComprobanteSeleccionado] = useState<ComprobanteBuscado | null>(null)
  const [itemsDevolucion, setItemsDevolucion] = useState<ItemComprobante[]>([])
  const [itemsConDestino, setItemsConDestino] = useState<ItemDevolucion[]>([])
  const [resultado, setResultado] = useState<Resultado>('cambio')
  const [procesando, setProcesando] = useState(false)
  const [voucherGenerado, setVoucherGenerado] = useState<string | null>(null)
  const [sinComprobante, setSinComprobante] = useState(false)
  const [motivoSinComp, setMotivoSinComp] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})

  async function buscarComprobantes() {
    if (busqueda.length < 2) return
    setBuscando(true)

    const resultados: ComprobanteBuscado[] = []

    // Buscar en comprobantes por producto
    const { data: productos } = await supabase.from('productos')
      .select('id').or(`nombre.ilike.%${busqueda}%,codigo_barras.eq.${busqueda},sku.ilike.%${busqueda}%`)

    if (productos && productos.length > 0) {
      const ids = productos.map(p => p.id)

      // Items en comprobantes
      const { data: itemsComp } = await supabase.from('items_comprobante')
        .select('comprobante_id, producto_id, descripcion, cantidad, precio_unitario, subtotal')
        .in('producto_id', ids)

      if (itemsComp && itemsComp.length > 0) {
        const compIds = [...new Set(itemsComp.map(i => i.comprobante_id))]
        const { data: comps } = await supabase.from('comprobantes')
          .select('id, tipo, numero, fecha, total, clientes(razon_social)')
          .in('id', compIds)
          .eq('estado', 'emitido')
          .in('tipo', ['factura_a', 'factura_b', 'factura_c'])
          .order('fecha', { ascending: false })
          .limit(10)

        comps?.forEach((c: any) => {
          const items = itemsComp.filter(i => i.comprobante_id === c.id)
          resultados.push({
            id: c.id, tipo: c.tipo, numero: c.numero, fecha: c.fecha,
            total: Number(c.total), esCotizacion: false,
            cliente: c.clientes?.razon_social || null,
            items: items.map(i => ({ ...i, cantidad_devolver: 0 })),
          })
        })
      }

      // Items en cotizaciones
      const { data: itemsCot } = await supabase.from('items_cotizacion')
        .select('cotizacion_id, producto_id, descripcion, cantidad, precio_unitario, subtotal')
        .in('producto_id', ids)

      if (itemsCot && itemsCot.length > 0) {
        const cotIds = [...new Set(itemsCot.map(i => i.cotizacion_id))]
        const { data: cots } = await supabase.from('cotizaciones')
          .select('id, numero, fecha, total, clientes(razon_social)')
          .in('id', cotIds)
          .in('estado', ['aceptada', 'facturada'])
          .order('fecha', { ascending: false })
          .limit(10)

        cots?.forEach((c: any) => {
          const items = itemsCot.filter(i => i.cotizacion_id === c.id)
          resultados.push({
            id: c.id, tipo: 'cotizacion', numero: c.numero, fecha: c.fecha,
            total: Number(c.total), esCotizacion: true,
            cliente: c.clientes?.razon_social || null,
            items: items.map(i => ({ ...i, cantidad_devolver: 0 })),
          })
        })
      }
    }

    setComprobantes(resultados)
    setBuscando(false)
    if (resultados.length > 0 || sinComprobante) setPaso('seleccionar')
  }

  function seleccionarComprobante(c: ComprobanteBuscado) {
    setComprobanteSeleccionado(c)
    setItemsDevolucion(c.items.map(i => ({ ...i, cantidad_devolver: 0 })))
    setPaso('items')
  }

  function cambiarCantidadDevolver(productoId: string, val: number) {
    setItemsDevolucion(prev => prev.map(i =>
      i.producto_id === productoId
        ? { ...i, cantidad_devolver: Math.min(Math.max(0, val), i.cantidad) }
        : i
    ))
  }

  function siguientePaso() {
    const seleccionados = itemsDevolucion.filter(i => i.cantidad_devolver > 0)
    if (seleccionados.length === 0) { setErrores({ items: 'Selecciona al menos un item a devolver' }); return }
    setItemsConDestino(seleccionados.map(i => ({
      producto_id: i.producto_id, descripcion: i.descripcion,
      cantidad: i.cantidad_devolver, precio_unitario: i.precio_unitario,
      subtotal: i.precio_unitario * i.cantidad_devolver,
      destino: 'stock' as const,
    })))
    setErrores({})
    setPaso('destino')
  }

  function cambiarDestino(productoId: string, destino: 'stock' | 'defectuoso') {
    setItemsConDestino(prev => prev.map(i => i.producto_id === productoId ? { ...i, destino } : i))
  }

  function cambiarMotivoDefecto(productoId: string, motivo: string) {
    setItemsConDestino(prev => prev.map(i => i.producto_id === productoId ? { ...i, motivo_defecto: motivo } : i))
  }

  const montoDevolucion = itemsConDestino.reduce((a, i) => a + i.subtotal, 0)

  async function confirmarDevolucion() {
    const errs: Record<string, string> = {}
    itemsConDestino.forEach(i => {
      if (i.destino === 'defectuoso' && !i.motivo_defecto?.trim()) {
        errs[i.producto_id] = 'Ingresa el motivo del defecto'
      }
    })
    if (Object.keys(errs).length > 0) { setErrores(errs); return }

    setProcesando(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setProcesando(false); return }

    // Crear devolucion
    const { data: devolucion, error: errDev } = await supabase.from('devoluciones').insert({
      punto_venta_id:        puntoVenta.id,
      usuario_id:            user.id,
      comprobante_origen_id: !comprobanteSeleccionado?.esCotizacion ? comprobanteSeleccionado?.id : null,
      cotizacion_origen_id:  comprobanteSeleccionado?.esCotizacion ? comprobanteSeleccionado?.id : null,
      sin_comprobante:       sinComprobante,
      resultado,
      monto_total:           montoDevolucion,
      observaciones:         sinComprobante ? motivoSinComp : null,
    }).select('id').single()

    if (errDev) { console.error(errDev); setProcesando(false); return }

    // Crear items devolucion
    await supabase.from('items_devolucion').insert(
      itemsConDestino.map(i => ({
        devolucion_id:   devolucion!.id,
        producto_id:     i.producto_id,
        descripcion:     i.descripcion,
        cantidad:        i.cantidad,
        precio_unitario: i.precio_unitario,
        subtotal:        i.subtotal,
        destino:         i.destino,
        motivo_defecto:  i.motivo_defecto || null,
      }))
    )

    // Generar nota de credito
    const tipoNC = comprobanteSeleccionado?.esCotizacion
      ? 'nota_credito_cotizacion'
      : comprobanteSeleccionado?.tipo === 'factura_a' ? 'nota_credito_a'
      : comprobanteSeleccionado?.tipo === 'factura_b' ? 'nota_credito_b'
      : 'nota_credito_c'

    const { data: numeradorNC } = await supabase.rpc('siguiente_numero', {
      p_punto_venta_id: puntoVenta.id, p_tipo: tipoNC
    })

    const { data: notaCredito } = await supabase.from('comprobantes').insert({
      tipo:                  tipoNC,
      numero:                numeradorNC,
      punto_venta_id:        puntoVenta.id,
      fecha:                 new Date().toISOString().split('T')[0],
      usuario_id:            user.id,
      subtotal:              montoDevolucion,
      descuento_pct:         0,
      descuento_monto:       0,
      iva_monto:             0,
      total:                 montoDevolucion,
      estado:                'emitido',
      cliente_id:            null,
    }).select('id, numero').single()

    if (notaCredito) {
      await supabase.from('items_comprobante').insert(
        itemsConDestino.map(i => ({
          comprobante_id:  notaCredito.id,
          producto_id:     i.producto_id,
          descripcion:     i.descripcion,
          cantidad:        i.cantidad,
          precio_unitario: i.precio_unitario,
          alicuota_iva:    0,
          subtotal:        i.subtotal,
        }))
      )
      await supabase.from('devoluciones').update({ nota_credito_id: notaCredito.id }).eq('id', devolucion!.id)
    }

    // Actualizar stock y defectuosos
    for (const item of itemsConDestino) {
      if (item.destino === 'stock') {
        const { data: stockActual } = await supabase.from('stock').select('cantidad, id')
          .eq('producto_id', item.producto_id).eq('deposito_id', puntoVenta.deposito_id).single()
        if (stockActual) {
          await supabase.from('stock').update({ cantidad: stockActual.cantidad + item.cantidad })
            .eq('producto_id', item.producto_id).eq('deposito_id', puntoVenta.deposito_id)
        } else {
          await supabase.from('stock').insert({
            producto_id: item.producto_id, deposito_id: puntoVenta.deposito_id, cantidad: item.cantidad
          })
        }
        await supabase.from('movimientos_stock').insert({
          producto_id: item.producto_id, deposito_id: puntoVenta.deposito_id,
          tipo: 'entrada', cantidad: item.cantidad,
          motivo: 'Devolucion', usuario_id: user.id,
        })
      } else {
        await supabase.from('productos_defectuosos').insert({
          producto_id:    item.producto_id,
          devolucion_id:  devolucion!.id,
          cantidad:       item.cantidad,
          motivo:         item.motivo_defecto || '',
          punto_venta_id: puntoVenta.id,
          usuario_id:     user.id,
        })
      }
    }

    // Voucher
    if (resultado === 'voucher') {
      const codigo = generarCodigoVoucher()
      await supabase.from('vouchers').insert({
        codigo,
        monto:         montoDevolucion,
        devolucion_id: devolucion!.id,
        vence_at:      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      setVoucherGenerado(codigo)
    }

    setProcesando(false)
    setPaso('resultado')

    if (resultado === 'cambio') {
      onCambio(itemsConDestino, comprobanteSeleccionado)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <div>
            <h2 className="text-base font-medium text-[#0F172A]">Devolucion / Cambio</h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">{puntoVenta.nombre}</p>
          </div>
          <button onClick={onCerrar} className="p-1.5 rounded-lg hover:bg-[#F8FAFB] text-[#64748B]"><X size={18} /></button>
        </div>

        {/* Indicador de pasos */}
        {paso !== 'resultado' && (
          <div className="px-6 py-3 border-b border-[#E2E8F0] bg-[#F8FAFB]">
            <div className="flex items-center gap-2">
              {['buscar', 'seleccionar', 'items', 'destino'].map((p, i) => {
                const pasos = ['buscar', 'seleccionar', 'items', 'destino']
                const actual = pasos.indexOf(paso)
                const esteIndex = pasos.indexOf(p)
                return (
                  <div key={p} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      esteIndex < actual ? 'bg-[#00B4D8] text-white'
                      : esteIndex === actual ? 'bg-[#00B4D8] text-white ring-2 ring-[#E0F7FC]'
                      : 'bg-[#E2E8F0] text-[#94A3B8]'
                    }`}>
                      {esteIndex < actual ? <Check size={12} /> : i + 1}
                    </div>
                    <span className={`text-xs ${esteIndex === actual ? 'text-[#00B4D8] font-medium' : 'text-[#94A3B8]'}`}>
                      {['Buscar', 'Seleccionar', 'Items', 'Destino'][i]}
                    </span>
                    {i < 3 && <ChevronRight size={14} className="text-[#E2E8F0]" />}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Paso 1: Buscar */}
          {paso === 'buscar' && (
            <div className="space-y-4">
              <p className="text-sm text-[#64748B]">Busca el producto que el cliente devuelve para encontrar la factura o cotizacion original.</p>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && buscarComprobantes()}
                  placeholder="Nombre del producto, codigo de barras o SKU..."
                  className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#E2E8F0] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                />
              </div>
              <button onClick={buscarComprobantes} disabled={busqueda.length < 2 || buscando}
                className="w-full h-10 bg-[#00B4D8] hover:bg-[#0096B4] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
                {buscando ? 'Buscando...' : 'Buscar comprobantes'}
              </button>
              {esAdmin && (
                <div className="border-t border-[#E2E8F0] pt-4">
                  <button onClick={() => { setSinComprobante(true); setPaso('seleccionar') }}
                    className="w-full h-10 border border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-700 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
                    <AlertTriangle size={15} /> Autorizar devolucion sin comprobante (admin)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Paso 2: Seleccionar comprobante */}
          {paso === 'seleccionar' && (
            <div className="space-y-3">
              {sinComprobante ? (
                <div className="space-y-4">
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={16} className="text-orange-500" />
                      <p className="text-sm font-medium text-orange-700">Devolucion sin comprobante</p>
                    </div>
                    <p className="text-xs text-orange-600">Esta operacion quedara registrada como autorizada por el administrador.</p>
                  </div>
                  <div>
                    <label className="block text-sm text-[#64748B] mb-1.5">Motivo *</label>
                    <input value={motivoSinComp} onChange={e => setMotivoSinComp(e.target.value)}
                      placeholder="Ej: Cliente no tiene ticket, compra para regalo..."
                      className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm text-[#64748B]">Busca el producto a devolver</label>
                    <div className="relative">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                      <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                        placeholder="Nombre o codigo del producto..."
                        className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#E2E8F0] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-[#64748B]">{comprobantes.length} comprobante{comprobantes.length !== 1 ? 's' : ''} encontrado{comprobantes.length !== 1 ? 's' : ''} con ese producto.</p>
                  {comprobantes.map(c => (
                    <button key={c.id} onClick={() => seleccionarComprobante(c)}
                      className="w-full flex items-center gap-4 p-4 bg-white border border-[#E2E8F0] rounded-xl hover:border-[#00B4D8] hover:bg-[#F0FBFE] transition-colors text-left">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-[#0F172A]">
                            {LABEL_TIPO[c.tipo] || c.tipo} N° {String(c.numero).padStart(8, '0')}
                          </span>
                          {c.esCotizacion && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[#E0F7FC] text-[#00B4D8]">Cotizacion</span>
                          )}
                        </div>
                        <p className="text-xs text-[#94A3B8]">
                          {new Date(c.fecha + 'T00:00:00').toLocaleDateString('es-AR')}
                          {c.cliente && ` · ${c.cliente}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-[#00B4D8]">${c.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                        <p className="text-xs text-[#94A3B8]">{c.items.length} items</p>
                      </div>
                      <ChevronRight size={16} className="text-[#94A3B8]" />
                    </button>
                  ))}
                  <button onClick={() => { setBusqueda(''); setPaso('buscar') }}
                    className="w-full h-9 border border-[#E2E8F0] text-sm text-[#64748B] hover:bg-[#F8FAFB] rounded-lg transition-colors flex items-center justify-center gap-2">
                    <ChevronLeft size={15} /> Buscar de nuevo
                  </button>
                </>
              )}
            </div>
          )}

          {/* Paso 3: Seleccionar items */}
          {paso === 'items' && comprobanteSeleccionado && (
            <div className="space-y-4">
              <div className="bg-[#F8FAFB] rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#0F172A]">
                    {LABEL_TIPO[comprobanteSeleccionado.tipo]} N° {String(comprobanteSeleccionado.numero).padStart(8, '0')}
                  </p>
                  <p className="text-xs text-[#94A3B8]">{new Date(comprobanteSeleccionado.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</p>
                </div>
                <p className="text-sm font-medium text-[#00B4D8]">${comprobanteSeleccionado.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
              </div>

              <p className="text-sm text-[#64748B]">Selecciona los items y la cantidad a devolver:</p>

              {errores.items && <p className="text-xs text-red-500">{errores.items}</p>}

              <div className="space-y-2">
                {itemsDevolucion.map(item => (
                  <div key={item.producto_id} className="flex items-center gap-4 p-3 bg-white border border-[#E2E8F0] rounded-xl">
                    <Package size={16} className="text-[#94A3B8] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0F172A] truncate">{item.descripcion}</p>
                      <p className="text-xs text-[#94A3B8]">${item.precio_unitario.toLocaleString('es-AR')} x {item.cantidad} = ${item.subtotal.toLocaleString('es-AR')}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => cambiarCantidadDevolver(item.producto_id, item.cantidad_devolver - 1)}
                        className="w-7 h-7 rounded-lg border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F8FAFB] text-[#64748B]">
                        -
                      </button>
                      <span className={`text-sm font-medium w-6 text-center ${item.cantidad_devolver > 0 ? 'text-[#00B4D8]' : 'text-[#94A3B8]'}`}>
                        {item.cantidad_devolver}
                      </span>
                      <button onClick={() => cambiarCantidadDevolver(item.producto_id, item.cantidad_devolver + 1)}
                        disabled={item.cantidad_devolver >= item.cantidad}
                        className="w-7 h-7 rounded-lg border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F8FAFB] text-[#64748B] disabled:opacity-40">
                        +
                      </button>
                      <span className="text-xs text-[#94A3B8]">/ {item.cantidad}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Paso 4: Destino y resultado */}
          {paso === 'destino' && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-[#0F172A] mb-3">Que hacemos con cada producto devuelto?</p>
                <div className="space-y-2">
                  {itemsConDestino.map(item => (
                    <div key={item.producto_id} className="p-3 bg-white border border-[#E2E8F0] rounded-xl space-y-3">
                      <p className="text-sm font-medium text-[#0F172A]">{item.descripcion} ({item.cantidad} unidades)</p>
                      <div className="flex gap-2">
                        <button onClick={() => cambiarDestino(item.producto_id, 'stock')}
                          className={`flex-1 h-9 rounded-lg border text-sm font-medium transition-colors ${
                            item.destino === 'stock' ? 'border-green-400 bg-green-50 text-green-700' : 'border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFB]'
                          }`}>
                          Vuelve al stock
                        </button>
                        <button onClick={() => cambiarDestino(item.producto_id, 'defectuoso')}
                          className={`flex-1 h-9 rounded-lg border text-sm font-medium transition-colors ${
                            item.destino === 'defectuoso' ? 'border-red-400 bg-red-50 text-red-600' : 'border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFB]'
                          }`}>
                          Defectuoso
                        </button>
                      </div>
                      {item.destino === 'defectuoso' && (
                        <div>
                          <input value={item.motivo_defecto || ''}
                            onChange={e => cambiarMotivoDefecto(item.producto_id, e.target.value)}
                            placeholder="Motivo del defecto *"
                            className={`w-full h-9 px-3 rounded-lg border text-sm placeholder:text-[#94A3B8] focus:outline-none focus:ring-1 ${
                              errores[item.producto_id] ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : 'border-[#E2E8F0] focus:border-[#00B4D8] focus:ring-[#00B4D8]'
                            }`}
                          />
                          {errores[item.producto_id] && <p className="text-xs text-red-500 mt-1">{errores[item.producto_id]}</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-[#E2E8F0] pt-4">
                <p className="text-sm font-medium text-[#0F172A] mb-3">
                  Que recibe el cliente? <span className="text-[#94A3B8] font-normal">Monto: ${montoDevolucion.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'cambio',    label: 'Cambio de producto', icon: RefreshCw,  desc: 'Abre el carrito para nueva venta' },
                    { id: 'voucher',   label: 'Voucher',            icon: Ticket,     desc: 'Credito para uso futuro (30 dias)' },
                    { id: 'reembolso', label: 'Reembolso',          icon: DollarSign, desc: 'Devolucion en efectivo' },
                  ].map(r => {
                    const Icon = r.icon
                    return (
                      <button key={r.id} onClick={() => setResultado(r.id as Resultado)}
                        className={`p-3 rounded-xl border text-left transition-colors ${
                          resultado === r.id ? 'border-[#00B4D8] bg-[#E0F7FC]' : 'border-[#E2E8F0] hover:bg-[#F8FAFB]'
                        }`}>
                        <Icon size={18} className={resultado === r.id ? 'text-[#00B4D8] mb-1' : 'text-[#64748B] mb-1'} />
                        <p className={`text-sm font-medium ${resultado === r.id ? 'text-[#00B4D8]' : 'text-[#0F172A]'}`}>{r.label}</p>
                        <p className="text-xs text-[#94A3B8] mt-0.5">{r.desc}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Paso final: Resultado */}
          {paso === 'resultado' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto">
                <Check size={32} className="text-green-500" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-base font-medium text-[#0F172A] mb-1">Devolucion registrada</p>
                <p className="text-sm text-[#64748B]">La nota de credito fue generada correctamente.</p>
              </div>

              {resultado === 'voucher' && voucherGenerado && (
                <div className="bg-[#E0F7FC] border border-[#00B4D8] rounded-xl p-4 mx-auto max-w-xs">
                  <p className="text-xs text-[#64748B] mb-1">Codigo del voucher</p>
                  <p className="text-xl font-mono font-bold text-[#00B4D8] tracking-wider">{voucherGenerado}</p>
                  <p className="text-xs text-[#94A3B8] mt-2">Valido por 30 dias — uso unico</p>
                  <p className="text-sm font-medium text-[#00B4D8] mt-1">${montoDevolucion.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                </div>
              )}

              {resultado === 'reembolso' && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mx-auto max-w-xs">
                  <p className="text-sm text-green-700">Reembolso de <span className="font-bold">${montoDevolucion.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span> en efectivo al cliente.</p>
                </div>
              )}

              {resultado === 'cambio' && (
                <div className="bg-[#E0F7FC] border border-[#00B4D8] rounded-xl p-4 mx-auto max-w-xs">
                  <p className="text-sm text-[#00B4D8]">El carrito se abrio con el credito de <span className="font-bold">${montoDevolucion.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span> aplicado.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer con botones */}
        <div className="px-6 py-4 border-t border-[#E2E8F0] flex gap-3">
          {paso === 'resultado' ? (
            <button onClick={onCerrar}
              className="flex-1 h-10 bg-[#00B4D8] hover:bg-[#0096B4] text-white text-sm font-medium rounded-lg transition-colors">
              {resultado === 'cambio' ? 'Ir al carrito' : 'Cerrar'}
            </button>
          ) : (
            <>
              <button onClick={() => {
                if (paso === 'buscar') onCerrar()
                else if (paso === 'seleccionar') setPaso('buscar')
                else if (paso === 'items') setPaso('seleccionar')
                else if (paso === 'destino') setPaso('items')
              }}
                className="h-10 px-4 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] hover:bg-[#F8FAFB] transition-colors">
                {paso === 'buscar' ? 'Cancelar' : 'Atras'}
              </button>
              {paso === 'items' && (
                <button onClick={siguientePaso}
                  className="flex-1 h-10 bg-[#00B4D8] hover:bg-[#0096B4] text-white text-sm font-medium rounded-lg transition-colors">
                  Continuar
                </button>
              )}
              {paso === 'destino' && (
                <button onClick={confirmarDevolucion} disabled={procesando}
                  className="flex-1 h-10 bg-[#00B4D8] hover:bg-[#0096B4] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
                  {procesando ? 'Procesando...' : 'Confirmar devolucion'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
