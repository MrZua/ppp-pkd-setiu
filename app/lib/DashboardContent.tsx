'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

type Anggota = {
  id: string
  nama: string
  no_kp: string
  gred: string | null
  lokasi: string | null
  status: string
  umur_semasa: number | null
  bersara_wajib: string | null
  tempoh_berkhidmat: string | null
  baki_perkhidmatan: string | null
}

function bm(interval: string | null) {
  if (!interval) return '-'
  return interval
    .replace(/years?/, 'tahun')
    .replace(/mons?/, 'bulan')
    .replace(/days?/, 'hari')
}

function formatTarikh(t: string | null) {
  if (!t) return '-'
  return new Date(t).toLocaleDateString('ms-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function DashboardContent() {
  const [rows, setRows] = useState<Anggota[]>([])
  const [isPenyelia, setIsPenyelia] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cari, setCari] = useState('')

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        const { data: profil } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userData.user.id)
          .single()
        setIsPenyelia(profil?.role === 'penyelia' || profil?.role === 'admin')
      }

      const { data, error } = await supabase
        .from('anggota_view')
        .select('*')
        .order('nama')

      if (error) setError(error.message)
      else setRows((data as Anggota[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const dipaparkan = rows.filter(
    (r) =>
      r.nama.toLowerCase().includes(cari.toLowerCase()) ||
      (r.lokasi ?? '').toLowerCase().includes(cari.toLowerCase())
  )

  const jumlah = rows.length
  const aktif = rows.filter((r) => r.status === 'Aktif').length
  const lokasi = new Set(rows.map((r) => r.lokasi).filter(Boolean)).size
  const tahunIni = new Date().getFullYear()
  const bersaraTahunIni = rows.filter(
    (r) => r.bersara_wajib && new Date(r.bersara_wajib).getFullYear() === tahunIni
  ).length

  const kad = [
    ['Jumlah Anggota', jumlah],
    ['Status Aktif', aktif],
    ['Lokasi Bertugas', lokasi],
    ['Bersara Wajib Tahun Ini', bersaraTahunIni],
  ]

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kad.map(([label, value]) => (
          <article
            key={label}
            className="rounded-xl border-2 border-black bg-zinc-50 p-5 shadow-sm"
          >
            <p className="text-sm text-zinc-700">{label}</p>
            <p className="mt-3 text-3xl font-bold">{loading ? '...' : value}</p>
          </article>
        ))}
      </div>

      <section className="mt-8 rounded-xl border-2 border-black bg-zinc-50 p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold">Senarai anggota</h3>
            <p className="mt-1 text-sm text-zinc-700">
              {isPenyelia
                ? 'Anda log masuk sebagai penyelia.'
                : 'Paparan sahaja. No. kad pengenalan disorok.'}
            </p>
          </div>
          <input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nama atau lokasi..."
            className="w-full rounded-lg border-2 border-black bg-white px-3 py-2 text-sm sm:w-64"
          />
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            Ralat memuatkan data: {error}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-zinc-300 text-black">
              <tr>
                <th className="p-3">Nama</th>
                {isPenyelia && <th className="p-3">No. KP</th>}
                <th className="p-3">Gred</th>
                <th className="p-3">Lokasi</th>
                <th className="p-3">Umur</th>
                <th className="p-3">Bersara wajib</th>
                <th className="p-3">Tempoh berkhidmat</th>
                <th className="p-3">Baki</th>
                <th className="p-3">Status</th>
                <th className="p-3">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {!loading && dipaparkan.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-zinc-700">
                    Tiada rekod dijumpai.
                  </td>
                </tr>
              )}
              {dipaparkan.map((r) => (
                <tr key={r.id} className="border-t border-zinc-400">
                  <td className="p-3 font-medium">{r.nama}</td>
                  {isPenyelia && <td className="p-3">{r.no_kp}</td>}
                  <td className="p-3">{r.gred ?? '-'}</td>
                  <td className="p-3">{r.lokasi ?? '-'}</td>
                  <td className="p-3">{r.umur_semasa ?? '-'}</td>
                  <td className="p-3">{formatTarikh(r.bersara_wajib)}</td>
                  <td className="p-3">{bm(r.tempoh_berkhidmat)}</td>
                  <td className="p-3">{bm(r.baki_perkhidmatan)}</td>
                  <td className="p-3">
                    <span
                      className={`rounded-full border border-black px-3 py-1 ${
                        r.status === 'Aktif' ? 'bg-emerald-200' : 'bg-zinc-300'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <Link
                      href="/anggota"
                      className="font-medium text-black underline hover:bg-emerald-200"
                    >
                      {isPenyelia ? 'Urus' : 'Lihat'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
