'use client'

import { useEffect, useState, type ChangeEvent } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from './supabase'

/* ---------- Jenis data ---------- */

type Anggota = {
  nama: string
  no_kp: string
  gred: string | null
  tarikh_lahir: string | null
  tarikh_lantikan: string | null
  tarikh_disahkan: string | null
  tarikh_naik_pangkat: string | null
  tarikh_pencen: string | null
  umur_bersara_wajib: number | null
  no_daftar_ppp: string | null
  no_bless: string | null
  tarikh_semakan_cpd: string | null
  status_cpd: string | null
  tarikh_kemaskini_mycpd: string | null
  emel: string | null
  no_tel: string | null
  ijazah: string | null
  pos_basik: string | null
}

type Cpd = { no_kp: string; tahun: number; mata: number }

type Hasil = {
  anggota: Anggota[]
  cpd: Cpd[]
  info: string[]
  amaran: string[]
  ralat: string[]
}

/* ---------- Fungsi bantu ---------- */

const BULAN: Record<string, number> = {
  jan: 1, feb: 2, mac: 3, mar: 3, apr: 4, mei: 5, may: 5, jun: 6,
  jul: 7, ogo: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dis: 12, dec: 12,
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function norm(v: unknown): string {
  return String(v ?? '').toUpperCase().replace(/\s+/g, ' ').trim()
}

function simpleNama(v: unknown): string {
  return String(v ?? '').toUpperCase().replace(/[^A-Z]/g, '')
}

function teks(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function nombor(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const m = String(v).replace(',', '.').match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : null
}

function telefon(v: unknown): string | null {
  if (v === null || v === undefined || String(v).trim() === '') return null
  if (typeof v === 'number') {
    const d = String(Math.round(v))
    return d.startsWith('0') || d.startsWith('60') ? d : '0' + d
  }
  return String(v).trim()
}

function tarikhIso(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2100) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null
  }
  return `${y}-${pad(m)}-${pad(d)}`
}

// Boleh baca: nombor siri Excel, "16-Sep-1997", "16 Okt. 1999", "16/09/1997"
function bacaTarikh(v: unknown): { nilai: string | null; ralat: boolean } {
  if (v === null || v === undefined || String(v).trim() === '') {
    return { nilai: null, ralat: false }
  }
  if (typeof v === 'number') {
    const dt = new Date(Math.round((v - 25569) * 86400000))
    const iso = tarikhIso(
      dt.getUTCFullYear(),
      dt.getUTCMonth() + 1,
      dt.getUTCDate()
    )
    return { nilai: iso, ralat: iso === null }
  }
  const s = String(v).trim()
  const m = s.match(/^(\d{1,2})[\s\-/.]+([A-Za-z]+\.?|\d{1,2})[\s\-/.,]*(\d{2,4})$/)
  if (!m) return { nilai: null, ralat: true }

  const hari = Number(m[1])
  const bulanTeks = m[2].replace(/[^A-Za-z0-9]/g, '').toLowerCase()
  const bulan = /^\d+$/.test(bulanTeks)
    ? Number(bulanTeks)
    : BULAN[bulanTeks.slice(0, 3)]
  let tahun = Number(m[3])
  if (tahun < 100) tahun = tahun > 40 ? 1900 + tahun : 2000 + tahun
  if (!bulan) return { nilai: null, ralat: true }

  const iso = tarikhIso(tahun, bulan, hari)
  return { nilai: iso, ralat: iso === null }
}

// Seragamkan No. KP kepada XXXXXX-XX-XXXX
function bacaKp(v: unknown): string | null {
  let d = String(v ?? '').replace(/\D/g, '')
  if (d.length === 11) d = '0' + d // sifar di depan hilang
  if (d.length !== 12) return null
  return `${d.slice(0, 6)}-${d.slice(6, 8)}-${d.slice(8)}`
}

function lahirDariKp(kp: string): string | null {
  const yy = Number(kp.slice(0, 2))
  const mm = Number(kp.slice(2, 4))
  const dd = Number(kp.slice(4, 6))
  const yyIni = new Date().getFullYear() % 100
  const y = yy > yyIni ? 1900 + yy : 2000 + yy
  return tarikhIso(y, mm, dd)
}

