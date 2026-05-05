'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Plus, Pencil, Trash2, Check } from 'lucide-react'

interface Tipo { id: string; nombre: string; monto: number | null; es_custom: boolean; activo: boolean }

export default function ModalGiftCardTipos({ onCerrar }: { onCerrar: () => void }) {
  const supabase = createClient()
  const [tipos, setTipos] = useState<Tipo[]>([])
  const [cargando, setCargando] = useState(true)
  const [agregando, setAgregando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState({ nombre: '', monto: '', es_custom: false })

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('gift_card_tipos').select('id, nombre, monto, es_custom, activo').order('monto')
    setTipos(data || [])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  async function guardar() {
    if (!form.nombre.trim()) return
    const payload = {
      nombre: form.nombre,
      monto: form.es_custom ? null : (parseFloat(form.monto) || null),
      es_custom: form.es_custom,
    }
    if (editandoId) {
      await supabase.from('gift_card_tipos').update(payload).eq('id', editandoId)
      setEditandoId(null)
    } else {
      await supabase.from('gift_card_tipos').insert(payload)
      setAgregando(false)
    }
    setForm({ nombre: '', monto: '', es_custom: false })
    cargar()
  }

  async function toggleActivo(id: string, activo: boolean) {
    await supabase.from('gift_card_tipos').update({ activo: !activo }).eq('id', id)
    cargar()
  }

  async function eliminar(id: string, nombre: string) {
    if (!confirm(`Eliminar "${nombre}"?`)) return
    await supabase.from('gift_card_tipos').delete().eq('id', id)
    cargar()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-base font-medium text-[#0F172A]">Tipos de Gift Card</h2>
          <button onClick={onCerrar} className="p-1.5 rounded-lg hover:bg-[#F8FAFB] text-[#64748B]"><X size={18} /></button>
        </div>

        {(agregando || editandoId) && (
          <div className="px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFB] space-y-3">
            <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
              placeholder="Nombre (ej: Gift Card $5.000)"
              className="w-full h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
            />
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-[#64748B] cursor-pointer">
                <input type="checkbox" checked={form.es_custom}
                  onChange={e => setForm(p => ({ ...p, es_custom: e.target.checked, monto: '' }))}
                  className="rounded"
                />
                Monto personalizado
              </label>
              {!form.es_custom && (
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">$</span>
                  <input type="number" value={form.monto} onChange={e => setForm(p => ({ ...p, monto: e.target.value }))}
                    placeholder="0,00"
                    className="w-full h-9 pl-7 pr-3 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={guardar} className="flex-1 h-9 bg-[#00B4D8] hover:bg-[#0096B4] text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1">
                <Check size={14} /> Guardar
              </button>
              <button onClick={() => { setAgregando(false); setEditandoId(null); setForm({ nombre: '', monto: '', es_custom: false }) }}
                className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] hover:bg-white transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto divide-y divide-[#E2E8F0]">
          {cargando ? (
            <p className="text-sm text-[#94A3B8] text-center py-8">Cargando...</p>
          ) : (
            tipos.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1">
                  <p className={`text-sm ${!t.activo ? 'text-[#94A3B8] line-through' : 'text-[#0F172A]'}`}>{t.nombre}</p>
                  <p className="text-xs text-[#94A3B8]">{t.es_custom ? 'Monto personalizado' : `$${Number(t.monto).toLocaleString('es-AR')}`}</p>
                </div>
                <button onClick={() => toggleActivo(t.id, t.activo)}
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                    t.activo ? 'bg-[#E0F7FC] text-[#00B4D8] hover:bg-[#00B4D8] hover:text-white' : 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white'
                  }`}>
                  {t.activo ? 'Activo' : 'Inactivo'}
                </button>
                <button onClick={() => { setEditandoId(t.id); setForm({ nombre: t.nombre, monto: t.monto?.toString() || '', es_custom: t.es_custom }) }}
                  className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] transition-colors"><Pencil size={14} /></button>
                <button onClick={() => eliminar(t.id, t.nombre)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-[#64748B] hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#E2E8F0] flex gap-3">
          <button onClick={() => { setAgregando(true); setEditandoId(null) }}
            className="flex-1 h-10 bg-[#00B4D8] hover:bg-[#0096B4] text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
            <Plus size={15} /> Nuevo tipo
          </button>
          <button onClick={onCerrar}
            className="h-10 px-4 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] hover:bg-[#F8FAFB] transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
