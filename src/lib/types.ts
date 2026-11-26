import type { Database } from './database.types'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']
export type Entry = Database['public']['Tables']['entries']['Row']
export type Visibility = 'public' | 'followers' | 'private'
