import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  User,
  Mail,
  Phone,
  Shield,
  Edit2,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  Bell,
  BellOff,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import type { NotificationPrefs } from '../../../shared/types'

// ─── schemas ──────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  full_name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be under 100 characters'),
  phone: z
    .string()
    .regex(/^[+\d\s\-().]*$/, 'Enter a valid phone number')
    .max(20, 'Phone number too long')
    .optional()
    .or(z.literal('')),
})

type ProfileFormData = z.infer<typeof profileSchema>

// ─── helpers ─────────────────────────────────────────────────────────────────

const roleLabel: Record<string, string> = {
  elder: 'Elder / Resident',
  caregiver: 'Caregiver',
  family: 'Family Member',
  admin: 'Administrator',
}

const roleBadgeVariant: Record<string, any> = {
  elder: 'purple',
  caregiver: 'info',
  family: 'success',
  admin: 'danger',
}

// ─── notification toggle ──────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean
  onChange: (val: boolean) => void
  disabled?: boolean
}

function Toggle({ checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? 'bg-primary-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

// ─── notification prefs section ───────────────────────────────────────────────

function NotificationPrefsSection({ userId }: { userId: string }) {
  const queryClient = useQueryClient()

  const { data: prefs, isLoading, isError } = useQuery({
    queryKey: ['notification-prefs', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_prefs')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return data as NotificationPrefs | null
    },
  })

  const [localPrefs, setLocalPrefs] = useState<Partial<NotificationPrefs>>({})
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    if (prefs) {
      setLocalPrefs({
        medication_reminders: prefs.medication_reminders,
        appointment_reminders: prefs.appointment_reminders,
        task_updates: prefs.task_updates,
        family_updates: prefs.family_updates,
      })
    }
  }, [prefs])

  const handleToggle = async (key: keyof typeof localPrefs, value: boolean) => {
    const updated = { ...localPrefs, [key]: value }
    setLocalPrefs(updated)
    setSaveStatus('saving')

    try {
      if (prefs) {
        const { error } = await supabase
          .from('notification_prefs')
          .update({ [key]: value, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('notification_prefs').insert({
          user_id: userId,
          medication_reminders: updated.medication_reminders ?? true,
          appointment_reminders: updated.appointment_reminders ?? true,
          task_updates: updated.task_updates ?? true,
          family_updates: updated.family_updates ?? true,
          reminder_minutes_before: 30,
        })
        if (error) throw error
      }
      queryClient.invalidateQueries({ queryKey: ['notification-prefs', userId] })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
      setLocalPrefs((prev) => ({ ...prev, [key]: !value }))
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const notifItems: { key: keyof NotificationPrefs; label: string; description: string }[] = [
    {
      key: 'medication_reminders',
      label: 'Medication reminders',
      description: 'Get reminded when medications are due',
    },
    {
      key: 'appointment_reminders',
      label: 'Appointment reminders',
      description: 'Notifications before scheduled appointments',
    },
    {
      key: 'task_updates',
      label: 'Task updates',
      description: 'Updates when tasks are assigned or completed',
    },
    {
      key: 'family_updates',
      label: 'Family updates',
      description: 'Notify family members of care changes',
    },
  ]

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg p-3 text-sm">
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        Could not load notification preferences.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Bell className="h-4 w-4" />
          <span>Push and in-app notifications</span>
        </div>
        {saveStatus === 'saving' && <Spinner size="sm" />}
        {saveStatus === 'saved' && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved
          </span>
        )}
        {saveStatus === 'error' && (
          <span className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3.5 w-3.5" /> Failed to save
          </span>
        )}
      </div>

      {notifItems.map((item) => (
        <div
          key={item.key}
          className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 last:border-0"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              {localPrefs[item.key] ? (
                <Bell className="h-4 w-4 text-primary-600" />
              ) : (
                <BellOff className="h-4 w-4 text-gray-400" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{item.label}</p>
              <p className="text-xs text-gray-500">{item.description}</p>
            </div>
          </div>
          <Toggle
            checked={!!(localPrefs[item.key] ?? false)}
            onChange={(val) => handleToggle(item.key, val)}
            disabled={saveStatus === 'saving'}
          />
        </div>
      ))}
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { profile, user, refreshProfile } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [updateSuccess, setUpdateSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    values: {
      full_name: profile?.full_name ?? '',
      phone: profile?.phone ?? '',
    },
  })

  const onEdit = () => {
    setIsEditing(true)
    setUpdateError(null)
    setUpdateSuccess(false)
  }

  const onCancel = () => {
    setIsEditing(false)
    setUpdateError(null)
    reset()
  }

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return
    setUpdateError(null)
    setUpdateSuccess(false)

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: data.full_name,
        phone: data.phone || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (error) {
      setUpdateError(error.message)
    } else {
      await refreshProfile()
      setIsEditing(false)
      setUpdateSuccess(true)
      setTimeout(() => setUpdateSuccess(false), 3000)
    }
  }

  if (!profile || !user) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  const initials = profile.full_name
    .split(' ')
    .slice(0, 2)
    .map((n) => n.charAt(0).toUpperCase())
    .join('')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-500 mt-0.5">View and update your personal information</p>
      </div>

      {/* Success banner */}
      {updateSuccess && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          Profile updated successfully.
        </div>
      )}

      {/* Profile card */}
      <div className="card">
        {/* Avatar + basic info */}
        <div className="flex items-start gap-4 mb-6 pb-6 border-b border-gray-100">
          <div className="h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-primary-700">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-gray-900 truncate">{profile.full_name}</h2>
            <p className="text-sm text-gray-500">{user.email}</p>
            <div className="mt-2">
              <Badge variant={roleBadgeVariant[profile.role] ?? 'default'}>
                {roleLabel[profile.role] ?? profile.role}
              </Badge>
            </div>
          </div>
          {!isEditing && (
            <button
              onClick={onEdit}
              className="btn-secondary flex items-center gap-2 text-sm flex-shrink-0"
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </button>
          )}
        </div>

        {/* Info / edit form */}
        {isEditing ? (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {updateError && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {updateError}
              </div>
            )}

            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1.5">
                Full name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  id="full_name"
                  type="text"
                  autoComplete="name"
                  {...register('full_name')}
                  className={`input-field pl-9 ${errors.full_name ? 'border-red-400 focus:ring-red-400' : ''}`}
                />
              </div>
              {errors.full_name && (
                <p className="mt-1.5 text-xs text-red-600">{errors.full_name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                Phone number
                <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+1 (555) 000-0000"
                  {...register('phone')}
                  className={`input-field pl-9 ${errors.phone ? 'border-red-400 focus:ring-red-400' : ''}`}
                />
              </div>
              {errors.phone && (
                <p className="mt-1.5 text-xs text-red-600">{errors.phone.message}</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !isDirty}
                className="btn-primary flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Spinner size="sm" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Save changes
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="btn-secondary flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <dl className="space-y-4">
            <div className="flex items-start gap-3">
              <User className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Full name</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{profile.full_name}</dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{user.email}</dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</dt>
                <dd className="text-sm text-gray-900 mt-0.5">
                  {profile.phone ?? (
                    <span className="text-gray-400 italic">Not provided</span>
                  )}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Shield className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Role</dt>
                <dd className="text-sm text-gray-900 mt-0.5">
                  {roleLabel[profile.role] ?? profile.role}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Member since</dt>
                <dd className="text-sm text-gray-900 mt-0.5">
                  {new Date(profile.created_at).toLocaleDateString([], {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </dd>
              </div>
            </div>
          </dl>
        )}
      </div>

      {/* Notification preferences card */}
      <div className="card">
        <div className="flex items-center gap-2 mb-5">
          <Bell className="h-5 w-5 text-primary-600" />
          <h2 className="text-base font-semibold text-gray-900">Notification Preferences</h2>
        </div>
        <NotificationPrefsSection userId={user.id} />
      </div>

      {/* Account section */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Account</h2>
        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
          <Shield className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700">Password</p>
            <p className="text-xs text-gray-500">To change your password, sign out and use "Forgot password" on the login page.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
