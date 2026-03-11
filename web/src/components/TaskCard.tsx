import { ArrowRight, CheckCircle2, Trash2, Pencil, Calendar, Users, ChevronLeft } from 'lucide-react'
import { format, isPast, isToday } from 'date-fns'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/hooks/useAuth'
import type { Task, TaskStatus, TaskPriority } from '../../../shared/types'

// ---------------------------------------------------------------------------
// Priority helpers
// ---------------------------------------------------------------------------
const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

type BadgeVariant = 'success' | 'warning' | 'danger'

const PRIORITY_BADGE_VARIANT: Record<TaskPriority, BadgeVariant> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
}

// ---------------------------------------------------------------------------
// Status transition helpers
// ---------------------------------------------------------------------------
const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
}

const NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  todo: 'in_progress',
  in_progress: 'done',
}

const PREV_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  in_progress: 'todo',
  done: 'in_progress',
}

// ---------------------------------------------------------------------------
// Avatar component for assignee
// ---------------------------------------------------------------------------
function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'xs' }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  const sizeClass = size === 'xs' ? 'w-6 h-6 text-xs' : 'w-7 h-7 text-xs'
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-primary-100 text-primary-700 font-semibold ${sizeClass} ring-2 ring-white`}
      title={name}
    >
      {initials}
    </span>
  )
}

// ---------------------------------------------------------------------------
// TaskCard props
// ---------------------------------------------------------------------------
export interface TaskCardProps {
  task: Task
  onStatusChange: (newStatus: TaskStatus) => void
  onDelete: () => void
  onEdit?: () => void
  isUpdating?: boolean
  isDeleting?: boolean
}

// ---------------------------------------------------------------------------
// TaskCard component
// ---------------------------------------------------------------------------
export function TaskCard({
  task,
  onStatusChange,
  onDelete,
  onEdit,
  isUpdating = false,
  isDeleting = false,
}: TaskCardProps) {
  const { role, profile } = useAuth()
  const canModify = role === 'admin' || role === 'caregiver'
  // caregivers can only edit/delete tasks they created or are assigned to
  const isAssigned = task.assignments?.some((a) => a.caregiver_id === profile?.id) ?? false
  const isCreator = task.created_by === profile?.id
  const hasEditPermission = role === 'admin' || isCreator || isAssigned

  const nextStatus = NEXT_STATUS[task.status]
  const prevStatus = PREV_STATUS[task.status]

  // Due date styling
  const dueDateEl = task.due_date ? (() => {
    const d = new Date(task.due_date)
    const overdue = isPast(d) && !isToday(d) && task.status !== 'done'
    const todayDue = isToday(d) && task.status !== 'done'
    return (
      <div
        className={`flex items-center gap-1 text-xs ${
          overdue ? 'text-red-600 font-medium' : todayDue ? 'text-amber-600 font-medium' : 'text-gray-400'
        }`}
      >
        <Calendar className="h-3 w-3 flex-shrink-0" />
        <span>{overdue ? 'Overdue · ' : todayDue ? 'Today · ' : ''}{format(d, 'MMM d, yyyy')}</span>
      </div>
    )
  })() : null

  const assignees = task.assignments ?? []

  return (
    <div
      className={`card p-4 flex flex-col gap-3 transition-opacity ${
        isUpdating || isDeleting ? 'opacity-60 pointer-events-none' : ''
      }`}
    >
      {/* Header row: priority badge + done check */}
      <div className="flex items-start justify-between gap-2">
        <Badge variant={PRIORITY_BADGE_VARIANT[task.priority]}>
          {PRIORITY_LABELS[task.priority]}
        </Badge>
        {task.status === 'done' && (
          <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
        )}
      </div>

      {/* Title */}
      <div>
        <h3
          className={`text-sm font-semibold text-gray-900 leading-snug ${
            task.status === 'done' ? 'line-through text-gray-400' : ''
          }`}
        >
          {task.title}
        </h3>
        {task.description && (
          <p className="mt-1 text-xs text-gray-500 line-clamp-2">{task.description}</p>
        )}
      </div>

      {/* Due date */}
      {dueDateEl}

      {/* Elder */}
      {task.elder && (
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Users className="h-3 w-3 flex-shrink-0" />
          <span>{task.elder.full_name}</span>
        </div>
      )}

      {/* Assignees */}
      {assignees.length > 0 && (
        <div className="flex items-center gap-1">
          <div className="flex -space-x-1">
            {assignees.slice(0, 4).map((a) => (
              <Avatar key={a.id} name={a.caregiver?.full_name ?? 'C'} size="xs" />
            ))}
            {assignees.length > 4 && (
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs ring-2 ring-white">
                +{assignees.length - 4}
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400 ml-1">
            {assignees.length === 1 ? assignees[0].caregiver?.full_name : `${assignees.length} assigned`}
          </span>
        </div>
      )}

      {/* Action row */}
      {canModify && (
        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
          {/* Status movement */}
          <div className="flex gap-1">
            {prevStatus && (
              <button
                onClick={() => onStatusChange(prevStatus)}
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors px-1.5 py-1 rounded hover:bg-gray-50"
                title={`Move to ${STATUS_LABELS[prevStatus]}`}
                disabled={isUpdating}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {STATUS_LABELS[prevStatus]}
              </button>
            )}
            {nextStatus && (
              <button
                onClick={() => onStatusChange(nextStatus)}
                className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium transition-colors px-1.5 py-1 rounded hover:bg-primary-50"
                title={`Move to ${STATUS_LABELS[nextStatus]}`}
                disabled={isUpdating}
              >
                {STATUS_LABELS[nextStatus]}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Edit / Delete */}
          {hasEditPermission && (
            <div className="flex gap-1">
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Edit task"
                  disabled={isUpdating || isDeleting}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={onDelete}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Delete task"
                disabled={isDeleting || isUpdating}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
