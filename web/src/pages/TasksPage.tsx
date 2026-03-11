import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, ClipboardList, AlertCircle } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { TaskCard } from '@/components/TaskCard'
import type { Task, TaskStatus, TaskPriority, Profile } from '../../../shared/types'

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------
interface Column {
  status: TaskStatus
  label: string
  headerClass: string
  countClass: string
}

const COLUMNS: Column[] = [
  {
    status: 'todo',
    label: 'To Do',
    headerClass: 'border-t-gray-400',
    countClass: 'bg-gray-100 text-gray-600',
  },
  {
    status: 'in_progress',
    label: 'In Progress',
    headerClass: 'border-t-blue-400',
    countClass: 'bg-blue-100 text-blue-700',
  },
  {
    status: 'done',
    label: 'Done',
    headerClass: 'border-t-emerald-400',
    countClass: 'bg-emerald-100 text-emerald-700',
  },
]

// ---------------------------------------------------------------------------
// Zod schema for task form
// ---------------------------------------------------------------------------
const taskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Max 200 characters'),
  description: z.string().max(1000).optional(),
  elder_id: z.string().min(1, 'Elder is required'),
  due_date: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high'] as const),
  assignee_ids: z.array(z.string()).optional(),
})

type TaskFormValues = z.infer<typeof taskSchema>

// ---------------------------------------------------------------------------
// Task form component
// ---------------------------------------------------------------------------
interface TaskFormProps {
  elders: Profile[]
  caregivers: Profile[]
  defaultValues?: Partial<TaskFormValues>
  onSubmit: (values: TaskFormValues) => Promise<void>
  onCancel: () => void
  isSubmitting: boolean
  submitLabel?: string
}

