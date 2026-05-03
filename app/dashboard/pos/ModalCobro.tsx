'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, CreditCard, Banknote, ArrowRightLeft, Search, User, Printer, RefreshCw } from 'lucide-react'

interface ItemCarrito {
  producto_id: string
  nombre: string
  precio: number
  alicuota_iva: number
  cantidad: number
  subtotal: number
}

interface Props {
  carrito: ItemCarrito[]
  onCerrar: () => void
  onConfirmar: (medioPago: string, tipoComprobante: string, descuentoPct: number, clienteId: string | null) => Promise<{ id: string; numero: number; tipo: string } | null | undefined>
}

interface Cliente { id: string; razon_social: string; cuit: string | null; dni: string | null }

const tiposComprobante = [
  { id: 'cotizacion', label: 'Cotizacion', esFactura: false },
  { id: 'factura_a',  label: 'Factura A',  esFactura: true  },
  { id: 'factura_b',  label: 'Factura B',  esFactura: true  },
  { id: 'factura_c',  label: 'Factura C',  esFactura: true  },
]

const mediosPago = [
  { id: 'efectivo',      label: 'Efectivo',      icon: Banknote       },
  { id: 'debito',        label: 'Debito',         icon: CreditCard     },
  { id: 'credito',       label: 'Credito',        icon: CreditCard     },
  { id: 'transferencia', label: 'Transferencia',  icon: ArrowRightLeft },
]

const LABEL_TIPO: Record<string, string> = {
  cotizacion: 'Cotizacion', factura_a: 'Factura A', factura_b: 'Factura B', factura_c: 'Factura C',
}

