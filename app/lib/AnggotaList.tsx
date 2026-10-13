'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { supabase } from './supabase'

/* ---------- Jenis data ---------- */

type Baris = {
  id: string
  nama: string
  no_kp: string
  gred: string | null
  lokasi: string | null
  status: string
  emel: string | null
  no_tel: string | null
  no_daftar_ppp: string | null
  no_bless: string | null
  ijazah: string | null
  pos_basik: string | null
  status_cpd: string | null
  tarikh_semakan_cpd: string | null
  tarikh_kemaskini_mycpd: string | null
  tahun_cpd_terkini: number | null
  mata_cpd_terkini: number | null
  tarikh_lahir: string | null
  tarikh_lantikan: string | null
  tarikh_disahkan: string | null
  tarikh_naik_pangkat: string | null
  tarikh_pencen: string | null
  umur_bersara_wajib: number | null
  umur_semasa: number | null
  bersara_wajib: string | null
  tempoh_berkhidmat: string | null
  baki_perkhidmatan: string | null
}

type Permohonan = {
  id: string
  anggota_id: string
  medan: string
  nilai_cadangan: string
  sebab: string | null
  status: string
  created_at: string
  emel_pemohon: string | null
}

type Jenis = 'teks' | 'tarikh' | 'nombor' | 'status'
type Medan = { key: string; label: string; jenis: Jenis; mohon: boolean }
type Muatan = Record<string, string | number | null>

const STATUS = ['Aktif', 'Bersara', 'Pindah']

const MEDAN: Medan[] = [
  { key: 'nama', label: 'Nama', jenis: 'teks', mohon: true },
  { key: 'no_kp', label: 'No. kad pengenalan', jenis: 'teks', mohon: false },
  { key: 'gred', label: 'Gred', jenis: 'teks', mohon: true },
  { key: 'lokasi', label: 'Tempat bertugas', jenis: 'teks', mohon: true },
  { key: 'status', label: 'Status', jenis: 'status', mohon: true },
  { key: 'tarikh_lahir', label: 'Tarikh lahir', jenis: 'tarikh', mohon: true },
  { key: 'tarikh_lantikan', label: 'Tarikh lantikan', jenis: 'tarikh', mohon: true },
  { key: 'tarikh_disahkan', label: 'Tarikh disahkan', jenis: 'tarikh', mohon: true },
  { key: 'tarikh_naik_pangkat', label: 'Tarikh kenaikan pangkat', jenis: 'tarikh', mohon: true },
  { key: 'tarikh_pencen', label: 'Tarikh pencen', jenis: 'tarikh', mohon: true },
  { key: 'umur_bersara_wajib', label: 'Umur bersara wajib', jenis: 'nombor', mohon: true },
  { key: 'no_daftar_ppp', label: 'No. daftar PPP', jenis: 'teks', mohon: true },
  { key: 'no_bless', label: 'No. BLESS', jenis: 'teks', mohon: true },
  { key: 'ijazah', label: 'Ijazah', jenis: 'teks', mohon: true },
  { key: 'pos_basik', label: 'Pos basik', jenis: 'teks', mohon: true },
  { key: 'emel', label: 'Emel', jenis: 'teks', mohon: false },
  { key: 'no_tel', label: 'No. telefon', jenis: 'teks', mohon: false },
]

/* ---------- Fungsi bantu ---------- */

function nilaiMedan(b: Baris, key: string): unknown {
  return (b as unknown as Record<string, unknown>)[key]
}

