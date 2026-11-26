import { useEffect, useState, type FormEvent } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import type { Institution, InstitutionalSettings } from '../lib/types'

const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const LOGO_MAX = 2 * 1024 * 1024

export function SettingsPage() {
  const { institution, settings, reload } = useAuth()
  const toast = useToast()
  const [inst, setInst] = useState<Institution | null>(institution)
  const [cfg, setCfg] = useState<InstitutionalSettings | null>(settings)
  const [busy, setBusy] = useState<'inst' | 'cfg' | 'logo' | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => { setInst(institution); setCfg(settings) }, [institution, settings])

  useEffect(() => {
    let cancelled = false
    if (!institution?.logo_path) { setLogoUrl(null); return }
    supabase.storage.from('institution-assets').createSignedUrl(institution.logo_path, 3600)
      .then(({ data }) => { if (!cancelled) setLogoUrl(data?.signedUrl ?? null) })
    return () => { cancelled = true }
  }, [institution?.logo_path])

  if (!inst || !cfg) return <p className="text-sm text-slate-500">No se encontró la configuración de la institución.</p>

  async function saveInstitution(e: FormEvent) {
    e.preventDefault()
    if (!inst) return
    setBusy('inst')
    const { data, error } = await supabase.from('institutions').update({
      name: inst.name.trim(), cue: inst.cue || null, cuit: inst.cuit || null, address: inst.address || null,
      city: inst.city || null, phone: inst.phone || null, email: inst.email || null,
    }).eq('id', inst.id).select('id')
    setBusy(null)
    if (error || !data?.length) { toast.error('No se pudieron guardar los datos institucionales.'); return }
    toast.success('Datos institucionales guardados.')
    await reload()
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault()
    if (!cfg) return
    setBusy('cfg')
    const { data, error } = await supabase.from('institutional_settings').update({
      attendance_mode: cfg.attendance_mode,
      absence_alert_percent: cfg.absence_alert_percent,
      absence_alert_count: cfg.absence_alert_count,
      family_portal_enabled: cfg.family_portal_enabled,
      ai_enabled: cfg.ai_enabled,
      ai_provider: cfg.ai_provider,
      ai_model: cfg.ai_model || null,
    }).eq('institution_id', cfg.institution_id).select('institution_id')
    setBusy(null)
    if (error || !data?.length) { toast.error('No se pudo guardar la configuración.'); return }
    toast.success('Configuración guardada.')
    await reload()
  }

  async function uploadLogo(file: File) {
    if (!inst) return
    if (!LOGO_TYPES.includes(file.type)) { toast.error('El logo debe ser PNG, JPG o WebP.'); return }
    if (file.size > LOGO_MAX) { toast.error('El logo no puede superar los 2 MB.'); return }
    setBusy('logo')
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${inst.id}/logo-${Date.now()}.${ext}`
    const up = await supabase.storage.from('institution-assets').upload(path, file, { contentType: file.type })
    if (up.error) { setBusy(null); toast.error('No se pudo subir el logo.'); return }
    const { data, error } = await supabase.from('institutions').update({ logo_path: path }).eq('id', inst.id).select('id')
    if (error || !data?.length) { setBusy(null); toast.error('El logo se subió pero no se pudo asociar a la institución.'); return }
    if (inst.logo_path) await supabase.storage.from('institution-assets').remove([inst.logo_path])
    setBusy(null)
    toast.success('Logo actualizado.')
    await reload()
  }

  const field = (k: keyof Institution, label: string, type = 'text') => (
    <div>
      <label className="label" htmlFor={`i-${k}`}>{label}</label>
      <input id={`i-${k}`} type={type} className="input" value={(inst[k] as string | null) ?? ''}
             onChange={(e) => setInst({ ...inst, [k]: e.target.value })} />
    </div>
  )

  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-bold">Configuración institucional</h1>
        <p className="text-sm text-slate-500">Los cambios se aplican a toda la plataforma sin tocar código.</p></div>

      <form onSubmit={saveInstitution} className="card space-y-4">
        <h2 className="font-semibold">Datos de la institución</h2>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            {logoUrl ? <img src={logoUrl} alt="Logo de la institución" className="h-full w-full object-contain" /> : <span className="text-xs text-slate-400">Sin logo</span>}
          </div>
          <label className="btn-secondary cursor-pointer">
            {busy === 'logo' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Subir logo
            <input type="file" accept={LOGO_TYPES.join(',')} className="sr-only" disabled={busy === 'logo'}
                   onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo(f); e.target.value = '' }} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="i-name">Nombre</label>
            <input id="i-name" className="input" required value={inst.name} onChange={(e) => setInst({ ...inst, name: e.target.value })} />
          </div>
          {field('cue', 'CUE')}{field('cuit', 'CUIT')}{field('address', 'Dirección')}{field('city', 'Localidad')}
          {field('phone', 'Teléfono')}{field('email', 'Correo institucional', 'email')}
        </div>
        <div className="flex justify-end"><button className="btn-primary" disabled={busy === 'inst'}>
          {busy === 'inst' && <Loader2 className="h-4 w-4 animate-spin" />} Guardar datos</button></div>
      </form>

      <form onSubmit={saveSettings} className="card space-y-4">
        <h2 className="font-semibold">Asistencia, familias e inteligencia artificial</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="c-mode">Modalidad de asistencia</label>
            <select id="c-mode" className="input" value={cfg.attendance_mode}
                    onChange={(e) => setCfg({ ...cfg, attendance_mode: e.target.value as InstitutionalSettings['attendance_mode'] })}>
              <option value="diaria">Diaria (una por día)</option>
              <option value="por_materia">Por materia</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="c-pct">Alerta por % de inasistencias</label>
            <input id="c-pct" type="number" min={0} max={100} step="0.5" className="input" value={cfg.absence_alert_percent}
                   onChange={(e) => setCfg({ ...cfg, absence_alert_percent: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label" htmlFor="c-cnt">Alerta por cantidad de faltas</label>
            <input id="c-cnt" type="number" min={0} className="input" value={cfg.absence_alert_count}
                   onChange={(e) => setCfg({ ...cfg, absence_alert_count: Number(e.target.value) })} />
          </div>
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1" checked={cfg.family_portal_enabled}
                 onChange={(e) => setCfg({ ...cfg, family_portal_enabled: e.target.checked })} />
          <span><strong>Portal de familias</strong><br /><span className="text-slate-500">Cada familia verá solo los datos de sus hijos vinculados (solo lectura).</span></span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1" checked={cfg.ai_enabled}
                 onChange={(e) => setCfg({ ...cfg, ai_enabled: e.target.checked })} />
          <span><strong>Asistente pedagógico IA</strong><br /><span className="text-slate-500">Requiere cargar la clave del proveedor en los secretos de Supabase (ver README). Nunca se guarda en el navegador.</span></span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="c-prov">Proveedor de IA</label>
            <select id="c-prov" className="input" value={cfg.ai_provider}
                    onChange={(e) => setCfg({ ...cfg, ai_provider: e.target.value as InstitutionalSettings['ai_provider'] })}>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI</option>
              <option value="google">Google (Gemini)</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="c-model">Modelo (opcional)</label>
            <input id="c-model" className="input" value={cfg.ai_model ?? ''} onChange={(e) => setCfg({ ...cfg, ai_model: e.target.value })} placeholder="Dejar vacío para usar el predeterminado" />
          </div>
        </div>
        <div className="flex justify-end"><button className="btn-primary" disabled={busy === 'cfg'}>
          {busy === 'cfg' && <Loader2 className="h-4 w-4 animate-spin" />} Guardar configuración</button></div>
      </form>
    </div>
  )
}
