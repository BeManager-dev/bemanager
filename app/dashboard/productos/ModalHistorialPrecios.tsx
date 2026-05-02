'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, TrendingUp, TrendingDown } from 'lucide-react'

interface Producto {
  id: string
  nombre: string
  precio: number
}

interface HistorialItem {
  id: string
  precio_anterior: number
  precio_nuevo: number
  created_at: string
  perfiles: { nombre: string; apellido: string } | null
}

interface Props {
  producto: Producto
  onCerrar: () => void
}

export default function ModalHistorialPrecios({ producto, onCerrar }: Props) {
  const supabase = createClient()
  const [historial, setHistorial] = useState<HistorialItem[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    supabase
      .from('historial_precios')
      .select('id, precio_anterior, precio_nuevo, created_at, perfiles(nombre, apellido)')
      .eq('producto_id', producto.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setHistorial((data as any) || [])
        setCargando(false)
      })
  }, [])

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">

        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <div>
            <h2 className="text-base font-medium text-[#0F172A]">Historial de precios</h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">{producto.nombre}</p>
          </div>
          <button onClick={onCerrar} className="p-1.5 rounded-lg hover:bg-[#F8FAFB] text-[#64748B]">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          {/* Precio actual */}
          <div className="bg-[#E0F7FC] rounded-xl p-4 mb-4">
            <p className="text-xs text-[#00B4D8] font-medium mb-1">Precio actual</p>
            <p className="text-2xl font-medium text-[#00B4D8]">
              ${producto.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {cargando ? (
            <p className="text-sm text-[#94A3B8] text-center py-8">Cargando...</p>
          ) : historial.length === 0 ? (
            <p className="text-sm text-[#94A3B8] text-center py-8">Sin cambios de precio registrados</p>
          ) : (
            <div className="space-y-3">
              {historial.map(h => {
                const subio = h.precio_nuevo > h.precio_anterior
                const pct = Math.abs(((h.precio_nuevo - h.precio_anterior) / h.precio_anterior) * 100)
                return (
                  <div key={h.id} className="flex items-center justify-between py-3 border-b border-[#E2E8F0] last:border-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[#94A3B8] line-through">
                          ${h.precio_anterior.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-sm font-medium text-[#0F172A]">
                          ${h.precio_nuevo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className={`flex items-center gap-0.5 text-xs font-medium ${subio ? 'text-red-500' : 'text-green-500'}`}>
                          {subio ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs text-[#94A3B8] mt-0.5">
                        {h.perfiles ? `${h.perfiles.nombre} ${h.perfiles.apellido}` : 'Sistema'}
                      </p>
                    </div>
                    <p className="text-xs text-[#94A3B8]">
                      {new Date(h.created_at).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-6 pb-6">
          <button onClick={onCerrar}
            className="w-full h-10 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] hover:bg-[#F8FAFB] transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