function formatTarikh(t: string | null | undefined) {
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

function paparNilai(m: Medan | undefined, v: unknown): string {
  if (v === null || v === undefined || v === '') return '-'
  if (m?.jenis === 'tarikh') return formatTarikh(String(v))
  return String(v)
}

function bacaKp(v: string): string | null {
  let d = v.replace(/\D/g, '')
  if (d.length === 11) d = '0' + d
  if (d.length !== 12) return null
  return `${d.slice(0, 6)}-${d.slice(6, 8)}-${d.slice(8)}`
}

function lahirDariKp(kp: string): string | null {
  const yy = Number(kp.slice(0, 2))
  const mm = Number(kp.slice(2, 4))
  const dd = Number(kp.slice(4, 6))
  const y = yy > new Date().getFullYear() % 100 ? 1900 + yy : 2000 + yy
  const dt = new Date(Date.UTC(y, mm - 1, dd))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== dd) {
    return null
  }
  return `${y}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

function tukarNilai(
  m: Medan,
  v: string
): { nilai: string | number | null; ralat?: string } {
  const s = v.trim()
  if ((m.key === 'nama' || m.jenis === 'status') && s === '') {
    return { nilai: null, ralat: `${m.label} tidak boleh kosong.` }
  }
  if (m.jenis === 'tarikh') {
    if (s === '') return { nilai: null }
    return /^\d{4}-\d{2}-\d{2}$/.test(s)
      ? { nilai: s }
      : { nilai: null, ralat: `${m.label}: format tarikh tidak sah.` }
  }
  if (m.jenis === 'nombor') {
    if (s === '') return { nilai: null }
    const n = Number(s)
    return Number.isFinite(n)
      ? { nilai: n }
      : { nilai: null, ralat: `${m.label}: mesti nombor.` }
  }
  return { nilai: s === '' ? null : s }
}

/* ---------- Komponen kecil ---------- */

function Modal({
  tajuk,
  onTutup,
  children,
}: {
  tajuk: string
  onTutup: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-2xl rounded-xl border-2 border-black bg-zinc-50 p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="text-lg font-bold">{tajuk}</h3>
          <button
            onClick={onTutup}
            className="text-zinc-700 hover:text-black"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function InputMedan({
  m,
  nilai,
  onUbah,
  senaraiLokasi,
}: {
  m: Medan
  nilai: string
  onUbah: (v: string) => void
  senaraiLokasi?: string[]
}) {
  const kelas = 'w-full rounded-lg border-2 border-black bg-white px-3 py-2 text-sm'
  if (m.jenis === 'status') {
    return (
      <select value={nilai} onChange={(e) => onUbah(e.target.value)} className={kelas}>
        {STATUS.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
    )
  }
  return (
    <input
      type={m.jenis === 'tarikh' ? 'date' : m.jenis === 'nombor' ? 'number' : 'text'}
      value={nilai}
      onChange={(e) => onUbah(e.target.value)}
      list={m.key === 'lokasi' && senaraiLokasi ? 'senarai-lokasi' : undefined}
      className={kelas}
    />
  )
}

function BorangAnggota({
  awal,
  senaraiLokasi,
  sibuk,
  onSimpan,
  onBatal,
}: {
  awal: Baris | null
  senaraiLokasi: string[]
  sibuk: boolean
  onSimpan: (m: Muatan) => void
  onBatal: () => void
}) {
  const [nilai, setNilai] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {}
    for (const m of MEDAN) {
      o[m.key] = awal ? String(nilaiMedan(awal, m.key) ?? '') : ''
    }
    if (!awal) o.status = 'Aktif'
    return o
  })
  const [ralat, setRalat] = useState<string | null>(null)

  function hantar(e: FormEvent) {
    e.preventDefault()
    const muatan: Muatan = {}
    for (const m of MEDAN) {
      const h = tukarNilai(m, nilai[m.key] ?? '')
      if (h.ralat) {
        setRalat(h.ralat)
        return
      }
      muatan[m.key] = h.nilai
    }
    const kp = bacaKp(String(muatan.no_kp ?? ''))
    if (!kp) {
      setRalat('No. kad pengenalan tidak sah (mesti 12 digit).')
      return
    }
    muatan.no_kp = kp
    if (!muatan.tarikh_lahir) muatan.tarikh_lahir = lahirDariKp(kp)
    setRalat(null)
    onSimpan(muatan)
  }

  return (
    <form onSubmit={hantar}>
      <datalist id="senarai-lokasi">
        {senaraiLokasi.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
      <div className="grid gap-4 sm:grid-cols-2">
        {MEDAN.map((m) => (
          <label key={m.key} className="block text-sm">
            <span className="mb-1 block text-zinc-800">{m.label}</span>
            <InputMedan
              m={m}
              nilai={nilai[m.key] ?? ''}
              onUbah={(v) => setNilai((s) => ({ ...s, [m.key]: v }))}
              senaraiLokasi={senaraiLokasi}
            />
          </label>
        ))}
      </div>
      {ralat && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{ralat}</p>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onBatal}
          className="rounded-lg border-2 border-black bg-white px-4 py-2 text-sm"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={sibuk}
          className="rounded-lg border-2 border-black bg-emerald-300 px-5 py-2 text-sm font-semibold text-black disabled:bg-zinc-300 disabled:text-zinc-500"
        >
          {sibuk ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </form>
  )
}

function BorangMohon({
  baris,
  sibuk,
  onHantar,
  onBatal,
}: {
  baris: Baris
  sibuk: boolean
  onHantar: (medan: string, nilai: string, sebab: string) => void
  onBatal: () => void
}) {
  const pilihan = MEDAN.filter((m) => m.mohon)
  const [key, setKey] = useState(pilihan[0].key)
  const [nilai, setNilai] = useState('')
  const [sebab, setSebab] = useState('')
  const [ralat, setRalat] = useState<string | null>(null)
  const m = pilihan.find((x) => x.key === key) ?? pilihan[0]

  function hantar(e: FormEvent) {
    e.preventDefault()
    const h = tukarNilai(m, nilai)
    if (h.ralat) {
      setRalat(h.ralat)
      return
    }
    if (sebab.trim() === '') {
      setRalat('Sila nyatakan sebab atau bukti kesilapan.')
      return
    }
    setRalat(null)
    onHantar(m.key, nilai.trim(), sebab.trim())
  }

  return (
    <form onSubmit={hantar} className="space-y-4 text-sm">
      <p className="text-zinc-800">
        Permohonan ini akan disemak oleh penyelia PPP sebelum data diubah.
      </p>
      <label className="block">
        <span className="mb-1 block text-zinc-800">Maklumat yang salah</span>
        <select
          value={key}
          onChange={(e) => {
            setKey(e.target.value)
            setNilai('')
          }}
          className="w-full rounded-lg border-2 border-black bg-white px-3 py-2"
        >
          {pilihan.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <p className="rounded-lg bg-zinc-300 p-3">
        Nilai semasa: <strong>{paparNilai(m, nilaiMedan(baris, m.key))}</strong>
      </p>
      <label className="block">
        <span className="mb-1 block text-zinc-800">Nilai yang betul</span>
        <InputMedan m={m} nilai={nilai || (m.jenis === 'status' ? STATUS[0] : '')} onUbah={setNilai} />
      </label>
      <label className="block">
        <span className="mb-1 block text-zinc-800">Sebab / bukti</span>
        <textarea
          value={sebab}
          onChange={(e) => setSebab(e.target.value)}
          rows={3}
          className="w-full rounded-lg border-2 border-black bg-white px-3 py-2"
        />
      </label>
      {ralat && <p className="rounded-lg bg-red-50 p-3 text-red-700">{ralat}</p>}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onBatal}
          className="rounded-lg border-2 border-black bg-white px-4 py-2"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={sibuk}
          className="rounded-lg border-2 border-black bg-emerald-300 px-5 py-2 font-semibold text-black disabled:bg-zinc-300 disabled:text-zinc-500"
        >
          {sibuk ? 'Menghantar...' : 'Hantar permohonan'}
        </button>
      </div>
    </form>
  )
}

function Butiran({ b, penyelia }: { b: Baris; penyelia: boolean }) {
  const disorok = <span className="text-zinc-500">Disorok</span>
  const bahagian: [string, [string, ReactNode][]][] = [
    [
      'Maklumat asas',
      [
        ['Nama', b.nama],
        ['No. kad pengenalan', b.no_kp],
        ['Gred', b.gred ?? '-'],
        ['Tempat bertugas', b.lokasi ?? '-'],
        ['Status', b.status],
        ['Emel', penyelia ? b.emel ?? '-' : disorok],
        ['No. telefon', penyelia ? b.no_tel ?? '-' : disorok],
      ],
    ],
    [
      'Perkhidmatan',
      [
        ['Tarikh lahir', formatTarikh(b.tarikh_lahir)],
        ['Umur semasa', b.umur_semasa ?? '-'],
        ['Tarikh lantikan', formatTarikh(b.tarikh_lantikan)],
        ['Tarikh disahkan', formatTarikh(b.tarikh_disahkan)],
        ['Kenaikan pangkat terkini', formatTarikh(b.tarikh_naik_pangkat)],
        ['Tempoh berkhidmat', bm(b.tempoh_berkhidmat)],
        ['Umur bersara wajib', b.umur_bersara_wajib ?? '-'],
        ['Tarikh bersara wajib', formatTarikh(b.bersara_wajib)],
        ['Tarikh pencen', formatTarikh(b.tarikh_pencen)],
        ['Baki perkhidmatan', bm(b.baki_perkhidmatan)],
      ],
    ],
    [
      'Kelayakan dan CPD',
      [
        ['Ijazah', b.ijazah ?? '-'],
        ['Pos basik', b.pos_basik ?? '-'],
        ['No. daftar PPP', b.no_daftar_ppp ?? '-'],
        ['No. BLESS', b.no_bless ?? '-'],
        ['Status CPD', b.status_cpd ?? '-'],
        [
          'Mata MyCPD terkini',
          b.mata_cpd_terkini !== null
            ? `${b.mata_cpd_terkini} (${b.tahun_cpd_terkini})`
            : '-',
        ],
        ['Tarikh semakan CPD', formatTarikh(b.tarikh_semakan_cpd)],
        ['Kemaskini MyCPD', formatTarikh(b.tarikh_kemaskini_mycpd)],
      ],
    ],
  ]
  return (
    <div className="space-y-5 text-sm">
      {bahagian.map(([tajuk, item]) => (
        <section key={tajuk}>
          <h4 className="mb-2 font-semibold text-black">{tajuk}</h4>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {item.map(([label, nilai]) => (
              <div key={label}>
                <dt className="text-zinc-700">{label}</dt>
                <dd className="font-medium">{nilai}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}

/* ---------- Komponen utama ---------- */

type ModalState =
  | null
  | { jenis: 'lihat' | 'edit' | 'mohon'; baris: Baris }
  | { jenis: 'tambah' }

export default function AnggotaList() {
  const [rows, setRows] = useState<Baris[]>([])
  const [permohonan, setPermohonan] = useState<Permohonan[]>([])
  const [penyelia, setPenyelia] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sibuk, setSibuk] = useState(false)
  const [tab, setTab] = useState<'senarai' | 'permohonan'>('senarai')
  const [cari, setCari] = useState('')
  const [fGred, setFGred] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fLokasi, setFLokasi] = useState('')
  const [modal, setModal] = useState<ModalState>(null)
  const [mesej, setMesej] = useState<{ jenis: 'ok' | 'ralat'; teks: string } | null>(null)

  const muat = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser()
    if (u.user) {
      const { data: p } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', u.user.id)
        .single()
      setPenyelia(p?.role === 'penyelia' || p?.role === 'admin')
    }

    const { data, error } = await supabase
      .from('anggota_view')
      .select('*')
      .order('nama')
    if (error) setMesej({ jenis: 'ralat', teks: `Ralat memuatkan data: ${error.message}` })
    else setRows((data as Baris[]) ?? [])

    const { data: pm } = await supabase
      .from('permohonan_edit')
      .select('id, anggota_id, medan, nilai_cadangan, sebab, status, created_at, emel_pemohon')
      .order('created_at', { ascending: false })
      .limit(100)
    setPermohonan((pm as Permohonan[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    muat()
  }, [muat])

  const senaraiGred = useMemo(
    () => Array.from(new Set(rows.map((r) => r.gred).filter((x): x is string => !!x))).sort(),
    [rows]
  )
  const senaraiLokasi = useMemo(
    () => Array.from(new Set(rows.map((r) => r.lokasi).filter((x): x is string => !!x))).sort(),
    [rows]
  )

  const dipaparkan = rows.filter((r) => {
    const q = cari.toLowerCase().trim()
    const padanCari =
      q === '' ||
      r.nama.toLowerCase().includes(q) ||
      (r.lokasi ?? '').toLowerCase().includes(q) ||
      (r.gred ?? '').toLowerCase().includes(q) ||
      r.no_kp.toLowerCase().includes(q)
    return (
      padanCari &&
      (fGred === '' || r.gred === fGred) &&
      (fStatus === '' || r.status === fStatus) &&
      (fLokasi === '' || r.lokasi === fLokasi)
    )
  })

  const menunggu = permohonan.filter((p) => p.status === 'Menunggu').length

  function ralat(teks: string) {
    setMesej({ jenis: 'ralat', teks })
  }

  async function simpanAnggota(muatan: Muatan, id?: string) {
    setSibuk(true)
    setMesej(null)
    const { data, error } = id
      ? await supabase.from('anggota').update(muatan).eq('id', id).select('id')
      : await supabase.from('anggota').insert(muatan).select('id')
    setSibuk(false)
    if (error) {
      ralat(
        error.code === '23505'
          ? 'No. KP itu sudah wujud dalam pangkalan data.'
          : `Gagal menyimpan: ${error.message}`
      )
      return
    }
    if (!data || data.length === 0) {
      ralat('Tiada perubahan disimpan. Semak sama ada anda masih penyelia yang aktif.')
      return
    }
    setModal(null)
    setMesej({ jenis: 'ok', teks: id ? 'Maklumat anggota dikemas kini.' : 'Anggota baharu ditambah.' })
    await muat()
  }

  async function padamAnggota(b: Baris) {
    if (!window.confirm(`Padam ${b.nama}? Tindakan ini tidak boleh dibatalkan.`)) return
    setMesej(null)
    const { data, error } = await supabase.from('anggota').delete().eq('id', b.id).select('id')
    if (error) return ralat(`Gagal memadam: ${error.message}`)
    if (!data || data.length === 0) return ralat('Tiada rekod dipadam. Semak kebenaran anda.')
    setMesej({ jenis: 'ok', teks: `${b.nama} telah dipadam.` })
    await muat()
  }

  async function hantarMohon(b: Baris, medan: string, nilai: string, sebab: string) {
    setSibuk(true)
    setMesej(null)
    const { error } = await supabase.from('permohonan_edit').insert({
      anggota_id: b.id,
      medan,
      nilai_cadangan: nilai,
      sebab,
    })
    setSibuk(false)
    if (error) return ralat(`Gagal menghantar permohonan: ${error.message}`)
    setModal(null)
    setMesej({ jenis: 'ok', teks: 'Permohonan dihantar. Penyelia akan menyemaknya.' })
    await muat()
  }

  async function tandaPermohonan(p: Permohonan, status: 'Diluluskan' | 'Ditolak') {
    const { data: u } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('permohonan_edit')
      .update({
        status,
        disemak_oleh: u.user?.id ?? null,
        disemak_pada: new Date().toISOString(),
      })
      .eq('id', p.id)
      .select('id')
    if (error) return ralat(`Gagal mengemas kini permohonan: ${error.message}`)
    if (!data || data.length === 0) return ralat('Permohonan tidak dikemas kini.')
  }

  async function lulus(p: Permohonan) {
    const m = MEDAN.find((x) => x.key === p.medan && x.mohon)
    if (!m) return ralat('Medan permohonan ini tidak dibenarkan.')
    const h = tukarNilai(m, p.nilai_cadangan)
    if (h.ralat) return ralat(h.ralat)
    setMesej(null)
    const { data, error } = await supabase
      .from('anggota')
      .update({ [m.key]: h.nilai })
      .eq('id', p.anggota_id)
      .select('id')
    if (error) return ralat(`Gagal mengubah data: ${error.message}`)
    if (!data || data.length === 0) return ralat('Anggota tidak dijumpai atau tiada kebenaran.')
    await tandaPermohonan(p, 'Diluluskan')
    setMesej({ jenis: 'ok', teks: 'Permohonan diluluskan dan data dikemas kini.' })
    await muat()
  }

  async function tolak(p: Permohonan) {
    setMesej(null)
    await tandaPermohonan(p, 'Ditolak')
    setMesej({ jenis: 'ok', teks: 'Permohonan ditolak.' })
    await muat()
  }

  const kelasTab = (aktif: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium ${
      aktif ? 'border-2 border-black bg-emerald-300 text-black' : 'border-2 border-black bg-zinc-50 text-black hover:bg-white'
    }`

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button onClick={() => setTab('senarai')} className={kelasTab(tab === 'senarai')}>
            Senarai anggota
          </button>
          <button onClick={() => setTab('permohonan')} className={kelasTab(tab === 'permohonan')}>
            Permohonan edit{menunggu > 0 && penyelia ? ` (${menunggu})` : ''}
          </button>
        </div>
        {penyelia && tab === 'senarai' && (
          <button
            onClick={() => setModal({ jenis: 'tambah' })}
            className="rounded-lg border-2 border-black bg-emerald-300 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            + Tambah anggota
          </button>
        )}
      </div>

      {mesej && (
        <p
          className={`mb-5 rounded-lg p-3 text-sm ${
            mesej.jenis === 'ok' ? 'border-2 border-black bg-emerald-100 text-black' : 'bg-red-50 text-red-700'
          }`}
        >
          {mesej.teks}
        </p>
      )}

      {tab === 'senarai' && (
        <section className="rounded-xl border-2 border-black bg-zinc-50 p-5 shadow-sm">
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder={penyelia ? 'Cari nama, No. KP, gred, lokasi...' : 'Cari nama, gred, lokasi...'}
              className="rounded-lg border-2 border-black bg-white px-3 py-2 text-sm"
            />
            <select value={fGred} onChange={(e) => setFGred(e.target.value)} className="rounded-lg border-2 border-black bg-white px-3 py-2 text-sm">
              <option value="">Semua gred</option>
              {senaraiGred.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="rounded-lg border-2 border-black bg-white px-3 py-2 text-sm">
              <option value="">Semua status</option>
              {STATUS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select value={fLokasi} onChange={(e) => setFLokasi(e.target.value)} className="rounded-lg border-2 border-black bg-white px-3 py-2 text-sm">
              <option value="">Semua lokasi</option>
              {senaraiLokasi.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>

          <p className="mb-3 text-sm text-zinc-700">
            {loading ? 'Memuatkan...' : `Menunjukkan ${dipaparkan.length} daripada ${rows.length} anggota.`}
            {!penyelia && ' No. KP, emel dan no. telefon disorok.'}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-zinc-300 text-zinc-700">
                <tr>
                  <th className="p-3">Nama</th>
                  <th className="p-3">Gred</th>
                  <th className="p-3">Lokasi</th>
                  <th className="p-3">Umur</th>
                  <th className="p-3">Bersara wajib</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {!loading && dipaparkan.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-zinc-700">
                      Tiada rekod dijumpai.
                    </td>
                  </tr>
                )}
                {dipaparkan.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-400">
                    <td className="p-3 font-medium">{r.nama}</td>
                    <td className="p-3">{r.gred ?? '-'}</td>
                    <td className="p-3">{r.lokasi ?? '-'}</td>
                    <td className="p-3">{r.umur_semasa ?? '-'}</td>
                    <td className="p-3">{formatTarikh(r.bersara_wajib)}</td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-3 py-1 ${
                          r.status === 'Aktif'
                            ? 'border border-black bg-emerald-200 text-black'
                            : 'border border-black bg-zinc-300 text-black'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="space-x-3 p-3 whitespace-nowrap">
                      <button onClick={() => setModal({ jenis: 'lihat', baris: r })} className="font-medium text-black underline hover:bg-emerald-200">
                        Lihat
                      </button>
                      {penyelia ? (
                        <>
                          <button onClick={() => setModal({ jenis: 'edit', baris: r })} className="font-medium text-black underline hover:bg-emerald-200">
                            Edit
                          </button>
                          <button onClick={() => padamAnggota(r)} className="text-red-600 hover:underline">
                            Padam
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setModal({ jenis: 'mohon', baris: r })} className="font-medium text-black underline hover:bg-emerald-200">
                          Mohon edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'permohonan' && (
        <section className="space-y-3">
          <p className="text-sm text-zinc-700">
            {penyelia
              ? 'Semua permohonan edit daripada pengguna. Lulus untuk mengubah data, atau tolak.'
              : 'Permohonan edit yang anda hantar.'}
          </p>
          {permohonan.length === 0 && (
            <p className="rounded-xl border-2 border-black bg-zinc-50 p-6 text-center text-sm text-zinc-700">
              Tiada permohonan.
            </p>
          )}
          {permohonan.map((p) => {
            const b = rows.find((r) => r.id === p.anggota_id)
            const m = MEDAN.find((x) => x.key === p.medan)
            return (
              <article key={p.id} className="rounded-xl border-2 border-black bg-zinc-50 p-5 text-sm shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{b?.nama ?? 'Anggota tidak dijumpai'}</p>
                    <p className="mt-1 text-zinc-800">
                      {m?.label ?? p.medan}:{' '}
                      <span className="text-zinc-700">
                        {b ? paparNilai(m, nilaiMedan(b, p.medan)) : '-'}
                      </span>{' '}
                      → <strong>{paparNilai(m, p.nilai_cadangan)}</strong>
                    </p>
                    {p.sebab && <p className="mt-1 text-zinc-700">Sebab: {p.sebab}</p>}
                    <p className="mt-1 text-xs text-zinc-600">
                      {penyelia ? `Dimohon oleh: ${p.emel_pemohon ?? '-'} · ` : ''}
                      {formatTarikh(p.created_at)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${
                      p.status === 'Menunggu'
                        ? 'bg-amber-100 text-amber-700'
                        : p.status === 'Diluluskan'
                          ? 'border border-black bg-emerald-200 text-black'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
                {penyelia && p.status === 'Menunggu' && (
                  <div className="mt-4 flex gap-3">
                    <button onClick={() => lulus(p)} className="rounded-lg border-2 border-black bg-emerald-300 px-4 py-2 font-semibold text-black hover:bg-emerald-400">
                      Lulus
                    </button>
                    <button onClick={() => tolak(p)} className="rounded-lg border-2 border-black bg-white px-4 py-2 hover:bg-zinc-100">
                      Tolak
                    </button>
                  </div>
                )}
              </article>
            )
          })}
        </section>
      )}

      {modal?.jenis === 'lihat' && (
        <Modal tajuk={modal.baris.nama} onTutup={() => setModal(null)}>
          <Butiran b={modal.baris} penyelia={penyelia} />
        </Modal>
      )}
      {modal?.jenis === 'tambah' && (
        <Modal tajuk="Tambah anggota" onTutup={() => setModal(null)}>
          <BorangAnggota
            awal={null}
            senaraiLokasi={senaraiLokasi}
            sibuk={sibuk}
            onSimpan={(m) => simpanAnggota(m)}
            onBatal={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.jenis === 'edit' && (
        <Modal tajuk={`Edit: ${modal.baris.nama}`} onTutup={() => setModal(null)}>
          <BorangAnggota
            awal={modal.baris}
            senaraiLokasi={senaraiLokasi}
            sibuk={sibuk}
            onSimpan={(m) => simpanAnggota(m, modal.baris.id)}
            onBatal={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.jenis === 'mohon' && (
        <Modal tajuk={`Mohon edit: ${modal.baris.nama}`} onTutup={() => setModal(null)}>
          <BorangMohon
            baris={modal.baris}
            sibuk={sibuk}
            onHantar={(medan, nilai, sebab) => hantarMohon(modal.baris, medan, nilai, sebab)}
            onBatal={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  )
}
