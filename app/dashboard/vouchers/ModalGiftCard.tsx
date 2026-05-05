'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Gift, Copy, Check } from 'lucide-react'

interface GiftCardTipo { id: string; nombre: string; monto: number | null; es_custom: boolean }
interface PuntoVenta { id: string; nombre: string }

interface Props {
  onCerrar: () => void
  onGuardado: () => void
}

function generarCodigo(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let codigo = 'GC-'
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 8) codigo += '-'
    codigo += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return codigo
}

export default function ModalGiftCard({ onCerrar, onGuardado }: Props) {
  const supabase = createClient()
  const [tipos, setTipos] = useState<GiftCardTipo[]>([])
  const [puntosVenta, setPuntosVenta] = useState<PuntoVenta[]>([])
  const [tipoSeleccionado, setTipoSeleccionado] = useState<GiftCardTipo | null>(null)
  const [montoCustom, setMontoCustom] = useState('')
  const [compradorNombre, setCompradorNombre] = useState('')
  const [compradorTelefono, setCompradorTelefono] = useState('')
  const [beneficiarioNombre, setBeneficiarioNombre] = useState('')
  const [puntoVentaId, setPuntoVentaId] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [giftCardGenerada, setGiftCardGenerada] = useState<{ codigo: string; monto: number } | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [errores, setErrores] = useState<Record<string, string>>({})

  useEffect(() => {
    async function cargar() {
      const { data: t } = await supabase.from('gift_card_tipos').select('id, nombre, monto, es_custom').eq('activo', true).order('monto')
      setTipos(t || [])
      const { data: pv } = await supabase.from('puntos_venta').select('id, nombre').eq('activo', true).order('nombre')
      setPuntosVenta(pv || [])
      if (pv && pv.length > 0) setPuntoVentaId(pv[0].id)
    }
    cargar()
  }, [])

  const monto = tipoSeleccionado?.es_custom ? parseFloat(montoCustom) : (tipoSeleccionado?.monto || 0)

  async function guardar() {
    const errs: Record<string, string> = {}
    if (!tipoSeleccionado) errs.tipo = 'Selecciona un tipo de gift card'
    if (tipoSeleccionado?.es_custom && (!montoCustom || isNaN(parseFloat(montoCustom)) || parseFloat(montoCustom) <= 0))
      errs.monto = 'Ingresa un monto valido'
    if (!puntoVentaId) errs.punto_venta = 'Selecciona una sucursal'
    if (Object.keys(errs).length > 0) { setErrores(errs); return }

    setGuardando(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setGuardando(false); return }

    const codigo = generarCodigo()
    const vence = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()

    const { error } = await supabase.from('vouchers').insert({
      codigo,
      tipo:                'gift_card',
      monto,
      gift_card_tipo_id:   tipoSeleccionado!.id,
      comprador_nombre:    compradorNombre || null,
      comprador_telefono:  compradorTelefono || null,
      beneficiario_nombre: beneficiarioNombre || null,
      punto_venta_id:      puntoVentaId,
      usuario_id:          user.id,
      vence_at:            vence,
    })

    if (error) { console.error(error); setGuardando(false); return }
    setGiftCardGenerada({ codigo, monto })
    setGuardando(false)
  }

  function compartirWhatsApp() {
    if (!giftCardGenerada) return
    const vence = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toLocaleDateString('es-AR')
    const para = beneficiarioNombre ? `Para: *${beneficiarioNombre}*\n` : ''
    const msg = encodeURIComponent(
      `🎁 *BeHappy - Gift Card*\n\n${para}Codigo: *${giftCardGenerada.codigo}*\nMonto: *$${giftCardGenerada.monto.toLocaleString('es-AR')}*\nVence: ${vence}\n\nValida en cualquier sucursal BeHappy. Uso unico.`
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  function descargarPDF() {
    if (!giftCardGenerada) return
    const vence = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toLocaleDateString('es-AR')
    const ventana = window.open('', '_blank')
    if (!ventana) return
    ventana.document.write(`
      <html><head><title>Gift Card ${giftCardGenerada.codigo}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f5f5f5; }
        .card { background: linear-gradient(135deg, #00B4D8, #0096B4); border-radius: 16px; padding: 40px; max-width: 420px; width: 100%; color: white; text-align: center; }
        .logo { font-size: 32px; font-weight: bold; margin-bottom: 4px; }
        .subtitulo { font-size: 14px; opacity: 0.8; margin-bottom: 32px; }
        .para { font-size: 13px; opacity: 0.8; margin-bottom: 4px; }
        .beneficiario { font-size: 20px; font-weight: bold; margin-bottom: 24px; }
        .monto { font-size: 56px; font-weight: bold; margin-bottom: 4px; }
        .monto-label { font-size: 12px; opacity: 0.7; margin-bottom: 32px; }
        .codigo-label { font-size: 11px; opacity: 0.7; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        .codigo { font-size: 24px; font-family: monospace; font-weight: bold; letter-spacing: 2px; background: rgba(255,255,255,0.2); padding: 12px 20px; border-radius: 8px; margin-bottom: 24px; }
        .info { font-size: 11px; opacity: 0.7; line-height: 1.6; }
        .vence { font-size: 12px; opacity: 0.6; margin-top: 12px; }
        @media print { body { background: white; } }
      </style></head>
      <body>
        <div class="card">
          <div class="logo">be happy</div>
          <div class="subtitulo">🎁 Gift Card</div>
          ${beneficiarioNombre ? `<div class="para">Para</div><div class="beneficiario">${beneficiarioNombre}</div>` : ''}
          <div class="monto">$${giftCardGenerada.monto.toLocaleString('es-AR')}</div>
          <div class="monto-label">Monto de la gift card</div>
          <div class="codigo-label">Codigo unico</div>
          <div class="codigo">${giftCardGenerada.codigo}</div>
          <div class="info">Valida en cualquier sucursal BeHappy<br>Uso unico — no acumulable</div>
          <div class="vence">Vence: ${vence}</div>
        </div>
        <script>window.onload = () => window.print()<\/script>
      </body></html>
    `)
    ventana.document.close()
  }

  function copiarCodigo() {
    if (!giftCardGenerada) return
    navigator.clipboard.writeText(giftCardGenerada.codigo)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  if (giftCardGenerada) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
            <h2 className="text-base font-medium text-[#0F172A]">Gift Card generada</h2>
            <button onClick={onGuardado} className="p-1.5 rounded-lg hover:bg-[#F8FAFB] text-[#64748B]"><X size={18} /></button>
          </div>
          <div className="px-6 py-6 space-y-4">
            <div className="bg-gradient-to-br from-[#00B4D8] to-[#0096B4] rounded-2xl p-6 text-white text-center">
              <div className="text-2xl font-bold mb-1">be happy</div>
              <div className="text-sm opacity-80 mb-4">🎁 Gift Card</div>
              {beneficiarioNombre && <div className="text-lg font-medium mb-4">Para: {beneficiarioNombre}</div>}
              <div className="text-5xl font-bold mb-1">${giftCardGenerada.monto.toLocaleString('es-AR')}</div>
              <div className="text-xs opacity-70 mb-4">Monto de la gift card</div>
              <div className="bg-white/20 rounded-xl px-4 py-3 font-mono text-xl font-bold tracking-wider">
                {giftCardGenerada.codigo}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={copiarCodigo}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-[#E2E8F0] hover:bg-[#F8FAFB] transition-colors">
                {copiado ? <Check size={18} className="text-green-500" /> : <Copy size={18} className="text-[#64748B]" />}
                <span className="text-xs text-[#64748B]">{copiado ? 'Copiado' : 'Copiar'}</span>
              </button>
              <button onClick={compartirWhatsApp}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-[#E2E8F0] hover:bg-green-50 transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#22C55E">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <span className="text-xs text-[#64748B]">WhatsApp</span>
              </button>
              <button onClick={descargarPDF}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-[#E2E8F0] hover:bg-[#F8FAFB] transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                </svg>
                <span className="text-xs text-[#64748B]">Descargar</span>
              </button>
            </div>
          </div>
          <div className="px-6 pb-6">
            <button onClick={onGuardado}
              className="w-full h-10 bg-[#00B4D8] hover:bg-[#0096B4] text-white text-sm font-medium rounded-xl transition-colors">
              Listo
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-base font-medium text-[#0F172A]">Nueva Gift Card</h2>
          <button onClick={onCerrar} className="p-1.5 rounded-lg hover:bg-[#F8FAFB] text-[#64748B]"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm text-[#64748B] mb-2">Tipo de Gift Card *</label>
            <div className="grid grid-cols-2 gap-2">
              {tipos.map(t => (
                <button key={t.id} onClick={() => { setTipoSeleccionado(t); setErrores(p => ({ ...p, tipo: '' })) }}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    tipoSeleccionado?.id === t.id ? 'border-[#00B4D8] bg-[#E0F7FC]' : 'border-[#E2E8F0] hover:bg-[#F8FAFB]'
                  }`}>
                  <p className={`text-sm font-medium ${tipoSeleccionado?.id === t.id ? 'text-[#00B4D8]' : 'text-[#0F172A]'}`}>{t.nombre}</p>
                  {t.monto && <p className="text-xs text-[#94A3B8]">${Number(t.monto).toLocaleString('es-AR')}</p>}
                </button>
              ))}
            </div>
            {errores.tipo && <p className="text-xs text-red-500 mt-1">{errores.tipo}</p>}
          </div>

          {tipoSeleccionado?.es_custom && (
            <div>
              <label className="block text-sm text-[#64748B] mb-1.5">Monto *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">$</span>
                <input type="number" min={0} value={montoCustom}
                  onChange={e => { setMontoCustom(e.target.value); setErrores(p => ({ ...p, monto: '' })) }}
                  placeholder="0,00"
                  className={`w-full h-10 pl-7 pr-3 rounded-lg border text-sm focus:outline-none focus:ring-1 ${
                    errores.monto ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : 'border-[#E2E8F0] focus:border-[#00B4D8] focus:ring-[#00B4D8]'
                  }`}
                />
              </div>
              {errores.monto && <p className="text-xs text-red-500 mt-1">{errores.monto}</p>}
            </div>
          )}

          <div>
            <label className="block text-sm text-[#64748B] mb-1.5">Sucursal *</label>
            <select value={puntoVentaId} onChange={e => setPuntoVentaId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:border-[#00B4D8] bg-white">
              {puntosVenta.map(pv => <option key={pv.id} value={pv.id}>{pv.nombre}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-[#64748B] mb-1.5">Quien compra</label>
              <input value={compradorNombre} onChange={e => setCompradorNombre(e.target.value)}
                placeholder="Nombre (opcional)"
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
              />
            </div>
            <div>
              <label className="block text-sm text-[#64748B] mb-1.5">Telefono</label>
              <input value={compradorTelefono} onChange={e => setCompradorTelefono(e.target.value)}
                placeholder="Para WhatsApp"
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-[#64748B] mb-1.5">Beneficiario</label>
            <input value={beneficiarioNombre} onChange={e => setBeneficiarioNombre(e.target.value)}
              placeholder="Para quien es la gift card (opcional)"
              className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
            />
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onCerrar}
            className="flex-1 h-10 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] hover:bg-[#F8FAFB] transition-colors">Cancelar</button>
          <button onClick={guardar} disabled={guardando}
            className="flex-1 h-10 bg-[#00B4D8] hover:bg-[#0096B4] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
            <Gift size={15} />
            {guardando ? 'Generando...' : 'Generar Gift Card'}
          </button>
        </div>
      </div>
    </div>
  )
}
