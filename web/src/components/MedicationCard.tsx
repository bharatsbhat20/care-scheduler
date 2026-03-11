import type { ReactNode } from 'react'
import { CheckCircle, Clock, XCircle, Pill, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import type { Medication, MedicationSchedule, MedicationLog } from '../../../shared/types'

interface MedicationCardProps {
  medication: Medication
  schedule?: MedicationSchedule
  lastLog?: MedicationLog
  onLogDose?: () => void
}

function getNextScheduledTime(schedule: MedicationSchedule): string | null {
  if (!schedule.is_active || !schedule.times || schedule.times.length === 0) return null

  const now = new Date()
  const todayDow = now.getDay() // 0 = Sunday

  // Check if today is a scheduled day
  const isTodayScheduled = schedule.days_of_week.includes(todayDow)

  if (isTodayScheduled) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    const sortedTimes = [...schedule.times].sort()

    for (const t of sortedTimes) {
      const [h, m] = t.split(':').map(Number)
      const timeMinutes = h * 60 + m
      if (timeMinutes > nowMinutes) {
        return t
      }
    }
  }

  // Find next scheduled day
  for (let offset = 1; offset <= 7; offset++) {
    const nextDow = (todayDow + offset) % 7
    if (schedule.days_of_week.includes(nextDow)) {
      const sortedTimes = [...schedule.times].sort()
      const dayLabel = offset === 1 ? 'Tomorrow' : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][nextDow]
      return `${dayLabel} at ${formatTime(sortedTimes[0])}`
    }
  }

  return null
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function getStatusInfo(
  lastLog: MedicationLog | undefined,
  schedule: MedicationSchedule | undefined
): { label: string; variant: 'success' | 'danger' | 'warning' | 'default'; icon: ReactNode } {
  if (!schedule) {
    return { label: 'No Schedule', variant: 'default', icon: <AlertCircle className="h-3.5 w-3.5" /> }
  }

  if (!lastLog) {
    return { label: 'Pending', variant: 'warning', icon: <Clock className="h-3.5 w-3.5" /> }
  }

  switch (lastLog.status) {
    case 'taken':
      return { label: 'Taken', variant: 'success', icon: <CheckCircle className="h-3.5 w-3.5" /> }
    case 'missed':
      return { label: 'Missed', variant: 'danger', icon: <XCircle className="h-3.5 w-3.5" /> }
    case 'skipped':
      return { label: 'Skipped', variant: 'warning', icon: <AlertCircle className="h-3.5 w-3.5" /> }
    default:
      return { label: 'Pending', variant: 'warning', icon: <Clock className="h-3.5 w-3.5" /> }
  }
}

export function MedicationCard({ medication, schedule, lastLog, onLogDose }: MedicationCardProps) {
  const status = getStatusInfo(lastLog, schedule)
  const nextTime = schedule ? getNextScheduledTime(schedule) : null
  const alreadyTakenToday = lastLog?.status === 'taken'

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        {/* Icon + Name */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="bg-primary-50 rounded-lg p-2.5 flex-shrink-0">
            <Pill className="h-5 w-5 text-primary-600" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900 truncate">{medication.name}</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {medication.dosage} {medication.unit}
            </p>
            {medication.instructions && (
              <p className="text-xs text-gray-400 mt-1 line-clamp-2">{medication.instructions}</p>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <Badge variant={status.variant} className="flex-shrink-0 flex items-center gap-1">
          {status.icon}
          {status.label}
        </Badge>
      </div>

      {/* Schedule info */}
      {schedule && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              {/* Times today */}
              {schedule.times.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                  <span>
                    {schedule.times.length === 1
                      ? `Daily at ${formatTime(schedule.times[0])}`
                      : `${schedule.times.length} times daily`}
                  </span>
                </div>
              )}

              {/* Next scheduled */}
              {nextTime && !alreadyTakenToday && (
                <p className="text-xs text-primary-600 font-medium">Next: {nextTime}</p>
              )}
              {alreadyTakenToday && (
                <p className="text-xs text-green-600 font-medium">Completed for today</p>
              )}
            </div>

            {/* Mark as Taken button */}
            {onLogDose && schedule.is_active && !alreadyTakenToday && (
              <button
                onClick={onLogDose}
                className="btn-primary text-xs px-3 py-1.5 flex-shrink-0"
              >
                <CheckCircle className="h-3.5 w-3.5 inline mr-1" />
                Mark as Taken
              </button>
            )}
          </div>
        </div>
      )}

      {/* No schedule warning */}
      {!schedule && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 italic">No active schedule assigned.</p>
        </div>
      )}
    </div>
  )
}
