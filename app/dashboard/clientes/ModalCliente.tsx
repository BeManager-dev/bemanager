'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'

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
}

interface Props {
  cliente: Cliente | null
  onCerrar: () => void
  onGuardado: () => void
}

const CONDICIONES_IVA = [
  { id: 'consumidor_final',      label: 'Consumidor final'      },
  { id: 'responsable_inscripto', label: 'Responsable inscripto' },
  { id: 'monotributista',        label: 'Monotributista'        },
  { id: 'exento',                label: 'Exento'                },
]

export default function ModalCliente({ cliente, onCerrar, onGuardado }: Props) {
  const supabase = createClient()
  const esNuevo = !cliente

  const [form, setForm] = useState({
    razon_social:    cliente?.razon_social    || '',
    nombre_fantasia: cliente?.nombre_fantasia || '',
    cuit:            cliente?.cuit            || '',
    dni:             cliente?.dni             || '',
    condicion_iva:   cliente?.condicion_iva   || 'consumidor_final',
    email:           cliente?.email           || '',
    telefono:        cliente?.telefono        || '',
    ciudad:          cliente?.ciudad          || '',
    provincia:       cliente?.provincia       || '',
  })

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError('')

    const payload = {
      razon_social:    form.razon_social,
      nombre_fantasia: form.nombre_fantasia || null,
      cuit:            form.cuit || null,
      dni:             form.dni || null,
      condicion_iva:   form.condicion_iva,
      email:           form.email || null,
      telefono:        form.telefono || null,
      ciudad:          form.ciudad || null,
      provincia:       form.provincia || null,
    }

    if (esNuevo) {
      const { error } = await supabase.from('clientes').insert(payload)
      if (error) { setError(error.message); setGuardando(false); return }
    } else {
      const { error } = await supabase.from('clientes').update(payload).eq('id', cliente.id)
      if (error) { setError(error.message); setGuardando(false); return }
    }

    setGuardando(false)
    onGuardado()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
          <h2 className="text-base font-medium text-[#0F172A]">
            {esNuevo ? 'Nuevo cliente' : 'Editar cliente'}
          </h2>
          <button onClick={onCerrar} className="p-1.5 rounded-lg hover:bg-[#F8FAFB] text-[#64748B]">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleGuardar}>
          <div className="px-6 py-5 space-y-4">

            <div>
              <label className="block text-sm text-[#64748B] mb-1.5">Razón social / Nombre *</label>
              <input name="razon_social" value={form.razon_social} onChange={handleChange} required
                placeholder="Ej: Juan García o García S.A."
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
              />
            </div>

            <div>
              <label className="block text-sm text-[#64748B] mb-1.5">Nombre fantasia</label>
              <input name="nombre_fantasia" value={form.nombre_fantasia} onChange={handleChange}
                placeholder="Opcional"
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-[#64748B] mb-1.5">CUIT</label>
                <input name="cuit" value={form.cuit} onChange={handleChange}
                  placeholder="20-12345678-9"
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#64748B] mb-1.5">DNI</label>
                <input name="dni" value={form.dni} onChange={handleChange}
                  placeholder="12.345.678"
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-[#64748B] mb-1.5">Condición IVA</label>
              <select name="condicion_iva" value={form.condicion_iva} onChange={handleChange}
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#00B4D8] bg-white">
                {CONDICIONES_IVA.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-[#64748B] mb-1.5">Email</label>
                <input name="email" type="email" value={form.email} onChange={handleChange}
                  placeholder="email@ejemplo.com"
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#64748B] mb-1.5">Teléfono</label>
                <input name="telefono" value={form.telefono} onChange={handleChange}
                  placeholder="+54 9 381 000-0000"
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-[#64748B] mb-1.5">Ciudad</label>
                <input name="ciudad" value={form.ciudad} onChange={handleChange}
                  placeholder="Ej: Tucumán"
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#64748B] mb-1.5">Provincia</label>
                <input name="provincia" value={form.provincia} onChange={handleChange}
                  placeholder="Ej: Tucumán"
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                />
              </div>
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
              {guardando ? 'Guardando...' : esNuevo ? 'Crear cliente' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
