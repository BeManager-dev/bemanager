'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Barcode, Plus, Minus, Trash2, ShoppingCart, CreditCard, Lock, Zap, RefreshCw } from 'lucide-react'
import ModalCobro from './ModalCobro'
import ModalDevolucion, { ItemDevolucion } from './ModalDevolucion'
import { siguienteNumero } from '@/lib/numeracion'

interface Producto {
  id: string; nombre: string; codigo_barras: string | null
  sku: string | null; precio: number; alicuota_iva: number
}

interface ItemCarrito {
  producto_id: string; nombre: string; precio: number
  alicuota_iva: number; cantidad: number; subtotal: number
}

interface PuntoVenta {
  id: string; nombre: string; numero: number; deposito_id: string
}

export default function POSPage() {
  const supabase = createClient()
  const [busqueda, setBusqueda] = useState('')
  const [productos, setProductos] = useState<Producto[]>([])
  const [productosRapidos, setProductosRapidos] = useState<Producto[]>([])
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [buscando, setBuscando] = useState(false)
  const [mostrarPago, setMostrarPago] = useState(false)
  const [mostrarDevolucion, setMostrarDevolucion] = useState(false)
  const [esAdmin, setEsAdmin] = useState(false)
  const [puntosVenta, setPuntosVenta] = useState<PuntoVenta[]>([])
  const [puntoVentaSeleccionado, setPuntoVentaSeleccionado] = useState<PuntoVenta | null>(null)
  const [cajaAbierta, setCajaAbierta] = useState<boolean | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    cargarPerfil()
    inputRef.current?.focus()
  }, [])

  async function cargarPerfil() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: perfilData } = await supabase
      .from('perfiles').select('rol, punto_venta_id').eq('id', user.id).single()

    if (!perfilData) return
    const admin = perfilData.rol === 'admin'
    setEsAdmin(admin)

    if (admin) {
      const { data: pvData } = await supabase
        .from('puntos_venta').select('id, nombre, numero, deposito_id')
        .eq('activo', true).order('nombre')
      setPuntosVenta(pvData || [])
      if (pvData && pvData.length > 0) {
        setPuntoVentaSeleccionado(pvData[0])
        await cargarProductosRapidos(pvData[0].id)
      }
      setCajaAbierta(true)
    } else {
      if (perfilData.punto_venta_id) {
        const { data: pvData } = await supabase
          .from('puntos_venta').select('id, nombre, numero, deposito_id')
          .eq('id', perfilData.punto_venta_id).single()
        if (pvData) {
          setPuntoVentaSeleccionado(pvData)
          await verificarCaja(pvData.id)
          await cargarProductosRapidos(pvData.id)
        } else {
          setCajaAbierta(false)
        }
      } else {
        setCajaAbierta(false)
      }
    }
  }

  async function cargarProductosRapidos(puntoVentaId: string) {
    const { data: comprobantes } = await supabase
      .from('comprobantes').select('id')
      .eq('punto_venta_id', puntoVentaId).eq('estado', 'emitido')
      .in('tipo', ['factura_a', 'factura_b', 'factura_c'])

    if (!comprobantes || comprobantes.length === 0) return

    const { data: items } = await supabase
      .from('items_comprobante').select('producto_id, cantidad')
      .in('comprobante_id', comprobantes.map(c => c.id))

    if (!items || items.length === 0) return

    const conteo: Record<string, number> = {}
    items.forEach(i => {
      if (!conteo[i.producto_id]) conteo[i.producto_id] = 0
      conteo[i.producto_id] += Number(i.cantidad)
    })

    const top20ids = Object.entries(conteo)
      .sort((a, b) => b[1] - a[1]).slice(0, 20).map(([id]) => id)

    if (top20ids.length === 0) return

    const { data: prods } = await supabase.from('productos')
      .select('id, nombre, codigo_barras, sku, precio, alicuota_iva')
      .in('id', top20ids).eq('activo', true)

    if (!prods) return

    const ordenados = top20ids.map(id => prods.find(p => p.id === id)).filter(Boolean) as Producto[]
    setProductosRapidos(ordenados)
  }

  async function verificarCaja(puntoVentaId: string) {
    const { data } = await supabase.from('sesiones_caja').select('id')
      .eq('punto_venta_id', puntoVentaId).eq('estado', 'abierta').maybeSingle()
    setCajaAbierta(!!data)
  }

  useEffect(() => {
    if (busqueda.length < 2) { setProductos([]); return }
    const timeout = setTimeout(async () => {
      setBuscando(true)
      const { data } = await supabase.from('productos')
        .select('id, nombre, codigo_barras, sku, precio, alicuota_iva')
        .eq('activo', true)
        .or(`nombre.ilike.%${busqueda}%,codigo_barras.eq.${busqueda},sku.ilike.%${busqueda}%`)
        .limit(8)
      setProductos(data || [])
      setBuscando(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [busqueda])

  function agregarAlCarrito(producto: Producto) {
    setCarrito(prev => {
      const existe = prev.find(i => i.producto_id === producto.id)
      if (existe) {
        return prev.map(i => i.producto_id === producto.id
          ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precio }
          : i
        )
      }
      return [...prev, {
        producto_id: producto.id, nombre: producto.nombre,
        precio: producto.precio, alicuota_iva: producto.alicuota_iva,
        cantidad: 1, subtotal: producto.precio,
      }]
    })
    setBusqueda(''); setProductos([])
    inputRef.current?.focus()
  }

  function cambiarCantidad(id: string, delta: number) {
    setCarrito(prev => prev
      .map(i => i.producto_id === id
        ? { ...i, cantidad: i.cantidad + delta, subtotal: (i.cantidad + delta) * i.precio }
        : i
      ).filter(i => i.cantidad > 0)
    )
  }

  function eliminarItem(id: string) {
    setCarrito(prev => prev.filter(i => i.producto_id !== id))
  }

  async function confirmarCobro(
    medioPago: string, tipoComprobante: string, descuentoPct: number, clienteId: string | null, voucherId?: string | null
  ): Promise<{ id: string; numero: number; tipo: string } | null | undefined> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !puntoVentaSeleccionado) return null

    const subtotalBruto   = carrito.reduce((acc, i) => acc + i.subtotal, 0)
    const descuentoMonto  = subtotalBruto * (descuentoPct / 100)
    const subtotalConDesc = subtotalBruto - descuentoMonto
    const esCotizacion    = tipoComprobante === 'cotizacion'
    const iva = esCotizacion ? 0
      : carrito.reduce((acc, i) => acc + ((i.subtotal * (1 - descuentoPct / 100)) / (1 + i.alicuota_iva / 100) * (i.alicuota_iva / 100)), 0)
    const total = subtotalConDesc

    const itemsPayload = carrito.map(item => ({
      producto_id: item.producto_id, descripcion: item.nombre,
      cantidad: item.cantidad, precio_unitario: item.precio,
      alicuota_iva: item.alicuota_iva, subtotal: item.subtotal,
    }))

    if (esCotizacion) {
      const numero = await siguienteNumero(puntoVentaSeleccionado.id, 'cotizacion')
      const { data: cotizacion, error: errCot } = await supabase.from('cotizaciones').insert({
        numero, punto_venta_id: puntoVentaSeleccionado.id,
        fecha: new Date().toISOString().split('T')[0],
        validez_hasta: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        usuario_id: user.id, subtotal: subtotalBruto, descuento_pct: descuentoPct,
        descuento_monto: descuentoMonto, iva_monto: 0, total: subtotalConDesc,
        estado: 'aceptada', cliente_id: clienteId,
      }).select('id, numero').single()

      if (errCot) { console.error('Error cotizacion:', errCot); return null }
      await supabase.from('items_cotizacion').insert(itemsPayload.map(i => ({ ...i, cotizacion_id: cotizacion!.id })))
      setCarrito([])
      return { id: cotizacion!.id, numero: cotizacion!.numero, tipo: 'cotizacion' }

    } else {
      const numero = await siguienteNumero(puntoVentaSeleccionado.id, tipoComprobante)
      const { data: comprobante, error: errComp } = await supabase.from('comprobantes').insert({
        tipo: tipoComprobante, numero, punto_venta_id: puntoVentaSeleccionado.id,
        fecha: new Date().toISOString().split('T')[0], usuario_id: user.id,
        subtotal: subtotalBruto, descuento_pct: descuentoPct, descuento_monto: descuentoMonto,
        iva_monto: iva, total, estado: 'emitido', cliente_id: clienteId,
      }).select('id, numero').single()

      if (errComp) { console.error('Error comprobante:', errComp); return null }

      await supabase.from('items_comprobante').insert(itemsPayload.map(i => ({ ...i, comprobante_id: comprobante!.id })))
      await supabase.from('pagos_comprobante').insert({
        comprobante_id: comprobante!.id, medio_pago: medioPago, monto: total,
      })

      for (const item of carrito) {
        const { data: stockActual } = await supabase.from('stock').select('cantidad')
          .eq('producto_id', item.producto_id).eq('deposito_id', puntoVentaSeleccionado.deposito_id).single()
        if (stockActual) {
          await supabase.from('stock').update({
            cantidad: Math.max(0, Number(stockActual.cantidad) - item.cantidad)
          }).eq('producto_id', item.producto_id).eq('deposito_id', puntoVentaSeleccionado.deposito_id)
        }
      }

      setCarrito([])
      return { id: comprobante!.id, numero: comprobante!.numero, tipo: tipoComprobante }
    }
  }

  const subtotal = carrito.reduce((acc, i) => acc + i.subtotal, 0)

  if (cajaAbierta === null) {
    return <div className="flex items-center justify-center h-64 text-sm text-[#94A3B8]">Verificando caja...</div>
  }

  if (cajaAbierta === false) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <Lock size={32} className="text-red-400" strokeWidth={1.5} />
        </div>
        <div className="text-center">
          <p className="text-base font-medium text-[#0F172A] mb-1">Caja cerrada</p>
          <p className="text-sm text-[#64748B]">Debes abrir la caja antes de comenzar a vender</p>
        </div>
        <a href="/dashboard/finanzas/caja"
          className="flex items-center gap-2 h-10 px-6 bg-[#00B4D8] hover:bg-[#0096B4] text-white text-sm font-medium rounded-lg transition-colors">
          Ir a abrir caja
        </a>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-4 h-[calc(100vh-7rem)]">

        <div className="flex items-center justify-between">
          <div>
            {esAdmin ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#64748B]">Punto de venta:</span>
                <select value={puntoVentaSeleccionado?.id || ''}
                  onChange={async e => {
                    const pv = puntosVenta.find(p => p.id === e.target.value)
                    setPuntoVentaSeleccionado(pv || null)
                    if (pv) await cargarProductosRapidos(pv.id)
                  }}
                  className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#00B4D8] bg-white">
                  {puntosVenta.map(pv => <option key={pv.id} value={pv.id}>{pv.nombre}</option>)}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <span className="text-sm font-medium text-[#0F172A]">
                  {puntoVentaSeleccionado?.nombre || 'Sin punto de venta asignado'}
                </span>
              </div>
            )}
          </div>
          <button onClick={() => setMostrarDevolucion(true)}
            className="flex items-center gap-2 h-9 px-3 border border-[#E2E8F0] bg-white hover:bg-[#F8FAFB] text-sm text-[#64748B] rounded-lg transition-colors">
            <RefreshCw size={15} /> Devolucion
          </button>
        </div>

        <div className="flex gap-6 flex-1 min-h-0">
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <Barcode size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input ref={inputRef} type="text" value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, codigo de barras o SKU..."
                  className="w-full h-11 pl-9 pr-9 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8] transition-colors"
                />
              </div>
            </div>

            {busqueda.length >= 2 && (
              <>
                {buscando && <p className="text-sm text-[#94A3B8] text-center">Buscando...</p>}
                {productos.length > 0 && (
                  <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                    {productos.map((p, i) => (
                      <button key={p.id} onClick={() => agregarAlCarrito(p)}
                        className={`w-full flex items-center justify-between px-4 py-3 hover:bg-[#F8FAFB] transition-colors text-left ${i > 0 ? 'border-t border-[#E2E8F0]' : ''}`}>
                        <div>
                          <p className="text-sm font-medium text-[#0F172A]">{p.nombre}</p>
                          <p className="text-xs text-[#94A3B8] mt-0.5">{p.sku || p.codigo_barras || '---'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-[#00B4D8]">${p.precio.toLocaleString('es-AR')}</p>
                          <p className="text-xs text-[#94A3B8]">IVA {p.alicuota_iva}% inc.</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {busqueda.length < 2 && (
              <div className="flex-1 overflow-y-auto">
                {productosRapidos.length > 0 ? (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <Zap size={14} className="text-[#00B4D8]" />
                      <p className="text-xs font-medium text-[#64748B]">Mas vendidos en {puntoVentaSeleccionado?.nombre}</p>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                      {productosRapidos.map(p => (
                        <button key={p.id} onClick={() => agregarAlCarrito(p)}
                          className="bg-white border border-[#E2E8F0] rounded-xl p-3 text-left hover:border-[#00B4D8] hover:bg-[#F0FBFE] transition-colors group">
                          <p className="text-sm font-medium text-[#0F172A] leading-tight line-clamp-2 mb-2 group-hover:text-[#00B4D8]">{p.nombre}</p>
                          <p className="text-sm font-medium text-[#00B4D8]">${p.precio.toLocaleString('es-AR')}</p>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center text-[#94A3B8]">
                    <ShoppingCart size={48} strokeWidth={1} className="mb-3" />
                    <p className="text-sm">Busca un producto o escanea un codigo de barras</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="w-80 flex flex-col bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center gap-2">
              <ShoppingCart size={16} className="text-[#64748B]" />
              <span className="text-sm font-medium text-[#0F172A]">Carrito</span>
              {carrito.length > 0 && (
                <span className="ml-auto text-xs bg-[#00B4D8] text-white px-2 py-0.5 rounded-full">
                  {carrito.reduce((a, i) => a + i.cantidad, 0)}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#E2E8F0]">
              {carrito.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-[#94A3B8]">Sin productos</div>
              ) : (
                carrito.map(item => (
                  <div key={item.producto_id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm text-[#0F172A] leading-tight flex-1">{item.nombre}</p>
                      <button onClick={() => eliminarItem(item.producto_id)} className="text-[#94A3B8] hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button onClick={() => cambiarCantidad(item.producto_id, -1)}
                          className="w-6 h-6 rounded-md border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F8FAFB]">
                          <Minus size={12} />
                        </button>
                        <span className="text-sm w-6 text-center font-medium">{item.cantidad}</span>
                        <button onClick={() => cambiarCantidad(item.producto_id, 1)}
                          className="w-6 h-6 rounded-md border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F8FAFB]">
                          <Plus size={12} />
                        </button>
                      </div>
                      <p className="text-sm font-medium text-[#0F172A]">${item.subtotal.toLocaleString('es-AR')}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-[#E2E8F0] px-4 py-4 space-y-2">
              <div className="flex justify-between text-base font-medium text-[#0F172A]">
                <span>Subtotal</span>
                <span className="text-[#00B4D8]">${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
              <button onClick={() => setMostrarPago(true)}
                disabled={carrito.length === 0 || !puntoVentaSeleccionado}
                className="w-full h-11 bg-[#00B4D8] hover:bg-[#0096B4] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 mt-2">
                <CreditCard size={16} />
                Cobrar ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </button>
              {!puntoVentaSeleccionado && (
                <p className="text-xs text-orange-500 text-center">Sin punto de venta asignado</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {mostrarPago && (
        <ModalCobro
          carrito={carrito}
          onCerrar={() => setMostrarPago(false)}
          onConfirmar={confirmarCobro}
        />
      )}

      {mostrarDevolucion && puntoVentaSeleccionado && (
        <ModalDevolucion
          puntoVenta={puntoVentaSeleccionado}
          esAdmin={esAdmin}
          onCerrar={() => setMostrarDevolucion(false)}
          onCambio={(items: ItemDevolucion[], comp: any) => {
            setMostrarDevolucion(false)
          }}
        />
      )}
    </>
  )
}
