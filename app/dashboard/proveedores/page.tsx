'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Pencil, Trash2, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, DollarSign } from 'lucide-react'
import ModalProveedor from './ModalProveedor'
import ModalPagoProveedor from './ModalPagoProveedor'

interface Proveedor {
  id: string
  razon_social: string
  nombre_fantasia: string | null
  cuit: string
  condicion_iva: string
  email: string | null
  telefono: string | null
  contacto: string | null
  direccion: string | null
  activo: boolean
  created_at: string
  total_pagado?: number
  total_pagos?: number
}

type OrdenCol = 'razon_social' | 'total_pagado' | 'created_at'
type OrdenDir = 'asc' | 'desc'
const POR_PAGINA = 50

function IconOrden({ col, actual, dir }: { col: OrdenCol; actual: OrdenCol; dir: OrdenDir }) {
  if (col !== actual) return <ArrowUpDown size={13} className="text-[#CBD5E1]" />
  return dir === 'asc' ? <ArrowUp size={13} className="text-[#00B4D8]" /> : <ArrowDown size={13} className="text-[#00B4D8]" />
}

export default function ProveedoresPage() {
  const supabase = createClient()
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
  const [ordenCol, setOrdenCol] = useState<OrdenCol>('razon_social')
  const [ordenDir, setOrdenDir] = useState<OrdenDir>('asc')
  const [filtroEstado, setFiltroEstado] = useState('')

  const [modalProveedor, setModalProveedor] = useState(false)
  const [modalPago, setModalPago] = useState(false)
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<Proveedor | null>(null)

  function toggleOrden(col: OrdenCol) {
    if (ordenCol === col) setOrdenDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setOrdenCol(col); setOrdenDir('asc') }
    setPagina(1)
  }

  async function cargarProveedores() {
    setCargando(true)

    let query = supabase
      .from('proveedores')
      .select('id, razon_social, nombre_fantasia, cuit, condicion_iva, email, telefono, contacto, direccion, activo, created_at', { count: 'exact' })
      .order(ordenCol === 'total_pagado' ? 'razon_social' : ordenCol, { ascending: ordenDir === 'asc' })
      .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)

    if (busqueda) query = query.or(`razon_social.ilike.%${busqueda}%,cuit.ilike.%${busqueda}%,email.ilike.%${busqueda}%`)
    if (filtroEstado !== '') query = query.eq('activo', filtroEstado === 'activo')

    const { data, count } = await query
    if (!data) { setCargando(false); return }

    // Traer totales de pagos
    const ids = data.map(p => p.id)
    let statsMap: Record<string, { total_pagos: number; total_pagado: number }> = {}

    if (ids.length > 0) {
      const { data: pagos } = await supabase
        .from('pagos_proveedor')
        .select('proveedor_id, monto')
        .in('proveedor_id', ids)

      pagos?.forEach(p => {
        if (!statsMap[p.proveedor_id]) statsMap[p.proveedor_id] = { total_pagos: 0, total_pagado: 0 }
        statsMap[p.proveedor_id].total_pagos++
        statsMap[p.proveedor_id].total_pagado += Number(p.monto)
      })
    }

    let result = data.map(p => ({
      ...p,
      total_pagos: statsMap[p.id]?.total_pagos ?? 0,
      total_pagado: statsMap[p.id]?.total_pagado ?? 0,
    }))

    if (ordenCol === 'total_pagado') {
      result.sort((a, b) => ordenDir === 'asc'
        ? (a.total_pagado ?? 0) - (b.total_pagado ?? 0)
        : (b.total_pagado ?? 0) - (a.total_pagado ?? 0)
      )
    }

    setProveedores(result)
    setTotal(count || 0)
    setCargando(false)
  }

  useEffect(() => { cargarProveedores() }, [pagina, busqueda, filtroEstado, ordenCol, ordenDir])

  const totalPaginas = Math.ceil(total / POR_PAGINA)

  async function eliminarProveedor(p: Proveedor) {
    if (!confirm(`¿Eliminar a "${p.razon_social}"? Esta acción no se puede deshacer.`)) return
    await supabase.from('proveedores').delete().eq('id', p.id)
    cargarProveedores()
  }

  async function toggleActivo(p: Proveedor) {
    await supabase.from('proveedores').update({ activo: !p.activo }).eq('id', p.id)
    cargarProveedores()
  }

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-[#0F172A]">Proveedores</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{total} proveedores en total</p>
        </div>
        <button
          onClick={() => { setProveedorSeleccionado(null); setModalProveedor(true) }}
          className="flex items-center gap-2 h-10 px-4 bg-[#00B4D8] hover:bg-[#0096B4] text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} /> Nuevo proveedor
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input type="text" value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
              placeholder="Buscar por nombre, CUIT o email..."
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

      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFB]">
              <th className="text-left px-4 py-3">
                <button onClick={() => toggleOrden('razon_social')}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#64748B] hover:text-[#0F172A] transition-colors">
                  Proveedor <IconOrden col="razon_social" actual={ordenCol} dir={ordenDir} />
                </button>
              </th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">CUIT</th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Condición IVA</th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Contacto</th>
              <th className="text-right px-4 py-3">
                <button onClick={() => toggleOrden('total_pagado')}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#64748B] hover:text-[#0F172A] transition-colors ml-auto">
                  Total pagado <IconOrden col="total_pagado" actual={ordenCol} dir={ordenDir} />
                </button>
              </th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Estado</th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {cargando ? (
              <tr><td colSpan={7} className="text-center py-12 text-sm text-[#94A3B8]">Cargando...</td></tr>
            ) : proveedores.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-sm text-[#94A3B8]">
                {busqueda ? 'Sin resultados' : 'No hay proveedores cargados'}
              </td></tr>
            ) : (
              proveedores.map(p => (
                <tr key={p.id} className={`hover:bg-[#F8FAFB] transition-colors ${!p.activo ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-[#0F172A]">{p.razon_social}</p>
                    {p.nombre_fantasia && <p className="text-xs text-[#94A3B8]">{p.nombre_fantasia}</p>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm text-[#64748B] font-mono">{p.cuit}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-xs text-[#64748B]">{p.condicion_iva.replace('_', ' ')}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm text-[#64748B]">{p.contacto || p.email || '—'}</p>
                    {p.telefono && <p className="text-xs text-[#94A3B8]">{p.telefono}</p>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-medium text-[#0F172A]">
                      ${(p.total_pagado ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-[#94A3B8]">{p.total_pagos ?? 0} pagos</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => toggleActivo(p)}
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        p.activo
                          ? 'bg-[#E0F7FC] text-[#00B4D8] hover:bg-[#00B4D8] hover:text-white'
                          : 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white'
                      }`}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setProveedorSeleccionado(p); setModalPago(true) }}
                        title="Registrar pago"
                        className="p-1.5 rounded-lg hover:bg-green-50 text-[#64748B] hover:text-green-600 transition-colors">
                        <DollarSign size={15} />
                      </button>
                      <button onClick={() => { setProveedorSeleccionado(p); setModalProveedor(true) }}
                        title="Editar"
                        className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => eliminarProveedor(p)}
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

      {modalProveedor && (
        <ModalProveedor
          proveedor={proveedorSeleccionado}
          onCerrar={() => setModalProveedor(false)}
          onGuardado={() => { setModalProveedor(false); cargarProveedores() }}
        />
      )}
      {modalPago && proveedorSeleccionado && (
        <ModalPagoProveedor
          proveedor={proveedorSeleccionado}
          onCerrar={() => setModalPago(false)}
          onGuardado={() => { setModalPago(false); cargarProveedores() }}
        />
      )}
    </div>
  )
}
