'use client'

import { useEffect, useRef } from 'react'
import { X, Printer } from 'lucide-react'
import JsBarcode from 'jsbarcode'

interface Producto {
  id: string
  nombre: string
  precio: number
  codigo_barras: string | null
  sku: string | null
}

interface Props {
  producto: Producto
  onCerrar: () => void
}

export default function ModalEtiqueta({ producto, onCerrar }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const codigo = producto.codigo_barras || producto.sku || producto.id.slice(0, 12)

  useEffect(() => {
    if (svgRef.current) {
      JsBarcode(svgRef.current, codigo, {
        format: 'CODE128',
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 12,
        margin: 10,
        background: '#ffffff',
        lineColor: '#000000',
      })
    }
  }, [codigo])

  function imprimir() {
    const ventana = window.open('', '_blank')
    if (!ventana) return
    const svgHtml = svgRef.current?.outerHTML || ''
    ventana.document.write(`
      <html><head><title>Etiqueta - ${producto.nombre}</title>
      <style>
        body { margin: 0; padding: 20px; font-family: sans-serif; }
        .etiqueta { border: 1px solid #ccc; padding: 12px; display: inline-block; text-align: center; min-width: 200px; }
        .nombre { font-size: 13px; font-weight: 600; margin-bottom: 4px; max-width: 200px; word-break: break-word; }
        .precio { font-size: 18px; font-weight: 700; color: #00B4D8; margin-bottom: 8px; }
        .id { font-size: 10px; color: #999; margin-top: 4px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="etiqueta">
        <div class="nombre">${producto.nombre}</div>
        <div class="precio">$${producto.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
        ${svgHtml}
        <div class="id">${codigo}</div>
      </div>
      <script>window.onload = () => window.print()</script>
      </body></html>
    `)
    ventana.document.close()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">

        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-base font-medium text-[#0F172A]">Etiqueta</h2>
          <button onClick={onCerrar} className="p-1.5 rounded-lg hover:bg-[#F8FAFB] text-[#64748B]">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-6 flex flex-col items-center gap-4">
          {/* Preview etiqueta */}
          <div className="border border-[#E2E8F0] rounded-xl p-4 text-center w-full">
            <p className="text-sm font-medium text-[#0F172A] mb-1">{producto.nombre}</p>
            <p className="text-xl font-medium text-[#00B4D8] mb-3">
              ${producto.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
            <svg ref={svgRef} className="mx-auto" />
            <p className="text-xs text-[#94A3B8] mt-2 font-mono">{codigo}</p>
          </div>

          <button
            onClick={imprimir}
            className="w-full h-10 bg-[#00B4D8] hover:bg-[#0096B4] text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Printer size={16} />
            Imprimir etiqueta
          </button>
        </div>
      </div>
    </div>
  )
}
