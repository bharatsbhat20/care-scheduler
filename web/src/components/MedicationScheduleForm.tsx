import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { supabase } from '@/lib/supabase'
import type { Profile, Medication } from '../../../shared/types'

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------
const scheduleSchema = z.object({
  elder_id: z.string().min(1, 'Please select an elder'),
  medication_id: z.string().min(1, 'Please select a medication'),
  times: z
    .array(z.object({ value: z.string().min(1, 'Time is required') }))
    .min(1, 'Add at least one scheduled time'),
  days_of_week: z
    .array(z.number())
    .min(1, 'Select at least one day'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(),
})

export type ScheduleFormValues = z.infer<typeof scheduleSchema>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface MedicationScheduleFormProps {
  onSubmit: (data: ScheduleFormValues) => void
  onCancel: () => void
  isLoading: boolean
  defaultValues?: Partial<ScheduleFormValues>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function MedicationScheduleForm({
  onSubmit,
  onCancel,
  isLoading,
  defaultValues,
}: MedicationScheduleFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      elder_id: defaultValues?.elder_id ?? '',
      medication_id: defaultValues?.medication_id ?? '',
      times: defaultValues?.times ?? [{ value: '08:00' }],
      days_of_week: defaultValues?.days_of_week ?? [0, 1, 2, 3, 4, 5, 6],
      start_date: defaultValues?.start_date ?? new Date().toISOString().split('T')[0],
      end_date: defaultValues?.end_date ?? '',
    },
  })

  const { fields: timeFields, append: appendTime, remove: removeTime } = useFieldArray({
    control,
    name: 'times',
  })

  const selectedDays = watch('days_of_week')

  // -------------------------------------------------------------------------
  // Data fetches
  // -------------------------------------------------------------------------
  const { data: elders = [], isLoading: eldersLoading } = useQuery<Profile[]>({
    queryKey: ['elders-for-schedule'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('role', 'elder')
        .order('full_name')
      if (error) throw error
      return data as Profile[]
    },
  })

  const { data: medications = [], isLoading: medsLoading } = useQuery<Medication[]>({
    queryKey: ['medications-for-schedule'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('medications')
        .select('id, name, dosage, unit')
        .order('name')
      if (error) throw error
      return data as Medication[]
    },
  })

  // -------------------------------------------------------------------------
  // Day-of-week toggle helper
  // -------------------------------------------------------------------------
  function toggleDay(day: number) {
    const current = selectedDays ?? []
    if (current.includes(day)) {
      setValue('days_of_week', current.filter(d => d !== day), { shouldValidate: true })
    } else {
      setValue('days_of_week', [...current, day].sort((a, b) => a - b), { shouldValidate: true })
    }
  }

  // -------------------------------------------------------------------------
  // Form submit handler — flatten times array before passing up
  // -------------------------------------------------------------------------
  function handleFormSubmit(values: ScheduleFormValues) {
    onSubmit(values)
  }

  if (eldersLoading || medsLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5" noValidate>

      {/* Elder selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Elder <span className="text-red-500">*</span>
        </label>
        <select {...register('elder_id')} className="input-field">
          <option value="">Select an elder…</option>
          {elders.map(e => (
            <option key={e.id} value={e.id}>{e.full_name}</option>
          ))}
        </select>
        {errors.elder_id && (
          <p className="mt-1 text-xs text-red-600">{errors.elder_id.message}</p>
        )}
      </div>

      {/* Medication selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Medication <span className="text-red-500">*</span>
        </label>
        <select {...register('medication_id')} className="input-field">
          <option value="">Select a medication…</option>
          {medications.map(m => (
            <option key={m.id} value={m.id}>
              {m.name} — {m.dosage} {m.unit}
            </option>
          ))}
        </select>
        {errors.medication_id && (
          <p className="mt-1 text-xs text-red-600">{errors.medication_id.message}</p>
        )}
      </div>

      {/* Scheduled times */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Scheduled Times <span className="text-red-500">*</span>
        </label>
        <div className="space-y-2">
          {timeFields.map((field, idx) => (
            <div key={field.id} className="flex items-center gap-2">
              <input
                type="time"
                {...register(`times.${idx}.value`)}
                className="input-field"
              />
              {timeFields.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTime(idx)}
                  className="flex-shrink-0 text-red-500 hover:text-red-700 p-1"
                  aria-label="Remove time"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {errors.times && !Array.isArray(errors.times) && (
            <p className="text-xs text-red-600">{(errors.times as { message?: string }).message}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => appendTime({ value: '12:00' })}
          className="mt-2 flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-800 font-medium"
        >
          <Plus className="h-4 w-4" />
          Add another time
        </button>
      </div>

      {/* Days of week */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Days of Week <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2 flex-wrap">
          {DAY_LABELS.map((label, idx) => {
            const active = selectedDays?.includes(idx)
            return (
              <button
                key={idx}
                type="button"
                onClick={() => toggleDay(idx)}
                className={`w-10 h-10 rounded-full text-xs font-semibold border transition-colors ${
                  active
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400 hover:text-primary-600'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
        {errors.days_of_week && (
          <p className="mt-1 text-xs text-red-600">
            {(errors.days_of_week as { message?: string }).message ?? 'Select at least one day'}
          </p>
        )}
      </div>

      {/* Start date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Start Date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          {...register('start_date')}
          className="input-field"
        />
        {errors.start_date && (
          <p className="mt-1 text-xs text-red-600">{errors.start_date.message}</p>
        )}
      </div>

      {/* End date (optional) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          End Date <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          type="date"
          {...register('end_date')}
          className="input-field"
        />
        {errors.end_date && (
          <p className="mt-1 text-xs text-red-600">{errors.end_date.message}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={isLoading}>
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Spinner size="sm" />
              Saving…
            </span>
          ) : (
            'Save Schedule'
          )}
        </button>
      </div>
    </form>
  )
}
