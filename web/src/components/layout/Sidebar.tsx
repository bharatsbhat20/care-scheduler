import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Pill,
  Calendar,
  ClipboardList,
  Users,
  User,
  X,
  Heart,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import type { UserRole } from '../../../../shared/types'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

interface NavItem {
  to: string
  label: string
  icon: React.ElementType
  roles: UserRole[]
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['elder', 'caregiver', 'family', 'admin'] },
  { to: '/medications', label: 'Medications', icon: Pill, roles: ['elder', 'caregiver', 'admin'] },
  { to: '/calendar', label: 'Calendar', icon: Calendar, roles: ['elder', 'caregiver', 'family', 'admin'] },
  { to: '/tasks', label: 'Tasks', icon: ClipboardList, roles: ['caregiver', 'admin'] },
  { to: '/family', label: 'Family View', icon: Users, roles: ['family'] },
  { to: '/profile', label: 'Profile', icon: User, roles: ['elder', 'caregiver', 'family', 'admin'] },
]

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { role, profile } = useAuth()

  const filteredItems = navItems.filter(item => role && item.roles.includes(role))

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-200">
        <div className="bg-primary-600 rounded-lg p-1.5">
          <Heart className="h-5 w-5 text-white" />
        </div>
        <span className="text-lg font-bold text-gray-900">CareScheduler</span>
        <button onClick={onClose} className="ml-auto lg:hidden text-gray-400 hover:text-gray-600">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* User info */}
      {profile && (
        <div className="px-4 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-sm font-semibold text-primary-700">
                {profile.full_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{profile.full_name}</p>
              <p className="text-xs text-gray-500 capitalize">{profile.role}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {filteredItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-shrink-0 lg:w-64">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={onClose} />
          <aside className="relative w-64 h-full">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}