export default function ModalCobro({ carrito, onCerrar, onConfirmar }: Props) {
  const supabase = createClient()
  const [tipoComprobante, setTipoComprobante] = useState('cotizacion')
  const [medioPago, setMedioPago]             = useState('efectivo')
  const [descuentoPct, setDescuentoPct]       = useState(0)
  const [procesando, setProcesando]           = useState(false)
  const [comprobante, setComprobante]         = useState<{ id: string; numero: number; tipo: string } | null>(null)
  const [carritoConfirmado, setCarritoConfirmado] = useState<ItemCarrito[]>([])
  const [descuentoConfirmado, setDescuentoConfirmado] = useState(0)
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [clientesResultado, setClientesResultado] = useState<Cliente[]>([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null)
  const [mostrarBuscador, setMostrarBuscador] = useState(false)
  const comprobanteRef = useRef<HTMLDivElement>(null)

  const esCotizacion = tipoComprobante === 'cotizacion'

  useEffect(() => {
    if (busquedaCliente.length < 2) { setClientesResultado([]); return }
    const timeout = setTimeout(async () => {
      const { data } = await supabase.from('clientes').select('id, razon_social, cuit, dni')
        .eq('activo', true)
        .or(`razon_social.ilike.%${busquedaCliente}%,cuit.ilike.%${busquedaCliente}%,dni.ilike.%${busquedaCliente}%`)
        .limit(6)
      setClientesResultado(data || [])
    }, 300)
    return () => clearTimeout(timeout)
  }, [busquedaCliente])

  const totalBruto     = carrito.reduce((acc, i) => acc + i.subtotal, 0)
  const descuentoMonto = totalBruto * (descuentoPct / 100)
  const totalFinal     = totalBruto - descuentoMonto
  const ivaIncluido    = esCotizacion ? 0 : carrito.reduce((acc, i) => {
    const subtConDesc = i.subtotal * (1 - descuentoPct / 100)
    return acc + subtConDesc - subtConDesc / (1 + i.alicuota_iva / 100)
  }, 0)
  const netoSinIva = totalFinal - ivaIncluido

  async function handleConfirmar() {
    setProcesando(true)
    setCarritoConfirmado([...carrito])
    setDescuentoConfirmado(descuentoPct)
    const resultado = await onConfirmar(medioPago, tipoComprobante, descuentoPct, clienteSeleccionado?.id || null)
    setComprobante(resultado ?? null)
    setProcesando(false)
  }

  function imprimir() {
    const contenido = comprobanteRef.current
    if (!contenido) return
    const ventana = window.open('', '_blank')
    if (!ventana) return
    ventana.document.write(`
      <html><head><title>Comprobante</title>
      <style>
        body { font-family: monospace; font-size: 12px; margin: 20px; max-width: 300px; }
        .row { display: flex; justify-content: space-between; margin: 3px 0; }
        .bold { font-weight: bold; }
        .center { text-align: center; }
        .dashed { border-top: 1px dashed #000; margin: 8px 0; }
        @media print { body { margin: 0; } }
      </style></head><body>
      ${contenido.innerHTML}
      <script>window.onload = () => window.print()<\/script>
      </body></html>
    `)
    ventana.document.close()
  }

  if (comprobante) {
    const fechaHoy = new Date().toLocaleDateString('es-AR')
    const horaHoy  = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    const esCotConf = comprobante.tipo === 'cotizacion'

    const totalBrutoConf     = carritoConfirmado.reduce((acc, i) => acc + i.subtotal, 0)
    const descuentoMontoConf = totalBrutoConf * (descuentoConfirmado / 100)
    const totalFinalConf     = totalBrutoConf - descuentoMontoConf
    const ivaIncluidoConf    = esCotConf ? 0 : carritoConfirmado.reduce((acc, i) => {
      const subtConDesc = i.subtotal * (1 - descuentoConfirmado / 100)
      return acc + subtConDesc - subtConDesc / (1 + i.alicuota_iva / 100)
    }, 0)
    const netoSinIvaConf = totalFinalConf - ivaIncluidoConf

    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
            <h2 className="text-base font-medium text-[#0F172A]">Comprobante generado</h2>
            <div className="flex items-center gap-2">
              <button onClick={imprimir}
                className="flex items-center gap-1.5 h-8 px-3 border border-[#E2E8F0] hover:bg-[#F8FAFB] text-sm text-[#64748B] rounded-lg transition-colors">
                <Printer size={14} /> Imprimir
              </button>
              <button onClick={onCerrar} className="p-1.5 rounded-lg hover:bg-[#F8FAFB] text-[#64748B]">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="px-6 py-5">
            <div ref={comprobanteRef} className="font-mono text-sm space-y-1">
              <div className="text-center font-bold text-base mb-1">BeHappy</div>
              <div className="text-center text-xs text-[#64748B] mb-3">
                {LABEL_TIPO[comprobante.tipo] || comprobante.tipo} N {String(comprobante.numero).padStart(8, '0')}
              </div>
              <div className="flex justify-between text-xs text-[#64748B]">
                <span>Fecha: {fechaHoy}</span>
                <span>Hora: {horaHoy}</span>
              </div>
              {clienteSeleccionado && (
                <div className="text-xs text-[#64748B]">Cliente: {clienteSeleccionado.razon_social}</div>
              )}

              <div className="border-t border-dashed border-[#E2E8F0] my-2" />

              {carritoConfirmado.map((item, i) => (
                <div key={i}>
                  <div className="text-xs font-medium text-[#0F172A]">{item.nombre}</div>
                  <div className="flex justify-between text-xs text-[#64748B]">
                    <span>{item.cantidad} x ${item.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    <span>${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              ))}

              <div className="border-t border-dashed border-[#E2E8F0] my-2" />

              {descuentoConfirmado > 0 && (
                <div className="flex justify-between text-xs text-green-600">
                  <span>Descuento ({descuentoConfirmado}%)</span>
                  <span>-${descuentoMontoConf.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {!esCotConf && (
                <>
                  <div className="flex justify-between text-xs text-[#64748B]">
                    <span>Neto</span>
                    <span>${netoSinIvaConf.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-xs text-[#64748B]">
                    <span>IVA 21%</span>
                    <span>${ivaIncluidoConf.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-base font-bold text-[#0F172A] pt-1">
                <span>TOTAL</span>
                <span>${totalFinalConf.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs text-[#64748B]">
                <span>Medio de pago</span>
                <span className="capitalize">{medioPago}</span>
              </div>

              <div className="border-t border-dashed border-[#E2E8F0] my-2" />
              <div className="text-center text-xs text-[#94A3B8]">Gracias por su compra</div>
            </div>
          </div>

          <div className="px-6 pb-6">
            <button onClick={onCerrar}
              className="w-full h-10 bg-[#00B4D8] hover:bg-[#0096B4] text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2">
              <RefreshCw size={15} /> Nueva venta
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-base font-medium text-[#0F172A]">Confirmar cobro</h2>
          <button onClick={onCerrar} className="p-1.5 rounded-lg hover:bg-[#F8FAFB] text-[#64748B]">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">

          <div className="bg-[#F8FAFB] rounded-xl p-4 space-y-1.5">
            {carrito.map(item => (
              <div key={item.producto_id} className="flex justify-between text-sm">
                <span className="text-[#64748B]">{item.cantidad}x {item.nombre}</span>
                <span className="text-[#0F172A]">${item.subtotal.toLocaleString('es-AR')}</span>
              </div>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-[#0F172A]">Cliente</p>
              <span className="text-xs text-[#94A3B8]">opcional</span>
            </div>
            {clienteSeleccionado ? (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-[#00B4D8] bg-[#E0F7FC]">
                <User size={16} className="text-[#00B4D8] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#00B4D8] truncate">{clienteSeleccionado.razon_social}</p>
                  <p className="text-xs text-[#64748B]">{clienteSeleccionado.cuit || clienteSeleccionado.dni || 'Sin documento'}</p>
                </div>
                <button onClick={() => { setClienteSeleccionado(null); setBusquedaCliente('') }}
                  className="text-[#94A3B8] hover:text-red-400 transition-colors">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input value={busquedaCliente}
                  onChange={e => { setBusquedaCliente(e.target.value); setMostrarBuscador(true) }}
                  placeholder="Buscar cliente..."
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                />
                {clientesResultado.length > 0 && mostrarBuscador && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-[#E2E8F0] rounded-xl mt-1 shadow-lg z-10 overflow-hidden">
                    {clientesResultado.map(c => (
                      <button key={c.id} type="button"
                        onClick={() => { setClienteSeleccionado(c); setBusquedaCliente(''); setMostrarBuscador(false) }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#F8FAFB] transition-colors border-b border-[#E2E8F0] last:border-0">
                        <p className="font-medium text-[#0F172A]">{c.razon_social}</p>
                        <p className="text-xs text-[#94A3B8]">{c.cuit || c.dni || 'Sin documento'}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-[#0F172A] mb-2">Tipo de comprobante</p>
            <div className="grid grid-cols-4 gap-2">
              {tiposComprobante.map(t => (
                <button key={t.id} onClick={() => setTipoComprobante(t.id)}
                  className={`py-2.5 px-2 rounded-xl border text-center transition-colors ${
                    tipoComprobante === t.id ? 'border-[#00B4D8] bg-[#E0F7FC]' : 'border-[#E2E8F0] hover:bg-[#F8FAFB]'
                  }`}>
                  <p className={`text-sm font-medium ${tipoComprobante === t.id ? 'text-[#00B4D8]' : 'text-[#0F172A]'}`}>
                    {t.label}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-[#0F172A] mb-2">Descuento</p>
            <div className="flex items-center gap-2">
              {[0, 5, 10, 15, 20].map(pct => (
                <button key={pct} onClick={() => setDescuentoPct(pct)}
                  className={`w-12 h-9 rounded-lg border text-sm font-medium transition-colors ${
                    descuentoPct === pct ? 'border-[#00B4D8] bg-[#E0F7FC] text-[#00B4D8]' : 'border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFB]'
                  }`}>
                  {pct}%
                </button>
              ))}
              <div className="relative flex-1">
                <input type="number" min={0} max={100} value={descuentoPct}
                  onChange={e => setDescuentoPct(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-full h-9 pl-3 pr-7 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">%</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-[#0F172A] mb-2">Medio de pago</p>
            <div className="grid grid-cols-2 gap-2">
              {mediosPago.map(m => {
                const Icon = m.icon
                return (
                  <button key={m.id} onClick={() => setMedioPago(m.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                      medioPago === m.id ? 'border-[#00B4D8] bg-[#E0F7FC]' : 'border-[#E2E8F0] hover:bg-[#F8FAFB]'
                    }`}>
                    <Icon size={18} className={medioPago === m.id ? 'text-[#00B4D8]' : 'text-[#64748B]'} strokeWidth={1.5} />
                    <span className={`text-sm font-medium ${medioPago === m.id ? 'text-[#00B4D8]' : 'text-[#0F172A]'}`}>{m.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="bg-[#F8FAFB] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm text-[#64748B]">
              <span>Total productos</span>
              <span>${totalBruto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            {descuentoPct > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Descuento ({descuentoPct}%)</span>
                <span>- ${descuentoMonto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            {!esCotizacion && (
              <>
                <div className="flex justify-between text-sm text-[#64748B] pt-1 border-t border-[#E2E8F0]">
                  <span>Neto sin IVA</span>
                  <span>${netoSinIva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm text-[#64748B]">
                  <span>IVA incluido (21%)</span>
                  <span>${ivaIncluido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-base font-medium text-[#0F172A] pt-2 border-t border-[#E2E8F0]">
              <span>Total</span>
              <span className="text-[#00B4D8]">${totalFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6">
          <button onClick={handleConfirmar} disabled={procesando}
            className="w-full h-11 bg-[#00B4D8] hover:bg-[#0096B4] disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors">
            {procesando ? 'Procesando...' : `${esCotizacion ? 'Generar cotizacion' : 'Confirmar cobro'} $${totalFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
          </button>
        </div>
      </div>
    </div>
  )
}
