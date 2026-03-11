import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import type { Profile } from '../../../shared/types'

/**
 * Returns the list of elder profiles accessible to the current user.
 * - Admin/Caregiver: all elders (or assigned elders)
 * - Elder: just themselves
 * - Family: linked elders
 */
export function useElders() {
  const { profile, role } = useAuth()

  return useQuery({
    queryKey: ['elders', profile?.id, role],
    enabled: !!profile,
    queryFn: async () => {
      if (role === 'elder') {
        return [profile] as Profile[]
      }

      if (role === 'admin') {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'elder')
        return (data ?? []) as Profile[]
      }

      if (role === 'caregiver') {
        const { data: assignments } = await supabase
          .from('caregiver_elder_assignments')
          .select('elder:profiles!elder_id(*)')
          .eq('caregiver_id', profile!.id)
        return (assignments?.map(a => a.elder) ?? []) as unknown as Profile[]
      }

      if (role === 'family') {
        const { data: links } = await supabase
          .from('family_elder_links')
          .select('elder:profiles!elder_id(*)')
          .eq('family_id', profile!.id)
        return (links?.map(l => l.elder) ?? []) as unknown as Profile[]
      }

      return []
    },
  })
}
