import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { GraduationCap, LayoutDashboard, LogOut, Menu, Moon, Settings, Sun, UserCog, X, type LucideIcon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { ROLE_LABELS, canAccess, type ModuleKey } from '../lib/roles'

interface NavItem { to: string; label: string; icon: LucideIcon; module: ModuleKey }

// Solo se listan módulos ya implementados: no hay entradas decorativas.
const NAV: NavItem[] = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard, module: 'dashboard' },
  { to: '/usuarios', label: 'Usuarios', icon: UserCog, module: 'usuarios' },
  { to: '/configuracion', label: 'Configuración', icon: Settings, module: 'configuracion' },
]

export function Layout() {
  const { profile, roles, institution, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const [open, setOpen] = useState(false)
  const items = NAV.filter((n) => canAccess(n.module, roles))

  const sidebar = (
    <nav className="flex h-full flex-col bg-brand-800 text-white">
      <div className="flex items-center gap-3 px-5 py-5">
        <GraduationCap className="h-7 w-7 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-wide">AULA DIGITAL</p>
          <p className="truncate text-xs text-brand-200">{institution?.name ?? ''}</p>
        </div>
      </div>
      <ul className="flex-1 space-y-1 px-3">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink to={to} end={to === '/'} onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-white/15 text-white' : 'text-brand-100 hover:bg-white/10'}`}>
              <Icon className="h-5 w-5" /> {label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="border-t border-white/10 p-4 text-xs text-brand-200">
        <p className="truncate font-medium text-white">{profile ? `${profile.first_name} ${profile.last_name}` : ''}</p>
        <p>{roles.map((r) => ROLE_LABELS[r]).join(', ')}</p>
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">{sidebar}</aside>
        </div>
      )}

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <button className="btn-ghost lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Abrir menú">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <div className="hidden lg:block" />
        <div className="flex items-center gap-1">
          <button className="btn-ghost" onClick={toggle} aria-label={theme === 'dark' ? 'Pasar a modo claro' : 'Pasar a modo oscuro'}>
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button className="btn-ghost" onClick={() => void signOut()}>
            <LogOut className="h-5 w-5" /> <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 sm:p-6"><Outlet /></main>
    </div>
  )
}