function cari(tajuk: string[], ...kata: string[]): number {
  return tajuk.findIndex((t) => kata.every((k) => t.includes(k)))
}

type Tab = {
  nama: string
  tajuk: string[]
  baris: { noBaris: number; r: unknown[] }[]
}

function bacaTab(wb: XLSX.WorkBook, kata: string): Tab | null {
  const nama = wb.SheetNames.find((n) => n.toLowerCase().includes(kata))
  if (!nama) return null
  const ws = wb.Sheets[nama]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
  })
  const mula = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']).s.r : 0
  const idx = rows.findIndex((r) =>
    r.some((c) => norm(c).includes('KAD PENGENALAN'))
  )
  if (idx < 0) return { nama, tajuk: [], baris: [] }
  return {
    nama,
    tajuk: rows[idx].map(norm),
    baris: rows
      .slice(idx + 1)
      .map((r, j) => ({ noBaris: mula + idx + j + 2, r })),
  }
}

/* ---------- Proses seluruh fail Excel ---------- */

function proses(wb: XLSX.WorkBook): Hasil {
  const ralat: string[] = []
  const amaran: string[] = []
  const info: string[] = []
  const cpd: Cpd[] = []
  const peta = new Map<string, Anggota>()

  function tgl(v: unknown, label: string, di: string): string | null {
    const h = bacaTarikh(v)
  if (h.ralat) {
      amaran.push(`${di}: ${label} tidak dapat dibaca ("${String(v)}"), dikosongkan.`)
    }
    return h.nilai
  }

  /* --- Tab Anggota (sumber rasmi) --- */
  const utama = bacaTab(wb, 'anggota')
  if (!utama) {
    ralat.push('Tab "Anggota" tidak dijumpai dalam fail ini.')
    return { anggota: [], cpd, info, amaran, ralat }
  }

  const t = utama.tajuk
  const cNama = cari(t, 'NAMA')
  const cKp = cari(t, 'KAD PENGENALAN')
  const cGred = t.findIndex((x) => x === 'GRED')
  const cLantik = cari(t, 'TARIKH', 'LANTIKAN')
  const cSah = cari(t, 'TARIKH', 'DISAHKAN')
  const cNaik = cari(t, 'KENAIKAN', 'PANGKAT')
  const cPencen = cari(t, 'TARIKH', 'PENCEN')
  const cBersara = cari(t, 'BERSARA', 'WAJIB')

  if (cNama < 0) ralat.push('Tab Anggota: lajur "NAMA PPP" tidak dijumpai.')
  if (cKp < 0) ralat.push('Tab Anggota: lajur "NO KAD PENGENALAN" tidak dijumpai.')
  if (ralat.length > 0) return { anggota: [], cpd, info, amaran, ralat }

  const lajurTiada: [number, string][] = [
    [cGred, 'GRED'],
    [cLantik, 'TARIKH LANTIKAN'],
    [cSah, 'TARIKH DISAHKAN'],
    [cNaik, 'TARIKH KENAIKAN PANGKAT'],
    [cPencen, 'TARIKH PENCEN'],
    [cBersara, 'BERSARA WAJIB'],
  ]
  for (const [i, nama] of lajurTiada) {
    if (i < 0) amaran.push(`Tab Anggota: lajur "${nama}" tidak dijumpai, dilangkau.`)
  }

  for (const { noBaris, r } of utama.baris) {
    const di = `Tab ${utama.nama} baris ${noBaris}`
    const nama = teks(r[cNama])
    const kp = bacaKp(r[cKp])

    if (!kp) {
      if (nama) amaran.push(`${di} (${nama}): No. KP tidak sah, dilangkau.`)
      continue
    }
    if (!nama) {
      amaran.push(`${di}: nama kosong, dilangkau.`)
      continue
    }
    if (peta.has(kp)) {
      amaran.push(`${di} (${nama}): No. KP berulang, baris ini dilangkau.`)
      continue
    }

    const lahir = lahirDariKp(kp)
    if (!lahir) amaran.push(`${di} (${nama}): tarikh lahir tidak dapat diambil daripada No. KP.`)

    const lantikan = tgl(r[cLantik], 'Tarikh lantikan', di)
    const disahkan = tgl(r[cSah], 'Tarikh disahkan', di)
    if (lantikan && disahkan && disahkan < lantikan) {
      amaran.push(`${di} (${nama}): tarikh disahkan lebih awal daripada tarikh lantikan. Sila semak.`)
    }

    let umurBersara = nombor(r[cBersara])
    if (umurBersara !== null && (umurBersara < 50 || umurBersara > 65)) {
      amaran.push(`${di} (${nama}): umur bersara wajib "${umurBersara}" luar julat 50-65, dikosongkan.`)
      umurBersara = null
    }

    peta.set(kp, {
      nama,
      no_kp: kp,
      gred: teks(r[cGred]),
      tarikh_lahir: lahir,
      tarikh_lantikan: lantikan,
      tarikh_disahkan: disahkan,
      tarikh_naik_pangkat: tgl(r[cNaik], 'Tarikh kenaikan pangkat', di),
      tarikh_pencen: tgl(r[cPencen], 'Tarikh pencen', di),
      umur_bersara_wajib: umurBersara,
      no_daftar_ppp: null,
      no_bless: null,
      tarikh_semakan_cpd: null,
      status_cpd: null,
      tarikh_kemaskini_mycpd: null,
      emel: null,
      no_tel: null,
      ijazah: null,
      pos_basik: null,
    })
  }

  info.push(`Tab ${utama.nama}: ${peta.size} anggota sah dibaca.`)
  if (peta.size === 0) {
    ralat.push('Tiada baris anggota yang sah dijumpai dalam tab Anggota.')
    return { anggota: [], cpd, info, amaran, ralat }
  }

  /* --- Tab lain: dipadankan melalui No. KP --- */
  function sambung(
    kata: string,
    label: string,
    sediakan: (tajuk: string[]) => (r: unknown[], p: Anggota, di: string) => void
  ) {
    const tab = bacaTab(wb, kata)
    if (!tab) {
      amaran.push(`Tab "${label}" tidak dijumpai, dilangkau.`)
      return
    }
    const kKp = cari(tab.tajuk, 'KAD PENGENALAN')
    if (kKp < 0) {
      amaran.push(`Tab "${tab.nama}": lajur No. Kad Pengenalan tidak dijumpai, dilangkau.`)
      return
    }
    const kNama = cari(tab.tajuk, 'NAMA')
    const kendali = sediakan(tab.tajuk)
    const dilihat = new Set<string>()
    let padan = 0
    let tiada = 0
    let beza = 0

    for (const { noBaris, r } of tab.baris) {
      const di = `Tab ${tab.nama} baris ${noBaris}`
      const kp = bacaKp(r[kKp])
      if (!kp) {
        if (kNama >= 0 && teks(r[kNama])) {
          amaran.push(`${di} (${teks(r[kNama])}): No. KP tidak sah, dilangkau.`)
        }
        continue
      }
      const p = peta.get(kp)
      if (!p) {
        tiada++
        amaran.push(`${di} (${teks(r[kNama]) ?? 'tiada nama'}): No. KP tiada dalam tab Anggota, dilangkau.`)
        continue
      }
      if (dilihat.has(kp)) {
        amaran.push(`${di} (${p.nama}): No. KP berulang dalam tab ini, data baris ini menimpa baris sebelumnya.`)
      }
      dilihat.add(kp)
      if (kNama >= 0 && simpleNama(r[kNama]) !== simpleNama(p.nama)) beza++
      kendali(r, p, di)
      padan++
    }

    let ringkas = `Tab ${tab.nama}: ${padan} dipadankan`
    if (tiada) ringkas += `, ${tiada} tiada dalam tab Anggota`
    if (beza) ringkas += `, ${beza} nama berbeza ejaan (tidak menjejaskan import)`
    info.push(ringkas + '.')
  }

  sambung('bless', 'BLESS CPD', (tj) => {
    const cDaftar = cari(tj, 'NO', 'DAFTAR')
    const cBless = cari(tj, 'NO', 'BLESS')
    const cSemak = cari(tj, 'TARIKH', 'SEMAKAN')
    const cStatus = tj.findIndex((x) => x === 'STATUS')
    const cKemaskini = cari(tj, 'UPDATE', 'MYCPD')
    const lajurTahun = tj
      .map((x, i) => ({
        i,
        y: x.includes('POINT') ? Number(x.match(/20\d{2}/)?.[0]) : NaN,
      }))
      .filter((x) => !Number.isNaN(x.y))

    return (r, p, di) => {
      p.no_daftar_ppp = teks(r[cDaftar])
      p.no_bless = teks(r[cBless])
      p.tarikh_semakan_cpd = tgl(r[cSemak], 'Tarikh semakan', di)
      p.status_cpd = teks(r[cStatus])
      p.tarikh_kemaskini_mycpd = tgl(r[cKemaskini], 'Date update MyCPD', di)
      for (const { i, y } of lajurTahun) {
        const mata = nombor(r[i])
        if (mata !== null) cpd.push({ no_kp: p.no_kp, tahun: y, mata })
      }
    }
  })

  sambung('post', 'Post basic', (tj) => {
    const cIjazah = cari(tj, 'IJAZAH')
    const cPos = cari(tj, 'POS', 'BASIK')
    return (r, p) => {
      p.ijazah = teks(r[cIjazah])
      p.pos_basik = teks(r[cPos])
    }
  })

  sambung('email', 'Email no tel', (tj) => {
    const cTel = cari(tj, 'TELEFON')
    const cEmel = tj.findIndex((x) => /E-?MAIL|E-?MEL/.test(x))
    return (r, p) => {
      p.no_tel = telefon(r[cTel])
      p.emel = teks(r[cEmel])?.toLowerCase() ?? null
    }
  })

  return { anggota: Array.from(peta.values()), cpd, info, amaran, ralat }
}

