<template>
  <div class="login-page">
    <div class="login-center">
      <div class="login-logo">
        <img src="/logo/mateclaw_logo_s.png" alt="MateClaw" class="logo-image" />
        <h1 class="logo-title">GL<span class="logo-title-highlight">Claw</span></h1>
      </div>
      <!-- <div class="login-header">
        <h1 class="header-main-title">欢迎登录</h1>
        <p class="header-sub-title">国利信安</p>
      </div> -->

      <form class="login-form" @submit.prevent="handleLogin">
        <div class="input-wrap">
          <label class="input-wrap-label">用户名</label>
          <input
            v-model="form.username"
            type="text"
            class="form-input"
            :placeholder="t('login.placeholders.username')"
            :aria-label="t('login.fields.username')"
            autocomplete="username"
          />
        </div>

        <div class="input-wrap">
          <label class="input-wrap-label">密码</label>
          <div class="input-wrap-passwd">
            <input
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              class="form-input form-input--has-eye"
              :placeholder="t('login.placeholders.password')"
              :aria-label="t('login.fields.password')"
              autocomplete="current-password"
            />
            <button type="button" class="eye-btn" @click="showPassword = !showPassword">
              <svg v-if="!showPassword" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="input-wrap">
          <label class="input-wrap-label">验证码</label>
          <div class="input-wrap-code">
            <input
              v-model="form.captchaCode"
              type="text"
              class="form-input"
              :placeholder="t('login.placeholders.code')"
              :aria-label="t('login.fields.code')"
              autocomplete="captchaCode"
            />
            <img :src="captchaImage" alt="验证码" @click="loadCaptcha">
          </div>
        </div>

        <!-- <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div> -->

        <button type="submit" class="login-btn" :disabled="loading">
          <span v-if="!loading">登 录</span>
          <span v-else class="loading-dots">
            <span></span><span></span><span></span>
          </span>
        </button>
      </form>

      <!-- <p class="login-hint" v-html="t('login.hint')"></p> -->
      <p class="login-hint">
        {{ errorMsg ? '登录失败' : '请输入用户名和密码登录' }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { authApi, modelApi } from '@/api/index'
import { ElNotification } from 'element-plus'
import { useWorkspaceStore } from '@/stores/useWorkspaceStore'

const router = useRouter()
const { t } = useI18n()
const workspaceStore = useWorkspaceStore()
const loading = ref(false)
const showPassword = ref(false)
const errorMsg = ref('')
const form = reactive({ username: '', password: '', captchaCode: '', captchaKey: '' })
const captchaImage = ref('')

const loadCaptcha = async () => {
  const res: any = await authApi.getCaptcha()
  form.captchaKey = res.data.captchaKey
  captchaImage.value = res.data.image
}

loadCaptcha()

async function handleLogin() {
  // if (!form.username || !form.password) return
  if (!form.username) {
    ElNotification({
      title: 'Error',
      message: '请输入用户名',
      type: 'error',
      position: 'bottom-right'
    })
    return
  }
  if (!form.password) {
    ElNotification({
      title: 'Error',
      message: '请输入密码',
      type: 'error',
      position: 'bottom-right'
    })
    return
  }
  if (!form.captchaCode) {
    ElNotification({
      title: 'Error',
      message: '请输入验证码',
      type: 'error',
      position: 'bottom-right'
    })
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    const res: any = await authApi.login(form)
    const data = res.data || res
    localStorage.setItem('token', data.token)
    localStorage.setItem('userId', String(data.id || '1'))
    localStorage.setItem('username', data.username || form.username)
    localStorage.setItem('role', data.role || 'user')
    if (data.clawAccessToken) {localStorage.setItem('clawAccessToken', data.clawAccessToken)}
    localStorage.setItem('workspace-id', data.workspaceId)
    await modelApi.syncModels()
    router.push('/')
    // Resolve capabilities before deciding the landing route so a viewer
    // lands on /chat (their only capability) and member+ on /dashboard.
    try {
      await workspaceStore.fetchWorkspaces()
    } catch {
      /* default-deny is fine; router guard will still steer */
    }
    const target = workspaceStore.can('view:dashboard') ? '/dashboard' : '/chat'
    router.push(target)
  } catch (e: any) {
    errorMsg.value = typeof e.message === 'string' ? e.message : t('login.failed')
    ElNotification({
      title: 'Error',
      message: errorMsg.value,
      type: 'error',
      position: 'bottom-right'
    })
    loadCaptcha()
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  /* background: linear-gradient(160deg, #FAF5F0 0%, #F5EDE5 100%); */
  padding: 24px;
}

:root.dark .login-page,
html.dark .login-page {
  /* background: linear-gradient(160deg, var(--mc-bg) 0%, #1A1210 100%); */
}

.login-center {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 40px;
  animation: fadeUp 0.6s ease-out both;
  background-color: #fff;
  padding: 48px;
  border-radius: 20px;
  box-shadow: var(--mc-shadow-soft);
}

/* Logo */
.login-logo {
  text-align: center;
}

.login-header {
  text-align: center;
}

.login-header .header-main-title {
  font-size: 28px;
  font-weight: 600;
  color: rgb(51, 51, 51);
  margin-bottom: 8px;
  letter-spacing: 2px;
}

.login-header .header-sub-title {
  color: rgb(26, 59, 102);
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 4px;
}

.logo-image {
  display: block;
  margin: 0 auto 16px;
  width: 100px;
  height: 100px;
  object-fit: contain;
  filter: drop-shadow(0 6px 20px rgba(217, 119, 87, 0.3));
  animation: breathe 3.5s ease-in-out infinite;
}

.logo-title {
  font-size: 36px;
  font-weight: 800;
  color: var(--mc-text-primary);
  margin: 0;
  letter-spacing: -0.04em;
}

.logo-title-highlight {
  color: var(--mc-primary);
}

/* Form */
.login-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input-wrap {
  display: flex;
  flex-direction: column;
}

.input-wrap .input-wrap-label {
  margin-bottom: 10px;
  color: rgb(51, 51, 51);
  font-weight: 500;
  font-size: 14px;
}


.input-wrap .input-wrap-passwd {
  position: relative;
}

.input-wrap .input-wrap-code {
  display: flex;
  gap: 12px;
}

.input-wrap .input-wrap-code img {
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid rgb(220, 220, 220);
  opacity: 1;
}

.form-input {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid rgb(220, 220, 220);
  border-radius: 12px;
  font-size: 15px;
  color: rgb(51, 51, 51);
  background: #fff;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}

.form-input--has-eye {
  padding-right: 44px;
}

.form-input:focus {
  border-color: rgb(29, 97, 184);
  background: #fff;
  box-shadow: rgba(29, 97, 184, 0.1) 0px 0px 0px 3px;
}

.eye-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  cursor: pointer;
  color: rgb(136, 136, 136);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.eye-btn:hover {
  color: rgb(29, 97, 184);
}

/* Error */
.error-msg {
  padding: 10px 14px;
  background: var(--mc-danger-bg);
  border: 1px solid var(--mc-danger);
  border-radius: 10px;
  font-size: 13px;
  color: var(--mc-danger);
}

/* Button */
.login-btn {
  width: 100%;
  padding: 12px;
  background: rgb(29, 97, 184);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  margin-top: 4px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(29, 97, 184, 0.3) 0px 4px 12px;
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Loading */
.loading-dots {
  display: flex;
  gap: 5px;
  align-items: center;
}

.loading-dots span {
  width: 6px;
  height: 6px;
  background: white;
  border-radius: 50%;
  animation: bounce 1.2s infinite;
}

.loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.loading-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-5px); }
}

/* Hint */
.login-hint {
  text-align: center;
  font-size: 13px;
  color: rgb(136, 136, 136);
  /* margin: 0; */
  /* opacity: 0.7; */
}

.login-hint :deep(code) {
  background: var(--mc-inline-code-bg);
  padding: 1px 6px;
  border-radius: 4px;
  color: var(--mc-inline-code-color);
  font-size: 12px;
}

/* Breathing animation */
@keyframes breathe {
  0%, 100% {
    transform: scale(1);
    filter: drop-shadow(0 6px 20px rgba(217, 119, 87, 0.3));
  }
  50% {
    transform: scale(1.06);
    filter: drop-shadow(0 8px 28px rgba(217, 119, 87, 0.45));
  }
}

/* Entrance animation */
@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Mobile */
@media (max-width: 480px) {
  .login-page {
    padding: 16px;
  }
}
</style>
