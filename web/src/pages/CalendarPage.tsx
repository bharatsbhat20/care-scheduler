import { useState, useMemo, useCallback } from 'react'
import { Calendar, dateFnsLocalizer, Event, View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, MapPin, FileText, Clock, User, AlertCircle } from 'lucide-react'
import 'react-big-calendar/lib/css/react-big-calendar.css'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import type { Appointment, AppointmentType, Profile } from '../../../shared/types'

// ---------------------------------------------------------------------------
// date-fns localizer
// ---------------------------------------------------------------------------
const locales = { 'en-US': enUS }
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
})

// ---------------------------------------------------------------------------
// Appointment type meta
// ---------------------------------------------------------------------------
const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  medical: 'Medical',
  therapy: 'Therapy',
  family_visit: 'Family Visit',
  activity: 'Activity',
  other: 'Other',
}

const APPOINTMENT_TYPE_COLORS: Record<AppointmentType, string> = {
  medical: '#ef4444',      // red-500
  therapy: '#8b5cf6',      // violet-500
  family_visit: '#10b981', // emerald-500
  activity: '#f59e0b',     // amber-500
  other: '#6b7280',        // gray-500
}

// ---------------------------------------------------------------------------
// Zod schema for appointment form
// ---------------------------------------------------------------------------
const appointmentSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(120, 'Max 120 characters'),
    type: z.enum(['medical', 'therapy', 'family_visit', 'activity', 'other'] as const),
    elder_id: z.string().min(1, 'Elder is required'),
    start_time: z.string().min(1, 'Start time is required'),
    end_time: z.string().min(1, 'End time is required'),
    location: z.string().max(200).optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine(
    (data) => new Date(data.end_time) > new Date(data.start_time),
    { message: 'End time must be after start time', path: ['end_time'] }
  )

type AppointmentFormValues = z.infer<typeof appointmentSchema>

