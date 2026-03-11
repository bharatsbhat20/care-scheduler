import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Switch, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { NotificationPrefs } from '../../../shared/types'

const roleLabels: Record<string, string> = {
  elder: 'Elder',
  caregiver: 'Caregiver',
  family: 'Family Member',
  admin: 'Administrator',
}

const roleColors: Record<string, string> = {
  elder: '#7c3aed',
  caregiver: '#2563eb',
  family: '#16a34a',
  admin: '#dc2626',
}

export default function ProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')

  const { data: notifPrefs, refetch: refetchPrefs } = useQuery({
    queryKey: ['notification-prefs', profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data } = await supabase
        .from('notification_prefs')
        .select('*')
        .eq('user_id', profile!.id)
        .single()
      return data as NotificationPrefs | null
    },
  })

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim(), phone: phone.trim() || null })
        .eq('id', profile!.id)
      if (error) throw error
    },
    onSuccess: async () => {
      await refreshProfile()
      setEditing(false)
      Alert.alert('Success', 'Profile updated')
    },
    onError: (error) => Alert.alert('Error', error.message),
  })

  const updateNotifMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPrefs>) => {
      if (notifPrefs) {
        const { error } = await supabase
          .from('notification_prefs')
          .update(updates)
          .eq('id', notifPrefs.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('notification_prefs')
          .insert({ user_id: profile!.id, ...updates })
        if (error) throw error
      }
    },
    onSuccess: () => refetchPrefs(),
  })

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ])
  }

  const inputStyle = {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16,
    color: '#111827', backgroundColor: 'white', marginBottom: 12,
  }

  if (!profile) return null

  const roleColor = roleColors[profile.role] || '#6b7280'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 24 }}>
          Profile
        </Text>

        {/* Avatar + role */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: roleColor + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
          }}>
            <Text style={{ fontSize: 32, fontWeight: '700', color: roleColor }}>
              {profile.full_name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{
            paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12,
            backgroundColor: roleColor + '20',
          }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: roleColor }}>
              {roleLabels[profile.role] || profile.role}
            </Text>
          </View>
        </View>

        {/* Profile info */}
        <View style={{
          backgroundColor: 'white', borderRadius: 16, padding: 20,
          marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb',
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>
              Personal Info
            </Text>
            {!editing ? (
              <TouchableOpacity onPress={() => {
                setFullName(profile.full_name)
                setPhone(profile.phone ?? '')
                setEditing(true)
              }}>
                <Text style={{ color: '#2563eb', fontWeight: '600' }}>Edit</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setEditing(false)}>
                <Text style={{ color: '#6b7280' }}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>

          {editing ? (
            <>
              <Text style={{ fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 }}>Full Name</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                style={inputStyle}
                autoCapitalize="words"
              />
              <Text style={{ fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 }}>Phone</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                style={inputStyle}
                keyboardType="phone-pad"
                placeholder="+1 (555) 000-0000"
              />
              <TouchableOpacity
                onPress={() => updateProfileMutation.mutate()}
                disabled={updateProfileMutation.isPending}
                style={{
                  backgroundColor: '#2563eb', borderRadius: 8,
                  paddingVertical: 12, alignItems: 'center',
                }}
              >
                {updateProfileMutation.isPending ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={{ color: 'white', fontWeight: '600' }}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <InfoRow label="Full Name" value={profile.full_name} />
              <InfoRow label="Phone" value={profile.phone || 'Not set'} />
              <InfoRow label="Role" value={roleLabels[profile.role] || profile.role} />
            </>
          )}
        </View>

        {/* Notification preferences */}
        <View style={{
          backgroundColor: 'white', borderRadius: 16, padding: 20,
          marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb',
        }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 16 }}>
            Notifications
          </Text>

          <NotifToggle
            label="Medication Reminders"
            value={notifPrefs?.medication_reminders ?? true}
            onChange={(val) => updateNotifMutation.mutate({ medication_reminders: val })}
          />
          <NotifToggle
            label="Appointment Reminders"
            value={notifPrefs?.appointment_reminders ?? true}
            onChange={(val) => updateNotifMutation.mutate({ appointment_reminders: val })}
          />
          <NotifToggle
            label="Task Updates"
            value={notifPrefs?.task_updates ?? true}
            onChange={(val) => updateNotifMutation.mutate({ task_updates: val })}
          />
          <NotifToggle
            label="Family Updates"
            value={notifPrefs?.family_updates ?? true}
            onChange={(val) => updateNotifMutation.mutate({ family_updates: val })}
            isLast
          />
        </View>

        {/* Sign out */}
        <TouchableOpacity
          onPress={handleSignOut}
          style={{
            backgroundColor: 'white', borderRadius: 12, padding: 16,
            borderWidth: 1, borderColor: '#fecaca', alignItems: 'center', marginBottom: 32,
          }}
        >
          <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 16 }}>
            Sign Out
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
      <Text style={{ color: '#6b7280', fontSize: 14 }}>{label}</Text>
      <Text style={{ color: '#111827', fontSize: 14, fontWeight: '500' }}>{value}</Text>
    </View>
  )
}

function NotifToggle({ label, value, onChange, isLast = false }: {
  label: string; value: boolean; onChange: (val: boolean) => void; isLast?: boolean
}) {
  return (
    <View style={{
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: isLast ? 0 : 1,
      borderBottomColor: '#f3f4f6',
    }}>
      <Text style={{ color: '#111827', fontSize: 15 }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#e5e7eb', true: '#bfdbfe' }}
        thumbColor={value ? '#2563eb' : '#9ca3af'}
      />
    </View>
  )
}