/* ---------- Komponen ---------- */

export default function ImportExcel() {
  const [isPenyelia, setIsPenyelia] = useState<boolean | null>(null)
  const [hasil, setHasil] = useState<Hasil | null>(null)
  const [namaFail, setNamaFail] = useState('')
  const [simpan, setSimpan] = useState(false)
  const [mesej, setMesej] = useState<{ jenis: 'ok' | 'ralat'; teks: string } | null>(null)

  useEffect(() => {
    async function semak() {
      const { data: u } = await supabase.auth.getUser()
      if (!u.user) {
        setIsPenyelia(false)
        return
      }
      const { data: p } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', u.user.id)
        .single()
      setIsPenyelia(p?.role === 'penyelia' || p?.role === 'admin')
    }
    semak()
  }, [])

  async function pilihFail(e: ChangeEvent<HTMLInputElement>) {
    const fail = e.target.files?.[0]
    if (!fail) return
    setMesej(null)
    setHasil(null)
    setNamaFail(fail.name)
    try {
      const buf = await fail.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      setHasil(proses(wb))
    } catch {
      setMesej({
        jenis: 'ralat',
        teks: 'Fail tidak dapat dibaca. Pastikan ia fail .xlsx yang sah.',
      })
    }
  }

  async function simpanKeDb() {
    if (!hasil) return
    setSimpan(true)
    setMesej(null)
    try {
      // 1. Anggota (kemas kini jika No. KP sudah wujud)
      for (let i = 0; i < hasil.anggota.length; i += 100) {
        const { error } = await supabase
          .from('anggota')
          .upsert(hasil.anggota.slice(i, i + 100), { onConflict: 'no_kp' })
        if (error) throw error
      }

      // 2. Dapatkan ID setiap anggota
      const idMap = new Map<string, string>()
      const semuaKp = hasil.anggota.map((a) => a.no_kp)
      for (let i = 0; i < semuaKp.length; i += 100) {
        const { data, error } = await supabase
          .from('anggota')
          .select('id, no_kp')
          .in('no_kp', semuaKp.slice(i, i + 100))
        if (error) throw error
        data?.forEach((d) => idMap.set(d.no_kp, d.id))
      }

      // 3. Mata MyCPD
      const barisCpd = hasil.cpd.flatMap((c) => {
        const id = idMap.get(c.no_kp)
        return id ? [{ anggota_id: id, tahun: c.tahun, mata: c.mata }] : []
      })
      for (let i = 0; i < barisCpd.length; i += 200) {
        const { error } = await supabase
          .from('cpd_mata')
          .upsert(barisCpd.slice(i, i + 200), { onConflict: 'anggota_id,tahun' })
        if (error) throw error
      }

      setMesej({
        jenis: 'ok',
        teks: `Berjaya disimpan: ${hasil.anggota.length} anggota dan ${barisCpd.length} rekod mata MyCPD.`,
      })
    } catch (err) {
      const pesan = (err as { message?: string })?.message ?? String(err)
      setMesej({ jenis: 'ralat', teks: `Gagal menyimpan: ${pesan}` })
    }
    setSimpan(false)
  }

  if (isPenyelia === null) {
    return <p className="mt-6 text-sm text-zinc-700">Menyemak akses...</p>
  }
  if (!isPenyelia) {
    return (
      <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Hanya penyelia PPP boleh menggunakan halaman import.
      </p>
    )
  }

  const bolehSimpan =
    hasil !== null && hasil.ralat.length === 0 && hasil.anggota.length > 0 && !simpan

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-xl border-2 border-black bg-zinc-50 p-5 shadow-sm">
        <h2 className="text-lg font-bold">1. Pilih fail Excel</h2>
        <p className="mt-1 text-sm text-zinc-700">
          Fail .xlsx dengan tab Anggota, BLESS CPD, Post basic dan email no tel.
          Padanan antara tab dibuat melalui No. KP.
        </p>
        <input
          type="file"
          accept=".xlsx"
          onChange={pilihFail}
          className="mt-4 block text-sm"
        />
        {namaFail && <p className="mt-2 text-sm text-zinc-800">Fail: {namaFail}</p>}
      </section>

      {hasil && (
        <section className="rounded-xl border-2 border-black bg-zinc-50 p-5 shadow-sm">
          <h2 className="text-lg font-bold">2. Semak sebelum simpan</h2>

          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {hasil.info.map((x) => (
              <li key={x}>{x}</li>
            ))}
            <li>Rekod mata MyCPD dibaca: {hasil.cpd.length}</li>
          </ul>

          {hasil.ralat.length > 0 && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <p className="font-semibold">Ralat (perlu dibetulkan sebelum simpan):</p>
              <ul className="mt-1 list-disc pl-5">
                {hasil.ralat.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}

          {hasil.amaran.length > 0 && (
            <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-semibold">
                Amaran ({hasil.amaran.length}). Import tetap boleh diteruskan:
              </p>
              <ul className="mt-1 max-h-60 list-disc overflow-y-auto pl-5">
                {hasil.amaran.slice(0, 50).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
              {hasil.amaran.length > 50 && (
                <p className="mt-1">...dan {hasil.amaran.length - 50} amaran lagi.</p>
              )}
            </div>
          )}

          {hasil.anggota.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <p className="mb-2 text-sm text-zinc-700">
                Pratonton 10 anggota pertama:
              </p>
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-zinc-300 text-zinc-700">
                  <tr>
                    <th className="p-2">Nama</th>
                    <th className="p-2">No. KP</th>
                    <th className="p-2">Gred</th>
                    <th className="p-2">Lantikan</th>
                    <th className="p-2">Umur bersara</th>
                    <th className="p-2">Pos basik</th>
                  </tr>
                </thead>
                <tbody>
                  {hasil.anggota.slice(0, 10).map((a) => (
                    <tr key={a.no_kp} className="border-t border-zinc-400">
                      <td className="p-2">{a.nama}</td>
                      <td className="p-2">{a.no_kp}</td>
                      <td className="p-2">{a.gred ?? '-'}</td>
                      <td className="p-2">{a.tarikh_lantikan ?? '-'}</td>
                      <td className="p-2">{a.umur_bersara_wajib ?? '-'}</td>
                      <td className="p-2">{a.pos_basik ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            onClick={simpanKeDb}
            disabled={!bolehSimpan}
            className="mt-5 rounded-lg border-2 border-black bg-emerald-300 px-5 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
          >
            {simpan ? 'Menyimpan...' : 'Simpan ke pangkalan data'}
          </button>
        </section>
      )}

      {mesej && (
        <p
          className={`rounded-lg p-4 text-sm ${
            mesej.jenis === 'ok'
              ? 'border-2 border-black bg-emerald-100 text-black'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {mesej.teks}
        </p>
      )}
    </div>
  )
}
