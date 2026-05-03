'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, Check, X, Users, Tag } from 'lucide-react'
import ModalUsuario from './ModalUsuario'

interface Categoria {
  id: string
  nombre: string
  descripcion: string | null
}

interface Usuario {
  id: string
  nombre: string
  apellido: string
  rol: string
  activo: boolean
  punto_venta_id: string | null
  email?: string
  punto_venta?: { nombre: string } | null
}

interface PuntoVenta {
  id: string
  nombre: string
}

type Tab = 'usuarios' | 'categorias'

export default function ConfiguracionPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('usuarios')

  // Categorías
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [cargandoCat, setCargandoCat] = useState(true)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevaDesc, setNuevaDesc] = useState('')
  const [agregandoCat, setAgregandoCat] = useState(false)
  const [formNuevaCat, setFormNuevaCat] = useState({ nombre: '', descripcion: '' })

  // Usuarios
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [puntosVenta, setPuntosVenta] = useState<PuntoVenta[]>([])
  const [cargandoUsuarios, setCargandoUsuarios] = useState(true)
  const [modalUsuario, setModalUsuario] = useState(false)
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<Usuario | null>(null)

  // Categorías
  async function cargarCategorias() {
    setCargandoCat(true)
    const { data } = await supabase.from('categorias').select('id, nombre, descripcion').order('nombre')
    setCategorias(data || [])
    setCargandoCat(false)
  }

  async function guardarEdicionCat(id: string) {
    if (!nuevoNombre.trim()) return
    await supabase.from('categorias').update({ nombre: nuevoNombre, descripcion: nuevaDesc || null }).eq('id', id)
    setEditandoId(null)
    cargarCategorias()
  }

  async function eliminarCat(id: string, nombre: string) {
    if (!confirm(`¿Eliminar la categoría "${nombre}"?`)) return
    await supabase.from('categorias').delete().eq('id', id)
    cargarCategorias()
  }

  async function agregarCat() {
    if (!formNuevaCat.nombre.trim()) return
    await supabase.from('categorias').insert({ nombre: formNuevaCat.nombre, descripcion: formNuevaCat.descripcion || null })
    setFormNuevaCat({ nombre: '', descripcion: '' })
    setAgregandoCat(false)
    cargarCategorias()
  }

  // Usuarios
  async function cargarUsuarios() {
    setCargandoUsuarios(true)
    const { data } = await supabase
      .from('perfiles')
      .select('id, nombre, apellido, rol, activo, punto_venta_id, punto_venta:puntos_venta(nombre)')
      .order('nombre')
    setUsuarios((data as any) || [])
    setCargandoUsuarios(false)
  }

  async function cargarPuntosVenta() {
    const { data } = await supabase.from('puntos_venta').select('id, nombre').order('nombre')
    setPuntosVenta(data || [])
  }

  async function toggleActivoUsuario(u: Usuario) {
    await supabase.from('perfiles').update({ activo: !u.activo }).eq('id', u.id)
    cargarUsuarios()
  }

  useEffect(() => {
    cargarCategorias()
    cargarUsuarios()
    cargarPuntosVenta()
  }, [])

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-medium text-[#0F172A]">Configuración</h1>
        <p className="text-sm text-[#64748B] mt-0.5">Usuarios, categorías y parámetros del sistema</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F8FAFB] rounded-xl p-1 border border-[#E2E8F0] w-fit">
        {[
          { id: 'usuarios',   label: 'Usuarios',    icon: Users },
          { id: 'categorias', label: 'Categorías',  icon: Tag   },
        ].map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-white text-[#0F172A] shadow-sm border border-[#E2E8F0]'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}>
              <Icon size={15} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab Usuarios */}
      {tab === 'usuarios' && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
            <div>
              <h2 className="text-sm font-medium text-[#0F172A]">Usuarios del sistema</h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">{usuarios.length} usuarios</p>
            </div>
            <button onClick={() => { setUsuarioSeleccionado(null); setModalUsuario(true) }}
              className="flex items-center gap-1.5 h-8 px-3 bg-[#00B4D8] hover:bg-[#0096B4] text-white text-xs font-medium rounded-lg transition-colors">
              <Plus size={14} /> Nuevo usuario
            </button>
          </div>

          {cargandoUsuarios ? (
            <p className="text-sm text-[#94A3B8] text-center py-8">Cargando...</p>
          ) : usuarios.length === 0 ? (
            <p className="text-sm text-[#94A3B8] text-center py-8">No hay usuarios</p>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {usuarios.map(u => (
                <div key={u.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="w-9 h-9 rounded-full bg-[#E0F7FC] flex items-center justify-center shrink-0">
                    <span className="text-sm font-medium text-[#00B4D8]">
                      {u.nombre[0]}{u.apellido[0]}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#0F172A]">{u.nombre} {u.apellido}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        u.rol === 'admin'
                          ? 'bg-purple-50 text-purple-600'
                          : 'bg-[#E0F7FC] text-[#00B4D8]'
                      }`}>
                        {u.rol === 'admin' ? 'Administrador' : 'Vendedor'}
                      </span>
                      {u.punto_venta && (
                        <span className="text-xs text-[#94A3B8]">
                          {(u.punto_venta as any).nombre}
                        </span>
                      )}
                      {!u.punto_venta && u.rol === 'vendedor' && (
                        <span className="text-xs text-orange-500">Sin punto de venta asignado</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleActivoUsuario(u)}
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        u.activo
                          ? 'bg-[#E0F7FC] text-[#00B4D8] hover:bg-[#00B4D8] hover:text-white'
                          : 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white'
                      }`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </button>
                    <button onClick={() => { setUsuarioSeleccionado(u); setModalUsuario(true) }}
                      className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors">
                      <Pencil size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Categorías */}
      {tab === 'categorias' && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
            <div>
              <h2 className="text-sm font-medium text-[#0F172A]">Categorías de productos</h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">{categorias.length} categorías</p>
            </div>
            <button onClick={() => setAgregandoCat(true)}
              className="flex items-center gap-1.5 h-8 px-3 bg-[#00B4D8] hover:bg-[#0096B4] text-white text-xs font-medium rounded-lg transition-colors">
              <Plus size={14} /> Nueva categoría
            </button>
          </div>

          {agregandoCat && (
            <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFB]">
              <div className="flex gap-2">
                <input autoFocus value={formNuevaCat.nombre}
                  onChange={e => setFormNuevaCat(p => ({ ...p, nombre: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && agregarCat()}
                  placeholder="Nombre de la categoría"
                  className="flex-1 h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                />
                <input value={formNuevaCat.descripcion}
                  onChange={e => setFormNuevaCat(p => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Descripción (opcional)"
                  className="flex-1 h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                />
                <button onClick={agregarCat} className="p-2 rounded-lg bg-[#00B4D8] hover:bg-[#0096B4] text-white transition-colors">
                  <Check size={16} />
                </button>
                <button onClick={() => setAgregandoCat(false)} className="p-2 rounded-lg border border-[#E2E8F0] hover:bg-white text-[#64748B] transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {cargandoCat ? (
            <p className="text-sm text-[#94A3B8] text-center py-8">Cargando...</p>
          ) : categorias.length === 0 ? (
            <p className="text-sm text-[#94A3B8] text-center py-8">No hay categorías creadas</p>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {categorias.map(c => (
                <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                  {editandoId === c.id ? (
                    <>
                      <input autoFocus value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && guardarEdicionCat(c.id)}
                        className="flex-1 h-8 px-3 rounded-lg border border-[#00B4D8] text-sm text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#00B4D8]"
                      />
                      <input value={nuevaDesc} onChange={e => setNuevaDesc(e.target.value)}
                        placeholder="Descripción"
                        className="flex-1 h-8 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                      />
                      <button onClick={() => guardarEdicionCat(c.id)} className="p-1.5 rounded-lg bg-[#00B4D8] text-white hover:bg-[#0096B4] transition-colors">
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
                      <button onClick={() => { setEditandoId(c.id); setNuevoNombre(c.nombre); setNuevaDesc(c.descripcion || '') }}
                        className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => eliminarCat(c.id, c.nombre)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-[#64748B] hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {modalUsuario && (
        <ModalUsuario
          usuario={usuarioSeleccionado}
          puntosVenta={puntosVenta}
          onCerrar={() => setModalUsuario(false)}
          onGuardado={() => { setModalUsuario(false); cargarUsuarios() }}
        />
      )}
    </div>
  )
}
