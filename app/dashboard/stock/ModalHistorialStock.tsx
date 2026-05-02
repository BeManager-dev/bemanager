'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, ArrowUp, ArrowDown, ArrowLeftRight, RefreshCw } from 'lucide-react'

interface StockItem { producto_id: string; nombre: string }
interface Deposito { id: string; nombre: string }
interface Props {
  producto: StockItem
  depositos: Deposito[]
  onCerrar: () => void
}

interface Movimiento {
  id: string
  tipo: string
  cantidad: number
  cantidad_anterior: number | null
  cantidad_posterior: number | null
  deposito_origen_id: string | null
  deposito_destino_id: string | null
  motivo: string | null
  created_at: string
  perfiles: { nombre: string; apellido: string } | null
}

export default function ModalHistorialStock({ producto, depositos, onCerrar }: Props) {
  const supabase = createClient()
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [cargando, setCargando] = useState(true)

  const depMap = Object.fromEntries(depositos.map(d => [d.id, d.nombre]))

  useEffect(() => {
    supabase.from('movimientos_stock')
      .select('id, tipo, cantidad, cantidad_anterior, cantidad_posterior, deposito_origen_id, deposito_destino_id, motivo, created_at, perfiles(nombre, apellido)')
      .eq('producto_id', producto.producto_id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setMovimientos((data as any) || [])
        setCargando(false)
      })
  }, [])

  function IconTipo({ tipo }: { tipo: string }) {
    if (tipo === 'entrada') return <ArrowUp size={14} className="text-green-500" />
    if (tipo === 'salida')  return <ArrowDown size={14} className="text-red-400" />
    if (tipo === 'transferencia') return <ArrowLeftRight size={14} className="text-[#00B4D8]" />
    return <RefreshCw size={14} className="text-purple-400" />
  }

  function labelTipo(m: Movimiento) {
    if (m.tipo === 'transferencia') {
      return `${depMap[m.deposito_origen_id!] || '?'} → ${depMap[m.deposito_destino_id!] || '?'}`
    }
    if (m.tipo === 'entrada') return depMap[m.deposito_destino_id!] || 'Entrada'
    if (m.tipo === 'salida')  return depMap[m.deposito_origen_id!]  || 'Salida'
    return 'Ajuste'
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">

        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <div>
            <h2 className="text-base font-medium text-[#0F172A]">Historial de movimientos</h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">{producto.nombre}</p>
          </div>
          <button onClick={onCerrar} className="p-1.5 rounded-lg hover:bg-[#F8FAFB] text-[#64748B]">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {cargando ? (
            <p className="text-sm text-[#94A3B8] text-center py-8">Cargando...</p>
          ) : movimientos.length === 0 ? (
            <p className="text-sm text-[#94A3B8] text-center py-8">Sin movimientos registrados</p>
          ) : (
            <div className="space-y-0 divide-y divide-[#E2E8F0]">
              {movimientos.map(m => (
                <div key={m.id} className="flex items-center gap-3 py-3">
                  <div className="w-7 h-7 rounded-lg bg-[#F8FAFB] border border-[#E2E8F0] flex items-center justify-center shrink-0">
                    <IconTipo tipo={m.tipo} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#0F172A] capitalize">{m.tipo}</span>
                      <span className="text-xs text-[#94A3B8]">{labelTipo(m)}</span>
                    </div>
                    {m.motivo && <p className="text-xs text-[#64748B] mt-0.5 truncate">{m.motivo}</p>}
                    <p className="text-xs text-[#94A3B8] mt-0.5">
                      {m.perfiles ? `${m.perfiles.nombre} ${m.perfiles.apellido}` : 'Sistema'} · {new Date(m.created_at).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-medium ${
                      m.tipo === 'entrada' ? 'text-green-600'
                      : m.tipo === 'salida' ? 'text-red-500'
                      : 'text-[#00B4D8]'
                    }`}>
                      {m.tipo === 'salida' ? '-' : '+'}{m.cantidad}
                    </p>
                    {m.cantidad_anterior !== null && m.cantidad_posterior !== null && (
                      <p className="text-xs text-[#94A3B8]">{m.cantidad_anterior} → {m.cantidad_posterior}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 pb-6">
          <button onClick={onCerrar}
            className="w-full h-10 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] hover:bg-[#F8FAFB] transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
