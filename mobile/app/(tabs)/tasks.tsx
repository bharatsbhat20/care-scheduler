import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import type { Task, TaskStatus } from '../../../shared/types'

const statusLabels: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
}

const priorityColors: Record<string, string> = {
  low: '#16a34a',
  medium: '#d97706',
  high: '#dc2626',
}

const nextStatus: Record<TaskStatus, TaskStatus | null> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: null,
}

export default function TasksScreen() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all')
  const [refreshing, setRefreshing] = useState(false)

  const { data: tasks, refetch } = useQuery({
    queryKey: ['tasks', profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, assignments:task_assignments(*, caregiver:profiles(*))')
        .order('due_date', { ascending: true })
      if (error) throw error
      return data as Task[]
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: TaskStatus }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', taskId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (error) => Alert.alert('Error', error.message),
  })

  const onRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  const filteredTasks = filter === 'all'
    ? tasks ?? []
    : tasks?.filter(t => t.status === filter) ?? []

  const filterOptions: Array<{ label: string; value: TaskStatus | 'all' }> = [
    { label: 'All', value: 'all' },
    { label: 'To Do', value: 'todo' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Done', value: 'done' },
  ]

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 16 }}>
          Tasks
        </Text>

        {/* Filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {filterOptions.map(opt => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setFilter(opt.value)}
                style={{
                  paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                  backgroundColor: filter === opt.value ? '#2563eb' : 'white',
                  borderWidth: 1, borderColor: filter === opt.value ? '#2563eb' : '#e5e7eb',
                }}
              >
                <Text style={{
                  color: filter === opt.value ? 'white' : '#374151',
                  fontWeight: '600', fontSize: 14,
                }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {!tasks ? (
          <ActivityIndicator size="large" color="#2563eb" />
        ) : filteredTasks.length === 0 ? (
          <View style={{
            backgroundColor: 'white', borderRadius: 12, padding: 40,
            alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb',
          }}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>✅</Text>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 4 }}>
              No Tasks
            </Text>
            <Text style={{ color: '#6b7280', textAlign: 'center' }}>
              {filter === 'all' ? 'No tasks assigned yet.' : `No ${statusLabels[filter as TaskStatus]} tasks.`}
            </Text>
          </View>
        ) : (
          filteredTasks.map(task => (
            <View key={task.id} style={{
              backgroundColor: 'white', borderRadius: 12, padding: 16,
              marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb',
              borderLeftWidth: 4, borderLeftColor: priorityColors[task.priority],
              shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
            }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontWeight: '700', color: '#111827', fontSize: 16, flex: 1 }}>
                  {task.title}
                </Text>
                <View style={{
                  paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
                  backgroundColor: task.status === 'done' ? '#dcfce7' :
                    task.status === 'in_progress' ? '#dbeafe' : '#f3f4f6',
                }}>
                  <Text style={{
                    fontSize: 12, fontWeight: '600',
                    color: task.status === 'done' ? '#16a34a' :
                      task.status === 'in_progress' ? '#2563eb' : '#6b7280',
                  }}>
                    {statusLabels[task.status]}
                  </Text>
                </View>
              </View>

              {task.description && (
                <Text style={{ color: '#6b7280', fontSize: 14, marginBottom: 8 }}>
                  {task.description}
                </Text>
              )}

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{
                  paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
                  backgroundColor: priorityColors[task.priority] + '20',
                }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: priorityColors[task.priority] }}>
                    {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
                  </Text>
                </View>
                {task.due_date && (
                  <Text style={{ color: '#9ca3af', fontSize: 13 }}>
                    📅 {format(new Date(task.due_date), 'MMM d')}
                  </Text>
                )}
              </View>

              {/* Action button */}
              {task.status !== 'done' && nextStatus[task.status] && (
                <TouchableOpacity
                  onPress={() => updateStatusMutation.mutate({
                    taskId: task.id,
                    status: nextStatus[task.status]!,
                  })}
                  disabled={updateStatusMutation.isPending}
                  style={{
                    marginTop: 12, backgroundColor: '#2563eb', borderRadius: 8,
                    paddingVertical: 10, alignItems: 'center',
                  }}
                >
                  {updateStatusMutation.isPending ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>
                      {task.status === 'todo' ? 'Start Task →' : 'Mark Complete ✓'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
