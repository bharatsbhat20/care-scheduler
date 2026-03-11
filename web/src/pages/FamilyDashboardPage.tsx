import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  User,
  BedDouble,
  CalendarDays,
  Pill,
  ClipboardList,
  Heart,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Link2Off,
} from 'lucide-react'
import { format, subDays, addDays, isAfter, isBefore, parseISO } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import type {
  Profile,
  ElderProfile,
  Appointment,
  AppointmentType,
  MedicationSchedule,
  MedicationLog,
} from '../../../shared/types'

// ---------------------------------------------------------------------------
// Types for fetched data shapes
// ---------------------------------------------------------------------------
interface FamilyElderLink {
  elder_id: string
  elder: Profile
}

interface ElderData {
  profile: Profile
  elderProfile: ElderProfile | null
  appointments: Appointment[]
  medicationSchedules: MedicationSchedule[]
  recentMedLogs: MedicationLog[]
}

// ---------------------------------------------------------------------------
// Appointment type helpers
// ---------------------------------------------------------------------------
const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  medical: 'Medical',
  therapy: 'Therapy',
  family_visit: 'Family Visit',
  activity: 'Activity',
  other: 'Other',
}

type BadgeVariantType = 'danger' | 'purple' | 'success' | 'warning' | 'info' | 'default'

