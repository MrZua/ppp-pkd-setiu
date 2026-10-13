import Shell from '../lib/Shell'
import LogContent from '../lib/LogContent'

export default function LogPage() {
  return (
    <Shell
      tajuk="Log Perubahan"
      penerangan="Rekod siapa menambah, mengubah atau memadam data anggota, dan bila."
    >
      <LogContent />
    </Shell>
  )
}
