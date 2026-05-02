'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Pencil, History, Copy, Trash2, Upload, Download, ChevronLeft, ChevronRight, Barcode, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import ModalProducto from './ModalProducto'
import ModalHistorialPrecios from './ModalHistorialPrecios'
import ModalEtiqueta from './ModalEtiqueta'

interface Producto {
  id: string
  nombre: string
  sku: string | null
  codigo_barras: string | null
  precio: number
  alicuota_iva: number
  tipo: string
  activo: boolean
  categoria_id: string | null
  created_at?: string
  stock_total?: number
}

interface Categoria { id: string; nombre: string }

type OrdenCol = 'nombre' | 'created_at' | 'precio' | 'activo' | 'stock_total'
type OrdenDir = 'asc' | 'desc'

const POR_PAGINA = 50

function IconOrden({ col, actual, dir }: { col: OrdenCol; actual: OrdenCol; dir: OrdenDir }) {
  if (col !== actual) return <ArrowUpDown size={13} className="text-[#CBD5E1]" />
  return dir === 'asc' ? <ArrowUp size={13} className="text-[#00B4D8]" /> : <ArrowDown size={13} className="text-[#00B4D8]" />
}

export default function ProductosPage() {
  const supabase = createClient()
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
  const [ordenCol, setOrdenCol] = useState<OrdenCol>('nombre')
  const [ordenDir, setOrdenDir] = useState<OrdenDir>('asc')

  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroStockBajo, setFiltroStockBajo] = useState(false)

  const [modalProducto, setModalProducto] = useState(false)
  const [modalHistorial, setModalHistorial] = useState(false)
  const [modalEtiqueta, setModalEtiqueta] = useState(false)
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null)
  const [copiarDe, setCopiarDe] = useState<Producto | null>(null)

  function toggleOrden(col: OrdenCol) {
    if (ordenCol === col) {
      setOrdenDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setOrdenCol(col)
      setOrdenDir('asc')
    }
    setPagina(1)
  }

  function ThOrd({ col, label, right }: { col: OrdenCol; label: string; right?: boolean }) {
    return (
      <th className={`px-4 py-3 ${right ? 'text-right' : 'text-left'}`}>
        <button onClick={() => toggleOrden(col)}
          className={`flex items-center gap-1.5 text-xs font-medium text-[#64748B] hover:text-[#0F172A] transition-colors ${right ? 'ml-auto' : ''}`}>
          {label} <IconOrden col={col} actual={ordenCol} dir={ordenDir} />
        </button>
      </th>
    )
  }

  async function cargarProductos() {
    setCargando(true)
    const colsDB: Partial<Record<OrdenCol, string>> = {
      nombre: 'nombre', created_at: 'created_at', precio: 'precio', activo: 'activo'
    }
    let query = supabase
      .from('productos')
      .select('id, nombre, sku, codigo_barras, precio, alicuota_iva, tipo, activo, categoria_id, created_at', { count: 'exact' })
      .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)

    const colDB = colsDB[ordenCol]
    query = query.order(colDB || 'nombre', { ascending: ordenDir === 'asc' })

    if (busqueda) query = query.or(`nombre.ilike.%${busqueda}%,sku.ilike.%${busqueda}%,codigo_barras.eq.${busqueda}`)
    if (filtroCategoria) query = query.eq('categoria_id', filtroCategoria)
    if (filtroEstado !== '') query = query.eq('activo', filtroEstado === 'activo')

    const { data, count } = await query

    const ids = (data || []).map(p => p.id)
    let stockMap: Record<string, number> = {}
    if (ids.length > 0) {
      const { data: stockData } = await supabase
        .from('stock').select('producto_id, cantidad').in('producto_id', ids)
      stockData?.forEach(s => {
        stockMap[s.producto_id] = (stockMap[s.producto_id] || 0) + Number(s.cantidad)
      })
    }

    let prods = (data || []).map(p => ({ ...p, stock_total: stockMap[p.id] ?? 0 }))
    if (ordenCol === 'stock_total') {
      prods.sort((a, b) => ordenDir === 'asc'
        ? (a.stock_total ?? 0) - (b.stock_total ?? 0)
        : (b.stock_total ?? 0) - (a.stock_total ?? 0)
      )
    }

    setProductos(prods)
    setTotal(count || 0)
    setCargando(false)
  }

  async function cargarCategorias() {
    const { data } = await supabase.from('categorias').select('id, nombre').order('nombre')
    setCategorias(data || [])
  }

  useEffect(() => { cargarCategorias() }, [])
  useEffect(() => { cargarProductos() }, [pagina, busqueda, filtroCategoria, filtroEstado, filtroStockBajo, ordenCol, ordenDir])

  const totalPaginas = Math.ceil(total / POR_PAGINA)

  async function toggleActivo(p: Producto) {
    await supabase.from('productos').update({ activo: !p.activo }).eq('id', p.id)
    cargarProductos()
  }

  async function eliminarProducto(p: Producto) {
    if (!confirm(`¿Eliminar "${p.nombre}"? Esta acción no se puede deshacer.`)) return
    await supabase.from('productos').delete().eq('id', p.id)
    cargarProductos()
  }

  const limpiarFiltros = () => {
    setBusqueda(''); setFiltroCategoria(''); setFiltroEstado(''); setFiltroStockBajo(false); setPagina(1)
  }
  const hayFiltros = busqueda || filtroCategoria || filtroEstado || filtroStockBajo

  async function exportarCSV() {
    const { data } = await supabase.from('productos').select('nombre, sku, codigo_barras, precio, alicuota_iva, activo').order('nombre')
    if (!data) return
    const headers = ['Nombre', 'SKU', 'Código de barras', 'Precio', 'IVA %', 'Activo']
    const rows = data.map(p => [p.nombre, p.sku || '', p.codigo_barras || '', p.precio, p.alicuota_iva, p.activo ? 'Sí' : 'No'])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'productos_bemanager.csv'; a.click()
  }

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-[#0F172A]">Productos</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{total} productos en total</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportarCSV} className="flex items-center gap-2 h-10 px-4 border border-[#E2E8F0] bg-white hover:bg-[#F8FAFB] text-sm text-[#64748B] rounded-lg transition-colors">
            <Download size={15} /> Exportar
          </button>
          <label className="flex items-center gap-2 h-10 px-4 border border-[#E2E8F0] bg-white hover:bg-[#F8FAFB] text-sm text-[#64748B] rounded-lg transition-colors cursor-pointer">
            <Upload size={15} /> Importar
            <input type="file" accept=".csv,.xlsx" className="hidden" onChange={() => alert('Importación próximamente')} />
          </label>
          <button onClick={() => { setCopiarDe(null); setProductoSeleccionado(null); setModalProducto(true) }}
            className="flex items-center gap-2 h-10 px-4 bg-[#00B4D8] hover:bg-[#0096B4] text-white text-sm font-medium rounded-lg transition-colors">
            <Plus size={16} /> Nuevo producto
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input type="text" value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
              placeholder="Nombre, SKU o código de barras..."
              className="w-full h-9 pl-8 pr-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
            />
          </div>
          <select value={filtroCategoria} onChange={e => { setFiltroCategoria(e.target.value); setPagina(1) }}
            className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] focus:outline-none focus:border-[#00B4D8] bg-white">
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPagina(1) }}
            className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] focus:outline-none focus:border-[#00B4D8] bg-white">
            <option value="">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
          <button onClick={() => { setFiltroStockBajo(!filtroStockBajo); setPagina(1) }}
            className={`h-9 px-3 rounded-lg border text-sm font-medium transition-colors ${
              filtroStockBajo ? 'border-orange-300 bg-orange-50 text-orange-600' : 'border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFB]'
            }`}>
            Stock bajo
          </button>
          {hayFiltros && (
            <button onClick={limpiarFiltros} className="h-9 px-3 rounded-lg text-sm text-[#94A3B8] hover:text-[#64748B] transition-colors">
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFB]">
              <ThOrd col="nombre"      label="Producto"     />
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">SKU</th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Código de barras</th>
              <ThOrd col="precio"      label="Precio"       right />
              <ThOrd col="stock_total" label="Stock total"  right />
              <ThOrd col="activo"      label="Estado"       right />
              <ThOrd col="created_at"  label="Agregado"     right />
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {cargando ? (
              <tr><td colSpan={8} className="text-center py-12 text-sm text-[#94A3B8]">Cargando...</td></tr>
            ) : productos.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-sm text-[#94A3B8]">
                {hayFiltros ? 'Sin resultados para esos filtros' : 'No hay productos cargados'}
              </td></tr>
            ) : (
              productos.map(p => (
                <tr key={p.id} className={`hover:bg-[#F8FAFB] transition-colors ${!p.activo ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 text-left">
                    <p className="text-sm font-medium text-[#0F172A]">{p.nombre}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm text-[#64748B]">{p.sku || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm text-[#64748B] font-mono">{p.codigo_barras || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-medium text-[#0F172A]">${p.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-[#94A3B8]">IVA {p.alicuota_iva}% inc.</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-medium ${
                      (p.stock_total || 0) === 0 ? 'text-red-500'
                      : (p.stock_total || 0) <= 5 ? 'text-orange-500'
                      : 'text-[#0F172A]'
                    }`}>
                      {p.stock_total ?? 0}
                    </span>
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
                  <td className="px-4 py-3 text-right">
                    <p className="text-xs text-[#94A3B8]">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString('es-AR') : '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setProductoSeleccionado(p); setCopiarDe(null); setModalProducto(true) }}
                        title="Editar" className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => { setProductoSeleccionado(p); setModalHistorial(true) }}
                        title="Historial de precios" className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors">
                        <History size={15} />
                      </button>
                      <button onClick={() => { setProductoSeleccionado(p); setModalEtiqueta(true) }}
                        title="Imprimir etiqueta" className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors">
                        <Barcode size={15} />
                      </button>
                      <button onClick={() => { setCopiarDe(p); setProductoSeleccionado(null); setModalProducto(true) }}
                        title="Copiar producto" className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors">
                        <Copy size={15} />
                      </button>
                      <button onClick={() => eliminarProducto(p)}
                        title="Eliminar" className="p-1.5 rounded-lg hover:bg-red-50 text-[#64748B] hover:text-red-500 transition-colors">
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

      {modalProducto && (
        <ModalProducto producto={productoSeleccionado} copiarDe={copiarDe}
          onCerrar={() => setModalProducto(false)}
          onGuardado={() => { setModalProducto(false); cargarProductos(); cargarCategorias() }}
        />
      )}
      {modalHistorial && productoSeleccionado && (
        <ModalHistorialPrecios producto={productoSeleccionado} onCerrar={() => setModalHistorial(false)} />
      )}
      {modalEtiqueta && productoSeleccionado && (
        <ModalEtiqueta producto={productoSeleccionado} onCerrar={() => setModalEtiqueta(false)} />
      )}
    </div>
  )
}
