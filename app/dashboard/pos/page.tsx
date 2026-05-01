'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Barcode, Plus, Minus, Trash2, ShoppingCart, CreditCard } from 'lucide-react'

interface Producto {
  id: string
  nombre: string
  codigo_barras: string | null
  sku: string | null
  precio: number
  alicuota_iva: number
}

interface ItemCarrito {
  producto_id: string
  nombre: string
  precio: number
  alicuota_iva: number
  cantidad: number
  subtotal: number
}

export default function POSPage() {
  const supabase = createClient()
  const [busqueda, setBusqueda] = useState('')
  const [productos, setProductos] = useState<Producto[]>([])
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [buscando, setBuscando] = useState(false)
  const [mostrarPago, setMostrarPago] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Foco automático en el buscador
  useEffect(() => { inputRef.current?.focus() }, [])

  // Buscar productos
  useEffect(() => {
    if (busqueda.length < 2) { setProductos([]); return }
    const timeout = setTimeout(async () => {
      setBuscando(true)
      const { data } = await supabase
        .from('productos')
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
        producto_id: producto.id,
        nombre: producto.nombre,
        precio: producto.precio,
        alicuota_iva: producto.alicuota_iva,
        cantidad: 1,
        subtotal: producto.precio,
      }]
    })
    setBusqueda('')
    setProductos([])
    inputRef.current?.focus()
  }

  function cambiarCantidad(id: string, delta: number) {
    setCarrito(prev => prev
      .map(i => i.producto_id === id
        ? { ...i, cantidad: i.cantidad + delta, subtotal: (i.cantidad + delta) * i.precio }
        : i
      )
      .filter(i => i.cantidad > 0)
    )
  }

  function eliminarItem(id: string) {
    setCarrito(prev => prev.filter(i => i.producto_id !== id))
  }

  const subtotal = carrito.reduce((acc, i) => acc + i.subtotal, 0)
  const iva = carrito.reduce((acc, i) => acc + (i.subtotal * i.alicuota_iva / 100), 0)
  const total = subtotal + iva

  return (
    <div className="flex gap-6 h-[calc(100vh-7rem)]">

      {/* Panel izquierdo — búsqueda */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">

        {/* Buscador */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <Barcode size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              ref={inputRef}
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, código de barras o SKU..."
              className="w-full h-11 pl-9 pr-9 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8] transition-colors"
            />
          </div>
        </div>

        {/* Resultados */}
        {productos.length > 0 && (
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            {productos.map((p, i) => (
              <button
                key={p.id}
                onClick={() => agregarAlCarrito(p)}
                className={`w-full flex items-center justify-between px-4 py-3 hover:bg-[#F8FAFB] transition-colors text-left ${i > 0 ? 'border-t border-[#E2E8F0]' : ''}`}
              >
                <div>
                  <p className="text-sm font-medium text-[#0F172A]">{p.nombre}</p>
                  <p className="text-xs text-[#94A3B8] mt-0.5">{p.sku || p.codigo_barras || '—'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-[#00B4D8]">${p.precio.toLocaleString('es-AR')}</p>
                  <p className="text-xs text-[#94A3B8]">IVA {p.alicuota_iva}%</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {buscando && (
          <p className="text-sm text-[#94A3B8] text-center">Buscando...</p>
        )}

        {/* Estado vacío */}
        {carrito.length === 0 && !busqueda && (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-[#94A3B8]">
            <ShoppingCart size={48} strokeWidth={1} className="mb-3" />
            <p className="text-sm">Buscá un producto o escaneá un código de barras</p>
          </div>
        )}
      </div>

      {/* Panel derecho — carrito */}
      <div className="w-80 flex flex-col bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">

        {/* Header carrito */}
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center gap-2">
          <ShoppingCart size={16} className="text-[#64748B]" />
          <span className="text-sm font-medium text-[#0F172A]">Carrito</span>
          {carrito.length > 0 && (
            <span className="ml-auto text-xs bg-[#00B4D8] text-white px-2 py-0.5 rounded-full">
              {carrito.reduce((a, i) => a + i.cantidad, 0)}
            </span>
          )}
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#E2E8F0]">
          {carrito.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-[#94A3B8]">
              Sin productos
            </div>
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
                    <button
                      onClick={() => cambiarCantidad(item.producto_id, -1)}
                      className="w-6 h-6 rounded-md border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F8FAFB] transition-colors"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-sm w-6 text-center font-medium">{item.cantidad}</span>
                    <button
                      onClick={() => cambiarCantidad(item.producto_id, 1)}
                      className="w-6 h-6 rounded-md border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F8FAFB] transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <p className="text-sm font-medium text-[#0F172A]">
                    ${item.subtotal.toLocaleString('es-AR')}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totales */}
        <div className="border-t border-[#E2E8F0] px-4 py-4 space-y-2">
          <div className="flex justify-between text-sm text-[#64748B]">
            <span>Subtotal</span>
            <span>${subtotal.toLocaleString('es-AR')}</span>
          </div>
          <div className="flex justify-between text-sm text-[#64748B]">
            <span>IVA</span>
            <span>${iva.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-base font-medium text-[#0F172A] pt-2 border-t border-[#E2E8F0]">
            <span>Total</span>
            <span className="text-[#00B4D8]">${total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>

          <button
            onClick={() => setMostrarPago(true)}
            disabled={carrito.length === 0}
            className="w-full h-11 bg-[#00B4D8] hover:bg-[#0096B4] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 mt-2"
          >
            <CreditCard size={16} />
            Cobrar ${total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </button>
        </div>
      </div>
    </div>
  )
}
