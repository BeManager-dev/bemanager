'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'

interface StockItem {
  producto_id: string
  nombre: string
  depositos: Record<string, number>
}

interface Deposito { id: string; nombre: string }

interface Props {
  producto: StockItem
  depositos: Deposito[]
  onCerrar: () => void
  onGuardado: () => void
}

export default function ModalAjusteStock({ producto, depositos, onCerrar, onGuardado }: Props) {
  const supabase = createClient()
  const [depositoId, setDepositoId] = useState(depositos[0]?.id || '')
  const [tipo, setTipo] = useState<'entrada' | 'salida' | 'ajuste'>('entrada')
  const [cantidad, setCantidad] = useState(1)
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const stockActual = producto.depositos[depositoId] ?? 0

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const cantidadFinal = tipo === 'salida' ? -cantidad : cantidad
    const nuevaCantidad = tipo === 'ajuste' ? cantidad : stockActual + cantidadFinal

    if (nuevaCantidad < 0) {
      setError('El stock no puede quedar negativo.')
      setGuardando(false)
      return
    }

    // Upsert stock
    const { error: errStock } = await supabase.from('stock').upsert({
      producto_id: producto.producto_id,
      deposito_id: depositoId,
      cantidad: nuevaCantidad,
    }, { onConflict: 'producto_id,deposito_id' })

    if (errStock) { setError(errStock.message); setGuardando(false); return }

    // Registrar movimiento
    await supabase.from('movimientos_stock').insert({
      tipo: tipo === 'ajuste' ? 'ajuste' : tipo === 'entrada' ? 'entrada' : 'salida',
      producto_id: producto.producto_id,
      deposito_destino_id: tipo !== 'salida' ? depositoId : null,
      deposito_origen_id: tipo === 'salida' ? depositoId : null,
      cantidad: tipo === 'ajuste' ? cantidad : Math.abs(cantidadFinal),
      cantidad_anterior: stockActual,
      cantidad_posterior: nuevaCantidad,
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
          <div>
            <h2 className="text-base font-medium text-[#0F172A]">Ajustar stock</h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">{producto.nombre}</p>
          </div>
          <button onClick={onCerrar} className="p-1.5 rounded-lg hover:bg-[#F8FAFB] text-[#64748B]">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleGuardar}>
          <div className="px-6 py-5 space-y-4">

            {/* Ubicación */}
            <div>
              <label className="block text-sm text-[#64748B] mb-1.5">Ubicación</label>
              <select value={depositoId} onChange={e => setDepositoId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#00B4D8] bg-white"
              >
                {depositos.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.nombre} — Stock actual: {producto.depositos[d.id] ?? 0}
                  </option>
                ))}
              </select>
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-sm text-[#64748B] mb-2">Tipo de movimiento</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'entrada', label: 'Entrada',  color: 'text-green-600', bg: 'bg-green-50 border-green-300' },
                  { id: 'salida',  label: 'Salida',   color: 'text-red-500',   bg: 'bg-red-50 border-red-300'     },
                  { id: 'ajuste',  label: 'Ajuste',   color: 'text-[#00B4D8]', bg: 'bg-[#E0F7FC] border-[#00B4D8]' },
                ].map(t => (
                  <button key={t.id} type="button" onClick={() => setTipo(t.id as any)}
                    className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                      tipo === t.id ? `${t.bg} ${t.color}` : 'border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFB]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {tipo === 'ajuste' && (
                <p className="text-xs text-[#94A3B8] mt-1.5">El ajuste establece el stock exacto en esa ubicación.</p>
              )}
            </div>

            {/* Cantidad */}
            <div>
              <label className="block text-sm text-[#64748B] mb-1.5">
                {tipo === 'ajuste' ? 'Cantidad final' : 'Cantidad'}
              </label>
              <input type="number" min={1} value={cantidad} onChange={e => setCantidad(Number(e.target.value))} required
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
              />
              {tipo !== 'ajuste' && (
                <p className="text-xs text-[#94A3B8] mt-1">
                  Stock resultante: <span className="font-medium text-[#0F172A]">
                    {tipo === 'entrada' ? stockActual + cantidad : Math.max(0, stockActual - cantidad)}
                  </span>
                </p>
              )}
            </div>

            {/* Motivo */}
            <div>
              <label className="block text-sm text-[#64748B] mb-1.5">Motivo <span className="text-[#94A3B8]">(opcional)</span></label>
              <input type="text" value={motivo} onChange={e => setMotivo(e.target.value)}
                placeholder="Ej: Compra a proveedor, rotura, inventario..."
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
            <button type="submit" disabled={guardando}
              className="flex-1 h-10 bg-[#00B4D8] hover:bg-[#0096B4] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
              {guardando ? 'Guardando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
