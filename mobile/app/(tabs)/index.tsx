import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import type { MedicationSchedule, Appointment, Task } from '../../../shared/types'

export default function DashboardScreen() {
  const { profile, role } = useAuth()
  const [refreshing, setRefreshing] = useState(false)

  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const tomorrowStr = format(new Date(today.getTime() + 86400000 * 7), 'yyyy-MM-dd')

  const { data: medicationSchedules, refetch: refetchMeds } = useQuery({
    queryKey: ['dashboard-medications', profile?.id],
    enabled: !!profile && role !== 'family',
    queryFn: async () => {
      const query = supabase
        .from('medication_schedules')
        .select('*, medication:medications(*)')
        .eq('is_active', true)
      if (role === 'elder') {
        query.eq('elder_id', profile!.id)
      }
      const { data } = await query.limit(5)
      return data as MedicationSchedule[]
    },
  })

  const { data: appointments, refetch: refetchAppts } = useQuery({
    queryKey: ['dashboard-appointments', profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const query = supabase
        .from('appointments')
        .select('*')
        .gte('start_time', todayStr)
        .lte('start_time', tomorrowStr)
        .order('start_time', { ascending: true })
      if (role === 'elder') {
        query.eq('elder_id', profile!.id)
      }
      const { data } = await query.limit(5)
      return data as Appointment[]
    },
  })

  const { data: tasks, refetch: refetchTasks } = useQuery({
    queryKey: ['dashboard-tasks', profile?.id],
    enabled: !!profile && (role === 'caregiver' || role === 'admin'),
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .neq('status', 'done')
        .order('due_date', { ascending: true })
        .limit(5)
      return data as Task[]
    },
  })

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([refetchMeds(), refetchAppts(), refetchTasks()])
    setRefreshing(false)
  }

  const priorityColor = (priority: string) => {
    if (priority === 'high') return '#dc2626'
    if (priority === 'medium') return '#d97706'
    return '#16a34a'
  }

  const appointmentTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      medical: '#2563eb', therapy: '#7c3aed',
      family_visit: '#16a34a', activity: '#d97706', other: '#6b7280',
    }
    return colors[type] || '#6b7280'
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827' }}>
            Good {today.getHours() < 12 ? 'morning' : today.getHours() < 17 ? 'afternoon' : 'evening'},
          </Text>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#2563eb' }}>
            {profile?.full_name?.split(' ')[0] ?? 'there'}!
          </Text>
          <Text style={{ color: '#6b7280', marginTop: 4 }}>
            {format(today, 'EEEE, MMMM d, yyyy')}
          </Text>
        </View>

        {/* Medications section */}
        {role !== 'family' && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 12 }}>
              Today's Medications
            </Text>
            {!medicationSchedules ? (
              <ActivityIndicator color="#2563eb" />
            ) : medicationSchedules.length === 0 ? (
              <View style={{
                backgroundColor: 'white', borderRadius: 12, padding: 20,
                alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb',
              }}>
                <Text style={{ color: '#6b7280' }}>No medications scheduled</Text>
              </View>
            ) : (
              medicationSchedules.map(schedule => (
                <View key={schedule.id} style={{
                  backgroundColor: 'white', borderRadius: 12, padding: 16,
                  marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb',
                  flexDirection: 'row', alignItems: 'center',
                }}>
                  <View style={{
                    width: 44, height: 44, borderRadius: 22,
                    backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center',
                    marginRight: 12,
                  }}>
                    <Text style={{ fontSize: 20 }}>💊</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', color: '#111827', fontSize: 16 }}>
                      {schedule.medication?.name ?? 'Unknown'}
                    </Text>
                    <Text style={{ color: '#6b7280', fontSize: 14 }}>
                      {schedule.medication?.dosage} {schedule.medication?.unit}
                    </Text>
                    <Text style={{ color: '#6b7280', fontSize: 13 }}>
                      Times: {schedule.times.join(', ')}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Upcoming appointments */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 12 }}>
            Upcoming Appointments
          </Text>
          {!appointments ? (
            <ActivityIndicator color="#2563eb" />
          ) : appointments.length === 0 ? (
            <View style={{
              backgroundColor: 'white', borderRadius: 12, padding: 20,
              alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb',
            }}>
              <Text style={{ color: '#6b7280' }}>No upcoming appointments</Text>
            </View>
          ) : (
            appointments.map(appt => (
              <View key={appt.id} style={{
                backgroundColor: 'white', borderRadius: 12, padding: 16,
                marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb',
                borderLeftWidth: 4, borderLeftColor: appointmentTypeColor(appt.type),
              }}>
                <Text style={{ fontWeight: '600', color: '#111827', fontSize: 15 }}>
                  {appt.title}
                </Text>
                <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>
                  {format(new Date(appt.start_time), 'MMM d, h:mm a')}
                </Text>
                {appt.location && (
                  <Text style={{ color: '#9ca3af', fontSize: 13 }}>📍 {appt.location}</Text>
                )}
              </View>
            ))
          )}
        </View>

        {/* Tasks section (caregiver/admin) */}
        {(role === 'caregiver' || role === 'admin') && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 12 }}>
              Pending Tasks
            </Text>
            {!tasks ? (
              <ActivityIndicator color="#2563eb" />
            ) : tasks.length === 0 ? (
              <View style={{
                backgroundColor: 'white', borderRadius: 12, padding: 20,
                alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb',
              }}>
                <Text style={{ color: '#6b7280' }}>No pending tasks</Text>
              </View>
            ) : (
              tasks.map(task => (
                <View key={task.id} style={{
                  backgroundColor: 'white', borderRadius: 12, padding: 16,
                  marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb',
                  flexDirection: 'row', alignItems: 'center',
                }}>
                  <View style={{
                    width: 10, height: 10, borderRadius: 5,
                    backgroundColor: priorityColor(task.priority),
                    marginRight: 12,
                  }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', color: '#111827' }}>{task.title}</Text>
                    {task.due_date && (
                      <Text style={{ color: '#6b7280', fontSize: 13 }}>
                        Due: {format(new Date(task.due_date), 'MMM d')}
                      </Text>
                    )}
                  </View>
                  <View style={{
                    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
                    backgroundColor: task.status === 'todo' ? '#f3f4f6' : '#dbeafe',
                  }}>
                    <Text style={{ fontSize: 12, color: task.status === 'todo' ? '#6b7280' : '#2563eb' }}>
                      {task.status === 'todo' ? 'To Do' : 'In Progress'}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
