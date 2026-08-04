<template>
  <div class="project-switcher" :class="{ collapsed }">
    <button
      ref="triggerRef"
      class="ps-trigger"
      :title="collapsed ? currentLabel : ''"
      @click="toggleOpen"
    >
      <span class="ps-trigger__icon">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
      </span>
      <template v-if="!collapsed">
        <span class="ps-trigger__name">{{ currentLabel }}</span>
        <svg class="ps-trigger__arrow" :class="{ open }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </template>
    </button>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="open" class="ps-backdrop" @click="open = false"></div>
      </Transition>
      <Transition name="ps-dropdown">
        <div v-if="open" class="ps-dropdown" :class="{ 'ps-dropdown--collapsed': collapsed }" :style="dropdownStyle">
          <div
            v-for="proj in projects"
            :key="proj.id"
            class="ps-item"
            :class="{ active: String(proj.id) === String(currentProjectId) }"
            @click="onSelect(proj.id)"
          >
            <svg class="ps-item__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span class="ps-item__name">{{ proj.name }}</span>
            <svg v-if="String(proj.id) === String(currentProjectId)" class="ps-item__check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useProjectStore } from '@/stores/useProjectStore'

const props = defineProps<{
  collapsed?: boolean
}>()

const store = useProjectStore()
const open = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const dropdownPos = ref({ top: 0, left: 0 })

const dropdownStyle = computed(() => ({
  position: 'fixed' as const,
  top: `${dropdownPos.value.top}px`,
  left: `${dropdownPos.value.left}px`,
  right: 'auto',
  width: props.collapsed ? '200px' : '212px',
}))

function toggleOpen() {
  open.value = !open.value
  if (open.value && triggerRef.value) {
    nextTick(() => {
      const triggerRect = triggerRef.value!.getBoundingClientRect()
      if (props.collapsed) {
        const sidebar = triggerRef.value!.closest('.sidebar')
        const sidebarRight = sidebar ? sidebar.getBoundingClientRect().right : triggerRect.right
        dropdownPos.value = {
          top: triggerRect.top,
          left: sidebarRight + 6,
        }
      } else {
        dropdownPos.value = {
          top: triggerRect.bottom + 4,
          left: triggerRect.left,
        }
      }
    })
  }
}

const projects = computed(() => store.projects)
const currentProjectId = computed(() => store.currentProjectId)
const currentLabel = computed(() => store.currentProject?.name || 'Project')

onMounted(() => {
  store.fetchProjects()
})

function onSelect(id: string | number) {
  open.value = false
  store.switchProject(id)
}
</script>

<style scoped>
.project-switcher {
  padding: 8px 12px;
  position: relative;
}

.project-switcher.collapsed {
  padding: 8px 6px;
  display: flex;
  justify-content: center;
}

.ps-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--mc-sidebar-border, var(--mc-border-light));
  border-radius: 12px;
  background: var(--mc-sidebar-hover, rgba(0,0,0,0.04));
  color: var(--mc-sidebar-text, var(--mc-text-primary));
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s;
}

.ps-trigger:hover {
  background: var(--mc-sidebar-active, rgba(0,0,0,0.06));
  border-color: var(--mc-primary, #d96d46);
}

.collapsed .ps-trigger {
  width: 36px;
  height: 36px;
  padding: 0;
  justify-content: center;
  border-radius: 10px;
}

.ps-trigger__icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  color: var(--mc-accent, var(--mc-primary));
}

.ps-trigger__name {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: -0.01em;
}

.ps-trigger__arrow {
  flex-shrink: 0;
  color: var(--mc-sidebar-text, var(--mc-text-tertiary));
  opacity: 0.5;
  transition: transform 0.2s;
}

.ps-trigger__arrow.open {
  transform: rotate(180deg);
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.ps-dropdown-leave-to { opacity: 0; transform: translateY(-4px) scale(0.98); }
</style>

<style>
.ps-backdrop {
  position: fixed;
  inset: 0;
  z-index: 199;
}

.ps-dropdown {
  z-index: 200;
  background: var(--mc-bg-elevated);
  border: 1px solid var(--mc-border);
  border-radius: 14px;
  padding: 6px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  max-height: 280px;
  overflow-y: auto;
}

.ps-dropdown .ps-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.12s;
  font-size: 13px;
  color: var(--mc-text-primary);
}

.ps-dropdown .ps-item:hover {
  background: var(--mc-bg-sunken);
}

.ps-dropdown .ps-item.active {
  background: var(--mc-primary-bg);
  color: var(--mc-primary);
  font-weight: 600;
}

.ps-dropdown .ps-item__icon {
  flex-shrink: 0;
  opacity: 0.5;
}

.ps-dropdown .ps-item.active .ps-item__icon {
  opacity: 1;
  color: var(--mc-primary);
}

.ps-dropdown .ps-item__name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ps-dropdown .ps-item__check {
  flex-shrink: 0;
  color: var(--mc-primary);
}

.ps-dropdown-enter-active { transition: all 0.15s ease-out; }
.ps-dropdown-leave-active { transition: all 0.1s ease-in; }
.ps-dropdown-enter-from { opacity: 0; transform: translateY(-6px) scale(0.97); }
.ps-dropdown-leave-to { opacity: 0; transform: translateY(-4px) scale(0.98); }
</style>
