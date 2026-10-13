'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

type Pengguna = {
  id: string
  emel: string | null
  role: string | null
  is_active: boolean | null
  dicipta: string
  log_masuk_akhir: string | null
}

function formatMasa(t: string | null) {
  if (!t) return '-'
  return new Date(t).toLocaleString('ms-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function PenggunaContent() {
  const [senarai, setSenarai] = useState<Pengguna[]>([])
  const [uid, setUid] = useState<string | null>(null)
  const [isPenyelia, setIsPenyelia] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [cari, setCari] = useState('')
  const [mesej, setMesej] = useState<{ jenis: 'ok' | 'ralat'; teks: string } | null>(null)

  const muat = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser()
    setUid(u.user?.id ?? null)
    if (u.user) {
      const { data: p } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', u.user.id)
        .single()
      const ok = p?.role === 'penyelia' || p?.role === 'admin'
      setIsPenyelia(ok)
      if (!ok) {
        setLoading(false)
        return
      }
    } else {
      setIsPenyelia(false)
      setLoading(false)
      return
    }

    const { data, error } = await supabase.rpc('senarai_pengguna')
    if (error) setMesej({ jenis: 'ralat', teks: `Ralat memuatkan pengguna: ${error.message}` })
    else setSenarai((data as Pengguna[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    muat()
  }, [muat])

  async function tetapkan(p: Pengguna, role: string, aktif: boolean, soalan: string) {
    if (!window.confirm(soalan)) return
    setMesej(null)
    const { error } = await supabase.rpc('tetapkan_pengguna', {
      p_id: p.id,
      p_role: role,
      p_aktif: aktif,
    })
    if (error) {
      setMesej({ jenis: 'ralat', teks: error.message })
      return
    }
    setMesej({ jenis: 'ok', teks: `Akaun ${p.emel ?? ''} dikemas kini.` })
    await muat()
  }

  if (isPenyelia === false) {
    return (
      <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Hanya penyelia PPP boleh mengurus pengguna.
      </p>
    )
  }

  const dipaparkan = senarai.filter((p) =>
    (p.emel ?? '').toLowerCase().includes(cari.toLowerCase().trim())
  )
  const menunggu = senarai.filter((p) => p.is_active !== true).length

  return (
    <div className="space-y-5">
      {mesej && (
        <p
          className={`rounded-lg p-3 text-sm ${
            mesej.jenis === 'ok'
              ? 'border-2 border-black bg-emerald-100 text-black'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {mesej.teks}
        </p>
      )}

      <section className="rounded-xl border-2 border-black bg-zinc-50 p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold">Senarai pengguna</h3>
            <p className="mt-1 text-sm text-zinc-700">
              {loading
                ? 'Memuatkan...'
                : `${senarai.length} akaun. ${menunggu} belum aktif.`}{' '}
              Pengguna baharu yang mendaftar tidak boleh melihat data sehingga diaktifkan.
            </p>
          </div>
          <input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari emel..."
            className="w-full rounded-lg border-2 border-black bg-white px-3 py-2 text-sm sm:w-64"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-zinc-300 text-black">
              <tr>
                <th className="p-3">Emel</th>
                <th className="p-3">Peranan</th>
                <th className="p-3">Akaun</th>
                <th className="p-3">Log masuk akhir</th>
                <th className="p-3">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {!loading && dipaparkan.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-zinc-700">
                    Tiada pengguna dijumpai.
                  </td>
                </tr>
              )}
              {dipaparkan.map((p) => {
                const sendiri = p.id === uid
                const penyeliaIni = p.role === 'penyelia' || p.role === 'admin'
                const aktif = p.is_active === true
                return (
                  <tr key={p.id} className="border-t border-zinc-400">
                    <td className="p-3 font-medium">
                      {p.emel ?? '-'}
                      {sendiri && <span className="ml-2 text-xs text-zinc-600">(anda)</span>}
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full border border-black px-3 py-1 ${
                          penyeliaIni ? 'bg-emerald-200' : 'bg-zinc-300'
                        }`}
                      >
                        {p.role ?? '-'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full border border-black px-3 py-1 ${
                          aktif ? 'bg-emerald-200' : 'bg-amber-100'
                        }`}
                      >
                        {aktif ? 'Aktif' : 'Belum aktif'}
                      </span>
                    </td>
                    <td className="p-3">{formatMasa(p.log_masuk_akhir)}</td>
                    <td className="space-x-3 p-3 whitespace-nowrap">
                      {sendiri ? (
                        <span className="text-zinc-500">-</span>
                      ) : (
                        <>
                          <button
                            onClick={() =>
                              tetapkan(
                                p,
                                p.role === 'admin' ? 'penyelia' : p.role ?? 'pengguna',
                                !aktif,
                                aktif
                                  ? `Nyahaktifkan ${p.emel}? Pengguna ini tidak boleh lagi melihat data.`
                                  : `Aktifkan ${p.emel}?`
                              )
                            }
                            className="font-medium text-black underline hover:bg-emerald-200"
                          >
                            {aktif ? 'Nyahaktifkan' : 'Aktifkan'}
                          </button>
                          <button
                            onClick={() =>
                              tetapkan(
                                p,
                                penyeliaIni ? 'pengguna' : 'penyelia',
                                aktif || !penyeliaIni,
                                penyeliaIni
                                  ? `Tukar ${p.emel} kepada pengguna biasa? Akses edit dan No. KP akan ditarik.`
                                  : `Jadikan ${p.emel} penyelia PPP? Penyelia boleh melihat No. KP, mengedit, memadam dan mengimport data.`
                              )
                            }
                            className="font-medium text-black underline hover:bg-emerald-200"
                          >
                            {penyeliaIni ? 'Jadikan pengguna' : 'Jadikan penyelia'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-sm text-zinc-700">
        Hanya lantik penyelia daripada staf KKM yang disahkan. Anda tidak boleh mengubah akaun sendiri,
        supaya sentiasa ada sekurang-kurangnya seorang penyelia.
      </p>
    </div>
  )
}