const APPOINTMENT_TYPE_BADGE: Record<AppointmentType, BadgeVariantType> = {
  medical: 'danger',
  therapy: 'purple',
  family_visit: 'success',
  activity: 'warning',
  other: 'default',
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ---------------------------------------------------------------------------
// Medication log status helpers
// ---------------------------------------------------------------------------
const MED_LOG_STATUS_ICON = {
  taken: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  missed: <XCircle className="h-4 w-4 text-red-400" />,
  skipped: <MinusCircle className="h-4 w-4 text-yellow-400" />,
}

const MED_LOG_STATUS_LABEL = {
  taken: 'Taken',
  missed: 'Missed',
  skipped: 'Skipped',
}

// ---------------------------------------------------------------------------
// Section card wrapper
// ---------------------------------------------------------------------------
function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
        <div className="bg-primary-50 rounded-lg p-2">
          <Icon className="h-4 w-4 text-primary-600" />
        </div>
        <h2 className="font-semibold text-gray-800">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Elder info section
// ---------------------------------------------------------------------------
function ElderInfoSection({ profile, elderProfile }: { profile: Profile; elderProfile: ElderProfile | null }) {
  return (
    <SectionCard title="Elder Information" icon={Heart}>
      <div className="flex items-start gap-4">
        <div className="bg-primary-100 rounded-full p-4 flex-shrink-0">
          <User className="h-8 w-8 text-primary-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-gray-900">{profile.full_name}</h3>
          {profile.phone && (
            <p className="text-sm text-gray-500 mt-0.5">{profile.phone}</p>
          )}
          {elderProfile?.room_unit && (
            <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-600">
              <BedDouble className="h-4 w-4 text-gray-400" />
              <span>Room / Unit: <span className="font-medium">{elderProfile.room_unit}</span></span>
            </div>
          )}
          {elderProfile?.emergency_contact_name && (
            <div className="mt-2 text-sm text-gray-600">
              <span className="text-gray-400">Emergency contact: </span>
              <span className="font-medium">{elderProfile.emergency_contact_name}</span>
              {elderProfile.emergency_contact_phone && (
                <span className="text-gray-400"> · {elderProfile.emergency_contact_phone}</span>
              )}
            </div>
          )}
          {elderProfile?.medical_notes && (
            <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Medical Notes</p>
              <p className="text-sm text-amber-800 whitespace-pre-wrap">{elderProfile.medical_notes}</p>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Recent activity feed (last 7 days)
// ---------------------------------------------------------------------------
interface ActivityItem {
  id: string
  time: Date
  kind: 'appointment' | 'medication'
  label: string
  sublabel?: string
  status?: string
}

function RecentActivitySection({
  appointments,
  medLogs,
}: {
  appointments: Appointment[]
  medLogs: MedicationLog[]
}) {
  const now = new Date()
  const sevenDaysAgo = subDays(now, 7)

  const items: ActivityItem[] = useMemo(() => {
    const apptItems: ActivityItem[] = appointments
      .filter((a) => {
        const d = parseISO(a.start_time)
        return isAfter(d, sevenDaysAgo) && isBefore(d, now)
      })
      .map((a) => ({
        id: `appt-${a.id}`,
        time: parseISO(a.start_time),
        kind: 'appointment' as const,
        label: a.title,
        sublabel: APPOINTMENT_TYPE_LABELS[a.type] + (a.location ? ` · ${a.location}` : ''),
      }))

    const logItems: ActivityItem[] = medLogs.map((log) => ({
      id: `log-${log.id}`,
      time: parseISO(log.taken_at ?? log.scheduled_time),
      kind: 'medication' as const,
      label: log.medication?.name ?? 'Medication',
      sublabel: log.medication?.dosage
        ? `${log.medication.dosage} ${log.medication.unit}`
        : undefined,
      status: log.status,
    }))

    return [...apptItems, ...logItems].sort((a, b) => b.time.getTime() - a.time.getTime())
  }, [appointments, medLogs, sevenDaysAgo, now])

  if (items.length === 0) {
    return (
      <SectionCard title="Recent Activity (last 7 days)" icon={ClipboardList}>
        <p className="text-sm text-gray-400 text-center py-6">No activity recorded in the past week.</p>
      </SectionCard>
    )
  }

  return (
    <SectionCard title="Recent Activity (last 7 days)" icon={ClipboardList}>
      <ol className="relative border-l border-gray-200 ml-2 space-y-4">
        {items.map((item) => (
          <li key={item.id} className="ml-4">
            <span
              className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white ${
                item.kind === 'appointment' ? 'bg-blue-400' : 'bg-emerald-400'
              }`}
            />
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-800">{item.label}</p>
                {item.sublabel && (
                  <p className="text-xs text-gray-400">{item.sublabel}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-xs text-gray-400">{format(item.time, 'MMM d, h:mm a')}</span>
                {item.kind === 'medication' && item.status && (
                  <div className="flex items-center gap-1">
                    {MED_LOG_STATUS_ICON[item.status as keyof typeof MED_LOG_STATUS_ICON]}
                    <span className="text-xs text-gray-500">
                      {MED_LOG_STATUS_LABEL[item.status as keyof typeof MED_LOG_STATUS_LABEL]}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Upcoming appointments (next 7 days)
// ---------------------------------------------------------------------------
function UpcomingAppointmentsSection({ appointments }: { appointments: Appointment[] }) {
  const now = new Date()
  const sevenDaysAhead = addDays(now, 7)

  const upcoming = appointments
    .filter((a) => {
      const d = parseISO(a.start_time)
      return isAfter(d, now) && isBefore(d, sevenDaysAhead)
    })
    .sort((a, b) => parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime())

  return (
    <SectionCard title="Upcoming Appointments (next 7 days)" icon={CalendarDays}>
      {upcoming.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">
          No appointments in the next 7 days.
        </p>
      ) : (
        <div className="space-y-3">
          {upcoming.map((appt) => (
            <div key={appt.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
              <div className="flex-shrink-0 mt-0.5">
                <Badge variant={APPOINTMENT_TYPE_BADGE[appt.type]}>
                  {APPOINTMENT_TYPE_LABELS[appt.type]}
                </Badge>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800">{appt.title}</p>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  <span>
                    {format(parseISO(appt.start_time), 'EEE, MMM d')} ·{' '}
                    {format(parseISO(appt.start_time), 'h:mm a')} –{' '}
                    {format(parseISO(appt.end_time), 'h:mm a')}
                  </span>
                </div>
                {appt.location && (
                  <p className="text-xs text-gray-400 mt-0.5">{appt.location}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Medication schedule section
// ---------------------------------------------------------------------------
function MedicationScheduleSection({ schedules }: { schedules: MedicationSchedule[] }) {
  const activeSchedules = schedules.filter((s) => s.is_active)

  return (
    <SectionCard title="Current Medication Schedule" icon={Pill}>
      {activeSchedules.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">
          No active medication schedules.
        </p>
      ) : (
        <div className="space-y-3">
          {activeSchedules.map((schedule) => (
            <div key={schedule.id} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {schedule.medication?.name ?? 'Unknown medication'}
                  </p>
                  {schedule.medication && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {schedule.medication.dosage} {schedule.medication.unit}
                    </p>
                  )}
                  {schedule.medication?.instructions && (
                    <p className="text-xs text-gray-400 mt-0.5 italic">
                      {schedule.medication.instructions}
                    </p>
                  )}
                </div>
                <Badge variant="success">Active</Badge>
              </div>

              {/* Times */}
              {schedule.times.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {schedule.times.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-white border border-gray-200 rounded-full text-gray-600"
                    >
                      <Clock className="h-3 w-3 text-gray-400" />
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* Days of week */}
              {schedule.days_of_week.length > 0 && schedule.days_of_week.length < 7 && (
                <div className="flex gap-1 mt-2">
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                    <span
                      key={d}
                      className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        schedule.days_of_week.includes(d)
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-gray-100 text-gray-300'
                      }`}
                    >
                      {DAY_NAMES[d]}
                    </span>
                  ))}
                </div>
              )}
              {schedule.days_of_week.length === 7 && (
                <p className="text-xs text-gray-400 mt-1">Every day</p>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// No linked elder state
// ---------------------------------------------------------------------------
function NoLinkedElderState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
      <div className="bg-gray-100 rounded-full p-6 mb-4">
        <Link2Off className="h-10 w-10 text-gray-400" />
      </div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">No Elder Linked</h2>
      <p className="text-gray-500 max-w-sm text-sm">
        Your account is not yet linked to an elder. Please contact a facility administrator to
        link your account so you can view care updates.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main FamilyDashboardPage
// ---------------------------------------------------------------------------
export default function FamilyDashboardPage() {
  const { profile } = useAuth()

  // ---- Fetch family-elder link ----
  const {
    data: link,
    isLoading: linkLoading,
    error: linkError,
  } = useQuery<FamilyElderLink | null>({
    queryKey: ['family-elder-link', profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('family_elder_links')
        .select('elder_id, elder:profiles!family_elder_links_elder_id_fkey(*)')
        .eq('family_id', profile!.id)
        .maybeSingle()
      if (error) throw error
      return data as FamilyElderLink | null
    },
  })

  const elderId = link?.elder_id

  // ---- Fetch elder profile details ----
  const { data: elderProfile } = useQuery<ElderProfile | null>({
    queryKey: ['elder-profile', elderId],
    enabled: !!elderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('elder_profiles')
        .select('*')
        .eq('elder_id', elderId!)
        .maybeSingle()
      if (error) throw error
      return data as ElderProfile | null
    },
  })

  // ---- Fetch appointments for this elder ----
  const { data: appointments = [] } = useQuery<Appointment[]>({
    queryKey: ['family-appointments', elderId],
    enabled: !!elderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('elder_id', elderId!)
        .order('start_time', { ascending: false })
      if (error) throw error
      return (data ?? []) as Appointment[]
    },
  })

  // ---- Fetch medication schedules ----
  const { data: medicationSchedules = [] } = useQuery<MedicationSchedule[]>({
    queryKey: ['family-med-schedules', elderId],
    enabled: !!elderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('medication_schedules')
        .select('*, medication:medications(*)')
        .eq('elder_id', elderId!)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as MedicationSchedule[]
    },
  })

  // ---- Fetch recent medication logs (last 7 days) ----
  const { data: recentMedLogs = [] } = useQuery<MedicationLog[]>({
    queryKey: ['family-med-logs', elderId],
    enabled: !!elderId,
    queryFn: async () => {
      const since = subDays(new Date(), 7).toISOString()
      const { data, error } = await supabase
        .from('medication_logs')
        .select('*, medication:medications(*)')
        .eq('elder_id', elderId!)
        .gte('scheduled_time', since)
        .order('scheduled_time', { ascending: false })
      if (error) throw error
      return (data ?? []) as MedicationLog[]
    },
  })

  // ---- Render states ----
  if (linkLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (linkError) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 rounded-lg text-red-700 text-sm max-w-lg mx-auto mt-8">
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        <span>Failed to load your family data. Please try refreshing the page.</span>
      </div>
    )
  }

  if (!link || !link.elder) {
    return <NoLinkedElderState />
  }

  const elderData: ElderData = {
    profile: link.elder,
    elderProfile: elderProfile ?? null,
    appointments,
    medicationSchedules,
    recentMedLogs,
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Family Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Care updates for {elderData.profile.full_name}
        </p>
      </div>

      {/* Elder info */}
      <ElderInfoSection
        profile={elderData.profile}
        elderProfile={elderData.elderProfile}
      />

      {/* Upcoming appointments */}
      <UpcomingAppointmentsSection appointments={elderData.appointments} />

      {/* Recent activity feed */}
      <RecentActivitySection
        appointments={elderData.appointments}
        medLogs={elderData.recentMedLogs}
      />

      {/* Medication schedule */}
      <MedicationScheduleSection schedules={elderData.medicationSchedules} />
    </div>
  )
}