function TaskForm({
  elders,
  caregivers,
  defaultValues,
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel = 'Save Task',
}: TaskFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      elder_id: elders.length === 1 ? elders[0].id : '',
      due_date: '',
      priority: 'medium',
      assignee_ids: [],
      ...defaultValues,
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input {...register('title')} className="input-field" placeholder="e.g. Assist with morning routine" />
        {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          {...register('description')}
          className="input-field resize-none"
          rows={3}
          placeholder="Optional details…"
        />
      </div>

      {/* Elder */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Elder <span className="text-red-500">*</span>
        </label>
        <select {...register('elder_id')} className="input-field">
          <option value="">Select elder…</option>
          {elders.map((e) => (
            <option key={e.id} value={e.id}>{e.full_name}</option>
          ))}
        </select>
        {errors.elder_id && <p className="mt-1 text-xs text-red-600">{errors.elder_id.message}</p>}
      </div>

      {/* Due date & Priority */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
          <input type="date" {...register('due_date')} className="input-field" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Priority <span className="text-red-500">*</span>
          </label>
          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <select {...field} className="input-field">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            )}
          />
        </div>
      </div>

      {/* Assigned caregivers */}
      {caregivers.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Assign To (caregiver)
          </label>
          <div className="border border-gray-300 rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-100">
            {caregivers.map((cg) => (
              <label key={cg.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  value={cg.id}
                  {...register('assignee_ids')}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">{cg.full_name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting && <Spinner size="sm" className="inline mr-2" />}
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Kanban column component
// ---------------------------------------------------------------------------
interface KanbanColumnProps {
  column: Column
  tasks: Task[]
  onStatusChange: (task: Task, status: TaskStatus) => void
  onDelete: (task: Task) => void
  onEdit: (task: Task) => void
  updatingIds: Set<string>
  deletingIds: Set<string>
}

function KanbanColumn({
  column,
  tasks,
  onStatusChange,
  onDelete,
  onEdit,
  updatingIds,
  deletingIds,
}: KanbanColumnProps) {
  return (
    <div className="flex flex-col min-w-0">
      {/* Column header */}
      <div
        className={`card border-t-4 ${column.headerClass} mb-3 px-4 py-3 flex items-center justify-between`}
      >
        <span className="font-semibold text-gray-700 text-sm">{column.label}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${column.countClass}`}>
          {tasks.length}
        </span>
      </div>

      {/* Task cards */}
      <div className="flex flex-col gap-3 min-h-[120px]">
        {tasks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-8 text-xs text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
            No tasks
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusChange={(status) => onStatusChange(task, status)}
              onDelete={() => onDelete(task)}
              onEdit={() => onEdit(task)}
              isUpdating={updatingIds.has(task.id)}
              isDeleting={deletingIds.has(task.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main TasksPage
// ---------------------------------------------------------------------------
export default function TasksPage() {
  const { profile, role } = useAuth()
  const queryClient = useQueryClient()

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())

  const isAdmin = role === 'admin'
  const isCaregiver = role === 'caregiver'

  // ---- Fetch elders ----
  const { data: elders = [] } = useQuery<Profile[]>({
    queryKey: ['elders-for-tasks', profile?.id, role],
    enabled: !!profile && (isAdmin || isCaregiver),
    queryFn: async () => {
      if (isAdmin) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'elder')
          .order('full_name')
        if (error) throw error
        return (data ?? []) as Profile[]
      }
      // caregiver: only linked elders
      const { data: links, error: linkError } = await supabase
        .from('caregiver_elder_links')
        .select('elder_id')
        .eq('caregiver_id', profile!.id)
      if (linkError) throw linkError
      const ids = (links ?? []).map((l: { elder_id: string }) => l.elder_id)
      if (ids.length === 0) return []
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('id', ids)
        .order('full_name')
      if (error) throw error
      return (data ?? []) as Profile[]
    },
  })

  // ---- Fetch caregivers (for assignment) ----
  const { data: caregivers = [] } = useQuery<Profile[]>({
    queryKey: ['caregivers-list'],
    enabled: isAdmin || isCaregiver,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'caregiver')
        .order('full_name')
      if (error) throw error
      return (data ?? []) as Profile[]
    },
  })

  const elderIds = elders.map((e) => e.id)

  // ---- Fetch tasks ----
  const {
    data: tasks = [],
    isLoading,
    error,
  } = useQuery<Task[]>({
    queryKey: ['tasks', role, profile?.id, elderIds.join(',')],
    enabled: !!profile && (isAdmin || isCaregiver),
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          elder:profiles!tasks_elder_id_fkey(*),
          assignments:task_assignments(
            id, task_id, caregiver_id, assigned_at,
            caregiver:profiles!task_assignments_caregiver_id_fkey(*)
          )
        `)
        .order('created_at', { ascending: false })

      if (isCaregiver) {
        // Only tasks where this caregiver is assigned OR created by them
        // Supabase doesn't do OR across related tables easily; fetch all for linked elders
        // and filter client-side for assignment
        if (elderIds.length > 0) {
          query = query.in('elder_id', elderIds)
        } else {
          return []
        }
      }

      const { data, error } = await query
      if (error) throw error

      const all = (data ?? []) as Task[]

      // For caregivers: filter to only tasks they're assigned to or created
      if (isCaregiver) {
        return all.filter(
          (t) =>
            t.created_by === profile!.id ||
            t.assignments?.some((a) => a.caregiver_id === profile!.id)
        )
      }

      return all
    },
  })

  // ---- Mutations ----
  const addMutation = useMutation({
    mutationFn: async (values: TaskFormValues) => {
      const { data: inserted, error } = await supabase
        .from('tasks')
        .insert({
          title: values.title,
          description: values.description || null,
          elder_id: values.elder_id,
          due_date: values.due_date || null,
          priority: values.priority as TaskPriority,
          status: 'todo' as TaskStatus,
          created_by: profile!.id,
        })
        .select()
        .single()
      if (error) throw error

      const assigneeIds = values.assignee_ids ?? []
      if (assigneeIds.length > 0 && inserted) {
        const assignments = assigneeIds.map((cid) => ({
          task_id: (inserted as Task).id,
          caregiver_id: cid,
        }))
        const { error: assignError } = await supabase.from('task_assignments').insert(assignments)
        if (assignError) throw assignError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setShowAddModal(false)
    },
  })

  const editMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: TaskFormValues }) => {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: values.title,
          description: values.description || null,
          elder_id: values.elder_id,
          due_date: values.due_date || null,
          priority: values.priority as TaskPriority,
        })
        .eq('id', id)
      if (error) throw error

      // Replace assignments
      await supabase.from('task_assignments').delete().eq('task_id', id)
      const assigneeIds = values.assignee_ids ?? []
      if (assigneeIds.length > 0) {
        const assignments = assigneeIds.map((cid) => ({
          task_id: id,
          caregiver_id: cid,
        }))
        const { error: assignError } = await supabase.from('task_assignments').insert(assignments)
        if (assignError) throw assignError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setEditingTask(null)
    },
  })

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const { error } = await supabase.from('tasks').update({ status }).eq('id', id)
      if (error) throw error
    },
    onMutate: ({ id }) => setUpdatingIds((prev) => new Set([...prev, id])),
    onSettled: (_, __, { id }) =>
      setUpdatingIds((prev) => { const next = new Set(prev); next.delete(id); return next }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('task_assignments').delete().eq('task_id', id)
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: (id) => setDeletingIds((prev) => new Set([...prev, id])),
    onSettled: (_, __, id) =>
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(id); return next }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  // ---- Derived per-column tasks ----
  const tasksByStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status)

  // ---- Build edit default values ----
  const editDefaults = editingTask
    ? {
        title: editingTask.title,
        description: editingTask.description ?? '',
        elder_id: editingTask.elder_id,
        due_date: editingTask.due_date ?? '',
        priority: editingTask.priority,
        assignee_ids: editingTask.assignments?.map((a) => a.caregiver_id) ?? [],
      }
    : undefined

  // ---- Render ----
  if (!profile) return null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isAdmin ? 'All care tasks across the facility' : 'Tasks assigned to you'}
          </p>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => setShowAddModal(true)}
        >
          <Plus className="h-4 w-4" />
          Add Task
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 rounded-lg text-red-700 mb-4 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Failed to load tasks. Please try refreshing.</span>
        </div>
      )}

      {/* Board */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : tasks.length === 0 && !isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={ClipboardList}
            title="No tasks yet"
            description="Create your first task to get started."
            action={
              <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                Add Task
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 items-start">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.status}
              column={col}
              tasks={tasksByStatus(col.status)}
              onStatusChange={(task, status) => statusMutation.mutate({ id: task.id, status })}
              onDelete={(task) => deleteMutation.mutate(task.id)}
              onEdit={(task) => setEditingTask(task)}
              updatingIds={updatingIds}
              deletingIds={deletingIds}
            />
          ))}
        </div>
      )}

      {/* Add modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="New Task"
        size="lg"
      >
        <TaskForm
          elders={elders}
          caregivers={caregivers}
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
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        title="Edit Task"
        size="lg"
      >
        {editingTask && (
          <>
            <TaskForm
              elders={elders}
              caregivers={caregivers}
              defaultValues={editDefaults}
              onSubmit={(values) => editMutation.mutateAsync({ id: editingTask.id, values })}
              onCancel={() => setEditingTask(null)}
              isSubmitting={editMutation.isPending}
              submitLabel="Update Task"
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
