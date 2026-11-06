<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { authApi } from '@/api'
import { useProjectStore } from '@/stores/useProjectStore'

const router = useRouter()
const route = useRoute()
const projectStore = useProjectStore()
const error = ref('')

onMounted(async () => {
  const platformToken = route.query.platform_token as string
  const redirect = sanitizeRedirect(route.query.redirect as string)
  
  if (!platformToken) {
    error.value = '缺少平台令牌，无法完成登录'
    return
  }

  try {
    const res = await authApi.noPassLogin({ platformToken })
    const data = res.data || res
    localStorage.setItem('token', data.token)
    localStorage.setItem('userId', String(data.id || '1'))
    localStorage.setItem('username', data.username)
    localStorage.setItem('role', data.role || 'user')
    if (data.clawAccessToken) {localStorage.setItem('clawAccessToken', data.clawAccessToken)}
    try {
      await projectStore.fetchProjects()
      await router.replace(redirect)
    } catch {
      /* project listing is best-effort */
    }
  } catch (e: any) {
    error.value = e?.message || '门户免密登录失败，请返回门户重试'
  }
})

function sanitizeRedirect(raw?: string) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/chat'
  return raw
}
</script>