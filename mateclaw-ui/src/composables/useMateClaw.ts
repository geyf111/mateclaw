import type { MateClawAPI } from '@/types/mateClaw'

export function useMateClaw(): { api: MateClawAPI | undefined; isElectron: boolean } {
  const api = typeof window !== 'undefined' ? window.mateClawAPI : undefined
  return { api, isElectron: !!api }
}