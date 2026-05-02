'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'

interface Proveedor { id: string; razon_social: string }
interface Props {
  proveedor: Proveedor
  onCerrar: () => void
  onGuardado: () => void
}

const MEDIOS_PAGO = [
  { id: 'efectivo',      label: 'Efectivo'       },
  { id: 'transferencia', label: 'Transferencia'  },
  { id: 'debito',        label: 'Débito'         },
  { id: 'credito',       label: 'Crédito'        },
]

export default function ModalPagoProveedor({ proveedor, onCerrar, onGuardado }: Props) {
  const supabase = createClient()
  const [form, setForm] = useState({
    fecha:          new Date().toISOString().split('T')[0],
    monto:          0,
    medio_pago:     'transferencia',
    concepto:       '',
    comprobante_nro: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }))
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('pagos_proveedor').insert({
      proveedor_id:    proveedor.id,
      fecha:           form.fecha,
      monto:           form.monto,
      medio_pago:      form.medio_pago,
      concepto:        form.concepto || null,
      comprobante_nro: form.comprobante_nro || null,
      usuario_id:      user.id,
    })

    if (error) { setError(error.message); setGuardando(false); return }
    setGuardando(false)
    onGuardado()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">

        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <div>
            <h2 className="text-base font-medium text-[#0F172A]">Registrar pago</h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">{proveedor.razon_social}</p>
          </div>
          <button onClick={onCerrar} className="p-1.5 rounded-lg hover:bg-[#F8FAFB] text-[#64748B]">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleGuardar}>
          <div className="px-6 py-5 space-y-4">

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-[#64748B] mb-1.5">Fecha</label>
                <input name="fecha" type="date" value={form.fecha} onChange={handleChange}
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#64748B] mb-1.5">Monto *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">$</span>
                  <input name="monto" type="number" min={0} step={0.01} value={form.monto}
                    onChange={handleChange} required
                    className="w-full h-10 pl-7 pr-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm text-[#64748B] mb-2">Medio de pago</label>
              <div className="grid grid-cols-2 gap-2">
                {MEDIOS_PAGO.map(m => (
                  <button key={m.id} type="button" onClick={() => setForm(p => ({ ...p, medio_pago: m.id }))}
                    className={`h-10 rounded-lg border text-sm font-medium transition-colors ${
                      form.medio_pago === m.id
                        ? 'border-[#00B4D8] bg-[#E0F7FC] text-[#00B4D8]'
                        : 'border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFB]'
                    }`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-[#64748B] mb-1.5">Concepto</label>
              <input name="concepto" value={form.concepto} onChange={handleChange}
                placeholder="Ej: Pago factura octubre, mercadería..."
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
              />
            </div>

            <div>
              <label className="block text-sm text-[#64748B] mb-1.5">N° comprobante del proveedor</label>
              <input name="comprobante_nro" value={form.comprobante_nro} onChange={handleChange}
                placeholder="Ej: FC 0001-00012345"
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
              />
            </div>

            {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          </div>

          <div className="px-6 pb-6 flex gap-3">
            <button type="button" onClick={onCerrar}
              className="flex-1 h-10 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] hover:bg-[#F8FAFB] transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={guardando}
              className="flex-1 h-10 bg-[#00B4D8] hover:bg-[#0096B4] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
              {guardando ? 'Guardando...' : 'Registrar pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
