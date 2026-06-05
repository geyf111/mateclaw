<template>
  <div class="mc-page-shell">
    <div class="mc-page-frame">
      <div class="mc-page-inner">
        <div class="mc-page-header">
          <div>
            <div class="mc-page-kicker">{{ t('scheduler.kicker') }}</div>
            <h1 class="mc-page-title">{{ t('scheduler.title') }}</h1>
            <!-- <p class="mc-page-desc">{{ t('scheduler.desc') }}</p> -->
            <p class="mc-page-desc">定时任务与运行历史，集中在一个地方管理。</p>
          </div>
          <button class="btn-primary" @click="onAction">
            <svg v-if="activeTab === 'history'" width="16" height="16" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {{ actionLabel }}
          </button>
        </div>

        <nav class="sched-tabs" role="tablist">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            role="tab"
            class="sched-tab"
            :class="{ active: activeTab === tab.id }"
            :aria-selected="activeTab === tab.id"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
            <span v-if="counts[tab.id]" class="tab-badge">{{ counts[tab.id] }}</span>
          </button>
        </nav>

        <div class="sched-body">
          <CronJobsPanel v-if="activeTab === 'jobs'" ref="jobsPanel" @count="counts.jobs = $event" />
          <TriggersPanel v-else-if="activeTab === 'triggers'" ref="triggersPanel" @count="counts.triggers = $event" />
          <RunHistoryPanel v-else ref="historyPanel" @count="counts.history = $event" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import CronJobsPanel from './CronJobsPanel.vue'
import TriggersPanel from './TriggersPanel.vue'
import RunHistoryPanel from './RunHistoryPanel.vue'

type TabId = 'jobs' | 'triggers' | 'history'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const TAB_IDS: TabId[] = ['jobs', 'triggers', 'history']

function isTabId(value: unknown): value is TabId {
  return typeof value === 'string' && (TAB_IDS as string[]).includes(value)
}

// The active tab is mirrored into the `?tab=` query so a reload — or a
// redirect from the legacy /settings/triggers route — lands on the right tab.
const activeTab = ref<TabId>(isTabId(route.query.tab) ? route.query.tab : 'jobs')

watch(activeTab, (tab) => {
  if (route.query.tab !== tab) {
    router.replace({ query: { ...route.query, tab } })
  }
})
watch(
  () => route.query.tab,
  (tab) => {
    if (isTabId(tab) && tab !== activeTab.value) activeTab.value = tab
  },
)

const tabs = computed(() => [
  { id: 'jobs' as TabId, label: t('scheduler.tabs.jobs') },
  // { id: 'triggers' as TabId, label: t('scheduler.tabs.triggers') },
  { id: 'history' as TabId, label: t('scheduler.tabs.history') },
])

// Per-tab item counts shown as badges. Each panel emits `count` on mount and
// whenever its list size changes; the value sticks until the next emit.
const counts = ref<Record<TabId, number>>({ jobs: 0, triggers: 0, history: 0 })

const actionLabel = computed(() => {
  if (activeTab.value === 'history') return t('scheduler.actions.refresh')
  if (activeTab.value === 'triggers') return t('scheduler.actions.newTrigger')
  return t('scheduler.actions.newJob')
})

// The header button drives the active panel through the method it exposes:
// `openCreate` for the job/trigger tabs, `refresh` for the history tab. Each
// panel keeps its own ref so the call always lands on the mounted instance.
const jobsPanel = ref<InstanceType<typeof CronJobsPanel> | null>(null)
const triggersPanel = ref<InstanceType<typeof TriggersPanel> | null>(null)
const historyPanel = ref<InstanceType<typeof RunHistoryPanel> | null>(null)
function onAction() {
  if (activeTab.value === 'jobs') jobsPanel.value?.openCreate()
  else if (activeTab.value === 'triggers') triggersPanel.value?.openCreate()
  else historyPanel.value?.refresh()
}
</script>

<style scoped>
.btn-primary { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: none; border-radius: 14px; padding: 10px 16px; font-size: 14px; font-weight: 600; line-height: 1; cursor: pointer; transition: background 0.15s, box-shadow 0.15s; background: linear-gradient(135deg, var(--mc-primary), var(--mc-primary-hover)); color: white; box-shadow: var(--mc-shadow-soft); white-space: nowrap; flex-shrink: 0; }
.btn-primary:hover { background: var(--mc-primary-hover); box-shadow: var(--mc-shadow-medium); }

.sched-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--mc-border);
  margin-bottom: 20px;
}

.sched-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  background: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  font-size: 14px;
  font-weight: 600;
  color: var(--mc-text-secondary);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.sched-tab:hover { color: var(--mc-text-primary); }
.sched-tab.active {
  color: var(--mc-primary);
  border-bottom-color: var(--mc-primary);
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--mc-bg-sunken);
  color: var(--mc-text-tertiary);
  font-size: 11px;
  font-weight: 700;
}
.sched-tab.active .tab-badge {
  background: var(--mc-primary-bg);
  color: var(--mc-primary);
}

.sched-body {
  min-height: 0;
}

@media (max-width: 720px) {
  .mc-page-header {
    flex-direction: column;
    align-items: stretch;
  }
  .btn-primary {
    justify-content: center;
  }
  .sched-tabs {
    overflow-x: auto;
  }
  .sched-tab {
    white-space: nowrap;
  }
}
</style>
