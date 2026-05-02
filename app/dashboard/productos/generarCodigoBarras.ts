import { createClient } from '@/lib/supabase/client'

export async function generarCodigoBarrasUnico(): Promise<string> {
  const supabase = createClient()
  let codigo = ''
  let intentos = 0

  while (intentos < 10) {
    codigo = '779' + Math.floor(Math.random() * 10000000000).toString().padStart(10, '0')
    const { data } = await supabase
      .from('productos')
      .select('id')
      .eq('codigo_barras', codigo)
      .maybeSingle()

    if (!data) return codigo // no existe, es único
    intentos++
  }

  // Fallback con timestamp para garantizar unicidad
  return '779' + Date.now().toString().slice(-10)
}
