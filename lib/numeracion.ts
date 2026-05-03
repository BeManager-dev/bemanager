import { createClient } from '@/lib/supabase/client'

export async function siguienteNumero(puntoVentaId: string, tipo: string): Promise<number> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('siguiente_numero', {
    p_punto_venta_id: puntoVentaId,
    p_tipo: tipo,
  })
  if (error) {
    console.error('Error generando número:', error)
    return Math.floor(Math.random() * 99999)
  }
  return data
}
