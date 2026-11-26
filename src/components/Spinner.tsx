import { Loader2 } from 'lucide-react'

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500" role="status">
      <Loader2 className="h-5 w-5 animate-spin" /> {label}
    </div>
  )
}
