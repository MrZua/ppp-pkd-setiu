'use client'

import { useEffect, useState } from 'react'
import { supabase } from './supabase'

type Log = {
  id: number
  waktu: string
  emel: string | null
  tindakan: string
  nama: string | null
  lama: Record<string, unknown> | null
  baharu: Record<string, unknown> | null
}

const LABEL: Record<string, string> = {
  nama: 'Nama',
  no_kp: 'No. KP',
  gred: 'Gred',
  lokasi: 'Tempat bertugas',
  status: 'Status',
  tarikh_lahir: 'Tarikh lahir',
  tarikh_lantikan: 'Tarikh lantikan',
  tarikh_disahkan: 'Tarikh disahkan',
  tarikh_naik_pangkat: 'Kenaikan pangkat',
  tarikh_pencen: 'Tarikh pencen',
  umur_bersara_wajib: 'Umur bersara wajib',
  no_daftar_ppp: 'No. daftar PPP',
  no_bless: 'No. BLESS',
  tarikh_semakan_cpd: 'Tarikh semakan CPD',
  status_cpd: 'Status CPD',
  tarikh_kemaskini_mycpd: 'Kemaskini MyCPD',
  emel: 'Emel',
  no_tel: 'No. telefon',
  ijazah: 'Ijazah',
  pos_basik: 'Pos basik',
}

// Nilai medan ini tidak dipaparkan dalam log supaya tidak terdedah di skrin
const SENSITIF = new Set(['no_kp', 'emel', 'no_tel'])

function nilai(k: string, v: unknown): string {
  if (SENSITIF.has(k)) return '(diubah)'
  if (v === null || v === undefined || v === '') return 'kosong'
  return String(v)
}

function formatMasa(t: string) {
  return new Date(t).toLocaleString('ms-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const KELAS: Record<string, string> = {
  TAMBAH: 'bg-emerald-200',
  KEMASKINI: 'bg-zinc-300',
  PADAM: 'bg-red-100',
}

export default function LogContent() {
  const [senarai, setSenarai] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [isPenyelia, setIsPenyelia] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cari, setCari] = useState('')
  const [tindakan, setTindakan] = useState('')

  useEffect(() => {
    async function muat() {
      const { data: u } = await supabase.auth.getUser()
      if (!u.user) {
        setIsPenyelia(false)
        setLoading(false)
        return
      }
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

      const { data, error } = await supabase
        .from('log_perubahan')
        .select('id, waktu, emel, tindakan, nama, lama, baharu')
        .order('waktu', { ascending: false })
        .limit(200)
      if (error) setError(error.message)
      else setSenarai((data as Log[]) ?? [])
      setLoading(false)
    }
    muat()
  }, [])

  if (isPenyelia === false) {
    return (
      <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Hanya penyelia PPP boleh melihat log perubahan.
      </p>
    )
  }

  const dipaparkan = senarai.filter((l) => {
    const q = cari.toLowerCase().trim()
    return (
      (tindakan === '' || l.tindakan === tindakan) &&
      (q === '' ||
        (l.nama ?? '').toLowerCase().includes(q) ||
        (l.emel ?? '').toLowerCase().includes(q))
    )
  })

  return (
    <section className="rounded-xl border-2 border-black bg-zinc-50 p-5 shadow-sm">
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <input
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari nama anggota atau emel pengguna..."
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-sm sm:col-span-2"
        />
        <select
          value={tindakan}
          onChange={(e) => setTindakan(e.target.value)}
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-sm"
        >
          <option value="">Semua tindakan</option>
          <option value="TAMBAH">Tambah</option>
          <option value="KEMASKINI">Kemaskini</option>
          <option value="PADAM">Padam</option>
        </select>
      </div>

      <p className="mb-3 text-sm text-zinc-700">
        {loading
          ? 'Memuatkan...'
          : `Menunjukkan ${dipaparkan.length} daripada ${senarai.length} rekod terkini (maksimum 200).`}{' '}
        Log hanya boleh dibaca, tidak boleh diubah atau dipadam. No. KP, emel dan no. telefon tidak
        dipaparkan nilainya.
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Ralat memuatkan log: {error}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-zinc-300 text-black">
            <tr>
              <th className="p-3">Masa</th>
              <th className="p-3">Pengguna</th>
              <th className="p-3">Tindakan</th>
              <th className="p-3">Anggota</th>
              <th className="p-3">Perubahan</th>
            </tr>
          </thead>
          <tbody>
            {!loading && dipaparkan.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-zinc-700">
                  Tiada rekod log.
                </td>
              </tr>
            )}
            {dipaparkan.map((l) => (
              <tr key={l.id} className="border-t border-zinc-400 align-top">
                <td className="p-3 whitespace-nowrap">{formatMasa(l.waktu)}</td>
                <td className="p-3">{l.emel ?? 'Sistem / SQL'}</td>
                <td className="p-3">
                  <span
                    className={`rounded-full border border-black px-3 py-1 ${KELAS[l.tindakan] ?? ''}`}
                  >
                    {l.tindakan}
                  </span>
                </td>
                <td className="p-3 font-medium">{l.nama ?? '-'}</td>
                <td className="p-3">
                  {l.tindakan === 'KEMASKINI' && l.baharu ? (
                    <ul className="space-y-1">
                      {Object.keys(l.baharu).map((k) => (
                        <li key={k}>
                          <span className="font-medium">{LABEL[k] ?? k}:</span>{' '}
                          {nilai(k, l.lama?.[k])} → {nilai(k, l.baharu?.[k])}
                        </li>
                      ))}
                    </ul>
                  ) : l.tindakan === 'TAMBAH' ? (
                    'Anggota baharu ditambah'
                  ) : (
                    'Rekod anggota dipadam'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
