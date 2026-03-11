import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native'
import { Link, router } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'

export default function LoginScreen() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }

    setLoading(true)
    const { error } = await signIn(email.trim(), password)
    setLoading(false)

    if (error) {
      Alert.alert('Sign In Failed', error.message)
    } else {
      router.replace('/(tabs)/')
    }
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
        <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
          {/* Header */}
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <View style={{
              width: 64, height: 64, borderRadius: 16,
              backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', marginBottom: 16
            }}>
              <Text style={{ fontSize: 28 }}>❤️</Text>
            </View>
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 8 }}>
              CareScheduler
            </Text>
            <Text style={{ fontSize: 16, color: '#6b7280' }}>
              Sign in to your account
            </Text>
          </View>

          {/* Form */}
          <View style={{
            backgroundColor: 'white', borderRadius: 16,
            padding: 24, shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8,
            elevation: 4,
          }}>
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
                style={{
                  borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
                  paddingHorizontal: 12, paddingVertical: 10, fontSize: 16,
                  color: '#111827', backgroundColor: 'white',
                }}
              />
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 }}>
                Password
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                style={{
                  borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
                  paddingHorizontal: 12, paddingVertical: 10, fontSize: 16,
                  color: '#111827', backgroundColor: 'white',
                }}
              />
            </View>

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              style={{
                backgroundColor: loading ? '#93c5fd' : '#2563eb',
                borderRadius: 8, paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>
                  Sign In
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Register link */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
            <Text style={{ color: '#6b7280' }}>Don't have an account? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={{ color: '#2563eb', fontWeight: '600' }}>Sign up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
