import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, Modal, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import type { MedicationSchedule, MedicationLog } from '../../../shared/types'

export default function MedicationsScreen() {
  const { profile, role } = useAuth()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const [logModalVisible, setLogModalVisible] = useState(false)
  const [selectedSchedule, setSelectedSchedule] = useState<MedicationSchedule | null>(null)
  const [logNotes, setLogNotes] = useState('')

  const { data: schedules, refetch } = useQuery({
    queryKey: ['medication-schedules', profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const query = supabase
        .from('medication_schedules')
        .select('*, medication:medications(*)')
        .eq('is_active', true)
      if (role === 'elder') {
        query.eq('elder_id', profile!.id)
      }
      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      return data as MedicationSchedule[]
    },
  })

  const { data: todayLogs } = useQuery({
    queryKey: ['medication-logs-today', profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd')
      const { data } = await supabase
        .from('medication_logs')
        .select('*')
        .gte('created_at', today)
        .eq(role === 'elder' ? 'elder_id' : 'logged_by', profile!.id)
      return data as MedicationLog[]
    },
  })

  const logDoseMutation = useMutation({
    mutationFn: async ({ schedule, status, notes }: {
      schedule: MedicationSchedule
      status: 'taken' | 'skipped'
      notes: string
    }) => {
      const { error } = await supabase.from('medication_logs').insert({
        schedule_id: schedule.id,
        elder_id: schedule.elder_id,
        medication_id: schedule.medication_id,
        scheduled_time: new Date().toISOString(),
        taken_at: status === 'taken' ? new Date().toISOString() : null,
        status,
        notes: notes || null,
        logged_by: profile!.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medication-logs-today'] })
      setLogModalVisible(false)
      setLogNotes('')
      Alert.alert('Success', 'Dose logged successfully')
    },
    onError: (error) => {
      Alert.alert('Error', error.message)
    },
  })

  const onRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  const handleLogDose = (schedule: MedicationSchedule) => {
    setSelectedSchedule(schedule)
    setLogModalVisible(true)
  }

  const isLoggedToday = (scheduleId: string) => {
    return todayLogs?.some(log => log.schedule_id === scheduleId && log.status === 'taken')
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 16 }}>
          Medications
        </Text>

        {!schedules ? (
          <ActivityIndicator size="large" color="#2563eb" />
        ) : schedules.length === 0 ? (
          <View style={{
            backgroundColor: 'white', borderRadius: 12, padding: 40,
            alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb',
          }}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>💊</Text>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 4 }}>
              No Medications
            </Text>
            <Text style={{ color: '#6b7280', textAlign: 'center' }}>
              No medication schedules found.
            </Text>
          </View>
        ) : (
          schedules.map(schedule => {
            const logged = isLoggedToday(schedule.id)
            return (
              <View key={schedule.id} style={{
                backgroundColor: 'white', borderRadius: 12, padding: 16,
                marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb',
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
                  <View style={{
                    width: 52, height: 52, borderRadius: 26,
                    backgroundColor: logged ? '#dcfce7' : '#eff6ff',
                    alignItems: 'center', justifyContent: 'center', marginRight: 12,
                  }}>
                    <Text style={{ fontSize: 24 }}>💊</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
                      {schedule.medication?.name}
                    </Text>
                    <Text style={{ color: '#6b7280', fontSize: 14 }}>
                      {schedule.medication?.dosage} {schedule.medication?.unit}
                    </Text>
                    {schedule.medication?.instructions && (
                      <Text style={{ color: '#9ca3af', fontSize: 13, marginTop: 2 }}>
                        {schedule.medication.instructions}
                      </Text>
                    )}
                  </View>
                  <View style={{
                    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
                    backgroundColor: logged ? '#dcfce7' : '#fef3c7',
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: logged ? '#16a34a' : '#d97706' }}>
                      {logged ? '✓ Taken' : 'Pending'}
                    </Text>
                  </View>
                </View>

                {/* Times */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {schedule.times.map((time, i) => (
                    <View key={i} style={{
                      paddingHorizontal: 10, paddingVertical: 4,
                      backgroundColor: '#f3f4f6', borderRadius: 8,
                    }}>
                      <Text style={{ fontSize: 13, color: '#374151', fontWeight: '500' }}>
                        🕐 {time}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Days */}
                <View style={{ flexDirection: 'row', gap: 4, marginBottom: 14 }}>
                  {dayNames.map((day, i) => (
                    <View key={i} style={{
                      width: 34, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: schedule.days_of_week.includes(i) ? '#dbeafe' : '#f3f4f6',
                    }}>
                      <Text style={{
                        fontSize: 11, fontWeight: schedule.days_of_week.includes(i) ? '700' : '400',
                        color: schedule.days_of_week.includes(i) ? '#2563eb' : '#9ca3af',
                      }}>
                        {day}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Log dose button */}
                {!logged && (
                  <TouchableOpacity
                    onPress={() => handleLogDose(schedule)}
                    style={{
                      backgroundColor: '#2563eb', borderRadius: 10,
                      paddingVertical: 14, alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
                      Mark as Taken
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          })
        )}
      </ScrollView>

      {/* Log dose modal */}
      <Modal
        visible={logModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setLogModalVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4 }}>
              Log Dose
            </Text>
            <Text style={{ color: '#6b7280', marginBottom: 20 }}>
              {selectedSchedule?.medication?.name} — {selectedSchedule?.medication?.dosage} {selectedSchedule?.medication?.unit}
            </Text>

            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>
              Notes (optional)
            </Text>
            <TextInput
              value={logNotes}
              onChangeText={setLogNotes}
              placeholder="Any notes about this dose..."
              multiline
              numberOfLines={3}
              style={{
                borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
                padding: 12, fontSize: 14, color: '#111827', marginBottom: 20,
                minHeight: 80, textAlignVertical: 'top',
              }}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  if (selectedSchedule) {
                    logDoseMutation.mutate({ schedule: selectedSchedule, status: 'skipped', notes: logNotes })
                  }
                }}
                style={{
                  flex: 1, backgroundColor: '#f3f4f6', borderRadius: 10,
                  paddingVertical: 14, alignItems: 'center',
                }}
              >
                <Text style={{ color: '#374151', fontWeight: '600' }}>Skip Dose</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (selectedSchedule) {
                    logDoseMutation.mutate({ schedule: selectedSchedule, status: 'taken', notes: logNotes })
                  }
                }}
                disabled={logDoseMutation.isPending}
                style={{
                  flex: 1, backgroundColor: '#2563eb', borderRadius: 10,
                  paddingVertical: 14, alignItems: 'center',
                }}
              >
                {logDoseMutation.isPending ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={{ color: 'white', fontWeight: '700' }}>Mark Taken ✓</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => { setLogModalVisible(false); setLogNotes('') }}
              style={{ marginTop: 12, alignItems: 'center', paddingVertical: 8 }}
            >
              <Text style={{ color: '#9ca3af' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
