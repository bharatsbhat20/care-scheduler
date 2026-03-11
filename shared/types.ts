export type UserRole = 'elder' | 'caregiver' | 'family' | 'admin'

export interface Profile {
  id: string
  role: UserRole
  full_name: string
  phone?: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface ElderProfile {
  id: string
  elder_id: string
  room_unit?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  medical_notes?: string
  created_at: string
  updated_at: string
}

export interface Medication {
  id: string
  name: string
  dosage: string
  unit: string
  instructions?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface MedicationSchedule {
  id: string
  elder_id: string
  medication_id: string
  times: string[]
  days_of_week: number[]
  start_date: string
  end_date?: string
  is_active: boolean
  medication?: Medication
  created_at: string
  updated_at: string
}

export interface MedicationLog {
  id: string
  schedule_id: string
  elder_id: string
  medication_id: string
  scheduled_time: string
  taken_at?: string
  status: 'taken' | 'missed' | 'skipped'
  notes?: string
  logged_by?: string
  medication?: Medication
  created_at: string
}

export type AppointmentType = 'medical' | 'therapy' | 'family_visit' | 'activity' | 'other'

export interface Appointment {
  id: string
  title: string
  elder_id: string
  type: AppointmentType
  start_time: string
  end_time: string
  location?: string
  notes?: string
  created_by: string
  elder?: Profile
  created_at: string
  updated_at: string
}

export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  title: string
  description?: string
  elder_id: string
  due_date?: string
  priority: TaskPriority
  status: TaskStatus
  created_by: string
  elder?: Profile
  assignments?: TaskAssignment[]
  created_at: string
  updated_at: string
}

export interface TaskAssignment {
  id: string
  task_id: string
  caregiver_id: string
  assigned_at: string
  caregiver?: Profile
}

export interface NotificationPrefs {
  id: string
  user_id: string
  medication_reminders: boolean
  appointment_reminders: boolean
  task_updates: boolean
  family_updates: boolean
  reminder_minutes_before: number
  push_token?: string
  created_at: string
  updated_at: string
}
