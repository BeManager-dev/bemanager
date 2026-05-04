'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

interface Producto {
  id: string
  nombre: string
  sku: string | null
  codigo_barras: string | null
  precio: number
  categoria: string | null
  activo: boolean
  depositos: Record<string, number>
  stock_total: number
}

interface Deposito { id: string; nombre: string }
interface Categoria { id: string; nombre: string }

type OrdenCol = 'nombre' | 'precio' | 'stock_total'
type OrdenDir = 'asc' | 'desc'
const POR_PAGINA = 50

function IconOrden({ col, actual, dir }: { col: OrdenCol; actual: OrdenCol; dir: OrdenDir }) {
  if (col !== actual) return <ArrowUpDown size={13} className="text-[#CBD5E1]" />
  return dir === 'asc' ? <ArrowUp size={13} className="text-[#00B4D8]" /> : <ArrowDown size={13} className="text-[#00B4D8]" />
}

export default function ProductosVendedorPage() {
  const supabase = createClient()
  const [productos, setProductos] = useState<Producto[]>([])
  const [depositos, setDepositos] = useState<Deposito[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroStockBajo, setFiltroStockBajo] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
  const [ordenCol, setOrdenCol] = useState<OrdenCol>('nombre')
  const [ordenDir, setOrdenDir] = useState<OrdenDir>('asc')

  function toggleOrden(col: OrdenCol) {
    if (ordenCol === col) setOrdenDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setOrdenCol(col); setOrdenDir('asc') }
    setPagina(1)
  }

  useEffect(() => {
    async function cargarCatalogos() {
      const { data: deps } = await supabase.from('depositos').select('id, nombre').order('nombre')
      setDepositos(deps || [])
      const { data: cats } = await supabase.from('categorias').select('id, nombre').order('nombre')
      setCategorias(cats || [])
    }
    cargarCatalogos()
  }, [])

  useEffect(() => {
    cargarProductos()
  }, [busqueda, filtroCategoria, filtroStockBajo, pagina, ordenCol, ordenDir])

  async function cargarProductos() {
    setCargando(true)

    let query = supabase
      .from('productos')
      .select('id, nombre, sku, codigo_barras, precio, activo, categorias(nombre)', { count: 'exact' })
      .eq('activo', true)

    if (busqueda) query = query.or(`nombre.ilike.%${busqueda}%,sku.ilike.%${busqueda}%,codigo_barras.eq.${busqueda}`)
    if (filtroCategoria) query = query.eq('categoria_id', filtroCategoria)

    const { data, count } = await query
    if (!data) { setCargando(false); return }

    const ids = data.map(p => p.id)
    const { data: stockData } = await supabase
      .from('stock').select('producto_id, deposito_id, cantidad')
      .in('producto_id', ids)

    const stockMap: Record<string, Record<string, number>> = {}
    stockData?.forEach(s => {
      if (!stockMap[s.producto_id]) stockMap[s.producto_id] = {}
      stockMap[s.producto_id][s.deposito_id] = Number(s.cantidad)
    })

    let result: Producto[] = data.map((p: any) => {
      const deps = stockMap[p.id] || {}
      const stock_total = Object.values(deps).reduce((a: number, b: number) => a + b, 0)
      return {
        id: p.id, nombre: p.nombre, sku: p.sku, codigo_barras: p.codigo_barras,
        precio: p.precio, activo: p.activo,
        categoria: p.categorias?.nombre || null,
        depositos: deps, stock_total,
      }
    })

    if (filtroStockBajo) result = result.filter(p => p.stock_total < 5)

    if (ordenCol === 'nombre') result.sort((a, b) => ordenDir === 'asc' ? a.nombre.localeCompare(b.nombre, 'es') : b.nombre.localeCompare(a.nombre, 'es'))
    if (ordenCol === 'precio') result.sort((a, b) => ordenDir === 'asc' ? a.precio - b.precio : b.precio - a.precio)
    if (ordenCol === 'stock_total') result.sort((a, b) => ordenDir === 'asc' ? a.stock_total - b.stock_total : b.stock_total - a.stock_total)

    const inicio = (pagina - 1) * POR_PAGINA
    setTotal(result.length)
    setProductos(result.slice(inicio, inicio + POR_PAGINA))
    setCargando(false)
  }

  const totalPaginas = Math.ceil(total / POR_PAGINA)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-[#0F172A]">Productos</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{total} productos</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input type="text" value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
              placeholder="Buscar por nombre, SKU o codigo de barras..."
              className="w-full h-9 pl-8 pr-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
            />
          </div>
          <select value={filtroCategoria} onChange={e => { setFiltroCategoria(e.target.value); setPagina(1) }}
            className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] focus:outline-none focus:border-[#00B4D8] bg-white">
            <option value="">Todas las categorias</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <button onClick={() => { setFiltroStockBajo(!filtroStockBajo); setPagina(1) }}
            className={`h-9 px-3 rounded-lg border text-sm font-medium transition-colors ${
              filtroStockBajo ? 'border-orange-300 bg-orange-50 text-orange-600' : 'border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFB]'
            }`}>
            Stock bajo
          </button>
          {(busqueda || filtroCategoria || filtroStockBajo) && (
            <button onClick={() => { setBusqueda(''); setFiltroCategoria(''); setFiltroStockBajo(false); setPagina(1) }}
              className="h-9 px-3 rounded-lg text-sm text-[#94A3B8] hover:text-[#64748B] transition-colors">
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden overflow-x-auto">
        <table className="w-full min-w-max">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFB]">
              <th className="text-left px-4 py-3">
                <button onClick={() => toggleOrden('nombre')}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#64748B] hover:text-[#0F172A] transition-colors">
                  Producto <IconOrden col="nombre" actual={ordenCol} dir={ordenDir} />
                </button>
              </th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">SKU</th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Categoria</th>
              <th className="text-right px-4 py-3">
                <button onClick={() => toggleOrden('precio')}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#64748B] hover:text-[#0F172A] transition-colors ml-auto">
                  Precio <IconOrden col="precio" actual={ordenCol} dir={ordenDir} />
                </button>
              </th>
              {depositos.map(d => (
                <th key={d.id} className="text-right text-xs font-medium text-[#64748B] px-4 py-3 whitespace-nowrap">
                  {d.nombre}
                </th>
              ))}
              <th className="text-right px-4 py-3">
                <button onClick={() => toggleOrden('stock_total')}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#64748B] hover:text-[#0F172A] transition-colors ml-auto">
                  Total <IconOrden col="stock_total" actual={ordenCol} dir={ordenDir} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {cargando ? (
              <tr><td colSpan={5 + depositos.length} className="text-center py-12 text-sm text-[#94A3B8]">Cargando...</td></tr>
            ) : productos.length === 0 ? (
              <tr><td colSpan={5 + depositos.length} className="text-center py-12 text-sm text-[#94A3B8]">Sin resultados</td></tr>
            ) : (
              productos.map(p => (
                <tr key={p.id} className="hover:bg-[#F8FAFB] transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-[#0F172A]">{p.nombre}</p>
                    {p.codigo_barras && <p className="text-xs text-[#94A3B8] font-mono">{p.codigo_barras}</p>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm text-[#64748B]">{p.sku || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm text-[#64748B]">{p.categoria || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-medium text-[#00B4D8]">${p.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                  </td>
                  {depositos.map(d => {
                    const cant = p.depositos[d.id] ?? 0
                    return (
                      <td key={d.id} className="px-4 py-3 text-right">
                        <span className={`text-sm font-medium ${cant === 0 ? 'text-red-500' : cant < 5 ? 'text-orange-500' : 'text-[#0F172A]'}`}>
                          {cant}
                        </span>
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-medium ${p.stock_total === 0 ? 'text-red-500' : p.stock_total < 5 ? 'text-orange-500' : 'text-[#0F172A]'}`}>
                      {p.stock_total}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPaginas > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#E2E8F0]">
            <p className="text-sm text-[#64748B]">Mostrando {((pagina - 1) * POR_PAGINA) + 1}–{Math.min(pagina * POR_PAGINA, total)} de {total}</p>
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
    </div>
  )
}
