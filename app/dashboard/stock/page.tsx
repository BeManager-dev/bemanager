'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, ArrowLeftRight, Plus, History, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, AlertCircle, Layers } from 'lucide-react'
import ModalTransferencia from './ModalTransferencia'
import ModalAjusteStock from './ModalAjusteStock'
import ModalHistorialStock from './ModalHistorialStock'
import AjusteMasivo from './AjusteMasivo'
import TransferenciaMasiva from './TransferenciaMasiva'

interface StockItem {
  producto_id: string
  nombre: string
  sku: string | null
  codigo_barras: string | null
  depositos: Record<string, number>
  stock_total: number
  alerta: 'critico' | 'bajo' | null
}

interface Deposito { id: string; nombre: string }
type OrdenCol = 'nombre' | 'stock_total'
type OrdenDir = 'asc' | 'desc'
const POR_PAGINA = 50

function IconOrden({ col, actual, dir }: { col: OrdenCol; actual: OrdenCol; dir: OrdenDir }) {
  if (col !== actual) return <ArrowUpDown size={13} className="text-[#CBD5E1]" />
  return dir === 'asc' ? <ArrowUp size={13} className="text-[#00B4D8]" /> : <ArrowDown size={13} className="text-[#00B4D8]" />
}

export default function StockPage() {
  const supabase = createClient()
  const [todosLosItems, setTodosLosItems] = useState<StockItem[]>([])
  const [depositos, setDepositos] = useState<Deposito[]>([])
  const [depositosCargados, setDepositosCargados] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [pagina, setPagina] = useState(1)
  const [filtroDeposito, setFiltroDeposito] = useState('')
  const [filtroStockBajo, setFiltroStockBajo] = useState(false)
  const [ordenCol, setOrdenCol] = useState<OrdenCol>('nombre')
  const [ordenDir, setOrdenDir] = useState<OrdenDir>('asc')

  const [modalTransferencia, setModalTransferencia] = useState(false)
  const [modalAjuste, setModalAjuste] = useState(false)
  const [modalHistorial, setModalHistorial] = useState(false)
  const [modalAjusteMasivo, setModalAjusteMasivo] = useState(false)
  const [modalTransferenciaMasiva, setModalTransferenciaMasiva] = useState(false)
  const [productoSeleccionado, setProductoSeleccionado] = useState<StockItem | null>(null)

  function toggleOrden(col: OrdenCol) {
    if (ordenCol === col) setOrdenDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setOrdenCol(col); setOrdenDir('asc') }
    setPagina(1)
  }

  async function cargarDepositos() {
    const { data } = await supabase.from('depositos').select('id, nombre').order('nombre')
    setDepositos(data || [])
    setDepositosCargados(true)
  }

  async function cargarStock() {
    if (!depositosCargados) return
    setCargando(true)

    let query = supabase
      .from('productos')
      .select('id, nombre, sku, codigo_barras')
      .eq('activo', true)
      .order('nombre', { ascending: true })

    if (busqueda) query = query.or(`nombre.ilike.%${busqueda}%,sku.ilike.%${busqueda}%,codigo_barras.eq.${busqueda}`)

    const { data: productos } = await query
    if (!productos) { setCargando(false); return }

    const ids = productos.map(p => p.id)
    const { data: stockData } = await supabase
      .from('stock').select('producto_id, deposito_id, cantidad')
      .in('producto_id', ids)

    const stockMap: Record<string, Record<string, number>> = {}
    stockData?.forEach(s => {
      if (!stockMap[s.producto_id]) stockMap[s.producto_id] = {}
      stockMap[s.producto_id][s.deposito_id] = Number(s.cantidad)
    })

    let result: StockItem[] = productos.map(p => {
      const deps = stockMap[p.id] || {}
      const stockTotal = Object.values(deps).reduce((a, b) => a + b, 0)
      const tieneAlgunCero = depositos.some(d => (deps[d.id] ?? 0) === 0)
      const tieneAlgunBajo = depositos.some(d => {
        const cant = deps[d.id] ?? 0
        return cant > 0 && cant < 5
      })
      let alerta: StockItem['alerta'] = null
      if (tieneAlgunCero) alerta = 'critico'
      else if (tieneAlgunBajo) alerta = 'bajo'
      return { producto_id: p.id, nombre: p.nombre, sku: p.sku, codigo_barras: p.codigo_barras, depositos: deps, stock_total: stockTotal, alerta }
    })

    if (filtroDeposito) {
      result = result.map(item => ({ ...item, stock_total: item.depositos[filtroDeposito] ?? 0 }))
    }

    if (filtroStockBajo) {
      if (filtroDeposito) {
        result = result.filter(i => (i.depositos[filtroDeposito] ?? 0) < 5)
      } else {
        result = result.filter(i => i.alerta !== null)
      }
    }

    if (ordenCol === 'stock_total') {
      result.sort((a, b) => ordenDir === 'asc' ? a.stock_total - b.stock_total : b.stock_total - a.stock_total)
    } else {
      result.sort((a, b) => ordenDir === 'asc'
        ? a.nombre.localeCompare(b.nombre, 'es')
        : b.nombre.localeCompare(a.nombre, 'es')
      )
    }

    setTodosLosItems(result)
    setCargando(false)
  }

  useEffect(() => { cargarDepositos() }, [])
  useEffect(() => {
    if (depositosCargados) { setPagina(1); cargarStock() }
  }, [depositosCargados, busqueda, filtroDeposito, filtroStockBajo, ordenCol, ordenDir])

  const total = todosLosItems.length
  const totalPaginas = Math.ceil(total / POR_PAGINA)
  const items = todosLosItems.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)
  const totalCriticos = todosLosItems.filter(i => i.alerta === 'critico').length
  const totalBajos = todosLosItems.filter(i => i.alerta === 'bajo').length

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-medium text-[#0F172A]">Stock</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{total} productos · {depositos.length} ubicaciones</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setModalAjusteMasivo(true)}
            className="flex items-center gap-2 h-10 px-4 border border-[#E2E8F0] bg-white hover:bg-[#F8FAFB] text-sm text-[#64748B] font-medium rounded-lg transition-colors">
            <Layers size={16} /> Ajuste masivo
          </button>
          <button onClick={() => setModalTransferenciaMasiva(true)}
            className="flex items-center gap-2 h-10 px-4 border border-[#E2E8F0] bg-white hover:bg-[#F8FAFB] text-sm text-[#64748B] font-medium rounded-lg transition-colors">
            <ArrowLeftRight size={16} /> Transferencia masiva
          </button>
        </div>
      </div>

      {!filtroStockBajo && (totalCriticos > 0 || totalBajos > 0) && (
        <div className="flex gap-3 flex-wrap">
          {totalCriticos > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle size={15} className="text-red-500" />
              <span className="text-sm text-red-600 font-medium">{totalCriticos} productos sin stock en alguna ubicacion</span>
            </div>
          )}
          {totalBajos > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-xl">
              <AlertTriangle size={15} className="text-orange-500" />
              <span className="text-sm text-orange-600 font-medium">{totalBajos} productos con stock bajo en alguna ubicacion</span>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input type="text" value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
              placeholder="Buscar producto, SKU o codigo de barras..."
              className="w-full h-9 pl-8 pr-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
            />
          </div>
          <select value={filtroDeposito} onChange={e => { setFiltroDeposito(e.target.value); setPagina(1) }}
            className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] focus:outline-none focus:border-[#00B4D8] bg-white">
            <option value="">Todas las ubicaciones</option>
            {depositos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
          <button onClick={() => { setFiltroStockBajo(!filtroStockBajo); setPagina(1) }}
            className={`h-9 px-3 rounded-lg border text-sm font-medium transition-colors ${
              filtroStockBajo ? 'border-orange-300 bg-orange-50 text-orange-600' : 'border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFB]'
            }`}>
            {filtroStockBajo ? `Stock bajo (${total})` : 'Stock bajo'}
          </button>
          {(busqueda || filtroDeposito || filtroStockBajo) && (
            <button onClick={() => { setBusqueda(''); setFiltroDeposito(''); setFiltroStockBajo(false); setPagina(1) }}
              className="h-9 px-3 rounded-lg text-sm text-[#94A3B8] hover:text-[#64748B] transition-colors">
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {filtroStockBajo && (
        <div className="flex items-center gap-4 px-1">
          <div className="flex items-center gap-1.5">
            <AlertCircle size={13} className="text-red-500" />
            <span className="text-xs text-[#64748B]">Sin stock (0 unidades)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={13} className="text-orange-500" />
            <span className="text-xs text-[#64748B]">Stock bajo (1 a 4 unidades)</span>
          </div>
        </div>
      )}

      {!depositosCargados ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center text-sm text-[#94A3B8]">Cargando ubicaciones...</div>
      ) : (
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
                <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Codigo de barras</th>
                {depositos.map(d => (
                  <th key={d.id} className={`text-right text-xs font-medium px-4 py-3 whitespace-nowrap ${filtroDeposito === d.id ? 'text-[#00B4D8]' : 'text-[#64748B]'}`}>
                    {d.nombre}{filtroDeposito === d.id && <span className="ml-1 text-[10px]">▼</span>}
                  </th>
                ))}
                <th className="text-right px-4 py-3">
                  <button onClick={() => toggleOrden('stock_total')}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#64748B] hover:text-[#0F172A] transition-colors ml-auto">
                    Total <IconOrden col="stock_total" actual={ordenCol} dir={ordenDir} />
                  </button>
                </th>
                <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {cargando ? (
                <tr><td colSpan={6 + depositos.length} className="text-center py-12 text-sm text-[#94A3B8]">Cargando...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6 + depositos.length} className="text-center py-12 text-sm text-[#94A3B8]">Sin resultados</td></tr>
              ) : (
                items.map(item => (
                  <tr key={item.producto_id} className={`hover:bg-[#F8FAFB] transition-colors ${
                    item.alerta === 'critico' ? 'bg-red-50/30' : item.alerta === 'bajo' ? 'bg-orange-50/30' : ''
                  }`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.alerta === 'critico' && <AlertCircle size={13} className="text-red-500 shrink-0" />}
                        {item.alerta === 'bajo' && <AlertTriangle size={13} className="text-orange-500 shrink-0" />}
                        <p className="text-sm font-medium text-[#0F172A]">{item.nombre}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right"><p className="text-sm text-[#64748B]">{item.sku || '—'}</p></td>
                    <td className="px-4 py-3 text-right"><p className="text-sm text-[#64748B] font-mono">{item.codigo_barras || '—'}</p></td>
                    {depositos.map(d => {
                      const cant = item.depositos[d.id] ?? 0
                      return (
                        <td key={d.id} className={`px-4 py-3 text-right ${filtroDeposito === d.id ? 'bg-[#F0FBFE]' : ''}`}>
                          <span className={`text-sm font-medium ${cant === 0 ? 'text-red-500' : cant < 5 ? 'text-orange-500' : 'text-[#0F172A]'}`}>{cant}</span>
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-medium ${item.stock_total === 0 ? 'text-red-500' : item.stock_total < 5 ? 'text-orange-500' : 'text-[#0F172A]'}`}>
                        {item.stock_total}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setProductoSeleccionado(item); setModalAjuste(true) }}
                          title="Ajustar stock"
                          className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors">
                          <Plus size={15} />
                        </button>
                        <button onClick={() => { setProductoSeleccionado(item); setModalTransferencia(true) }}
                          title="Transferir"
                          className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors">
                          <ArrowLeftRight size={15} />
                        </button>
                        <button onClick={() => { setProductoSeleccionado(item); setModalHistorial(true) }}
                          title="Historial"
                          className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors">
                          <History size={15} />
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
      )}

      {modalAjuste && productoSeleccionado && (
        <ModalAjusteStock producto={productoSeleccionado} depositos={depositos}
          onCerrar={() => setModalAjuste(false)}
          onGuardado={() => { setModalAjuste(false); cargarStock() }}
        />
      )}
      {modalTransferencia && (
        <ModalTransferencia producto={productoSeleccionado} depositos={depositos}
          onCerrar={() => setModalTransferencia(false)}
          onGuardado={() => { setModalTransferencia(false); cargarStock() }}
        />
      )}
      {modalHistorial && productoSeleccionado && (
        <ModalHistorialStock producto={productoSeleccionado} depositos={depositos}
          onCerrar={() => setModalHistorial(false)}
        />
      )}
      {modalAjusteMasivo && (
        <AjusteMasivo
          onCerrar={() => setModalAjusteMasivo(false)}
          onGuardado={() => { setModalAjusteMasivo(false); cargarStock() }}
        />
      )}
      {modalTransferenciaMasiva && (
        <TransferenciaMasiva
          onCerrar={() => setModalTransferenciaMasiva(false)}
          onGuardado={() => { setModalTransferenciaMasiva(false); cargarStock() }}
        />
      )}
    </div>
  )
}
