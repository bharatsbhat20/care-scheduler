import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Pill,
  CalendarDays,
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  Activity,
  BarChart2,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import type {
  MedicationSchedule,
  Appointment,
  Task,
  Profile,
} from '../../../shared/types'

// ─── helpers ────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-gray-900 mb-3">{children}</h2>
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}

function MedScheduleCard({ schedule }: { schedule: MedicationSchedule }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
      <div className="p-2 bg-blue-50 rounded-lg mt-0.5">
        <Pill className="h-4 w-4 text-blue-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate">
          {schedule.medication?.name ?? 'Medication'}
        </p>
        <p className="text-xs text-gray-500">
          {schedule.medication?.dosage} {schedule.medication?.unit}
          {schedule.medication?.instructions ? ` · ${schedule.medication.instructions}` : ''}
        </p>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {schedule.times.map((t) => (
            <span key={t} className="badge bg-blue-50 text-blue-700 text-xs">
              <Clock className="h-3 w-3 inline mr-1" />
              {t}
            </span>
          ))}
        </div>
      </div>
      <Badge variant={schedule.is_active ? 'success' : 'default'}>
        {schedule.is_active ? 'Active' : 'Inactive'}
      </Badge>
    </div>
  )
}

function AppointmentCard({ appointment }: { appointment: Appointment }) {
  const typeColors: Record<string, string> = {
    medical: 'info',
    therapy: 'purple',
    family_visit: 'success',
    activity: 'warning',
    other: 'default',
  }
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
      <div className="p-2 bg-green-50 rounded-lg mt-0.5">
        <CalendarDays className="h-4 w-4 text-green-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate">{appointment.title}</p>
        <p className="text-xs text-gray-500">
          {formatDate(appointment.start_time)} · {formatTime(appointment.start_time)}–{formatTime(appointment.end_time)}
          {appointment.location ? ` · ${appointment.location}` : ''}
        </p>
      </div>
      <Badge variant={(typeColors[appointment.type] ?? 'default') as any}>
        {appointment.type.replace('_', ' ')}
      </Badge>
    </div>
  )
}

function TaskCard({ task }: { task: Task }) {
  const priorityVariant: Record<string, any> = {
    high: 'danger',
    medium: 'warning',
    low: 'default',
  }
  const statusVariant: Record<string, any> = {
    todo: 'default',
    in_progress: 'info',
    done: 'success',
  }
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
      <div className="p-2 bg-orange-50 rounded-lg mt-0.5">
        <ClipboardList className="h-4 w-4 text-orange-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
        {task.elder && (
          <p className="text-xs text-gray-500">For: {task.elder.full_name}</p>
        )}
        {task.due_date && (
          <p className="text-xs text-gray-400 mt-0.5">Due {formatDate(task.due_date)}</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <Badge variant={statusVariant[task.status]}>
          {task.status.replace('_', ' ')}
        </Badge>
        <Badge variant={priorityVariant[task.priority]}>
          {task.priority}
        </Badge>
      </div>
    </div>
  )
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-gray-400">
      <CheckCircle2 className="h-8 w-8 mb-2 text-gray-300" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg p-3 text-sm">
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      {message}
    </div>
  )
}

// ─── role views ──────────────────────────────────────────────────────────────

