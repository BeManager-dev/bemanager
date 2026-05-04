'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Search, Plus, Minus, Check, Trash2, ArrowRight } from 'lucide-react'

interface Deposito { id: string; nombre: string }
interface Producto { id: string; nombre: string; sku: string | null; codigo_barras: string | null; stock_origen?: number }
interface ItemTransferencia { producto: Producto; cantidad: number }

interface Props {
  onCerrar: () => void
  onGuardado: () => void
}

export default function TransferenciaMasiva({ onCerrar, onGuardado }: Props) {
  const supabase = createClient()
  const [depositos, setDepositos] = useState<Deposito[]>([])
  const [origenId, setOrigenId] = useState('')
  const [destinoId, setDestinoId] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<Producto[]>([])
  const [items, setItems] = useState<ItemTransferencia[]>([])
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState<Record<string, string>>({})

  useEffect(() => {
    async function cargar() {
      const { data } = await supabase.from('depositos').select('id, nombre').order('nombre')
      setDepositos(data || [])
      if (data && data.length >= 2) {
        setOrigenId(data[0].id)
        setDestinoId(data[1].id)
      }
    }
    cargar()
  }, [])

  useEffect(() => {
    if (busqueda.length < 2) { setResultados([]); return }
    const timeout = setTimeout(async () => {
      const { data } = await supabase.from('productos')
        .select('id, nombre, sku, codigo_barras')
        .eq('activo', true)
        .or(`nombre.ilike.%${busqueda}%,sku.ilike.%${busqueda}%,codigo_barras.eq.${busqueda}`)
        .limit(8)
      setResultados(data || [])
    }, 300)
    return () => clearTimeout(timeout)
  }, [busqueda])

  async function agregarProducto(p: Producto) {
    if (items.find(i => i.producto.id === p.id)) { setBusqueda(''); setResultados([]); return }
    const { data } = await supabase.from('stock')
      .select('cantidad').eq('producto_id', p.id).eq('deposito_id', origenId).single()
    setItems(prev => [...prev, {
      producto: { ...p, stock_origen: data?.cantidad ?? 0 },
      cantidad: 1,
    }])
    setBusqueda(''); setResultados([])
  }

  function cambiarCantidad(id: string, val: number) {
    setItems(prev => prev.map(i => i.producto.id === id ? { ...i, cantidad: Math.max(1, val) } : i))
  }

  function eliminarItem(id: string) {
    setItems(prev => prev.filter(i => i.producto.id !== id))
  }

  async function guardar() {
    const errs: Record<string, string> = {}
    if (!origenId) errs.origen = 'Selecciona origen'
    if (!destinoId) errs.destino = 'Selecciona destino'
    if (origenId === destinoId) errs.destino = 'Origen y destino deben ser distintos'
    if (items.length === 0) errs.items = 'Agrega al menos un producto'
    if (!motivo.trim()) errs.motivo = 'Ingresa un motivo'
    items.forEach(i => {
      if (i.cantidad <= 0) errs[i.producto.id] = 'Cantidad debe ser mayor a 0'
      if (i.cantidad > (i.producto.stock_origen ?? 0)) errs[i.producto.id] = `Stock insuficiente (disponible: ${i.producto.stock_origen ?? 0})`
    })
    if (Object.keys(errs).length > 0) { setErrores(errs); return }

    setGuardando(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setGuardando(false); return }

    for (const item of items) {
      const stockOrigen = item.producto.stock_origen ?? 0
      const nuevaCantOrigen = stockOrigen - item.cantidad

      // Actualizar origen
      await supabase.from('stock').update({ cantidad: nuevaCantOrigen })
        .eq('producto_id', item.producto.id).eq('deposito_id', origenId)

      // Actualizar destino
      const { data: stockDestino } = await supabase.from('stock')
        .select('cantidad').eq('producto_id', item.producto.id).eq('deposito_id', destinoId).single()

      if (stockDestino) {
        await supabase.from('stock').update({ cantidad: stockDestino.cantidad + item.cantidad })
          .eq('producto_id', item.producto.id).eq('deposito_id', destinoId)
      } else {
        await supabase.from('stock').insert({
          producto_id: item.producto.id, deposito_id: destinoId, cantidad: item.cantidad
        })
      }

      // Movimiento salida
      await supabase.from('movimientos_stock').insert({
        producto_id: item.producto.id, deposito_id: origenId,
        tipo: 'transferencia_salida', cantidad: -item.cantidad,
        motivo, usuario_id: user.id,
      })

      // Movimiento entrada
      await supabase.from('movimientos_stock').insert({
        producto_id: item.producto.id, deposito_id: destinoId,
        tipo: 'transferencia_entrada', cantidad: item.cantidad,
        motivo, usuario_id: user.id,
      })
    }

    setGuardando(false)
    onGuardado()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-base font-medium text-[#0F172A]">Transferencia masiva de stock</h2>
          <button onClick={onCerrar} className="p-1.5 rounded-lg hover:bg-[#F8FAFB] text-[#64748B]">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-[#E2E8F0] space-y-3">
          <div className="grid grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-sm text-[#64748B] mb-1.5">Origen *</label>
              <select value={origenId} onChange={e => { setOrigenId(e.target.value); setItems([]) }}
                className={`w-full h-10 px-3 rounded-lg border text-sm focus:outline-none focus:border-[#00B4D8] bg-white ${errores.origen ? 'border-red-400' : 'border-[#E2E8F0]'}`}>
                {depositos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
              {errores.origen && <p className="text-xs text-red-500 mt-1">{errores.origen}</p>}
            </div>
            <div className="flex justify-center pb-2">
              <ArrowRight size={20} className="text-[#00B4D8]" />
            </div>
            <div>
              <label className="block text-sm text-[#64748B] mb-1.5">Destino *</label>
              <select value={destinoId} onChange={e => setDestinoId(e.target.value)}
                className={`w-full h-10 px-3 rounded-lg border text-sm focus:outline-none focus:border-[#00B4D8] bg-white ${errores.destino ? 'border-red-400' : 'border-[#E2E8F0]'}`}>
                {depositos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
              {errores.destino && <p className="text-xs text-red-500 mt-1">{errores.destino}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm text-[#64748B] mb-1.5">Motivo *</label>
            <input value={motivo} onChange={e => { setMotivo(e.target.value); setErrores(p => ({ ...p, motivo: '' })) }}
              placeholder="Ej: Reposicion sucursal, inventario..."
              className={`w-full h-10 px-3 rounded-lg border text-sm placeholder:text-[#94A3B8] focus:outline-none focus:ring-1 ${errores.motivo ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : 'border-[#E2E8F0] focus:border-[#00B4D8] focus:ring-[#00B4D8]'}`}
            />
            {errores.motivo && <p className="text-xs text-red-500 mt-1">{errores.motivo}</p>}
          </div>

          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar producto por nombre, SKU o codigo de barras..."
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#E2E8F0] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
            />
            {resultados.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-[#E2E8F0] rounded-xl mt-1 shadow-lg z-10 overflow-hidden">
                {resultados.map(p => (
                  <button key={p.id} onClick={() => agregarProducto(p)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#F8FAFB] transition-colors border-b border-[#E2E8F0] last:border-0 flex items-center justify-between">
                    <span className="font-medium text-[#0F172A]">{p.nombre}</span>
                    <span className="text-xs text-[#94A3B8]">{p.sku || p.codigo_barras || ''}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {errores.items && <p className="text-xs text-red-500">{errores.items}</p>}
        </div>

        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-[#94A3B8]">
              Buscá y agregá productos para transferir
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-[#F8FAFB]">
                <tr className="border-b border-[#E2E8F0]">
                  <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">Producto</th>
                  <th className="text-center text-xs font-medium text-[#64748B] px-4 py-3">Stock en origen</th>
                  <th className="text-center text-xs font-medium text-[#64748B] px-4 py-3">Cantidad a transferir</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {items.map(item => (
                  <tr key={item.producto.id} className="hover:bg-[#F8FAFB]">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-[#0F172A]">{item.producto.nombre}</p>
                      <p className="text-xs text-[#94A3B8]">{item.producto.sku || item.producto.codigo_barras || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-medium ${(item.producto.stock_origen ?? 0) === 0 ? 'text-red-500' : 'text-[#0F172A]'}`}>
                        {item.producto.stock_origen ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-center">
                        <button onClick={() => cambiarCantidad(item.producto.id, item.cantidad - 1)}
                          className="w-7 h-7 rounded-lg border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F8FAFB]">
                          <Minus size={12} />
                        </button>
                        <input type="number" min={1} value={item.cantidad || ''}
                          onChange={e => cambiarCantidad(item.producto.id, Number(e.target.value) || 1)}
                          className="w-16 h-7 text-center rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:border-[#00B4D8]"
                        />
                        <button onClick={() => cambiarCantidad(item.producto.id, item.cantidad + 1)}
                          className="w-7 h-7 rounded-lg border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F8FAFB]">
                          <Plus size={12} />
                        </button>
                      </div>
                      {errores[item.producto.id] && <p className="text-xs text-red-500 text-center mt-1">{errores[item.producto.id]}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => eliminarItem(item.producto.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-[#94A3B8] hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#E2E8F0] flex items-center justify-between">
          <p className="text-sm text-[#64748B]">{items.length} producto{items.length !== 1 ? 's' : ''} seleccionado{items.length !== 1 ? 's' : ''}</p>
          <div className="flex gap-3">
            <button onClick={onCerrar}
              className="h-10 px-4 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] hover:bg-[#F8FAFB] transition-colors">
              Cancelar
            </button>
            <button onClick={guardar} disabled={guardando || items.length === 0}
              className="h-10 px-4 bg-[#00B4D8] hover:bg-[#0096B4] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
              <Check size={15} />
              {guardando ? 'Transfiriendo...' : 'Confirmar transferencia'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
