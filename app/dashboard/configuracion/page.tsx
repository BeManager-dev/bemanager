'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'

interface Categoria {
  id: string
  nombre: string
  descripcion: string | null
}

export default function ConfiguracionPage() {
  const supabase = createClient()
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [cargando, setCargando] = useState(true)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevaDesc, setNuevaDesc] = useState('')
  const [agregando, setAgregando] = useState(false)
  const [formNuevo, setFormNuevo] = useState({ nombre: '', descripcion: '' })

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('categorias').select('id, nombre, descripcion').order('nombre')
    setCategorias(data || [])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  async function guardarEdicion(id: string) {
    if (!nuevoNombre.trim()) return
    await supabase.from('categorias').update({ nombre: nuevoNombre, descripcion: nuevaDesc || null }).eq('id', id)
    setEditandoId(null)
    cargar()
  }

  async function eliminar(id: string, nombre: string) {
    if (!confirm(`¿Eliminar la categoría "${nombre}"?`)) return
    await supabase.from('categorias').delete().eq('id', id)
    cargar()
  }

  async function agregar() {
    if (!formNuevo.nombre.trim()) return
    await supabase.from('categorias').insert({ nombre: formNuevo.nombre, descripcion: formNuevo.descripcion || null })
    setFormNuevo({ nombre: '', descripcion: '' })
    setAgregando(false)
    cargar()
  }

  function iniciarEdicion(c: Categoria) {
    setEditandoId(c.id)
    setNuevoNombre(c.nombre)
    setNuevaDesc(c.descripcion || '')
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-medium text-[#0F172A]">Configuración</h1>
        <p className="text-sm text-[#64748B] mt-0.5">Gestión de categorías y parámetros del sistema</p>
      </div>

      {/* Categorías */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div>
            <h2 className="text-sm font-medium text-[#0F172A]">Categorías de productos</h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">{categorias.length} categorías</p>
          </div>
          <button
            onClick={() => setAgregando(true)}
            className="flex items-center gap-1.5 h-8 px-3 bg-[#00B4D8] hover:bg-[#0096B4] text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Plus size={14} />
            Nueva categoría
          </button>
        </div>

        {/* Formulario nueva categoría */}
        {agregando && (
          <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFB]">
            <div className="flex gap-2">
              <input
                autoFocus
                value={formNuevo.nombre}
                onChange={e => setFormNuevo(p => ({ ...p, nombre: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && agregar()}
                placeholder="Nombre de la categoría"
                className="flex-1 h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
              />
              <input
                value={formNuevo.descripcion}
                onChange={e => setFormNuevo(p => ({ ...p, descripcion: e.target.value }))}
                placeholder="Descripción (opcional)"
                className="flex-1 h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
              />
              <button onClick={agregar} className="p-2 rounded-lg bg-[#00B4D8] hover:bg-[#0096B4] text-white transition-colors">
                <Check size={16} />
              </button>
              <button onClick={() => setAgregando(false)} className="p-2 rounded-lg border border-[#E2E8F0] hover:bg-white text-[#64748B] transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {cargando ? (
          <p className="text-sm text-[#94A3B8] text-center py-8">Cargando...</p>
        ) : categorias.length === 0 ? (
          <p className="text-sm text-[#94A3B8] text-center py-8">No hay categorías creadas</p>
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {categorias.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                {editandoId === c.id ? (
                  <>
                    <input
                      autoFocus
                      value={nuevoNombre}
                      onChange={e => setNuevoNombre(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && guardarEdicion(c.id)}
                      className="flex-1 h-8 px-3 rounded-lg border border-[#00B4D8] text-sm text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#00B4D8]"
                    />
                    <input
                      value={nuevaDesc}
                      onChange={e => setNuevaDesc(e.target.value)}
                      placeholder="Descripción"
                      className="flex-1 h-8 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                    />
                    <button onClick={() => guardarEdicion(c.id)} className="p-1.5 rounded-lg bg-[#00B4D8] text-white hover:bg-[#0096B4] transition-colors">
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditandoId(null)} className="p-1.5 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFB] transition-colors">
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1">
                      <p className="text-sm text-[#0F172A]">{c.nombre}</p>
                      {c.descripcion && <p className="text-xs text-[#94A3B8] mt-0.5">{c.descripcion}</p>}
                    </div>
                    <button onClick={() => iniciarEdicion(c)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => eliminar(c.id, c.nombre)} className="p-1.5 rounded-lg hover:bg-red-50 text-[#64748B] hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
