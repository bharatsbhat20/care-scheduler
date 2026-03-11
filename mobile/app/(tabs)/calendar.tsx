import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Calendar } from 'react-native-calendars'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { format, isSameDay, parseISO } from 'date-fns'
import type { Appointment } from '../../../shared/types'

const typeColors: Record<string, string> = {
  medical: '#2563eb',
  therapy: '#7c3aed',
  family_visit: '#16a34a',
  activity: '#d97706',
  other: '#6b7280',
}

const typeLabels: Record<string, string> = {
  medical: 'Medical',
  therapy: 'Therapy',
  family_visit: 'Family Visit',
  activity: 'Activity',
  other: 'Other',
}

export default function CalendarScreen() {
  const { profile, role } = useAuth()
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [refreshing, setRefreshing] = useState(false)

  const { data: appointments, refetch } = useQuery({
    queryKey: ['appointments', profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const query = supabase
        .from('appointments')
        .select('*')
        .order('start_time', { ascending: true })
      if (role === 'elder') {
        query.eq('elder_id', profile!.id)
      }
      const { data, error } = await query
      if (error) throw error
      return data as Appointment[]
    },
  })

  const onRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  // Build marked dates for the calendar
  const markedDates: Record<string, { marked: boolean; dotColor: string }> = {}
  appointments?.forEach(appt => {
    const dateStr = format(parseISO(appt.start_time), 'yyyy-MM-dd')
    markedDates[dateStr] = { marked: true, dotColor: typeColors[appt.type] || '#6b7280' }
  })
  if (selectedDate) {
    markedDates[selectedDate] = {
      ...(markedDates[selectedDate] ?? {}),
      marked: !!(markedDates[selectedDate]),
      dotColor: markedDates[selectedDate]?.dotColor ?? '#6b7280',
      // @ts-ignore
      selected: true,
      selectedColor: '#2563eb',
    }
  }

  const selectedAppointments = appointments?.filter(appt =>
    isSameDay(parseISO(appt.start_time), parseISO(selectedDate))
  ) ?? []

  const upcomingAppointments = appointments?.filter(appt =>
    parseISO(appt.start_time) >= new Date()
  ).slice(0, 10) ?? []

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 16 }}>
            Calendar
          </Text>
        </View>

        {/* Calendar strip */}
        <Calendar
          current={selectedDate}
          onDayPress={(day: { dateString: string }) => setSelectedDate(day.dateString)}
          markedDates={markedDates}
          theme={{
            backgroundColor: 'white',
            calendarBackground: 'white',
            selectedDayBackgroundColor: '#2563eb',
            selectedDayTextColor: 'white',
            todayTextColor: '#2563eb',
            dayTextColor: '#111827',
            textDisabledColor: '#d1d5db',
            dotColor: '#2563eb',
            arrowColor: '#2563eb',
            monthTextColor: '#111827',
            textDayFontWeight: '500',
            textMonthFontWeight: '700',
          }}
          style={{
            borderBottomWidth: 1,
            borderBottomColor: '#e5e7eb',
          }}
        />

        <View style={{ padding: 16 }}>
          {/* Selected date appointments */}
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 }}>
            {format(parseISO(selectedDate), 'EEEE, MMMM d')}
          </Text>

          {!appointments ? (
            <ActivityIndicator color="#2563eb" />
          ) : selectedAppointments.length === 0 ? (
            <View style={{
              backgroundColor: 'white', borderRadius: 12, padding: 24,
              alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 24,
            }}>
              <Text style={{ color: '#6b7280' }}>No appointments on this day</Text>
            </View>
          ) : (
            selectedAppointments.map(appt => (
              <AppointmentItem key={appt.id} appointment={appt} />
            ))
          )}

          {/* Upcoming appointments */}
          {upcomingAppointments.length > 0 && (
            <>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12, marginTop: 8 }}>
                Upcoming
              </Text>
              {upcomingAppointments.map(appt => (
                <AppointmentItem key={appt.id} appointment={appt} showDate />
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function AppointmentItem({ appointment: appt, showDate = false }: { appointment: Appointment; showDate?: boolean }) {
  const color = typeColors[appt.type] || '#6b7280'
  return (
    <View style={{
      backgroundColor: 'white', borderRadius: 12, padding: 14,
      marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb',
      borderLeftWidth: 4, borderLeftColor: color,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '600', color: '#111827', fontSize: 15 }}>{appt.title}</Text>
          {showDate && (
            <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>
              {format(new Date(appt.start_time), 'MMM d')} · {format(new Date(appt.start_time), 'h:mm a')}
            </Text>
          )}
          {!showDate && (
            <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>
              {format(new Date(appt.start_time), 'h:mm a')} — {format(new Date(appt.end_time), 'h:mm a')}
            </Text>
          )}
          {appt.location && (
            <Text style={{ color: '#9ca3af', fontSize: 13, marginTop: 2 }}>📍 {appt.location}</Text>
          )}
        </View>
        <View style={{
          paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
          backgroundColor: color + '20',
        }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color }}>
            {typeLabels[appt.type] ?? appt.type}
          </Text>
        </View>
      </View>
    </View>
  )
}
