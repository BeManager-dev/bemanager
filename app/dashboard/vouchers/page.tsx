'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, ChevronLeft, ChevronRight, Copy, Check, Ticket, Gift } from 'lucide-react'
import ModalGiftCard from './ModalGiftCard'
import ModalGiftCardTipos from './ModalGiftCardTipos'

interface Voucher {
  id: string
  codigo: string
  tipo: string
  monto: number
  usado: boolean
  vence_at: string | null
  created_at: string
  comprador_nombre: string | null
  beneficiario_nombre: string | null
  punto_venta: { nombre: string } | null
}

const POR_PAGINA = 30

export default function VouchersPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'vouchers' | 'gift_cards' | 'tipos'>('vouchers')
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [mostrarModalGC, setMostrarModalGC] = useState(false)
  const [mostrarModalTipos, setMostrarModalTipos] = useState(false)

  async function cargarVouchers() {
    setCargando(true)
    let query = supabase.from('vouchers')
      .select('id, codigo, tipo, monto, usado, vence_at, created_at, comprador_nombre, beneficiario_nombre, punto_venta:puntos_venta(nombre)', { count: 'exact' })
      .eq('tipo', tab === 'gift_cards' ? 'gift_card' : 'devolucion')
      .order('created_at', { ascending: false })
      .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)

    if (busqueda) query = query.ilike('codigo', `%${busqueda}%`)
    if (filtroEstado === 'activo') query = query.eq('usado', false)
    if (filtroEstado === 'usado') query = query.eq('usado', true)

    const { data, count } = await query
    setVouchers((data as any) || [])
    setTotal(count || 0)
    setCargando(false)
  }

  useEffect(() => {
    if (tab !== 'tipos') cargarVouchers()
  }, [tab, pagina, busqueda, filtroEstado])

  const totalPaginas = Math.ceil(total / POR_PAGINA)

  function copiarCodigo(codigo: string) {
    navigator.clipboard.writeText(codigo)
    setCopiado(codigo)
    setTimeout(() => setCopiado(null), 2000)
  }

  function compartirWhatsApp(v: Voucher) {
    const tipo = v.tipo === 'gift_card' ? 'Gift Card' : 'Voucher'
    const vencimiento = v.vence_at ? new Date(v.vence_at).toLocaleDateString('es-AR') : 'sin vencimiento'
    const msg = encodeURIComponent(
      `🎁 *BeHappy - ${tipo}*\n\nCodigo: *${v.codigo}*\nMonto: *$${Number(v.monto).toLocaleString('es-AR')}*\nVence: ${vencimiento}\n\nValido en cualquier sucursal BeHappy. Uso unico.`
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  function descargarPDF(v: Voucher) {
    const tipo = v.tipo === 'gift_card' ? 'Gift Card' : 'Voucher'
    const vencimiento = v.vence_at ? new Date(v.vence_at).toLocaleDateString('es-AR') : 'Sin vencimiento'
    const ventana = window.open('', '_blank')
    if (!ventana) return
    ventana.document.write(`
      <html><head><title>${tipo} ${v.codigo}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f5f5f5; }
        .card { background: white; border-radius: 16px; padding: 40px; max-width: 400px; width: 100%; box-shadow: 0 4px 20px rgba(0,0,0,0.1); text-align: center; }
        .logo { font-size: 28px; font-weight: bold; color: #00B4D8; margin-bottom: 8px; }
        .tipo { font-size: 14px; color: #64748B; margin-bottom: 24px; }
        .monto { font-size: 48px; font-weight: bold; color: #0F172A; margin-bottom: 8px; }
        .monto-label { font-size: 12px; color: #94A3B8; margin-bottom: 24px; }
        .codigo-label { font-size: 11px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        .codigo { font-size: 22px; font-family: monospace; font-weight: bold; color: #00B4D8; letter-spacing: 2px; background: #E0F7FC; padding: 12px 20px; border-radius: 8px; margin-bottom: 24px; }
        .info { font-size: 12px; color: #64748B; line-height: 1.6; }
        .vence { font-size: 13px; color: #94A3B8; margin-top: 16px; }
        .divider { border: none; border-top: 1px dashed #E2E8F0; margin: 20px 0; }
        ${v.beneficiario_nombre ? `.beneficiario { font-size: 14px; color: #0F172A; font-weight: bold; margin-bottom: 4px; }` : ''}
        @media print { body { background: white; } .card { box-shadow: none; } }
      </style></head>
      <body>
        <div class="card">
          <div class="logo">be happy</div>
          <div class="tipo">${tipo}</div>
          ${v.beneficiario_nombre ? `<div class="beneficiario">Para: ${v.beneficiario_nombre}</div>` : ''}
          <div class="monto">$${Number(v.monto).toLocaleString('es-AR')}</div>
          <div class="monto-label">Monto del ${tipo.toLowerCase()}</div>
          <hr class="divider">
          <div class="codigo-label">Codigo unico</div>
          <div class="codigo">${v.codigo}</div>
          <div class="info">
            Valido en cualquier sucursal BeHappy<br>
            Uso unico — no acumulable
          </div>
          <div class="vence">Vence: ${vencimiento}</div>
        </div>
        <script>window.onload = () => window.print()<\/script>
      </body></html>
    `)
    ventana.document.close()
  }

  function estadoVoucher(v: Voucher) {
    if (v.usado) return { label: 'Usado', color: 'bg-gray-100 text-gray-500' }
    if (v.vence_at && new Date(v.vence_at) < new Date()) return { label: 'Vencido', color: 'bg-red-50 text-red-500' }
    return { label: 'Activo', color: 'bg-green-50 text-green-600' }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-[#0F172A]">Vouchers y Gift Cards</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{total} registros</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMostrarModalTipos(true)}
            className="flex items-center gap-2 h-10 px-4 border border-[#E2E8F0] bg-white hover:bg-[#F8FAFB] text-sm text-[#64748B] rounded-lg transition-colors">
            Gestionar tipos
          </button>
          <button onClick={() => setMostrarModalGC(true)}
            className="flex items-center gap-2 h-10 px-4 bg-[#00B4D8] hover:bg-[#0096B4] text-white text-sm font-medium rounded-lg transition-colors">
            <Plus size={16} /> Nueva Gift Card
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-[#F8FAFB] rounded-xl p-1 border border-[#E2E8F0] w-fit">
        {[
          { id: 'vouchers',   label: 'Vouchers devolucion', icon: Ticket },
          { id: 'gift_cards', label: 'Gift Cards',           icon: Gift  },
        ].map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => { setTab(t.id as any); setPagina(1) }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-white text-[#0F172A] shadow-sm border border-[#E2E8F0]' : 'text-[#64748B] hover:text-[#0F172A]'
              }`}>
              <Icon size={15} />{t.label}
            </button>
          )
        })}
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
              placeholder="Buscar por codigo..."
              className="w-full h-9 pl-8 pr-3 rounded-lg border border-[#E2E8F0] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
            />
          </div>
          <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPagina(1) }}
            className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] focus:outline-none focus:border-[#00B4D8] bg-white">
            <option value="">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="usado">Usado</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFB]">
              <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">Codigo</th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Monto</th>
              {tab === 'gift_cards' && <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Beneficiario</th>}
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Sucursal</th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Vence</th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Estado</th>
              <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {cargando ? (
              <tr><td colSpan={7} className="text-center py-12 text-sm text-[#94A3B8]">Cargando...</td></tr>
            ) : vouchers.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-sm text-[#94A3B8]">Sin registros</td></tr>
            ) : (
              vouchers.map(v => {
                const estado = estadoVoucher(v)
                return (
                  <tr key={v.id} className="hover:bg-[#F8FAFB] transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-mono font-medium text-[#0F172A]">{v.codigo}</p>
                      <p className="text-xs text-[#94A3B8]">{new Date(v.created_at).toLocaleDateString('es-AR')}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-sm font-medium text-[#00B4D8]">${Number(v.monto).toLocaleString('es-AR')}</p>
                    </td>
                    {tab === 'gift_cards' && (
                      <td className="px-4 py-3 text-right">
                        <p className="text-sm text-[#64748B]">{v.beneficiario_nombre || '—'}</p>
                        {v.comprador_nombre && <p className="text-xs text-[#94A3B8]">de {v.comprador_nombre}</p>}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <p className="text-sm text-[#64748B]">{(v.punto_venta as any)?.nombre || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-sm text-[#64748B]">{v.vence_at ? new Date(v.vence_at).toLocaleDateString('es-AR') : '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${estado.color}`}>{estado.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => copiarCodigo(v.codigo)} title="Copiar codigo"
                          className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#00B4D8] transition-colors">
                          {copiado === v.codigo ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                        </button>
                        <button onClick={() => compartirWhatsApp(v)} title="Compartir por WhatsApp"
                          className="p-1.5 rounded-lg hover:bg-green-50 text-[#64748B] hover:text-green-600 transition-colors">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        </button>
                        <button onClick={() => descargarPDF(v)} title="Descargar PDF"
                          className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
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

      {mostrarModalGC && (
        <ModalGiftCard
          onCerrar={() => setMostrarModalGC(false)}
          onGuardado={() => { setMostrarModalGC(false); cargarVouchers() }}
        />
      )}
      {mostrarModalTipos && (
        <ModalGiftCardTipos
          onCerrar={() => setMostrarModalTipos(false)}
        />
      )}
    </div>
  )
}
