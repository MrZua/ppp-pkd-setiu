import Shell from './lib/Shell'
import DashboardContent from './lib/DashboardContent'

export default function Home() {
  return (
    <Shell
      tajuk="Dashboard PPP"
      penerangan="Ringkasan database Penolong Pegawai Perubatan."
    >
      <DashboardContent />
    </Shell>
  )
}
