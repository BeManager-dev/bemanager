'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, Check, X, Users, Tag, DollarSign, ShoppingBag } from 'lucide-react'
import ModalUsuario from './ModalUsuario'

interface Categoria { id: string; nombre: string; descripcion: string | null }
interface CategoriaCosto { id: string; nombre: string; activo: boolean }
interface CategoriaEgreso { id: string; nombre: string; activo: boolean }
interface Usuario {
  id: string; nombre: string; apellido: string; rol: string
  activo: boolean; punto_venta_id: string | null
  punto_venta?: { nombre: string } | null
}
interface PuntoVenta { id: string; nombre: string }

type Tab = 'usuarios' | 'categorias' | 'costos' | 'egresos'

function SeccionCategorias({
  titulo, items, cargando,
  onAgregar, onEditar, onEliminar, onToggle,
  conActivo = true,
}: {
  titulo: string
  items: { id: string; nombre: string; activo?: boolean; descripcion?: string | null }[]
  cargando: boolean
  onAgregar: (nombre: string) => void
  onEditar: (id: string, nombre: string) => void
  onEliminar: (id: string, nombre: string) => void
  onToggle?: (id: string, activo: boolean) => void
  conActivo?: boolean
}) {
  const [agregando, setAgregando] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [nombreEdit, setNombreEdit] = useState('')

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
        <div>
          <h2 className="text-sm font-medium text-[#0F172A]">{titulo}</h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">{items.length} categorias</p>
        </div>
        <button onClick={() => setAgregando(true)}
          className="flex items-center gap-1.5 h-8 px-3 bg-[#00B4D8] hover:bg-[#0096B4] text-white text-xs font-medium rounded-lg transition-colors">
          <Plus size={14} /> Nueva
        </button>
      </div>

      {agregando && (
        <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFB]">
          <div className="flex gap-2">
            <input autoFocus value={nuevoNombre}
              onChange={e => setNuevoNombre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && nuevoNombre.trim() && (onAgregar(nuevoNombre), setNuevoNombre(''), setAgregando(false))}
              placeholder="Nombre de la categoria"
              className="flex-1 h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
            />
            <button onClick={() => { if (nuevoNombre.trim()) { onAgregar(nuevoNombre); setNuevoNombre(''); setAgregando(false) } }}
              className="p-2 rounded-lg bg-[#00B4D8] text-white hover:bg-[#0096B4]"><Check size={16} /></button>
            <button onClick={() => { setAgregando(false); setNuevoNombre('') }}
              className="p-2 rounded-lg border border-[#E2E8F0] text-[#64748B]"><X size={16} /></button>
          </div>
        </div>
      )}

      {cargando ? (
        <p className="text-sm text-[#94A3B8] text-center py-8">Cargando...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[#94A3B8] text-center py-8">Sin categorias</p>
      ) : (
        <div className="divide-y divide-[#E2E8F0]">
          {items.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-5 py-3">
              {editandoId === c.id ? (
                <>
                  <input autoFocus value={nombreEdit} onChange={e => setNombreEdit(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && nombreEdit.trim() && (onEditar(c.id, nombreEdit), setEditandoId(null))}
                    className="flex-1 h-8 px-3 rounded-lg border border-[#00B4D8] text-sm focus:outline-none focus:ring-1 focus:ring-[#00B4D8]"
                  />
                  <button onClick={() => { if (nombreEdit.trim()) { onEditar(c.id, nombreEdit); setEditandoId(null) } }}
                    className="p-1.5 rounded-lg bg-[#00B4D8] text-white hover:bg-[#0096B4]"><Check size={14} /></button>
                  <button onClick={() => setEditandoId(null)}
                    className="p-1.5 rounded-lg border border-[#E2E8F0] text-[#64748B]"><X size={14} /></button>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <p className={`text-sm ${conActivo && c.activo === false ? 'text-[#94A3B8] line-through' : 'text-[#0F172A]'}`}>{c.nombre}</p>
                    {c.descripcion && <p className="text-xs text-[#94A3B8] mt-0.5">{c.descripcion}</p>}
                  </div>
                  {conActivo && onToggle && (
                    <button onClick={() => onToggle(c.id, c.activo ?? true)}
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        c.activo !== false
                          ? 'bg-[#E0F7FC] text-[#00B4D8] hover:bg-[#00B4D8] hover:text-white'
                          : 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white'
                      }`}>
                      {c.activo !== false ? 'Activo' : 'Inactivo'}
                    </button>
                  )}
                  <button onClick={() => { setEditandoId(c.id); setNombreEdit(c.nombre) }}
                    className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors"><Pencil size={14} /></button>
                  <button onClick={() => onEliminar(c.id, c.nombre)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-[#64748B] hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ConfiguracionPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('usuarios')

  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [cargandoCat, setCargandoCat] = useState(true)
  const [categoriasCosto, setCategoriasCosto] = useState<CategoriaCosto[]>([])
  const [cargandoCosto, setCargandoCosto] = useState(true)
  const [categoriasEgreso, setCategoriasEgreso] = useState<CategoriaEgreso[]>([])
  const [cargandoEgreso, setCargandoEgreso] = useState(true)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [puntosVenta, setPuntosVenta] = useState<PuntoVenta[]>([])
  const [cargandoUsuarios, setCargandoUsuarios] = useState(true)
  const [modalUsuario, setModalUsuario] = useState(false)
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<Usuario | null>(null)

  async function cargarCategorias() {
    setCargandoCat(true)
    const { data } = await supabase.from('categorias').select('id, nombre, descripcion').order('nombre')
    setCategorias(data || []); setCargandoCat(false)
  }
  async function cargarCategoriasCosto() {
    setCargandoCosto(true)
    const { data } = await supabase.from('categorias_costo').select('id, nombre, activo').order('nombre')
    setCategoriasCosto(data || []); setCargandoCosto(false)
  }
  async function cargarCategoriasEgreso() {
    setCargandoEgreso(true)
    const { data } = await supabase.from('categorias_egreso').select('id, nombre, activo').order('nombre')
    setCategoriasEgreso(data || []); setCargandoEgreso(false)
  }
  async function cargarUsuarios() {
    setCargandoUsuarios(true)
    const { data } = await supabase.from('perfiles')
      .select('id, nombre, apellido, rol, activo, punto_venta_id, punto_venta:puntos_venta(nombre)').order('nombre')
    setUsuarios((data as any) || []); setCargandoUsuarios(false)
  }
  async function cargarPuntosVenta() {
    const { data } = await supabase.from('puntos_venta').select('id, nombre').order('nombre')
    setPuntosVenta(data || [])
  }

  useEffect(() => { cargarCategorias(); cargarCategoriasCosto(); cargarCategoriasEgreso(); cargarUsuarios(); cargarPuntosVenta() }, [])

  async function toggleActivoUsuario(u: Usuario) {
    await supabase.from('perfiles').update({ activo: !u.activo }).eq('id', u.id); cargarUsuarios()
  }

  const tabs = [
    { id: 'usuarios',   label: 'Usuarios',       icon: Users      },
    { id: 'categorias', label: 'Cat. Productos',  icon: Tag        },
    { id: 'costos',     label: 'Cat. Costos',     icon: DollarSign },
    { id: 'egresos',    label: 'Cat. Egresos',    icon: ShoppingBag },
  ]

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-medium text-[#0F172A]">Configuracion</h1>
        <p className="text-sm text-[#64748B] mt-0.5">Usuarios, categorias y parametros del sistema</p>
      </div>

      <div className="flex gap-1 bg-[#F8FAFB] rounded-xl p-1 border border-[#E2E8F0] w-fit flex-wrap">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-white text-[#0F172A] shadow-sm border border-[#E2E8F0]' : 'text-[#64748B] hover:text-[#0F172A]'
              }`}>
              <Icon size={15} />{t.label}
            </button>
          )
        })}
      </div>

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
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {usuarios.map(u => (
                <div key={u.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="w-9 h-9 rounded-full bg-[#E0F7FC] flex items-center justify-center shrink-0">
                    <span className="text-sm font-medium text-[#00B4D8]">{u.nombre[0]}{u.apellido[0]}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#0F172A]">{u.nombre} {u.apellido}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.rol === 'admin' ? 'bg-purple-50 text-purple-600' : 'bg-[#E0F7FC] text-[#00B4D8]'}`}>
                        {u.rol === 'admin' ? 'Administrador' : 'Vendedor'}
                      </span>
                      {u.punto_venta && <span className="text-xs text-[#94A3B8]">{(u.punto_venta as any).nombre}</span>}
                      {!u.punto_venta && u.rol === 'vendedor' && <span className="text-xs text-orange-500">Sin punto de venta</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleActivoUsuario(u)}
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        u.activo ? 'bg-[#E0F7FC] text-[#00B4D8] hover:bg-[#00B4D8] hover:text-white' : 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white'
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

      {tab === 'categorias' && (
        <SeccionCategorias
          titulo="Categorias de productos"
          items={categorias}
          cargando={cargandoCat}
          conActivo={false}
          onAgregar={async nombre => { await supabase.from('categorias').insert({ nombre }); cargarCategorias() }}
          onEditar={async (id, nombre) => { await supabase.from('categorias').update({ nombre }).eq('id', id); cargarCategorias() }}
          onEliminar={async (id, nombre) => { if (!confirm(`Eliminar "${nombre}"?`)) return; await supabase.from('categorias').delete().eq('id', id); cargarCategorias() }}
        />
      )}

      {tab === 'costos' && (
        <SeccionCategorias
          titulo="Categorias de costos"
          items={categoriasCosto}
          cargando={cargandoCosto}
          onAgregar={async nombre => { await supabase.from('categorias_costo').insert({ nombre }); cargarCategoriasCosto() }}
          onEditar={async (id, nombre) => { await supabase.from('categorias_costo').update({ nombre }).eq('id', id); cargarCategoriasCosto() }}
          onEliminar={async (id, nombre) => { if (!confirm(`Eliminar "${nombre}"?`)) return; await supabase.from('categorias_costo').delete().eq('id', id); cargarCategoriasCosto() }}
          onToggle={async (id, activo) => { await supabase.from('categorias_costo').update({ activo: !activo }).eq('id', id); cargarCategoriasCosto() }}
        />
      )}

      {tab === 'egresos' && (
        <SeccionCategorias
          titulo="Categorias de egresos de caja"
          items={categoriasEgreso}
          cargando={cargandoEgreso}
          onAgregar={async nombre => { await supabase.from('categorias_egreso').insert({ nombre }); cargarCategoriasEgreso() }}
          onEditar={async (id, nombre) => { await supabase.from('categorias_egreso').update({ nombre }).eq('id', id); cargarCategoriasEgreso() }}
          onEliminar={async (id, nombre) => { if (!confirm(`Eliminar "${nombre}"?`)) return; await supabase.from('categorias_egreso').delete().eq('id', id); cargarCategoriasEgreso() }}
          onToggle={async (id, activo) => { await supabase.from('categorias_egreso').update({ activo: !activo }).eq('id', id); cargarCategoriasEgreso() }}
        />
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
