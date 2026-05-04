'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Search, Plus, Minus, Check, Trash2 } from 'lucide-react'

interface Deposito { id: string; nombre: string }
interface Producto {
  id: string; nombre: string; sku: string | null; codigo_barras: string | null
  stock_actual?: number
}
interface ItemAjuste {
  producto: Producto
  cantidad: number
  tipo: 'entrada' | 'salida' | 'ajuste'
  cantidad_ajuste: number
}

interface Props {
  onCerrar: () => void
  onGuardado: () => void
}

export default function AjusteMasivo({ onCerrar, onGuardado }: Props) {
  const supabase = createClient()
  const [depositos, setDepositos] = useState<Deposito[]>([])
  const [depositoId, setDepositoId] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<Producto[]>([])
  const [items, setItems] = useState<ItemAjuste[]>([])
  const [guardando, setGuardando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})

  useEffect(() => {
    async function cargar() {
      const { data } = await supabase.from('depositos').select('id, nombre').order('nombre')
      setDepositos(data || [])
      if (data && data.length > 0) setDepositoId(data[0].id)
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

    // Buscar stock actual en el depósito seleccionado
    const { data: stockData } = await supabase.from('stock')
      .select('cantidad').eq('producto_id', p.id).eq('deposito_id', depositoId).single()

    setItems(prev => [...prev, {
      producto: { ...p, stock_actual: stockData?.cantidad ?? 0 },
      cantidad: stockData?.cantidad ?? 0,
      tipo: 'entrada',
      cantidad_ajuste: 0,
    }])
    setBusqueda(''); setResultados([])
  }

  function cambiarTipo(id: string, tipo: 'entrada' | 'salida' | 'ajuste') {
    setItems(prev => prev.map(i => i.producto.id === id ? { ...i, tipo, cantidad_ajuste: 0 } : i))
  }

  function cambiarCantidadAjuste(id: string, val: number) {
    setItems(prev => prev.map(i => i.producto.id === id ? { ...i, cantidad_ajuste: val } : i))
  }

  function eliminarItem(id: string) {
    setItems(prev => prev.filter(i => i.producto.id !== id))
  }

  function calcularNuevo(item: ItemAjuste) {
    const actual = item.producto.stock_actual ?? 0
    if (item.tipo === 'entrada') return actual + item.cantidad_ajuste
    if (item.tipo === 'salida') return Math.max(0, actual - item.cantidad_ajuste)
    return item.cantidad_ajuste
  }

  async function guardar() {
    const errs: Record<string, string> = {}
    if (!depositoId) errs.deposito = 'Selecciona un deposito'
    if (items.length === 0) errs.items = 'Agrega al menos un producto'
    if (!motivo.trim()) errs.motivo = 'Ingresa un motivo'
    items.forEach(i => {
      if (i.cantidad_ajuste <= 0 && i.tipo !== 'ajuste') errs[i.producto.id] = 'Cantidad debe ser mayor a 0'
      if (i.tipo === 'ajuste' && i.cantidad_ajuste < 0) errs[i.producto.id] = 'Cantidad no puede ser negativa'
    })
    if (Object.keys(errs).length > 0) { setErrores(errs); return }

    setGuardando(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setGuardando(false); return }

    for (const item of items) {
      const nuevaCantidad = calcularNuevo(item)
      const tipoMovimiento = item.tipo === 'entrada' ? 'entrada' : item.tipo === 'salida' ? 'salida' : 'ajuste'

      // Actualizar stock
      const { data: stockExistente } = await supabase.from('stock')
        .select('id').eq('producto_id', item.producto.id).eq('deposito_id', depositoId).single()

      if (stockExistente) {
        await supabase.from('stock').update({ cantidad: nuevaCantidad })
          .eq('producto_id', item.producto.id).eq('deposito_id', depositoId)
      } else {
        await supabase.from('stock').insert({
          producto_id: item.producto.id, deposito_id: depositoId, cantidad: nuevaCantidad
        })
      }

      // Registrar movimiento
      await supabase.from('movimientos_stock').insert({
        producto_id:  item.producto.id,
        deposito_id:  depositoId,
        tipo:         tipoMovimiento,
        cantidad:     item.tipo === 'ajuste' ? nuevaCantidad - (item.producto.stock_actual ?? 0) : item.cantidad_ajuste,
        motivo:       motivo,
        usuario_id:   user.id,
      })
    }

    setGuardando(false)
    onGuardado()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-base font-medium text-[#0F172A]">Ajuste masivo de stock</h2>
          <button onClick={onCerrar} className="p-1.5 rounded-lg hover:bg-[#F8FAFB] text-[#64748B]">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-[#E2E8F0] space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-[#64748B] mb-1.5">Deposito *</label>
              <select value={depositoId} onChange={e => { setDepositoId(e.target.value); setItems([]) }}
                className={`w-full h-10 px-3 rounded-lg border text-sm focus:outline-none focus:border-[#00B4D8] bg-white ${errores.deposito ? 'border-red-400' : 'border-[#E2E8F0]'}`}>
                {depositos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
              {errores.deposito && <p className="text-xs text-red-500 mt-1">{errores.deposito}</p>}
            </div>
            <div>
              <label className="block text-sm text-[#64748B] mb-1.5">Motivo *</label>
              <input value={motivo} onChange={e => { setMotivo(e.target.value); setErrores(p => ({ ...p, motivo: '' })) }}
                placeholder="Ej: Recepcion mercaderia, inventario..."
                className={`w-full h-10 px-3 rounded-lg border text-sm placeholder:text-[#94A3B8] focus:outline-none focus:ring-1 ${errores.motivo ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : 'border-[#E2E8F0] focus:border-[#00B4D8] focus:ring-[#00B4D8]'}`}
              />
              {errores.motivo && <p className="text-xs text-red-500 mt-1">{errores.motivo}</p>}
            </div>
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
              Buscá y agregá productos para ajustar
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-[#F8FAFB]">
                <tr className="border-b border-[#E2E8F0]">
                  <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">Producto</th>
                  <th className="text-center text-xs font-medium text-[#64748B] px-4 py-3">Stock actual</th>
                  <th className="text-center text-xs font-medium text-[#64748B] px-4 py-3">Tipo</th>
                  <th className="text-center text-xs font-medium text-[#64748B] px-4 py-3">Cantidad</th>
                  <th className="text-center text-xs font-medium text-[#64748B] px-4 py-3">Nuevo stock</th>
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
                      <span className="text-sm font-medium text-[#0F172A]">{item.producto.stock_actual ?? 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-center">
                        {(['entrada', 'salida', 'ajuste'] as const).map(t => (
                          <button key={t} onClick={() => cambiarTipo(item.producto.id, t)}
                            className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${
                              item.tipo === t
                                ? t === 'entrada' ? 'bg-green-100 text-green-700'
                                  : t === 'salida' ? 'bg-red-100 text-red-600'
                                  : 'bg-[#E0F7FC] text-[#00B4D8]'
                                : 'bg-[#F8FAFB] text-[#64748B] hover:bg-[#E2E8F0]'
                            }`}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-center">
                        <button onClick={() => cambiarCantidadAjuste(item.producto.id, Math.max(0, item.cantidad_ajuste - 1))}
                          className="w-7 h-7 rounded-lg border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F8FAFB]">
                          <Minus size={12} />
                        </button>
                        <input type="number" min={0} value={item.cantidad_ajuste || ''}
                          onChange={e => cambiarCantidadAjuste(item.producto.id, Number(e.target.value) || 0)}
                          placeholder="0"
                          className="w-16 h-7 text-center rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:border-[#00B4D8]"
                        />
                        <button onClick={() => cambiarCantidadAjuste(item.producto.id, item.cantidad_ajuste + 1)}
                          className="w-7 h-7 rounded-lg border border-[#E2E8F0] flex items-center justify-center hover:bg-[#F8FAFB]">
                          <Plus size={12} />
                        </button>
                      </div>
                      {errores[item.producto.id] && <p className="text-xs text-red-500 text-center mt-1">{errores[item.producto.id]}</p>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-medium ${
                        calcularNuevo(item) > (item.producto.stock_actual ?? 0) ? 'text-green-600'
                        : calcularNuevo(item) < (item.producto.stock_actual ?? 0) ? 'text-red-500'
                        : 'text-[#0F172A]'
                      }`}>
                        {calcularNuevo(item)}
                      </span>
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
              {guardando ? 'Guardando...' : 'Confirmar ajuste'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
