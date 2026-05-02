'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Pencil, Trash2, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Trophy } from 'lucide-react'
import ModalCliente from './ModalCliente'

interface Cliente {
  id: string
  razon_social: string
  nombre_fantasia: string | null
  cuit: string | null
  dni: string | null
  condicion_iva: string
  email: string | null
  telefono: string | null
  ciudad: string | null
  provincia: string | null
  activo: boolean
  created_at: string
  total_compras?: number
  monto_total?: number
}

type OrdenCol = 'razon_social' | 'monto_total' | 'total_compras' | 'created_at'
type OrdenDir = 'asc' | 'desc'
const POR_PAGINA = 50

function IconOrden({ col, actual, dir }: { col: OrdenCol; actual: OrdenCol; dir: OrdenDir }) {
  if (col !== actual) return <ArrowUpDown size={13} className="text-[#CBD5E1]" />
  return dir === 'asc' ? <ArrowUp size={13} className="text-[#00B4D8]" /> : <ArrowDown size={13} className="text-[#00B4D8]" />
}

function medallaRanking(pos: number) {
  if (pos === 1) return <span className="text-yellow-500">🥇</span>
  if (pos === 2) return <span className="text-gray-400">🥈</span>
  if (pos === 3) return <span className="text-orange-400">🥉</span>
  return <span className="text-xs text-[#94A3B8] font-medium">#{pos}</span>
}

