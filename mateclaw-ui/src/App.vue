<template>
  <el-config-provider :locale="elementLocale">
    <div class="app-root" :class="{ 'electron-titlebar-offset': !isElectron }">
      <TitleBar v-if="!isElectron" />
      <router-view :style="{ height: !isElectron ? 'calc(100vh - 32px)' : '100vh' }" />
    </div>
    <McConfirmHost />
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import en from 'element-plus/es/locale/lang/en'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { currentLocale } from '@/i18n'
import { useThemeStore } from '@/stores/useThemeStore'
import { useMateClaw } from '@/composables/useMateClaw'
import McConfirmHost from '@/components/common/McConfirmHost.vue'
import TitleBar from '@/components/common/TitleBar.vue'

useThemeStore()

const { t } = useI18n()
const { isElectron } = useMateClaw()

watchEffect(() => {
  document.title = t('app.title')
})

const elementLocale = computed(() => (currentLocale.value === 'en-US' ? en : zhCn))
</script>

<style>
.app-root {
  height: 100vh;
}

.electron-titlebar-offset {
  padding-top: 32px;
}
</style>