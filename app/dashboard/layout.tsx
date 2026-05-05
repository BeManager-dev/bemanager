'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import {
  ShoppingCart, Package, Tag, Users, Truck,
  DollarSign, BarChart2, Settings, LogOut,
  Menu, X, Wallet, FileText, Ticket
} from 'lucide-react'

const navAdmin = [
  { href: '/dashboard/pos',                    label: 'Punto de venta',  icon: ShoppingCart },
  { href: '/dashboard/stock',                  label: 'Stock',           icon: Package      },
  { href: '/dashboard/productos',              label: 'Productos',       icon: Tag          },
  { href: '/dashboard/clientes',               label: 'Clientes',        icon: Users        },
  { href: '/dashboard/proveedores',            label: 'Proveedores',     icon: Truck        },
  { href: '/dashboard/finanzas/caja',          label: 'Caja',            icon: Wallet       },
  { href: '/dashboard/finanzas',               label: 'Finanzas',        icon: DollarSign   },
  { href: '/dashboard/reportes',               label: 'Dashboard',       icon: BarChart2    },
  { href: '/dashboard/finanzas/comprobantes',  label: 'Comprobantes',    icon: FileText     },
  { href: '/dashboard/configuracion',          label: 'Configuracion',   icon: Settings     },
  { href: '/dashboard/vouchers', label: 'Vouchers', icon: Ticket },
]

const navVendedor = [
  { href: '/dashboard/pos',                    label: 'Punto de venta',  icon: ShoppingCart },
  { href: '/dashboard/finanzas/caja',          label: 'Caja',            icon: Wallet       },
  { href: '/dashboard/clientes',               label: 'Clientes',        icon: Users        },
  { href: '/dashboard/productos-vendedor',     label: 'Productos',       icon: Tag          },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [rol, setRol] = useState<'admin' | 'vendedor' | null>(null)

  useEffect(() => {
    async function cargarRol() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('perfiles').select('rol').eq('id', user.id).single()
      setRol(data?.rol || 'vendedor')
    }
    cargarRol()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const nav = rol === 'admin' ? navAdmin : navVendedor

  return (
    <div className="flex min-h-screen bg-[#F8FAFB]">

      {open && (
        <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full w-60 bg-white border-r border-[#E2E8F0] z-30
        flex flex-col transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        <div className="h-16 flex items-center px-5 border-b border-[#E2E8F0]">
          <div className="bg-black rounded-lg px-3 py-1.5">
            <Image src="/logo.png" alt="BeHappy" width={90} height={32} className="object-contain" />
          </div>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === '/dashboard/finanzas'
              ? pathname === href
              : pathname.startsWith(href)
            return (
              <Link key={href} href={href} onClick={() => setOpen(false)}
                className={`
                  flex items-center gap-3 mx-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-colors
                  ${active
                    ? 'bg-[#E0F7FC] text-[#00B4D8] font-medium'
                    : 'text-[#64748B] hover:bg-[#F8FAFB] hover:text-[#0F172A]'
                  }
                `}>
                <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-[#E2E8F0]">
          <button onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-[#64748B] hover:bg-red-50 hover:text-red-500 transition-colors">
            <LogOut size={18} strokeWidth={1.5} />
            Cerrar sesion
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-[#E2E8F0] flex items-center px-4 lg:hidden">
          <button onClick={() => setOpen(!open)} className="p-2 rounded-lg hover:bg-[#F8FAFB]">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
