import Shell from '../lib/Shell'
import AnggotaList from '../lib/AnggotaList'

export default function AnggotaPage() {
  return (
    <Shell
      tajuk="Database Anggota"
      penerangan="Senarai penuh anggota PPP. Penyelia boleh tambah, edit dan padam. Pengguna lain boleh mohon edit jika ada kesilapan."
    >
      <AnggotaList />
    </Shell>
  )
}