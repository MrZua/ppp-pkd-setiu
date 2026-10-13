import Shell from '../lib/Shell'
import LaporanContent from '../lib/LaporanContent'

export default function LaporanPage() {
  return (
    <Shell
      tajuk="Laporan & Graf"
      penerangan="Statistik anggota mengikut gred, lokasi, umur, persaraan dan CPD."
    >
      <LaporanContent />
    </Shell>
  )
}