export default function ClientesPage() {
  const supabase = createClient()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
  const [ordenCol, setOrdenCol] = useState<OrdenCol>('razon_social')
  const [ordenDir, setOrdenDir] = useState<OrdenDir>('asc')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [vistaRanking, setVistaRanking] = useState(false)

  const [modalAbierto, setModalAbierto] = useState(false)
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null)

  function toggleOrden(col: OrdenCol) {
    if (ordenCol === col) setOrdenDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setOrdenCol(col); setOrdenDir('asc') }
    setPagina(1)
  }

  async function cargarClientes() {
    setCargando(true)

    // Traer clientes
    let query = supabase
      .from('clientes')
      .select('id, razon_social, nombre_fantasia, cuit, dni, condicion_iva, email, telefono, ciudad, provincia, activo, created_at', { count: 'exact' })
      .order(ordenCol === 'monto_total' || ordenCol === 'total_compras' ? 'razon_social' : ordenCol, { ascending: ordenDir === 'asc' })
      .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)

    if (busqueda) query = query.or(`razon_social.ilike.%${busqueda}%,cuit.ilike.%${busqueda}%,dni.ilike.%${busqueda}%,email.ilike.%${busqueda}%`)
    if (filtroEstado !== '') query = query.eq('activo', filtroEstado === 'activo')

    const { data, count } = await query

    if (!data) { setCargando(false); return }

    // Traer totales de compras por cliente
    const ids = data.map(c => c.id)
    let stats: Record<string, { total_compras: number; monto_total: number }> = {}

    if (ids.length > 0) {
      const { data: comprobantes } = await supabase
        .from('comprobantes')
        .select('cliente_id, total')
        .in('cliente_id', ids)
        .eq('estado', 'emitido')
        .in('tipo', ['factura_a', 'factura_b', 'factura_c'])

      comprobantes?.forEach(c => {
        if (!stats[c.cliente_id]) stats[c.cliente_id] = { total_compras: 0, monto_total: 0 }
        stats[c.cliente_id].total_compras++
        stats[c.cliente_id].monto_total += Number(c.total)
      })
    }

    let result = data.map(c => ({
      ...c,
      total_compras: stats[c.id]?.total_compras ?? 0,
      monto_total: stats[c.id]?.monto_total ?? 0,
    }))

    // Ordenar por stats si corresponde
    if (ordenCol === 'monto_total') {
      result.sort((a, b) => ordenDir === 'asc' ? a.monto_total - b.monto_total : b.monto_total - a.monto_total)
    } else if (ordenCol === 'total_compras') {
      result.sort((a, b) => ordenDir === 'asc' ? a.total_compras - b.total_compras : b.total_compras - a.total_compras)
    }

    setClientes(result)
    setTotal(count || 0)
    setCargando(false)
  }

  useEffect(() => { cargarClientes() }, [pagina, busqueda, filtroEstado, ordenCol, ordenDir])

  const totalPaginas = Math.ceil(total / POR_PAGINA)

  async function eliminarCliente(c: Cliente) {
    if (!confirm(`¿Eliminar a "${c.razon_social}"? Esta acción no se puede deshacer.`)) return
    await supabase.from('clientes').delete().eq('id', c.id)
    cargarClientes()
  }

  async function toggleActivo(c: Cliente) {
    await supabase.from('clientes').update({ activo: !c.activo }).eq('id', c.id)
    cargarClientes()
  }

  // Ranking: top 10 por monto
  const ranking = [...clientes].sort((a, b) => (b.monto_total ?? 0) - (a.monto_total ?? 0)).slice(0, 10)

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-[#0F172A]">Clientes</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{total} clientes en total</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVistaRanking(!vistaRanking)}
            className={`flex items-center gap-2 h-10 px-4 border text-sm font-medium rounded-lg transition-colors ${
              vistaRanking
                ? 'border-yellow-300 bg-yellow-50 text-yellow-700'
                : 'border-[#E2E8F0] bg-white hover:bg-[#F8FAFB] text-[#64748B]'
            }`}
          >
            <Trophy size={15} />
            Ranking
          </button>
          <button
            onClick={() => { setClienteSeleccionado(null); setModalAbierto(true) }}
            className="flex items-center gap-2 h-10 px-4 bg-[#00B4D8] hover:bg-[#0096B4] text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={16} /> Nuevo cliente
          </button>
        </div>
      </div>

      {/* Vista ranking */}
      {vistaRanking && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E2E8F0] bg-[#F8FAFB]">
            <p className="text-sm font-medium text-[#0F172A]">Top 10 clientes por monto comprado</p>
          </div>
          <div className="divide-y divide-[#E2E8F0]">
            {ranking.map((c, i) => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-3">
                <div className="w-8 text-center">{medallaRanking(i + 1)}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#0F172A]">{c.razon_social}</p>
                  <p className="text-xs text-[#94A3B8]">{c.total_compras} compras</p>
                </div>
                <p className="text-sm font-medium text-[#00B4D8]">
                  ${(c.monto_total ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
            {ranking.length === 0 && (
              <p className="text-sm text-[#94A3B8] text-center py-8">Sin ventas registradas aún</p>
            )}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input type="text" value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
              placeholder="Buscar por nombre, CUIT, DNI o email..."
              className="w-full h-9 pl-8 pr-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
            />
          </div>
          <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPagina(1) }}
            className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] focus:outline-none focus:border-[#00B4D8] bg-white">
            <option value="">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
          {(busqueda || filtroEstado) && (
            <button onClick={() => { setBusqueda(''); setFiltroEstado(''); setPagina(1) }}
              className="h-9 px-3 rounded-lg text-sm text-[#94A3B8] hover:text-[#64748B] transition-colors">
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFB]">
              <th className="text-left px-4 py-3">
                <button onClick={() => toggleOrden('razon_social')}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#64748B] hover:text-[#0F172A] transition-colors">
                  Cliente <IconOrden col="razon_social" actual={ordenCol} dir={ordenDir} />
                </button>
              </th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">CUIT / DNI</th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Condición IVA</th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Contacto</th>
              <th className="text-right px-4 py-3">
                <button onClick={() => toggleOrden('total_compras')}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#64748B] hover:text-[#0F172A] transition-colors ml-auto">
                  Compras <IconOrden col="total_compras" actual={ordenCol} dir={ordenDir} />
                </button>
              </th>
              <th className="text-right px-4 py-3">
                <button onClick={() => toggleOrden('monto_total')}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#64748B] hover:text-[#0F172A] transition-colors ml-auto">
                  Monto total <IconOrden col="monto_total" actual={ordenCol} dir={ordenDir} />
                </button>
              </th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Estado</th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {cargando ? (
              <tr><td colSpan={8} className="text-center py-12 text-sm text-[#94A3B8]">Cargando...</td></tr>
            ) : clientes.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-sm text-[#94A3B8]">
                {busqueda ? 'Sin resultados para esa búsqueda' : 'No hay clientes cargados'}
              </td></tr>
            ) : (
              clientes.map(c => (
                <tr key={c.id} className={`hover:bg-[#F8FAFB] transition-colors ${!c.activo ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-[#0F172A]">{c.razon_social}</p>
                    {c.nombre_fantasia && <p className="text-xs text-[#94A3B8]">{c.nombre_fantasia}</p>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm text-[#64748B]">{c.cuit || c.dni || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-xs text-[#64748B]">{c.condicion_iva.replace('_', ' ')}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm text-[#64748B]">{c.email || '—'}</p>
                    {c.telefono && <p className="text-xs text-[#94A3B8]">{c.telefono}</p>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-medium text-[#0F172A]">{c.total_compras ?? 0}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-medium text-[#00B4D8]">
                      ${(c.monto_total ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => toggleActivo(c)}
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        c.activo
                          ? 'bg-[#E0F7FC] text-[#00B4D8] hover:bg-[#00B4D8] hover:text-white'
                          : 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white'
                      }`}>
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setClienteSeleccionado(c); setModalAbierto(true) }}
                        title="Editar"
                        className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => eliminarCliente(c)}
                        title="Eliminar"
                        className="p-1.5 rounded-lg hover:bg-red-50 text-[#64748B] hover:text-red-500 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPaginas > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#E2E8F0]">
            <p className="text-sm text-[#64748B]">
              Mostrando {((pagina - 1) * POR_PAGINA) + 1}–{Math.min(pagina * POR_PAGINA, total)} de {total}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}
                className="p-1.5 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFB] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft size={16} className="text-[#64748B]" />
              </button>
              <span className="text-sm text-[#64748B]">{pagina} / {totalPaginas}</span>
              <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}
                className="p-1.5 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFB] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <ChevronRight size={16} className="text-[#64748B]" />
              </button>
            </div>
          </div>
        )}
      </div>

      {modalAbierto && (
        <ModalCliente
          cliente={clienteSeleccionado}
          onCerrar={() => setModalAbierto(false)}
          onGuardado={() => { setModalAbierto(false); cargarClientes() }}
        />
      )}
    </div>
  )
}
