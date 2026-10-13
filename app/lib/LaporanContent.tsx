'use client'

import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from './supabase'

type Row = {
  id: string
  nama: string
  gred: string | null
  lokasi: string | null
  status: string
  umur_semasa: number | null
  bersara_wajib: string | null
  baki_perkhidmatan: string | null
  mata_cpd_terkini: number | null
  tahun_cpd_terkini: number | null
  status_cpd: string | null
  pos_basik: string | null
  ijazah: string | null
}

type Data = [string, number][]

const URUTAN_UMUR = ['Bawah 30', '30-39', '40-49', '50-59', '60 ke atas', 'Tiada tarikh lahir']

function kumpulanUmur(u: number | null): string {
  if (u === null) return 'Tiada tarikh lahir'
  if (u < 30) return 'Bawah 30'
  if (u < 40) return '30-39'
  if (u < 50) return '40-49'
  if (u < 60) return '50-59'
  return '60 ke atas'
}

function kira(
  rows: Row[],
  ambil: (r: Row) => string,
  susun: 'label' | 'bilangan'
): Data {
  const m = new Map<string, number>()
  for (const r of rows) {
    const k = ambil(r)
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  const a = Array.from(m.entries())
  return susun === 'label'
    ? a.sort((x, y) => x[0].localeCompare(y[0], 'ms', { numeric: true }))
    : a.sort((x, y) => y[1] - x[1])
}

function formatTarikh(t: string | null) {
  if (!t) return '-'
  return new Date(t).toLocaleDateString('ms-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function bm(interval: string | null) {
  if (!interval) return '-'
  return interval
    .replace(/years?/, 'tahun')
    .replace(/mons?/, 'bulan')
    .replace(/days?/, 'hari')
}

function Bar({ tajuk, data }: { tajuk: string; data: Data }) {
  const maks = Math.max(1, ...data.map((d) => d[1]))
  return (
    <section className="rounded-xl border-2 border-black bg-zinc-50 p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-bold">{tajuk}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-zinc-700">Tiada data.</p>
      ) : (
        <div className="space-y-2">
          {data.map(([label, n]) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              <span className="w-40 shrink-0 truncate" title={label}>
                {label}
              </span>
              <div className="h-5 flex-1 rounded bg-zinc-300">
                {n > 0 && (
                  <div
                    className="h-5 rounded border-2 border-black bg-emerald-300"
                    style={{ width: `${(n / maks) * 100}%` }}
                  />
                )}
              </div>
              <span className="w-8 text-right font-medium">{n}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function LaporanContent() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aktifSahaja, setAktifSahaja] = useState(true)

  useEffect(() => {
    async function muat() {
      const { data, error } = await supabase
        .from('anggota_view')
        .select(
          'id, nama, gred, lokasi, status, umur_semasa, bersara_wajib, baki_perkhidmatan, mata_cpd_terkini, tahun_cpd_terkini, status_cpd, pos_basik, ijazah'
        )
        .order('nama')
      if (error) setError(error.message)
      else setRows((data as Row[]) ?? [])
      setLoading(false)
    }
    muat()
  }, [])

  const laporan = useMemo(() => {
    const sah = aktifSahaja ? rows.filter((r) => r.status === 'Aktif') : rows
    const hari = new Date()
    const tahunIni = hari.getFullYear()

    const had12 = new Date(hari)
    had12.setMonth(had12.getMonth() + 12)
    const had24 = new Date(hari)
    had24.setMonth(had24.getMonth() + 24)

    const dalam = (r: Row, had: Date) => {
      if (!r.bersara_wajib) return false
      const d = new Date(r.bersara_wajib)
      return d >= hari && d <= had
    }

    const umur = sah.map((r) => r.umur_semasa).filter((u): u is number => u !== null)
    const purataUmur = umur.length
      ? (umur.reduce((a, b) => a + b, 0) / umur.length).toFixed(1)
      : '-'

    const tahunCpd = Math.max(0, ...sah.map((r) => r.tahun_cpd_terkini ?? 0))
    const mata = sah
      .filter((r) => r.tahun_cpd_terkini === tahunCpd && r.mata_cpd_terkini !== null)
      .map((r) => r.mata_cpd_terkini as number)
    const purataMata = mata.length
      ? (mata.reduce((a, b) => a + b, 0) / mata.length).toFixed(1)
      : '-'

    const bersaraTahun: Data = []
    for (let y = tahunIni; y <= tahunIni + 10; y++) {
      bersaraTahun.push([
        String(y),
        sah.filter(
          (r) => r.bersara_wajib && new Date(r.bersara_wajib).getFullYear() === y
        ).length,
      ])
    }

    const umurKira = kira(sah, (r) => kumpulanUmur(r.umur_semasa), 'label')
    const kumpulanUmurData: Data = URUTAN_UMUR.map(
      (l) => [l, umurKira.find((x) => x[0] === l)?.[1] ?? 0] as [string, number]
    ).filter((x) => x[1] > 0)

    const adaPos = sah.filter((r) => r.pos_basik).length
    const adaIjazah = sah.filter((r) => r.ijazah).length

    const senaraiBersara = sah
      .filter((r) => dalam(r, had24))
      .sort(
        (a, b) =>
          new Date(a.bersara_wajib as string).getTime() -
          new Date(b.bersara_wajib as string).getTime()
      )

    return {
      jumlah: sah.length,
      purataUmur,
      bersara12: sah.filter((r) => dalam(r, had12)).length,
      bersara5: sah.filter((r) => {
        const h5 = new Date(hari)
        h5.setFullYear(h5.getFullYear() + 5)
        return dalam(r, h5)
      }).length,
      purataMata,
      tahunCpd,
      gred: kira(sah, (r) => r.gred ?? 'Tiada gred', 'label'),
      lokasi: kira(sah, (r) => r.lokasi ?? 'Belum ditetapkan', 'bilangan'),
      umurKumpulan: kumpulanUmurData,
      bersaraTahun,
      kelayakan: [
        ['Ada pos basik', adaPos],
        ['Tiada pos basik', sah.length - adaPos],
        ['Ada maklumat ijazah', adaIjazah],
        ['Tiada maklumat ijazah', sah.length - adaIjazah],
      ] as Data,
      statusCpd: kira(sah, (r) => r.status_cpd ?? 'Tiada rekod', 'bilangan'),
      senaraiBersara,
    }
  }, [rows, aktifSahaja])

  function muatTurun() {
    const aoa: (string | number)[][] = []
    const tambah = (tajuk: string, data: Data) => {
      aoa.push([tajuk])
      data.forEach(([l, n]) => aoa.push([l, n]))
      aoa.push([])
    }
    aoa.push(['Laporan PPP PKD Setiu'])
    aoa.push([aktifSahaja ? 'Anggota aktif sahaja' : 'Semua anggota'])
    aoa.push([])
    aoa.push(['Jumlah anggota', laporan.jumlah])
    aoa.push(['Purata umur', laporan.purataUmur])
    aoa.push(['Bersara dalam 12 bulan', laporan.bersara12])
    aoa.push(['Bersara dalam 5 tahun', laporan.bersara5])
    aoa.push([`Purata mata MyCPD ${laporan.tahunCpd || ''}`, laporan.purataMata])
    aoa.push([])
    tambah('Mengikut gred', laporan.gred)
    tambah('Mengikut tempat bertugas', laporan.lokasi)
    tambah('Mengikut kumpulan umur', laporan.umurKumpulan)
    tambah('Bersara wajib mengikut tahun', laporan.bersaraTahun)
    tambah('Kelayakan', laporan.kelayakan)
    tambah('Status CPD', laporan.statusCpd)

    const bersara = [
      ['Nama', 'Gred', 'Tempat bertugas', 'Tarikh bersara wajib', 'Baki perkhidmatan'],
      ...laporan.senaraiBersara.map((r) => [
        r.nama,
        r.gred ?? '',
        r.lokasi ?? '',
        formatTarikh(r.bersara_wajib),
        bm(r.baki_perkhidmatan),
      ]),
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Ringkasan')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bersara), 'Bersara 24 bulan')
    XLSX.writeFile(wb, 'laporan-ppp-pkd-setiu.xlsx')
  }

  const kad: [string, string | number][] = [
    ['Jumlah anggota', laporan.jumlah],
    ['Purata umur', laporan.purataUmur],
    ['Bersara dalam 12 bulan', laporan.bersara12],
    ['Bersara dalam 5 tahun', laporan.bersara5],
    [`Purata mata MyCPD${laporan.tahunCpd ? ` ${laporan.tahunCpd}` : ''}`, laporan.purataMata],
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={aktifSahaja}
            onChange={(e) => setAktifSahaja(e.target.checked)}
          />
          Anggota aktif sahaja
        </label>
        <button
          onClick={muatTurun}
          disabled={loading || rows.length === 0}
          className="rounded-lg border-2 border-black bg-emerald-300 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:bg-zinc-300 disabled:text-zinc-500"
        >
          Muat turun Excel
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Ralat memuatkan data: {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kad.map(([label, nilai]) => (
          <article
            key={label}
            className="rounded-xl border-2 border-black bg-zinc-50 p-5 shadow-sm"
          >
            <p className="text-sm text-zinc-700">{label}</p>
            <p className="mt-3 text-3xl font-bold">{loading ? '...' : nilai}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Bar tajuk="Mengikut gred" data={laporan.gred} />
        <Bar tajuk="Mengikut tempat bertugas" data={laporan.lokasi} />
        <Bar tajuk="Mengikut kumpulan umur" data={laporan.umurKumpulan} />
        <Bar tajuk="Bersara wajib mengikut tahun" data={laporan.bersaraTahun} />
        <Bar tajuk="Kelayakan" data={laporan.kelayakan} />
        <Bar tajuk="Status CPD" data={laporan.statusCpd} />
      </div>

      <section className="rounded-xl border-2 border-black bg-zinc-50 p-5 shadow-sm">
        <h3 className="text-lg font-bold">Bersara wajib dalam 24 bulan akan datang</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-zinc-300 text-zinc-700">
              <tr>
                <th className="p-3">Nama</th>
                <th className="p-3">Gred</th>
                <th className="p-3">Tempat bertugas</th>
                <th className="p-3">Tarikh bersara</th>
                <th className="p-3">Baki perkhidmatan</th>
              </tr>
            </thead>
            <tbody>
              {!loading && laporan.senaraiBersara.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-zinc-700">
                    Tiada anggota bersara dalam tempoh ini.
                  </td>
                </tr>
              )}
              {laporan.senaraiBersara.map((r) => (
                <tr key={r.id} className="border-t border-zinc-400">
                  <td className="p-3 font-medium">{r.nama}</td>
                  <td className="p-3">{r.gred ?? '-'}</td>
                  <td className="p-3">{r.lokasi ?? '-'}</td>
                  <td className="p-3">{formatTarikh(r.bersara_wajib)}</td>
                  <td className="p-3">{bm(r.baki_perkhidmatan)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
