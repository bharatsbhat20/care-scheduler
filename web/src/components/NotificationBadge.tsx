import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

interface Notification {
  id: string
  type: string
  message: string
  read: boolean
  created_at: string
}

export function NotificationBadge() {
  const { profile } = useAuth()
  const [count, setCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!profile) return

    // Subscribe to medication_logs inserts (new dose logged)
    const medLogChannel = supabase
      .channel('medication-log-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'medication_logs' },
        (payload) => {
          const newLog = payload.new as { status: string; medication_id: string }
          if (newLog.status === 'missed') {
            setCount(c => c + 1)
            setNotifications(prev => [{
              id: payload.new.id as string,
              type: 'missed_dose',
              message: 'A medication dose was missed',
              read: false,
              created_at: new Date().toISOString(),
            }, ...prev])
          }
        }
      )
      .subscribe()

    // Subscribe to task_assignments (assigned to you)
    const taskChannel = supabase
      .channel('task-assignment-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_assignments',
          filter: `caregiver_id=eq.${profile.id}`,
        },
        () => {
          setCount(c => c + 1)
          setNotifications(prev => [{
            id: `task-${Date.now()}`,
            type: 'task_assigned',
            message: 'A new task has been assigned to you',
            read: false,
            created_at: new Date().toISOString(),
          }, ...prev])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(medLogChannel)
      supabase.removeChannel(taskChannel)
    }
  }, [profile])

  const handleOpen = () => {
    setOpen(o => !o)
    if (!open) setCount(0)
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50">
          <div className="p-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No new notifications</p>
            ) : (
              notifications.slice(0, 10).map(n => (
                <div key={n.id} className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50">
                  <p className="text-sm text-gray-800">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(n.created_at).toLocaleTimeString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
