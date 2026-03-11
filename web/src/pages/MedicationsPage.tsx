import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pill, Calendar, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { MedicationCard } from '@/components/MedicationCard'
import { MedicationScheduleForm, type ScheduleFormValues } from '@/components/MedicationScheduleForm'
import type { Medication, MedicationSchedule, MedicationLog } from '../../../shared/types'

// ---------------------------------------------------------------------------
// Medication creation form schema
// ---------------------------------------------------------------------------
const medicationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  dosage: z.string().min(1, 'Dosage is required').max(50),
  unit: z.string().min(1, 'Unit is required').max(30),
  instructions: z.string().optional(),
})
type MedicationFormValues = z.infer<typeof medicationSchema>

// ---------------------------------------------------------------------------
// Helper: today's date string (YYYY-MM-DD)
// ---------------------------------------------------------------------------
function todayStr() {
  return new Date().toISOString().split('T')[0]
}

// ---------------------------------------------------------------------------
// Helper: check if a schedule is active today
// ---------------------------------------------------------------------------
function isScheduledToday(schedule: MedicationSchedule): boolean {
  if (!schedule.is_active) return false
  const today = new Date()
  const dow = today.getDay()
  const todayDate = todayStr()
  if (!schedule.days_of_week.includes(dow)) return false
  if (schedule.start_date > todayDate) return false
  if (schedule.end_date && schedule.end_date < todayDate) return false
  return true
}

// ---------------------------------------------------------------------------
// Supabase query helpers
// ---------------------------------------------------------------------------
async function fetchMedications(): Promise<Medication[]> {
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .order('name')
  if (error) throw error
  return data as Medication[]
}

