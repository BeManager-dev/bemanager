'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, ArrowRight, Search } from 'lucide-react'

interface StockItem {
  producto_id: string
  nombre: string
  depositos: Record<string, number>
}

interface Deposito { id: string; nombre: string }

interface Props {
  producto: StockItem | null
  depositos: Deposito[]
  onCerrar: () => void
  onGuardado: () => void
}

interface ProductoBusqueda {
  id: string
  nombre: string
  sku: string | null
}

export default function ModalTransferencia({ producto, depositos, onCerrar, onGuardado }: Props) {
  const supabase = createClient()
  const [productoSeleccionado, setProductoSeleccionado] = useState<StockItem | null>(producto)
  const [busqueda, setBusqueda] = useState(producto?.nombre || '')
  const [resultados, setResultados] = useState<ProductoBusqueda[]>([])
  const [origenId, setOrigenId] = useState(depositos[0]?.id || '')
  const [destinoId, setDestinoId] = useState(depositos[1]?.id || '')
  const [cantidad, setCantidad] = useState(1)
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!producto && busqueda.length >= 2) {
      const timeout = setTimeout(async () => {
        const { data } = await supabase.from('productos')
          .select('id, nombre, sku').eq('activo', true)
          .ilike('nombre', `%${busqueda}%`).limit(6)
        setResultados(data || [])
      }, 300)
      return () => clearTimeout(timeout)
    } else {
      setResultados([])
    }
  }, [busqueda])

  async function seleccionarProducto(p: ProductoBusqueda) {
    const { data } = await supabase.from('stock').select('deposito_id, cantidad').eq('producto_id', p.id)
    const deps: Record<string, number> = {}
    data?.forEach(s => { deps[s.deposito_id] = Number(s.cantidad) })
    setProductoSeleccionado({ producto_id: p.id, nombre: p.nombre, depositos: deps })
    setBusqueda(p.nombre)
    setResultados([])
  }

  const stockOrigen = productoSeleccionado?.depositos[origenId] ?? 0

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    if (!productoSeleccionado) return
    setGuardando(true)
    setError('')

    if (origenId === destinoId) { setError('El origen y destino deben ser distintos.'); setGuardando(false); return }
    if (cantidad > stockOrigen) { setError(`Stock insuficiente en origen. Disponible: ${stockOrigen}`); setGuardando(false); return }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const nuevoOrigen = stockOrigen - cantidad
    const nuevoDestino = (productoSeleccionado.depositos[destinoId] ?? 0) + cantidad

    // Actualizar origen
    await supabase.from('stock').upsert({
      producto_id: productoSeleccionado.producto_id,
      deposito_id: origenId,
      cantidad: nuevoOrigen,
    }, { onConflict: 'producto_id,deposito_id' })

    // Actualizar destino
    await supabase.from('stock').upsert({
      producto_id: productoSeleccionado.producto_id,
      deposito_id: destinoId,
      cantidad: nuevoDestino,
    }, { onConflict: 'producto_id,deposito_id' })

    // Registrar movimiento
    await supabase.from('movimientos_stock').insert({
      tipo: 'transferencia',
      producto_id: productoSeleccionado.producto_id,
      deposito_origen_id: origenId,
      deposito_destino_id: destinoId,
      cantidad,
      cantidad_anterior: stockOrigen,
      cantidad_posterior: nuevoOrigen,
      motivo: motivo || null,
      usuario_id: user.id,
    })

    setGuardando(false)
    onGuardado()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">

        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-base font-medium text-[#0F172A]">Transferir stock</h2>
          <button onClick={onCerrar} className="p-1.5 rounded-lg hover:bg-[#F8FAFB] text-[#64748B]">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleGuardar}>
          <div className="px-6 py-5 space-y-4">

            {/* Producto */}
            <div>
              <label className="block text-sm text-[#64748B] mb-1.5">Producto</label>
              {producto ? (
                <div className="h-10 px-3 rounded-lg border border-[#E2E8F0] flex items-center text-sm text-[#0F172A] bg-[#F8FAFB]">
                  {producto.nombre}
                </div>
              ) : (
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input value={busqueda} onChange={e => { setBusqueda(e.target.value); setProductoSeleccionado(null) }}
                    placeholder="Buscar producto..."
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                  />
                  {resultados.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-[#E2E8F0] rounded-lg mt-1 shadow-lg z-10 overflow-hidden">
                      {resultados.map(r => (
                        <button key={r.id} type="button" onClick={() => seleccionarProducto(r)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-[#F8FAFB] transition-colors border-b border-[#E2E8F0] last:border-0">
                          {r.nombre}
                          {r.sku && <span className="text-xs text-[#94A3B8] ml-2">{r.sku}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Origen → Destino */}
            <div>
              <label className="block text-sm text-[#64748B] mb-2">Recorrido</label>
              <div className="flex items-center gap-2">
                <select value={origenId} onChange={e => setOrigenId(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#00B4D8] bg-white"
                >
                  {depositos.map(d => (
                    <option key={d.id} value={d.id}>{d.nombre}</option>
                  ))}
                </select>
                <ArrowRight size={16} className="text-[#94A3B8] shrink-0" />
                <select value={destinoId} onChange={e => setDestinoId(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#00B4D8] bg-white"
                >
                  {depositos.map(d => (
                    <option key={d.id} value={d.id}>{d.nombre}</option>
                  ))}
                </select>
              </div>
              {productoSeleccionado && (
                <p className="text-xs text-[#94A3B8] mt-1.5">
                  Stock disponible en origen: <span className="font-medium text-[#0F172A]">{stockOrigen}</span>
                </p>
              )}
            </div>

            {/* Cantidad */}
            <div>
              <label className="block text-sm text-[#64748B] mb-1.5">Cantidad a transferir</label>
              <input type="number" min={1} max={stockOrigen || undefined} value={cantidad}
                onChange={e => setCantidad(Number(e.target.value))} required
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
              />
            </div>

            {/* Motivo */}
            <div>
              <label className="block text-sm text-[#64748B] mb-1.5">Motivo <span className="text-[#94A3B8]">(opcional)</span></label>
              <input type="text" value={motivo} onChange={e => setMotivo(e.target.value)}
                placeholder="Ej: Reposición sucursal, pedido especial..."
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
              />
            </div>

            {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          </div>

          <div className="px-6 pb-6 flex gap-3">
            <button type="button" onClick={onCerrar}
              className="flex-1 h-10 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] hover:bg-[#F8FAFB] transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={guardando || !productoSeleccionado}
              className="flex-1 h-10 bg-[#00B4D8] hover:bg-[#0096B4] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
              {guardando ? 'Transfiriendo...' : 'Confirmar transferencia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
