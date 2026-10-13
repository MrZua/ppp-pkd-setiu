import Shell from '../lib/Shell'
import PenggunaContent from '../lib/PenggunaContent'

export default function PenggunaPage() {
  return (
    <Shell
      tajuk="Pengurusan Pengguna"
      penerangan="Aktifkan akaun baharu, lantik penyelia, atau nyahaktifkan pengguna."
    >
      <PenggunaContent />
    </Shell>
  )
}
