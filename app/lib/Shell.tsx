'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import ProtectedDashboard from './ProtectedDashboard'
import { supabase } from './supabase'

const menu = [
  { href: '/', label: 'Dashboard', hanyaPenyelia: false },
  { href: '/anggota', label: 'Database Anggota', hanyaPenyelia: false },
  { href: '/import', label: 'Import Excel', hanyaPenyelia: true },
  { href: '/laporan', label: 'Laporan & Graf', hanyaPenyelia: false },
  { href: '/pengguna', label: 'Pengurusan Pengguna', hanyaPenyelia: true },
  { href: '/log', label: 'Log Perubahan', hanyaPenyelia: true },
]

export default function Shell({
  tajuk,
  penerangan,
  children,
}: {
  tajuk: string
  penerangan?: string
  children: ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [emel, setEmel] = useState('')
  const [isPenyelia, setIsPenyelia] = useState(false)

  useEffect(() => {
    async function muat() {
      const { data: u } = await supabase.auth.getUser()
      if (!u.user) return
      setEmel(u.user.email ?? '')
      const { data: p } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', u.user.id)
        .single()
      setIsPenyelia(p?.role === 'penyelia' || p?.role === 'admin')
    }
    muat()
  }, [])

  async function logKeluar() {
    try {
      await supabase.auth.signOut()
    } finally {
      router.push('/login')
    }
  }

  function aktif(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href)
  }

  return (
    <ProtectedDashboard>
      <main className="min-h-screen bg-zinc-200 text-black md:flex">
        <aside className="flex flex-col border-b-2 border-black bg-emerald-200 p-6 text-black md:min-h-screen md:w-64 md:border-b-0 md:border-r-2">
          <h1 className="text-xl font-bold">PKD SETIU</h1>
          <p className="mt-2 text-sm text-zinc-800">Portal Database PPP</p>

          <nav className="mt-8 space-y-2">
            {menu
              .filter((m) => !m.hanyaPenyelia || isPenyelia)
              .map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  className={`block rounded-lg border-2 px-4 py-3 text-sm transition ${
                    aktif(m.href)
                      ? 'border-black bg-white font-semibold'
                      : 'border-transparent hover:border-black hover:bg-emerald-100'
                  }`}
                >
                  {m.label}
                </Link>
              ))}
          </nav>

          <div className="mt-auto pt-10">
            {emel && (
              <div className="mb-3 text-xs text-zinc-800">
                <p className="break-all">{emel}</p>
                <p className="mt-1 font-medium">
                  {isPenyelia ? 'Penyelia PPP' : 'Pengguna (paparan sahaja)'}
                </p>
              </div>
            )}
            <button
              onClick={logKeluar}
              className="w-full rounded-lg border-2 border-black bg-white px-4 py-2 text-sm font-medium hover:bg-emerald-100"
            >
              Log keluar
            </button>
            <p className="mt-4 text-xs text-zinc-700">Versi pembangunan 0.2</p>
          </div>
        </aside>

        <section className="min-w-0 flex-1 p-5 md:p-8">
          <header className="mb-8">
            <p className="text-sm text-zinc-700">Portal / {tajuk}</p>
            <h2 className="mt-2 text-3xl font-bold">{tajuk}</h2>
            {penerangan && <p className="mt-2 text-zinc-800">{penerangan}</p>}
          </header>
          {children}
        </section>
      </main>
    </ProtectedDashboard>
  )
}
