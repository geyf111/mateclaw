<script setup lang="ts">
import { ref } from 'vue'
import { useMateClaw } from '@/composables/useMateClaw'
import { useI18n } from 'vue-i18n'

const { api } = useMateClaw()
const { t } = useI18n()

const showHelpMenu = ref(false)

const helpMenuItems = [
  { label: '关于 GLClaw', action: 'about' as const },
  { label: '检查更新...', action: 'checkUpdates' as const },
  { type: 'separator' as const },
  { label: 'GitHub 仓库', action: 'github' as const },
  { label: '反馈问题', action: 'reportIssue' as const },
]

function handleHelpAction(item: typeof helpMenuItems[number]) {
  showHelpMenu.value = false
  if (!api || item.type === 'separator') return

  switch (item.action) {
    case 'about':
      api.showAbout()
      break
    case 'checkUpdates':
      api.checkUpdates()
      break
    case 'github':
      api.openGitHub()
      break
    case 'reportIssue':
      api.reportIssue()
      break
  }
}

function toggleHelpMenu() {
  showHelpMenu.value = !showHelpMenu.value
}

function handleBlur() {
  setTimeout(() => { showHelpMenu.value = false }, 150)
}
</script>

<template>
  <div class="title-bar">
    <div class="title-bar-left">
      <img class="app-icon" src="/logo/mateclaw_logo_s.png" :alt="t('app.title')" />
      <span class="app-title">{{ t('app.title') }}</span>
    </div>
    <div class="title-bar-right">
      <div class="help-menu-container">
        <button
          class="title-bar-btn help-btn"
          @click.stop="toggleHelpMenu"
          @blur="handleBlur"
          title="帮助"
        >
          <span>帮助</span>
        </button>
        <Transition name="menu-fade">
          <div v-if="showHelpMenu" class="help-dropdown">
            <template v-for="(item, idx) in helpMenuItems" :key="idx">
              <div v-if="item.type === 'separator'" class="dropdown-separator" />
              <button
                v-else
                class="dropdown-item"
                @click.stop="handleHelpAction(item)"
              >
                {{ item.label }}
              </button>
            </template>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.title-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  height: 32px;
  background: var(--mc-bg, #f5f5f5);
  padding: 0 12px;
  user-select: none;
  -webkit-app-region: drag;
  flex-shrink: 0;
  font-size: 12px;
  font-family: "Segoe UI", system-ui, sans-serif;
  color: var(--mc-text-primary, #333);
  font-weight: 400;
}

.title-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.app-title {
  white-space: nowrap;
}

.title-bar-right {
  display: flex;
  align-items: center;
  -webkit-app-region: no-drag;
  padding: 0 138px 0 8px;
}

.title-bar-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: background 0.15s;
}

.title-bar-btn:hover {
  background: var(--mc-sidebar-hover, rgba(0, 0, 0, 0.08));
}

.help-menu-container {
  position: relative;
}

.help-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 160px;
  background: var(--mc-panel-top, #fff);
  border: 1px solid var(--mc-border-light, #e0e0e0);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  z-index: 9999;
  padding: 4px 0;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 7px 16px;
  border: none;
  background: transparent;
  font-size: 13px;
  color: var(--mc-text-primary, #333);
  text-align: left;
  cursor: pointer;
  transition: background 0.1s;
}

.dropdown-item:hover {
  background: var(--mc-sidebar-hover, #f0f0f0);
}

.dropdown-separator {
  height: 1px;
  background: var(--mc-border-light, #e8e8e8);
  margin: 4px 8px;
}

.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}

.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>