// ---------------------------------------------------------------------------
// Extended calendar event
// ---------------------------------------------------------------------------
interface CalendarEvent extends Event {
  resource: Appointment
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function nowRounded(): string {
  const d = new Date()
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
  return toLocalDateTimeInput(d.toISOString())
}

function oneHourLater(start: string): string {
  const d = new Date(start)
  d.setHours(d.getHours() + 1)
  return toLocalDateTimeInput(d.toISOString())
}

// ---------------------------------------------------------------------------
// Appointment form component (used in both add and edit modals)
// ---------------------------------------------------------------------------
interface AppointmentFormProps {
  elders: Profile[]
  defaultElderId?: string
  onSubmit: (values: AppointmentFormValues) => Promise<void>
  onCancel: () => void
  isSubmitting: boolean
  defaultValues?: Partial<AppointmentFormValues>
}

function AppointmentForm({
  elders,
  defaultElderId,
  onSubmit,
  onCancel,
  isSubmitting,
  defaultValues,
}: AppointmentFormProps) {
  const startNow = nowRounded()
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      title: '',
      type: 'medical',
      elder_id: defaultElderId ?? '',
      start_time: startNow,
      end_time: oneHourLater(startNow),
      location: '',
      notes: '',
      ...defaultValues,
    },
  })

  const startTime = watch('start_time')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input {...register('title')} className="input-field" placeholder="e.g. Cardiology check-up" />
        {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
      </div>

      {/* Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Type <span className="text-red-500">*</span>
        </label>
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <select {...field} className="input-field">
              {Object.entries(APPOINTMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          )}
        />
        {errors.type && <p className="mt-1 text-xs text-red-600">{errors.type.message}</p>}
      </div>

      {/* Elder */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Elder <span className="text-red-500">*</span>
        </label>
        <select {...register('elder_id')} className="input-field" disabled={!!defaultElderId && elders.length === 1}>
          <option value="">Select elder…</option>
          {elders.map((e) => (
            <option key={e.id} value={e.id}>{e.full_name}</option>
          ))}
        </select>
        {errors.elder_id && <p className="mt-1 text-xs text-red-600">{errors.elder_id.message}</p>}
      </div>

      {/* Start / End time */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start <span className="text-red-500">*</span>
          </label>
          <input type="datetime-local" {...register('start_time')} className="input-field" />
          {errors.start_time && <p className="mt-1 text-xs text-red-600">{errors.start_time.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            {...register('end_time')}
            className="input-field"
            min={startTime}
          />
          {errors.end_time && <p className="mt-1 text-xs text-red-600">{errors.end_time.message}</p>}
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
        <input {...register('location')} className="input-field" placeholder="e.g. Room 4B, Main Hospital" />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          {...register('notes')}
          className="input-field resize-none"
          rows={3}
          placeholder="Any additional information…"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? <Spinner size="sm" className="inline mr-2" /> : null}
          Save Appointment
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Appointment detail panel (shown inside modal when clicking an event)
// ---------------------------------------------------------------------------
interface AppointmentDetailProps {
  appointment: Appointment
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
  isDeleting: boolean
}

function AppointmentDetail({ appointment, canEdit, onEdit, onDelete, isDeleting }: AppointmentDetailProps) {
  const color = APPOINTMENT_TYPE_COLORS[appointment.type]
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm font-medium" style={{ color }}>
          {APPOINTMENT_TYPE_LABELS[appointment.type]}
        </span>
      </div>

      <div className="flex items-start gap-2 text-sm text-gray-700">
        <Clock className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-400" />
        <div>
          <p>{format(new Date(appointment.start_time), 'PPP')}</p>
          <p className="text-gray-500">
            {format(new Date(appointment.start_time), 'p')} – {format(new Date(appointment.end_time), 'p')}
          </p>
        </div>
      </div>

      {appointment.elder && (
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <User className="h-4 w-4 flex-shrink-0 text-gray-400" />
          <span>{appointment.elder.full_name}</span>
        </div>
      )}

      {appointment.location && (
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <MapPin className="h-4 w-4 flex-shrink-0 text-gray-400" />
          <span>{appointment.location}</span>
        </div>
      )}

      {appointment.notes && (
        <div className="flex items-start gap-2 text-sm text-gray-700">
          <FileText className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-400" />
          <p className="whitespace-pre-wrap">{appointment.notes}</p>
        </div>
      )}

      {canEdit && (
        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <button className="btn-secondary flex-1" onClick={onEdit}>
            Edit
          </button>
          <button
            className="btn-danger flex-1"
            onClick={onDelete}
            disabled={isDeleting}
          >
            {isDeleting ? <Spinner size="sm" className="inline mr-2" /> : null}
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main CalendarPage
// ---------------------------------------------------------------------------
export default function CalendarPage() {
  const { profile, role } = useAuth()
  const queryClient = useQueryClient()

  const [currentView, setCurrentView] = useState<View>('month')
  const [currentDate, setCurrentDate] = useState(new Date())

  const [selectedEvent, setSelectedEvent] = useState<Appointment | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  const isElder = role === 'elder'
  const isFamily = role === 'family'
  const canEdit = role === 'caregiver' || role === 'admin'

  // ---- Fetch elders the current user can see ----
  const { data: elders = [] } = useQuery<Profile[]>({
    queryKey: ['elders', profile?.id, role],
    enabled: !!profile,
    queryFn: async () => {
      if (role === 'admin') {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'elder')
          .order('full_name')
        if (error) throw error
        return (data ?? []) as Profile[]
      }

      if (role === 'caregiver') {
        // fetch elders linked to this caregiver via caregiver_elder_links
        const { data: links, error: linkError } = await supabase
          .from('caregiver_elder_links')
          .select('elder_id')
          .eq('caregiver_id', profile!.id)
        if (linkError) throw linkError
        const elderIds = (links ?? []).map((l: { elder_id: string }) => l.elder_id)
        if (elderIds.length === 0) return []
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .in('id', elderIds)
          .order('full_name')
        if (error) throw error
        return (data ?? []) as Profile[]
      }

      if (role === 'elder') {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', profile!.id)
          .single()
        if (error) throw error
        return data ? [data as Profile] : []
      }

      return []
    },
  })

  const elderIds = elders.map((e) => e.id)

  // ---- Fetch appointments ----
  const { data: appointments = [], isLoading, error } = useQuery<Appointment[]>({
    queryKey: ['appointments', elderIds.join(',')],
    enabled: elderIds.length > 0,
    queryFn: async () => {
      let query = supabase
        .from('appointments')
        .select('*, elder:profiles!appointments_elder_id_fkey(*)')
        .order('start_time', { ascending: true })

      if (isElder) {
        query = query.eq('elder_id', profile!.id)
      } else if (elderIds.length > 0) {
        query = query.in('elder_id', elderIds)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as Appointment[]
    },
  })

  // ---- Mutations ----
  const addMutation = useMutation({
    mutationFn: async (values: AppointmentFormValues) => {
      const { error } = await supabase.from('appointments').insert({
        title: values.title,
        type: values.type,
        elder_id: values.elder_id,
        start_time: new Date(values.start_time).toISOString(),
        end_time: new Date(values.end_time).toISOString(),
        location: values.location || null,
        notes: values.notes || null,
        created_by: profile!.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      setShowAddModal(false)
    },
  })

  const editMutation = useMutation({
    mutationFn: async (values: AppointmentFormValues) => {
      const { error } = await supabase
        .from('appointments')
        .update({
          title: values.title,
          type: values.type,
          elder_id: values.elder_id,
          start_time: new Date(values.start_time).toISOString(),
          end_time: new Date(values.end_time).toISOString(),
          location: values.location || null,
          notes: values.notes || null,
        })
        .eq('id', selectedEvent!.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      setShowEditModal(false)
      setShowDetailModal(false)
      setSelectedEvent(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('appointments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      setShowDetailModal(false)
      setSelectedEvent(null)
    },
  })

  // ---- Map appointments to calendar events ----
  const events: CalendarEvent[] = useMemo(
    () =>
      appointments.map((appt) => ({
        title: appt.title,
        start: new Date(appt.start_time),
        end: new Date(appt.end_time),
        resource: appt,
      })),
    [appointments]
  )

  // ---- Event style getter ----
  const eventStyleGetter = useCallback(
    (event: CalendarEvent) => {
      const color = APPOINTMENT_TYPE_COLORS[event.resource.type]
      return {
        style: {
          backgroundColor: color,
          borderColor: color,
          color: '#fff',
          borderRadius: '4px',
          fontSize: '12px',
          padding: '1px 4px',
        },
      }
    },
    []
  )

  // ---- Handlers ----
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event.resource)
    setShowDetailModal(true)
  }, [])

  const handleOpenEdit = () => {
    setShowDetailModal(false)
    setShowEditModal(true)
  }

  const handleDelete = () => {
    if (selectedEvent) deleteMutation.mutate(selectedEvent.id)
  }

  const defaultElderId = isElder ? profile?.id : elders.length === 1 ? elders[0].id : undefined

  // ---- Render ----
  if (!profile) return null

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isElder || isFamily
              ? 'Your upcoming appointments'
              : 'Manage appointments for your assigned elders'}
          </p>
        </div>
        {canEdit && (
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="h-4 w-4" />
            Add Appointment
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {(Object.entries(APPOINTMENT_TYPE_LABELS) as [AppointmentType, string][]).map(
          ([type, label]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: APPOINTMENT_TYPE_COLORS[type] }}
              />
              <span className="text-xs text-gray-600">{label}</span>
            </div>
          )
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 rounded-lg text-red-700 mb-4 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Failed to load appointments. Please try refreshing.</span>
        </div>
      )}

      {/* Calendar */}
      <div className="card flex-1 overflow-hidden" style={{ minHeight: '500px' }}>
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : (
          <Calendar
            localizer={localizer}
            events={events}
            view={currentView}
            onView={setCurrentView}
            date={currentDate}
            onNavigate={setCurrentDate}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventStyleGetter}
            views={['month', 'week', 'day', 'agenda']}
            style={{ height: '100%' }}
            popup
            tooltipAccessor={(event: CalendarEvent) =>
              `${event.title}${event.resource.location ? ` — ${event.resource.location}` : ''}`
            }
          />
        )}
      </div>

      {/* Detail modal */}
      <Modal
        isOpen={showDetailModal && !!selectedEvent}
        onClose={() => { setShowDetailModal(false); setSelectedEvent(null) }}
        title={selectedEvent?.title ?? ''}
        size="md"
      >
        {selectedEvent && (
          <AppointmentDetail
            appointment={selectedEvent}
            canEdit={canEdit}
            onEdit={handleOpenEdit}
            onDelete={handleDelete}
            isDeleting={deleteMutation.isPending}
          />
        )}
      </Modal>

      {/* Add modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="New Appointment"
        size="lg"
      >
        <AppointmentForm
          elders={elders}
          defaultElderId={defaultElderId}
          onSubmit={(values) => addMutation.mutateAsync(values)}
          onCancel={() => setShowAddModal(false)}
          isSubmitting={addMutation.isPending}
        />
        {addMutation.error && (
          <p className="mt-3 text-sm text-red-600">
            Error: {(addMutation.error as Error).message}
          </p>
        )}
      </Modal>

      {/* Edit modal */}
      <Modal
        isOpen={showEditModal && !!selectedEvent}
        onClose={() => { setShowEditModal(false); setSelectedEvent(null) }}
        title="Edit Appointment"
        size="lg"
      >
        {selectedEvent && (
          <>
            <AppointmentForm
              elders={elders}
              defaultElderId={defaultElderId}
              onSubmit={(values) => editMutation.mutateAsync(values)}
              onCancel={() => { setShowEditModal(false); setSelectedEvent(null) }}
              isSubmitting={editMutation.isPending}
              defaultValues={{
                title: selectedEvent.title,
                type: selectedEvent.type,
                elder_id: selectedEvent.elder_id,
                start_time: toLocalDateTimeInput(selectedEvent.start_time),
                end_time: toLocalDateTimeInput(selectedEvent.end_time),
                location: selectedEvent.location ?? '',
                notes: selectedEvent.notes ?? '',
              }}
            />
            {editMutation.error && (
              <p className="mt-3 text-sm text-red-600">
                Error: {(editMutation.error as Error).message}
              </p>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
