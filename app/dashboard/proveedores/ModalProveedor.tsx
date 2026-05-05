'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'

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
}

interface Props {
  proveedor: Proveedor | null
  onCerrar: () => void
  onGuardado: () => void
}

const CONDICIONES_IVA = [
  { id: 'responsable_inscripto', label: 'Responsable inscripto' },
  { id: 'monotributista',        label: 'Monotributista'        },
  { id: 'exento',                label: 'Exento'                },
]

function FieldError({ mensaje }: { mensaje?: string }) {
  if (!mensaje) return null
  return <p className="text-xs text-red-500 mt-1">{mensaje}</p>
}

export default function ModalProveedor({ proveedor, onCerrar, onGuardado }: Props) {
  const supabase = createClient()
  const esNuevo = !proveedor

  const [form, setForm] = useState({
    razon_social:    proveedor?.razon_social    || '',
    nombre_fantasia: proveedor?.nombre_fantasia || '',
    cuit:            proveedor?.cuit            || '',
    condicion_iva:   proveedor?.condicion_iva   || 'responsable_inscripto',
    email:           proveedor?.email           || '',
    telefono:        proveedor?.telefono        || '',
    contacto:        proveedor?.contacto        || '',
    direccion:       proveedor?.direccion       || '',
  })

  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [errorGeneral, setErrorGeneral] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    setErrores(prev => ({ ...prev, [name]: '' }))
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    setErrorGeneral('')

    const errs: Record<string, string> = {}
    if (!form.razon_social.trim()) errs.razon_social = 'La razon social es obligatoria'
    if (!form.cuit.trim()) errs.cuit = 'El CUIT es obligatorio'
    if (Object.keys(errs).length > 0) { setErrores(errs); return }

    setGuardando(true)

    const payload = {
      razon_social:    form.razon_social,
      nombre_fantasia: form.nombre_fantasia || null,
      cuit:            form.cuit,
      condicion_iva:   form.condicion_iva,
      email:           form.email || null,
      telefono:        form.telefono || null,
      contacto:        form.contacto || null,
      direccion:       form.direccion || null,
    }

    if (esNuevo) {
      const { error } = await supabase.from('proveedores').insert(payload)
      if (error) { setErrorGeneral(error.message); setGuardando(false); return }
    } else {
      const { error } = await supabase.from('proveedores').update(payload).eq('id', proveedor.id)
      if (error) { setErrorGeneral(error.message); setGuardando(false); return }
    }

    setGuardando(false)
    onGuardado()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
          <h2 className="text-base font-medium text-[#0F172A]">
            {esNuevo ? 'Nuevo proveedor' : 'Editar proveedor'}
          </h2>
          <button onClick={onCerrar} className="p-1.5 rounded-lg hover:bg-[#F8FAFB] text-[#64748B]">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleGuardar} noValidate>
          <div className="px-6 py-5 space-y-4">

            <div>
              <label className="block text-sm text-[#64748B] mb-1.5">Razon social *</label>
              <input name="razon_social" value={form.razon_social} onChange={handleChange}
                placeholder="Ej: Distribuidora Norte S.R.L."
                className={`w-full h-10 px-3 rounded-lg border text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-1 ${
                  errores.razon_social ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : 'border-[#E2E8F0] focus:border-[#00B4D8] focus:ring-[#00B4D8]'
                }`}
              />
              <FieldError mensaje={errores.razon_social} />
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
                <label className="block text-sm text-[#64748B] mb-1.5">CUIT *</label>
                <input name="cuit" value={form.cuit} onChange={handleChange}
                  placeholder="30-12345678-9"
                  className={`w-full h-10 px-3 rounded-lg border text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-1 ${
                    errores.cuit ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : 'border-[#E2E8F0] focus:border-[#00B4D8] focus:ring-[#00B4D8]'
                  }`}
                />
                <FieldError mensaje={errores.cuit} />
              </div>
              <div>
                <label className="block text-sm text-[#64748B] mb-1.5">Condicion IVA</label>
                <select name="condicion_iva" value={form.condicion_iva} onChange={handleChange}
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#00B4D8] bg-white">
                  {CONDICIONES_IVA.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-[#64748B] mb-1.5">Nombre del contacto</label>
              <input name="contacto" value={form.contacto} onChange={handleChange}
                placeholder="Ej: Martin Lopez"
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-[#64748B] mb-1.5">Email</label>
                <input name="email" type="email" value={form.email} onChange={handleChange}
                  placeholder="proveedor@email.com"
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#64748B] mb-1.5">Telefono</label>
                <input name="telefono" value={form.telefono} onChange={handleChange}
                  placeholder="+54 9 381 000-0000"
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-[#64748B] mb-1.5">Direccion</label>
              <input name="direccion" value={form.direccion} onChange={handleChange}
                placeholder="Ej: Av. Corrientes 1234, CABA"
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
              />
            </div>

            {errorGeneral && (
              <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{errorGeneral}</p>
            )}
          </div>

          <div className="px-6 pb-6 flex gap-3">
            <button type="button" onClick={onCerrar}
              className="flex-1 h-10 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] hover:bg-[#F8FAFB] transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={guardando}
              className="flex-1 h-10 bg-[#00B4D8] hover:bg-[#0096B4] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
              {guardando ? 'Guardando...' : esNuevo ? 'Crear proveedor' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
