'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'

interface ProductoDefectuoso {
  id: string
  cantidad: number
  motivo: string
  created_at: string
  productos: { nombre: string; sku: string | null } | null
  puntos_venta: { nombre: string } | null
  perfiles: { nombre: string; apellido: string } | null
}

const POR_PAGINA = 50

export default function DefectuososPage() {
  const supabase = createClient()
  const [items, setItems] = useState<ProductoDefectuoso[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)

  async function cargar() {
    setCargando(true)
    let query = supabase
      .from('productos_defectuosos')
      .select('id, cantidad, motivo, created_at, productos(nombre, sku), puntos_venta(nombre), perfiles(nombre, apellido)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)

    if (busqueda) query = query.ilike('productos.nombre', `%${busqueda}%`)

    const { data, count } = await query
    setItems((data as any) || [])
    setTotal(count || 0)
    setCargando(false)
  }

  useEffect(() => { cargar() }, [pagina, busqueda])

  const totalPaginas = Math.ceil(total / POR_PAGINA)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-[#0F172A]">Productos defectuosos</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{total} registros</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
            placeholder="Buscar por producto..."
            className="w-full h-9 pl-8 pr-3 rounded-lg border border-[#E2E8F0] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFB]">
              <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">Producto</th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Cantidad</th>
              <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">Motivo</th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Sucursal</th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Registrado por</th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {cargando ? (
              <tr><td colSpan={6} className="text-center py-12 text-sm text-[#94A3B8]">Cargando...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-sm text-[#94A3B8]">Sin registros</td></tr>
            ) : (
              items.map(item => (
                <tr key={item.id} className="hover:bg-[#F8FAFB] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={14} className="text-orange-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-[#0F172A]">{(item.productos as any)?.nombre || '—'}</p>
                        {(item.productos as any)?.sku && <p className="text-xs text-[#94A3B8]">{(item.productos as any).sku}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-red-500">{item.cantidad}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-[#64748B]">{item.motivo}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm text-[#64748B]">{(item.puntos_venta as any)?.nombre || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm text-[#64748B]">
                      {(item.perfiles as any) ? `${(item.perfiles as any).nombre} ${(item.perfiles as any).apellido}` : '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm text-[#64748B]">{new Date(item.created_at).toLocaleDateString('es-AR')}</p>
                    <p className="text-xs text-[#94A3B8]">{new Date(item.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPaginas > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#E2E8F0]">
            <p className="text-sm text-[#64748B]">Mostrando {((pagina-1)*POR_PAGINA)+1}-{Math.min(pagina*POR_PAGINA, total)} de {total}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPagina(p => Math.max(1, p-1))} disabled={pagina === 1}
                className="p-1.5 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFB] disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronLeft size={16} className="text-[#64748B]" />
              </button>
              <span className="text-sm text-[#64748B]">{pagina} / {totalPaginas}</span>
              <button onClick={() => setPagina(p => Math.min(totalPaginas, p+1))} disabled={pagina === totalPaginas}
                className="p-1.5 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFB] disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronRight size={16} className="text-[#64748B]" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