function ElderDashboard({ userId }: { userId: string }) {
  const today = todayISO()

  const { data: schedules, isLoading: schedLoading, isError: schedError } = useQuery({
    queryKey: ['med-schedules-elder', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('medication_schedules')
        .select('*, medication:medications(*)')
        .eq('elder_id', userId)
        .eq('is_active', true)
      if (error) throw error
      return data as MedicationSchedule[]
    },
  })

  const { data: appointments, isLoading: apptLoading, isError: apptError } = useQuery({
    queryKey: ['appointments-elder', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('elder_id', userId)
        .gte('start_time', today)
        .order('start_time', { ascending: true })
        .limit(5)
      if (error) throw error
      return data as Appointment[]
    },
  })

  return (
    <div className="space-y-6">
      {/* Medications */}
      <div className="card">
        <SectionTitle>Today's Medications</SectionTitle>
        {schedLoading && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}
        {schedError && <ErrorCard message="Could not load medication schedule." />}
        {!schedLoading && !schedError && schedules && schedules.length === 0 && (
          <EmptyCard message="No active medications scheduled." />
        )}
        {!schedLoading && !schedError && schedules && schedules.length > 0 && (
          <div className="space-y-2">
            {schedules.map((s) => (
              <MedScheduleCard key={s.id} schedule={s} />
            ))}
          </div>
        )}
      </div>

      {/* Appointments */}
      <div className="card">
        <SectionTitle>Upcoming Appointments</SectionTitle>
        {apptLoading && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}
        {apptError && <ErrorCard message="Could not load appointments." />}
        {!apptLoading && !apptError && appointments && appointments.length === 0 && (
          <EmptyCard message="No upcoming appointments." />
        )}
        {!apptLoading && !apptError && appointments && appointments.length > 0 && (
          <div className="space-y-2">
            {appointments.map((a) => (
              <AppointmentCard key={a.id} appointment={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CaregiverDashboard({ userId }: { userId: string }) {
  const { data: tasks, isLoading: tasksLoading, isError: tasksError } = useQuery({
    queryKey: ['tasks-caregiver', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_assignments')
        .select('task:tasks(*, elder:profiles!tasks_elder_id_fkey(*))')
        .eq('caregiver_id', userId)
      if (error) throw error
      // Unwrap the nested task objects
      return (data ?? [])
        .map((row: any) => row.task)
        .filter(Boolean)
        .filter((t: Task) => t.status !== 'done') as Task[]
    },
  })

  const { data: elderIds } = useQuery({
    queryKey: ['elder-ids-for-caregiver', userId],
    queryFn: async () => {
      // Get distinct elder_ids from assigned tasks
      const { data, error } = await supabase
        .from('task_assignments')
        .select('task:tasks(elder_id)')
        .eq('caregiver_id', userId)
      if (error) throw error
      const ids = [...new Set((data ?? []).map((r: any) => r.task?.elder_id).filter(Boolean))]
      return ids as string[]
    },
  })

  const { data: elderMeds, isLoading: medsLoading, isError: medsError } = useQuery({
    queryKey: ['elder-meds-caregiver', elderIds],
    enabled: !!(elderIds && elderIds.length > 0),
    queryFn: async () => {
      if (!elderIds || elderIds.length === 0) return []
      const { data, error } = await supabase
        .from('medication_schedules')
        .select('*, medication:medications(*), elder:profiles!medication_schedules_elder_id_fkey(full_name)')
        .in('elder_id', elderIds)
        .eq('is_active', true)
      if (error) throw error
      return data as (MedicationSchedule & { elder: Pick<Profile, 'full_name'> })[]
    },
  })

  const taskSummary = {
    total: tasks?.length ?? 0,
    todo: tasks?.filter((t) => t.status === 'todo').length ?? 0,
    inProgress: tasks?.filter((t) => t.status === 'in_progress').length ?? 0,
    highPriority: tasks?.filter((t) => t.priority === 'high').length ?? 0,
  }

  return (
    <div className="space-y-6">
      {/* Task summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Open tasks" value={taskSummary.total} icon={ClipboardList} color="bg-orange-50 text-orange-600" />
        <StatCard label="To do" value={taskSummary.todo} icon={Clock} color="bg-gray-100 text-gray-600" />
        <StatCard label="In progress" value={taskSummary.inProgress} icon={Activity} color="bg-blue-50 text-blue-600" />
        <StatCard label="High priority" value={taskSummary.highPriority} icon={AlertTriangle} color="bg-red-50 text-red-600" />
      </div>

      {/* Assigned tasks */}
      <div className="card">
        <SectionTitle>My Assigned Tasks</SectionTitle>
        {tasksLoading && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}
        {tasksError && <ErrorCard message="Could not load assigned tasks." />}
        {!tasksLoading && !tasksError && tasks && tasks.length === 0 && (
          <EmptyCard message="No open tasks assigned to you." />
        )}
        {!tasksLoading && !tasksError && tasks && tasks.length > 0 && (
          <div className="space-y-2">
            {tasks.slice(0, 6).map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        )}
      </div>

      {/* Elders' medication schedules */}
      <div className="card">
        <SectionTitle>Today's Medication Schedule (Your Elders)</SectionTitle>
        {(medsLoading || !elderIds) && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}
        {medsError && <ErrorCard message="Could not load medication schedules." />}
        {elderIds && elderIds.length === 0 && (
          <EmptyCard message="No elders assigned yet." />
        )}
        {!medsLoading && !medsError && elderMeds && elderMeds.length === 0 && elderIds && elderIds.length > 0 && (
          <EmptyCard message="No active medications for assigned elders." />
        )}
        {!medsLoading && !medsError && elderMeds && elderMeds.length > 0 && (
          <div className="space-y-2">
            {elderMeds.map((s) => (
              <div key={s.id} className="space-y-0.5">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-1">
                  {(s as any).elder?.full_name ?? 'Elder'}
                </p>
                <MedScheduleCard schedule={s} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AdminDashboard() {
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [elders, caregivers, families, meds, appointments, tasks] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'elder'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'caregiver'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'family'),
        supabase.from('medication_schedules').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).gte('start_time', todayISO()),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).neq('status', 'done'),
      ])
      return {
        elders: elders.count ?? 0,
        caregivers: caregivers.count ?? 0,
        families: families.count ?? 0,
        activeMeds: meds.count ?? 0,
        upcomingAppts: appointments.count ?? 0,
        openTasks: tasks.count ?? 0,
      }
    },
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    )
  }

  if (isError) {
    return <ErrorCard message="Could not load system statistics." />
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label="Elders / Residents" value={stats?.elders ?? 0} icon={Users} color="bg-purple-50 text-purple-600" />
        <StatCard label="Caregivers" value={stats?.caregivers ?? 0} icon={Activity} color="bg-blue-50 text-blue-600" />
        <StatCard label="Family members" value={stats?.families ?? 0} icon={Users} color="bg-green-50 text-green-600" />
        <StatCard label="Active med schedules" value={stats?.activeMeds ?? 0} icon={Pill} color="bg-orange-50 text-orange-600" />
        <StatCard label="Upcoming appointments" value={stats?.upcomingAppts ?? 0} icon={CalendarDays} color="bg-teal-50 text-teal-600" />
        <StatCard label="Open tasks" value={stats?.openTasks ?? 0} icon={ClipboardList} color="bg-red-50 text-red-600" />
      </div>

      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary-50 rounded-lg">
            <BarChart2 className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">System health</h3>
            <p className="text-xs text-gray-500">All services operational</p>
          </div>
          <Badge variant="success" className="ml-auto">Healthy</Badge>
        </div>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
            <span>Database connectivity</span>
            <Badge variant="success">Connected</Badge>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
            <span>Authentication service</span>
            <Badge variant="success">Online</Badge>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span>Notification service</span>
            <Badge variant="success">Online</Badge>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { profile, role, user } = useAuth()

  if (role === 'family') {
    return <Navigate to="/family" replace />
  }

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  const roleLabel: Record<string, string> = {
    elder: 'Resident',
    caregiver: 'Caregiver',
    family: 'Family',
    admin: 'Administrator',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Welcome header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting}, {profile?.full_name?.split(' ')[0] ?? 'there'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {role && (
          <Badge variant="info" className="flex-shrink-0">
            {roleLabel[role] ?? role}
          </Badge>
        )}
      </div>

      {/* Role-specific content */}
      {role === 'elder' && user && <ElderDashboard userId={user.id} />}
      {role === 'caregiver' && user && <CaregiverDashboard userId={user.id} />}
      {role === 'admin' && <AdminDashboard />}
    </div>
  )
}
