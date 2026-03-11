import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native'
import { Link, router } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import type { UserRole } from '../../../shared/types'

const roles: { value: UserRole; label: string; description: string }[] = [
  { value: 'elder', label: 'Elder', description: 'I am receiving care' },
  { value: 'caregiver', label: 'Caregiver', description: 'I provide care' },
  { value: 'family', label: 'Family', description: 'I monitor a loved one' },
]

export default function RegisterScreen() {
  const { signUp } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('elder')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters')
      return
    }

    setLoading(true)
    const { error } = await signUp(email.trim(), password, fullName.trim(), role)
    setLoading(false)

    if (error) {
      Alert.alert('Registration Failed', error.message)
    } else {
      Alert.alert(
        'Account Created',
        'Please check your email to confirm your account.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      )
    }
  }

  const inputStyle = {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16,
    color: '#111827', backgroundColor: 'white',
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: '#f9fafb' }}
      >
        <View style={{ padding: 24, paddingTop: 60 }}>
          {/* Header */}
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 8 }}>
            Create Account
          </Text>
          <Text style={{ fontSize: 16, color: '#6b7280', marginBottom: 32 }}>
            Join CareScheduler today
          </Text>

          {/* Form */}
          <View style={{
            backgroundColor: 'white', borderRadius: 16, padding: 24,
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
          }}>
            {/* Full name */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 }}>
                Full Name
              </Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="John Doe"
                autoCapitalize="words"
                style={inputStyle}
              />
            </View>

            {/* Email */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 }}>
                Email
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={inputStyle}
              />
            </View>

            {/* Password */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 }}>
                Password
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Min. 6 characters"
                secureTextEntry
                style={inputStyle}
              />
            </View>

            {/* Role selection */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 10 }}>
                I am a...
              </Text>
              <View style={{ gap: 8 }}>
                {roles.map(r => (
                  <TouchableOpacity
                    key={r.value}
                    onPress={() => setRole(r.value)}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      borderWidth: 2,
                      borderColor: role === r.value ? '#2563eb' : '#e5e7eb',
                      borderRadius: 8, padding: 12,
                      backgroundColor: role === r.value ? '#eff6ff' : 'white',
                    }}
                  >
                    <View style={{
                      width: 20, height: 20, borderRadius: 10,
                      borderWidth: 2,
                      borderColor: role === r.value ? '#2563eb' : '#d1d5db',
                      alignItems: 'center', justifyContent: 'center', marginRight: 12,
                    }}>
                      {role === r.value && (
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563eb' }} />
                      )}
                    </View>
                    <View>
                      <Text style={{ fontWeight: '600', color: '#111827', fontSize: 15 }}>{r.label}</Text>
                      <Text style={{ color: '#6b7280', fontSize: 13 }}>{r.description}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              onPress={handleRegister}
              disabled={loading}
              style={{
                backgroundColor: loading ? '#93c5fd' : '#2563eb',
                borderRadius: 8, paddingVertical: 14, alignItems: 'center',
              }}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>
                  Create Account
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Login link */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
            <Text style={{ color: '#6b7280' }}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={{ color: '#2563eb', fontWeight: '600' }}>Sign in</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
