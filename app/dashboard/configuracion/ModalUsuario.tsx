'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'

interface Usuario {
  id: string
  nombre: string
  apellido: string
  rol: string
  activo: boolean
  punto_venta_id: string | null
}

interface PuntoVenta { id: string; nombre: string }

interface Props {
  usuario: Usuario | null
  puntosVenta: PuntoVenta[]
  onCerrar: () => void
  onGuardado: () => void
}

export default function ModalUsuario({ usuario, puntosVenta, onCerrar, onGuardado }: Props) {
  const supabase = createClient()
  const esNuevo = !usuario

  const [form, setForm] = useState({
    nombre:         usuario?.nombre         || '',
    apellido:       usuario?.apellido       || '',
    email:          '',
    password:       '',
    rol:            usuario?.rol            || 'vendedor',
    punto_venta_id: usuario?.punto_venta_id || '',
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

    if (esNuevo) {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:          form.email,
          password:       form.password,
          nombre:         form.nombre,
          apellido:       form.apellido,
          rol:            form.rol,
          punto_venta_id: form.punto_venta_id || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) { setError(data.error); setGuardando(false); return }
    } else {
      const { error } = await supabase.from('perfiles').update({
        nombre:         form.nombre,
        apellido:       form.apellido,
        rol:            form.rol,
        punto_venta_id: form.punto_venta_id || null,
      }).eq('id', usuario.id)

      if (error) { setError(error.message); setGuardando(false); return }
    }

    setGuardando(false)
    onGuardado()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">

        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-base font-medium text-[#0F172A]">
            {esNuevo ? 'Nuevo usuario' : 'Editar usuario'}
          </h2>
          <button onClick={onCerrar} className="p-1.5 rounded-lg hover:bg-[#F8FAFB] text-[#64748B]">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleGuardar}>
          <div className="px-6 py-5 space-y-4">

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-[#64748B] mb-1.5">Nombre *</label>
                <input name="nombre" value={form.nombre} onChange={handleChange} required
                  placeholder="Juan"
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#64748B] mb-1.5">Apellido *</label>
                <input name="apellido" value={form.apellido} onChange={handleChange} required
                  placeholder="García"
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                />
              </div>
            </div>

            {esNuevo && (
              <>
                <div>
                  <label className="block text-sm text-[#64748B] mb-1.5">Email *</label>
                  <input name="email" type="email" value={form.email} onChange={handleChange} required
                    placeholder="usuario@behappy.com"
                    className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#64748B] mb-1.5">Contraseña *</label>
                  <input name="password" type="password" value={form.password} onChange={handleChange} required
                    placeholder="Mínimo 6 caracteres"
                    className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm text-[#64748B] mb-2">Rol</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'vendedor', label: 'Vendedor',      desc: 'Opera el POS asignado'   },
                  { id: 'admin',    label: 'Administrador', desc: 'Acceso total al sistema'  },
                ].map(r => (
                  <button key={r.id} type="button" onClick={() => setForm(p => ({ ...p, rol: r.id }))}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      form.rol === r.id
                        ? 'border-[#00B4D8] bg-[#E0F7FC]'
                        : 'border-[#E2E8F0] hover:bg-[#F8FAFB]'
                    }`}>
                    <p className={`text-sm font-medium ${form.rol === r.id ? 'text-[#00B4D8]' : 'text-[#0F172A]'}`}>
                      {r.label}
                    </p>
                    <p className="text-xs text-[#94A3B8] mt-0.5">{r.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {form.rol === 'vendedor' && (
              <div>
                <label className="block text-sm text-[#64748B] mb-1.5">Punto de venta asignado</label>
                <select name="punto_venta_id" value={form.punto_venta_id} onChange={handleChange}
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#00B4D8] bg-white">
                  <option value="">Sin asignar</option>
                  {puntosVenta.map(pv => <option key={pv.id} value={pv.id}>{pv.nombre}</option>)}
                </select>
              </div>
            )}

            {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          </div>

          <div className="px-6 pb-6 flex gap-3">
            <button type="button" onClick={onCerrar}
              className="flex-1 h-10 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] hover:bg-[#F8FAFB] transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={guardando}
              className="flex-1 h-10 bg-[#00B4D8] hover:bg-[#0096B4] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
              {guardando ? 'Guardando...' : esNuevo ? 'Crear usuario' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
