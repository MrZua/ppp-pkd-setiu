import Shell from '../lib/Shell'
import ImportExcel from '../lib/ImportExcel'

export default function ImportPage() {
  return (
    <Shell
      tajuk="Import Excel"
      penerangan="Muat naik fail Excel PPP untuk memasukkan atau mengemas kini data anggota."
    >
      <ImportExcel />
    </Shell>
  )
}