async function fetchSchedulesForElder(elderId: string): Promise<MedicationSchedule[]> {
  const { data, error } = await supabase
    .from('medication_schedules')
    .select('*, medication:medications(*)')
    .eq('elder_id', elderId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as MedicationSchedule[]
}

async function fetchAllSchedules(): Promise<MedicationSchedule[]> {
  const { data, error } = await supabase
    .from('medication_schedules')
    .select('*, medication:medications(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as MedicationSchedule[]
}

async function fetchTodayLogsForElder(elderId: string): Promise<MedicationLog[]> {
  const today = todayStr()
  const { data, error } = await supabase
    .from('medication_logs')
    .select('*, medication:medications(*)')
    .eq('elder_id', elderId)
    .gte('scheduled_time', `${today}T00:00:00`)
    .lte('scheduled_time', `${today}T23:59:59`)
    .order('scheduled_time', { ascending: false })
  if (error) throw error
  return data as MedicationLog[]
}

// ---------------------------------------------------------------------------
// Log-dose mutation payload
// ---------------------------------------------------------------------------
interface LogDosePayload {
  schedule_id: string
  elder_id: string
  medication_id: string
  scheduled_time: string
  status: 'taken'
  logged_by: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function MedicationsPage() {
  const { role, profile, user } = useAuth()
  const queryClient = useQueryClient()

  const [showAddMedModal, setShowAddMedModal] = useState(false)
  const [showAddScheduleModal, setShowAddScheduleModal] = useState(false)
  const [logDoseTarget, setLogDoseTarget] = useState<{
    schedule: MedicationSchedule
    time: string
  } | null>(null)

  const isElder = role === 'elder'
  const isAdminOrCaregiver = role === 'admin' || role === 'caregiver'
  const elderId = profile?.id ?? ''

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------
  const {
    data: medications = [],
    isLoading: medsLoading,
    error: medsError,
  } = useQuery<Medication[]>({
    queryKey: ['medications'],
    queryFn: fetchMedications,
    enabled: isAdminOrCaregiver,
  })

  const {
    data: elderSchedules = [],
    isLoading: elderSchedulesLoading,
  } = useQuery<MedicationSchedule[]>({
    queryKey: ['medication-schedules', 'elder', elderId],
    queryFn: () => fetchSchedulesForElder(elderId),
    enabled: isElder && !!elderId,
  })

  const {
    data: allSchedules = [],
    isLoading: allSchedulesLoading,
  } = useQuery<MedicationSchedule[]>({
    queryKey: ['medication-schedules', 'all'],
    queryFn: fetchAllSchedules,
    enabled: isAdminOrCaregiver,
  })

  const {
    data: todayLogs = [],
    isLoading: logsLoading,
  } = useQuery<MedicationLog[]>({
    queryKey: ['medication-logs', 'today', elderId],
    queryFn: () => fetchTodayLogsForElder(elderId),
    enabled: isElder && !!elderId,
  })

  // -------------------------------------------------------------------------
  // Add medication mutation
  // -------------------------------------------------------------------------
  const addMedicationMutation = useMutation({
    mutationFn: async (values: MedicationFormValues) => {
      const { data, error } = await supabase
        .from('medications')
        .insert({
          name: values.name,
          dosage: values.dosage,
          unit: values.unit,
          instructions: values.instructions ?? null,
          created_by: user!.id,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medications'] })
      setShowAddMedModal(false)
      medForm.reset()
    },
  })

  // -------------------------------------------------------------------------
  // Add schedule mutation
  // -------------------------------------------------------------------------
  const addScheduleMutation = useMutation({
    mutationFn: async (values: ScheduleFormValues) => {
      const times = values.times.map(t => t.value)
      const { data, error } = await supabase
        .from('medication_schedules')
        .insert({
          elder_id: values.elder_id,
          medication_id: values.medication_id,
          times,
          days_of_week: values.days_of_week,
          start_date: values.start_date,
          end_date: values.end_date || null,
          is_active: true,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medication-schedules'] })
      setShowAddScheduleModal(false)
    },
  })

  // -------------------------------------------------------------------------
  // Log dose mutation
  // -------------------------------------------------------------------------
  const logDoseMutation = useMutation({
    mutationFn: async (payload: LogDosePayload) => {
      const { data, error } = await supabase
        .from('medication_logs')
        .insert({ ...payload, taken_at: new Date().toISOString() })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medication-logs', 'today', elderId] })
      queryClient.invalidateQueries({ queryKey: ['medication-schedules'] })
      setLogDoseTarget(null)
    },
  })

  // -------------------------------------------------------------------------
  // Medication form
  // -------------------------------------------------------------------------
  const medForm = useForm<MedicationFormValues>({
    resolver: zodResolver(medicationSchema),
    defaultValues: { name: '', dosage: '', unit: '', instructions: '' },
  })

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  function getLatestLogForSchedule(schedule: MedicationSchedule): MedicationLog | undefined {
    return todayLogs
      .filter(l => l.schedule_id === schedule.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
  }

  function handleLogDose(schedule: MedicationSchedule) {
    const now = new Date()
    const scheduledTime = `${todayStr()}T${schedule.times[0] ?? now.toTimeString().slice(0, 5)}:00`
    setLogDoseTarget({ schedule, time: scheduledTime })
  }

  function confirmLogDose() {
    if (!logDoseTarget || !user) return
    logDoseMutation.mutate({
      schedule_id: logDoseTarget.schedule.id,
      elder_id: logDoseTarget.schedule.elder_id,
      medication_id: logDoseTarget.schedule.medication_id,
      scheduled_time: logDoseTarget.time,
      status: 'taken',
      logged_by: user.id,
    })
  }

  const isPageLoading =
    (isElder && (elderSchedulesLoading || logsLoading)) ||
    (isAdminOrCaregiver && (medsLoading || allSchedulesLoading))

  // -------------------------------------------------------------------------
  // Derived data for elder view
  // -------------------------------------------------------------------------
  const todaySchedules = elderSchedules.filter(isScheduledToday)
  const upcomingSchedules = elderSchedules.filter(s => !isScheduledToday(s))

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (isPageLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* ------------------------------------------------------------------ */}
      {/* Page header                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Medications</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isElder
              ? "Your medication schedule and today's status"
              : 'Manage medications and schedules for elders'}
          </p>
        </div>

        {/* Admin / Caregiver actions */}
        {isAdminOrCaregiver && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowAddScheduleModal(true)}
              className="btn-secondary flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" />
              Add Schedule
            </button>
            <button
              onClick={() => setShowAddMedModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Medication
            </button>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* ELDER VIEW                                                           */}
      {/* ================================================================== */}
      {isElder && (
        <>
          {/* Today's medications */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Today's Medications</h2>
            {todaySchedules.length === 0 ? (
              <EmptyState
                icon={Pill}
                title="No medications scheduled today"
                description="You have no medications due today. Check with your caregiver if you have any questions."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {todaySchedules.map(schedule => (
                  <MedicationCard
                    key={schedule.id}
                    medication={schedule.medication!}
                    schedule={schedule}
                    lastLog={getLatestLogForSchedule(schedule)}
                    onLogDose={() => handleLogDose(schedule)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Upcoming / other active schedules */}
          {upcomingSchedules.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Other Active Schedules</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {upcomingSchedules.map(schedule => (
                  <MedicationCard
                    key={schedule.id}
                    medication={schedule.medication!}
                    schedule={schedule}
                    lastLog={getLatestLogForSchedule(schedule)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Today's log summary */}
          {todayLogs.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Today's Activity</h2>
              <div className="card">
                <ul className="divide-y divide-gray-100">
                  {todayLogs.map(log => (
                    <li key={log.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {log.medication?.name ?? 'Unknown medication'}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Scheduled: {new Date(log.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {log.taken_at && (
                            <> &middot; Taken: {new Date(log.taken_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
                          )}
                        </p>
                      </div>
                      <Badge
                        variant={
                          log.status === 'taken' ? 'success' :
                          log.status === 'missed' ? 'danger' : 'warning'
                        }
                      >
                        {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </>
      )}

      {/* ================================================================== */}
      {/* ADMIN / CAREGIVER VIEW                                               */}
      {/* ================================================================== */}
      {isAdminOrCaregiver && (
        <>
          {/* Medications library */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Medications Library
              <span className="ml-2 text-sm font-normal text-gray-500">({medications.length})</span>
            </h2>

            {medsError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                Failed to load medications. Please refresh.
              </div>
            )}

            {medications.length === 0 && !medsLoading ? (
              <EmptyState
                icon={Pill}
                title="No medications yet"
                description="Add the first medication to get started."
                action={
                  <button onClick={() => setShowAddMedModal(true)} className="btn-primary">
                    <Plus className="h-4 w-4 inline mr-1" />
                    Add Medication
                  </button>
                }
              />
            ) : (
              <div className="card overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Dosage</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Unit</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Instructions</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Added</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {medications.map(med => (
                        <tr key={med.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-gray-900">{med.name}</td>
                          <td className="px-6 py-4 text-gray-600">{med.dosage}</td>
                          <td className="px-6 py-4 text-gray-600">{med.unit}</td>
                          <td className="px-6 py-4 text-gray-500 max-w-xs truncate">
                            {med.instructions ?? <span className="italic text-gray-300">—</span>}
                          </td>
                          <td className="px-6 py-4 text-gray-400 whitespace-nowrap">
                            {new Date(med.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* All schedules */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Medication Schedules
              <span className="ml-2 text-sm font-normal text-gray-500">({allSchedules.length})</span>
            </h2>

            {allSchedules.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No schedules yet"
                description="Create a schedule to assign medications to elders."
                action={
                  <button onClick={() => setShowAddScheduleModal(true)} className="btn-primary">
                    <Plus className="h-4 w-4 inline mr-1" />
                    Add Schedule
                  </button>
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {allSchedules.map(schedule => (
                  <div key={schedule.id} className="card space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="bg-primary-50 rounded-lg p-2 flex-shrink-0">
                          <Pill className="h-4 w-4 text-primary-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {schedule.medication?.name ?? 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {schedule.medication?.dosage} {schedule.medication?.unit}
                          </p>
                        </div>
                      </div>
                      <Badge variant={schedule.is_active ? 'success' : 'default'}>
                        {schedule.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    <div className="text-xs text-gray-500 space-y-1">
                      <p>
                        <span className="font-medium text-gray-700">Times: </span>
                        {schedule.times.map(t => {
                          const [h, m] = t.split(':').map(Number)
                          const ampm = h >= 12 ? 'PM' : 'AM'
                          const hour = h % 12 === 0 ? 12 : h % 12
                          return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
                        }).join(', ')}
                      </p>
                      <p>
                        <span className="font-medium text-gray-700">Days: </span>
                        {schedule.days_of_week.length === 7
                          ? 'Every day'
                          : schedule.days_of_week
                            .map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
                            .join(', ')}
                      </p>
                      <p>
                        <span className="font-medium text-gray-700">From: </span>
                        {new Date(schedule.start_date).toLocaleDateString()}
                        {schedule.end_date && (
                          <> &rarr; {new Date(schedule.end_date).toLocaleDateString()}</>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ================================================================== */}
      {/* MODALS                                                               */}
      {/* ================================================================== */}

      {/* Add Medication Modal */}
      <Modal
        isOpen={showAddMedModal}
        onClose={() => { setShowAddMedModal(false); medForm.reset() }}
        title="Add New Medication"
        size="md"
      >
        <form
          onSubmit={medForm.handleSubmit(v => addMedicationMutation.mutate(v))}
          className="space-y-4"
          noValidate
        >
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Medication Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...medForm.register('name')}
              className="input-field"
              placeholder="e.g. Metformin"
              autoFocus
            />
            {medForm.formState.errors.name && (
              <p className="mt-1 text-xs text-red-600">{medForm.formState.errors.name.message}</p>
            )}
          </div>

          {/* Dosage + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dosage <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...medForm.register('dosage')}
                className="input-field"
                placeholder="e.g. 500"
              />
              {medForm.formState.errors.dosage && (
                <p className="mt-1 text-xs text-red-600">{medForm.formState.errors.dosage.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...medForm.register('unit')}
                className="input-field"
                placeholder="e.g. mg"
              />
              {medForm.formState.errors.unit && (
                <p className="mt-1 text-xs text-red-600">{medForm.formState.errors.unit.message}</p>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instructions <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              {...medForm.register('instructions')}
              rows={3}
              className="input-field resize-none"
              placeholder="e.g. Take with food"
            />
          </div>

          {/* Error */}
          {addMedicationMutation.isError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              Failed to save medication. Please try again.
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => { setShowAddMedModal(false); medForm.reset() }}
              className="btn-secondary"
              disabled={addMedicationMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={addMedicationMutation.isPending}
            >
              {addMedicationMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Spinner size="sm" />
                  Saving…
                </span>
              ) : (
                'Add Medication'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Schedule Modal */}
      <Modal
        isOpen={showAddScheduleModal}
        onClose={() => setShowAddScheduleModal(false)}
        title="Add Medication Schedule"
        size="lg"
      >
        {addScheduleMutation.isError && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            Failed to save schedule. Please try again.
          </div>
        )}
        <MedicationScheduleForm
          onSubmit={v => addScheduleMutation.mutate(v)}
          onCancel={() => setShowAddScheduleModal(false)}
          isLoading={addScheduleMutation.isPending}
        />
      </Modal>

      {/* Log Dose Confirmation Modal */}
      <Modal
        isOpen={!!logDoseTarget}
        onClose={() => setLogDoseTarget(null)}
        title="Confirm Dose Taken"
        size="sm"
      >
        {logDoseTarget && (
          <div className="space-y-5">
            <p className="text-sm text-gray-600">
              Mark{' '}
              <span className="font-semibold text-gray-900">
                {logDoseTarget.schedule.medication?.name}
              </span>{' '}
              ({logDoseTarget.schedule.medication?.dosage}{' '}
              {logDoseTarget.schedule.medication?.unit}) as taken now?
            </p>

            {logDoseMutation.isError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                Failed to log dose. Please try again.
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setLogDoseTarget(null)}
                className="btn-secondary"
                disabled={logDoseMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={confirmLogDose}
                className="btn-primary"
                disabled={logDoseMutation.isPending}
              >
                {logDoseMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="sm" />
                    Logging…
                  </span>
                ) : (
                  'Confirm Taken'
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
