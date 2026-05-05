'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Plus, Check, RefreshCw } from 'lucide-react'
import { generarCodigoBarrasUnico } from './generarCodigoBarras'

interface Producto {
  id: string
  nombre: string
  sku: string | null
  codigo_barras: string | null
  precio: number
  alicuota_iva: number
  tipo: string
  activo: boolean
  categoria_id: string | null
}

interface Props {
  producto: Producto | null
  copiarDe: Producto | null
  onCerrar: () => void
  onGuardado: () => void
}

interface Categoria { id: string; nombre: string }

function FieldError({ mensaje }: { mensaje?: string }) {
  if (!mensaje) return null
  return <p className="text-xs text-red-500 mt-1">{mensaje}</p>
}

export default function ModalProducto({ producto, copiarDe, onCerrar, onGuardado }: Props) {
  const supabase = createClient()
  const esNuevo = !producto
  const base = copiarDe || producto

  const [form, setForm] = useState({
    nombre:        copiarDe ? `${copiarDe.nombre} (copia)` : (producto?.nombre || ''),
    sku:           copiarDe ? '' : (producto?.sku || ''),
    codigo_barras: copiarDe ? '' : (producto?.codigo_barras || ''),
    precio:        base?.precio || 0,
    alicuota_iva:  base?.alicuota_iva || 21,
    activo:        base?.activo ?? true,
    categoria_id:  base?.categoria_id || '',
  })

  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [agregandoCategoria, setAgregandoCategoria] = useState(false)
  const [nuevaCategoria, setNuevaCategoria] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [errorGeneral, setErrorGeneral] = useState('')

  async function cargarCategorias() {
    const { data } = await supabase.from('categorias').select('id, nombre').order('nombre')
    setCategorias(data || [])
  }

  useEffect(() => {
    cargarCategorias()
    if (esNuevo || copiarDe) generarNuevoCodigo()
  }, [])

  async function generarNuevoCodigo() {
    setGenerando(true)
    const codigo = await generarCodigoBarrasUnico()
    setForm(prev => ({ ...prev, codigo_barras: codigo }))
    setGenerando(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }))
    setErrores(prev => ({ ...prev, [name]: '' }))
  }

  async function agregarCategoria() {
    if (!nuevaCategoria.trim()) return
    const { data } = await supabase.from('categorias').insert({ nombre: nuevaCategoria }).select().single()
    if (data) {
      await cargarCategorias()
      setForm(prev => ({ ...prev, categoria_id: data.id }))
      setNuevaCategoria('')
      setAgregandoCategoria(false)
    }
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    setErrorGeneral('')

    const errs: Record<string, string> = {}
    if (!form.nombre.trim()) errs.nombre = 'El nombre es obligatorio'
    if (!form.precio || form.precio <= 0) errs.precio = 'Ingresa un precio mayor a 0'
    if (Object.keys(errs).length > 0) { setErrores(errs); return }

    setGuardando(true)

    if (form.codigo_barras) {
      let query = supabase.from('productos').select('id').eq('codigo_barras', form.codigo_barras)
      if (!esNuevo && producto) query = query.neq('id', producto.id)
      const { data: existente } = await query.maybeSingle()
      if (existente) {
        setErrores(p => ({ ...p, codigo_barras: 'Este codigo de barras ya esta en uso' }))
        setGuardando(false)
        return
      }
    }

    const payload = {
      nombre:        form.nombre,
      sku:           form.sku || null,
      codigo_barras: form.codigo_barras || null,
      precio:        form.precio,
      alicuota_iva:  form.alicuota_iva,
      tipo:          'simple',
      activo:        form.activo,
      categoria_id:  form.categoria_id || null,
    }

    if (!esNuevo && producto) {
      if (producto.precio !== form.precio) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.from('historial_precios').insert({
            producto_id: producto.id,
            precio_anterior: producto.precio,
            precio_nuevo: form.precio,
            usuario_id: user.id,
          })
        }
      }
      const { error } = await supabase.from('productos').update(payload).eq('id', producto.id)
      if (error) { setErrorGeneral(error.message); setGuardando(false); return }
    } else {
      const { error } = await supabase.from('productos').insert(payload)
      if (error) { setErrorGeneral(error.message); setGuardando(false); return }
    }

    setGuardando(false)
    onGuardado()
  }

  const titulo = copiarDe ? 'Copiar producto' : esNuevo ? 'Nuevo producto' : 'Editar producto'

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
          <h2 className="text-base font-medium text-[#0F172A]">{titulo}</h2>
          <button onClick={onCerrar} className="p-1.5 rounded-lg hover:bg-[#F8FAFB] text-[#64748B]">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleGuardar} noValidate>
          <div className="px-6 py-5 space-y-4">

            <div>
              <label className="block text-sm text-[#64748B] mb-1.5">Nombre *</label>
              <input name="nombre" value={form.nombre}
                onChange={handleChange}
                placeholder="Ej: Remera basica blanca"
                className={`w-full h-10 px-3 rounded-lg border text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-1 ${
                  errores.nombre ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : 'border-[#E2E8F0] focus:border-[#00B4D8] focus:ring-[#00B4D8]'
                }`}
              />
              <FieldError mensaje={errores.nombre} />
            </div>

            <div>
              <label className="block text-sm text-[#64748B] mb-1.5">SKU</label>
              <input name="sku" value={form.sku} onChange={handleChange}
                placeholder="Ej: REM-001 (opcional)"
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
              />
            </div>

            <div>
              <label className="block text-sm text-[#64748B] mb-1.5">Codigo de barras</label>
              <div className="flex gap-2">
                <input name="codigo_barras" value={form.codigo_barras}
                  onChange={handleChange}
                  placeholder="Generado automaticamente"
                  className={`flex-1 h-10 px-3 rounded-lg border text-sm text-[#0F172A] font-mono placeholder:text-[#94A3B8] focus:outline-none focus:ring-1 ${
                    errores.codigo_barras ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : 'border-[#E2E8F0] focus:border-[#00B4D8] focus:ring-[#00B4D8]'
                  }`}
                />
                <button type="button" onClick={generarNuevoCodigo} disabled={generando}
                  title="Generar nuevo codigo unico"
                  className="h-10 px-3 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFB] text-[#64748B] transition-colors disabled:opacity-50">
                  <RefreshCw size={15} className={generando ? 'animate-spin' : ''} />
                </button>
              </div>
              <FieldError mensaje={errores.codigo_barras} />
              <p className="text-xs text-[#94A3B8] mt-1">
                Se genera automaticamente y es unico. Podes reemplazarlo con el codigo real del producto.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-[#64748B] mb-1.5">Precio (IVA incluido) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">$</span>
                  <input name="precio" type="number" min={0} step={0.01}
                    value={form.precio || ''}
                    onChange={handleChange}
                    placeholder="0,00"
                    className={`w-full h-10 pl-7 pr-3 rounded-lg border text-sm text-[#0F172A] focus:outline-none focus:ring-1 ${
                      errores.precio ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : 'border-[#E2E8F0] focus:border-[#00B4D8] focus:ring-[#00B4D8]'
                    }`}
                  />
                </div>
                <FieldError mensaje={errores.precio} />
              </div>
              <div>
                <label className="block text-sm text-[#64748B] mb-1.5">Alicuota IVA</label>
                <select name="alicuota_iva" value={form.alicuota_iva} onChange={handleChange}
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#00B4D8] bg-white">
                  <option value={0}>0%</option>
                  <option value={10.5}>10.5%</option>
                  <option value={21}>21%</option>
                  <option value={27}>27%</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-[#64748B] mb-1.5">Categoria</label>
              {agregandoCategoria ? (
                <div className="flex gap-2">
                  <input autoFocus value={nuevaCategoria}
                    onChange={e => setNuevaCategoria(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), agregarCategoria())}
                    placeholder="Nombre de la nueva categoria"
                    className="flex-1 h-10 px-3 rounded-lg border border-[#00B4D8] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#00B4D8]"
                  />
                  <button type="button" onClick={agregarCategoria}
                    className="h-10 px-3 rounded-lg bg-[#00B4D8] hover:bg-[#0096B4] text-white transition-colors">
                    <Check size={15} />
                  </button>
                  <button type="button" onClick={() => setAgregandoCategoria(false)}
                    className="h-10 px-3 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFB] transition-colors">
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select name="categoria_id" value={form.categoria_id} onChange={handleChange}
                    className="flex-1 h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A] focus:outline-none focus:border-[#00B4D8] bg-white">
                    <option value="">Sin categoria</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                  <button type="button" onClick={() => setAgregandoCategoria(true)}
                    title="Nueva categoria"
                    className="h-10 px-3 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFB] text-[#64748B] hover:text-[#00B4D8] transition-colors">
                    <Plus size={15} />
                  </button>
                </div>
              )}
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
            <button type="submit" disabled={guardando || generando}
              className="flex-1 h-10 bg-[#00B4D8] hover:bg-[#0096B4] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
              {guardando ? 'Guardando...' : copiarDe ? 'Crear copia' : esNuevo ? 'Crear producto' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
