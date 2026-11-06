import { ref, computed } from 'vue'
import { http } from '@/api/index'

export interface CreditAccount {
  enabled: boolean
  available: boolean
  remainCredit: number
  usedCredit: number
  totalCredit: number
  message?: string
  fetchedAt: string
}

const creditAccount = ref<CreditAccount | null>(null)
const loading = ref(false)
let pollingTimer: ReturnType<typeof setInterval> | null = null

export function useCredit() {
  const isEnabled = computed(() => creditAccount.value?.enabled === true)
  const isAvailable = computed(() => creditAccount.value?.available === true)
  const fetchedAtLabel = computed(() => {
    const t = creditAccount.value?.fetchedAt
    if (!t) return ''
    const d = new Date(t)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  })

  const remainCredit = computed(() => creditAccount.value?.remainCredit ?? 0)
  const creditInsufficient = computed(() => {
    if (!creditAccount.value) return false
    if (!creditAccount.value.enabled) return false
    if (!creditAccount.value.available) return false
    return creditAccount.value.remainCredit <= 0
  })

  async function fetchCreditAccount(): Promise<void> {
    loading.value = true
    try {
      const res: any = await http.get('/credit/account')
      creditAccount.value = (res?.data ?? res) as CreditAccount
    } catch {
      // 接口不存在或未登录时静默失败，保持 null
    } finally {
      loading.value = false
    }
  }

  function startPolling(intervalMs = 45000) {
    stopPolling()
    fetchCreditAccount()
    pollingTimer = setInterval(fetchCreditAccount, intervalMs)
  }

  function stopPolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer)
      pollingTimer = null
    }
  }

  return {
    creditAccount,
    loading,
    isEnabled,
    isAvailable,
    fetchedAtLabel,
    remainCredit,
    creditInsufficient,
    fetchCreditAccount,
    startPolling,
    stopPolling,
  }
}