import { Globe, Lock, Users } from 'lucide-react'
import type { Visibility } from '../../lib/types'

export const VISIBILITY: { value: Visibility; label: string; hint: string; icon: typeof Globe }[] = [
  { value: 'public', label: 'Pública', hint: 'Cualquier persona con cuenta', icon: Globe },
  { value: 'followers', label: 'Solo seguidores', hint: 'Quien te siga', icon: Users },
  { value: 'private', label: 'Solo yo', hint: 'Nadie más la ve', icon: Lock },
]

export const visibilityInfo = (v: string) => VISIBILITY.find((x) => x.value === v) ?? VISIBILITY[2]!
