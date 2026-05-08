<template>
  <div class="mc-page-shell">
    <div class="mc-page-frame">
      <div class="mc-page-inner triggers-page">
        <div class="mc-page-header">
          <div>
            <div class="mc-page-kicker">Triggers</div>
            <h1 class="mc-page-title">Workflow Triggers</h1>
            <p class="mc-page-desc">
              Connect cron schedules and channel events to your published workflows.
              Pattern_version increments on every cron expression change so multi-node
              deployments coordinate correctly.
            </p>
          </div>
          <button class="btn-primary" @click="openCreate">+ New Trigger</button>
        </div>

        <table class="triggers-table mc-surface-card">
          <thead>
            <tr>
              <th>Name</th>
              <th>Pattern</th>
              <th>Target Workflow</th>
              <th>Rate</th>
              <th>Fires</th>
              <th>State</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in triggers" :key="t.id">
              <td>{{ t.name || '(unnamed)' }}</td>
              <td>
                <code>{{ t.patternType }}</code>
                <div class="pattern-detail">{{ t.patternJson }}</div>
              </td>
              <td>{{ t.targetType }}#{{ t.targetId }}</td>
              <td>{{ t.rateLimitPerMin }}/min</td>
              <td>{{ t.fireCount }}<span v-if="t.maxFires > 0"> / {{ t.maxFires }}</span></td>
              <td>
                <label class="toggle">
                  <input type="checkbox" :checked="t.enabled" @change="toggleEnabled(t)" />
                  <span>{{ t.enabled ? 'enabled' : 'disabled' }}</span>
                </label>
              </td>
              <td class="actions">
                <button class="btn-ghost" @click="openEdit(t)">Edit</button>
                <button class="btn-danger" @click="remove(t)">Delete</button>
              </td>
            </tr>
            <tr v-if="!triggers.length">
              <td colspan="7" class="empty-row">No triggers configured.</td>
            </tr>
          </tbody>
        </table>

        <!-- Inline form (replaces modal for v0 simplicity) -->
        <section v-if="formOpen" class="form-card mc-surface-card">
          <header>
            <strong>{{ editing?.id ? 'Edit Trigger' : 'New Trigger' }}</strong>
            <button class="btn-ghost" @click="closeForm">Close</button>
          </header>
          <div class="form-grid">
            <label>Name <input v-model="formState.name" placeholder="hourly-cleanup" /></label>
            <label>Pattern type
              <select v-model="formState.patternType">
                <option value="cron">cron</option>
                <option value="channel_message">channel_message</option>
                <option value="webhook">webhook</option>
                <option value="workflow_completion">workflow_completion</option>
              </select>
            </label>
            <label class="span-2">Pattern JSON
              <textarea v-model="formState.patternJson" rows="3"
                placeholder='{"cron":"0 0 * * * *","timezone":"UTC"}' />
            </label>
            <label>Target type
              <select v-model="formState.targetType">
                <option value="workflow">workflow</option>
                <option value="agent">agent</option>
              </select>
            </label>
            <label>Target id <input v-model.number="formState.targetId" type="number" /></label>
            <label>Rate / min <input v-model.number="formState.rateLimitPerMin" type="number" /></label>
            <label>Dedup window (s) <input v-model.number="formState.dedupWindowSecs" type="number" /></label>
            <label>Max fires (0 = unlimited)
              <input v-model.number="formState.maxFires" type="number" />
            </label>
            <label>
              <input type="checkbox" v-model="formState.botSelfFilter" />
              Bot-self filter (recommended)
            </label>
            <label class="span-2">Payload template (Pebble)
              <textarea v-model="formState.payloadTemplate" rows="3"
                placeholder='{"who":"{{ event.who }}"}' />
            </label>
            <label class="span-2">
              <input type="checkbox" v-model="formState.enabled" />
              Enabled
            </label>
          </div>
          <footer>
            <button class="btn-ghost" @click="closeForm">Cancel</button>
            <button class="btn-primary" :disabled="busy" @click="save">Save</button>
          </footer>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { triggerApi, type TriggerSummary } from '@/api'
import { useWorkspaceStore } from '@/stores/useWorkspaceStore'

const workspaceStore = useWorkspaceStore()
const workspaceId = computed(() => workspaceStore.currentWorkspaceId)
const triggers = ref<TriggerSummary[]>([])

const formOpen = ref(false)
const editing = ref<TriggerSummary | null>(null)
const busy = ref(false)

interface FormState {
  name: string
  patternType: string
  patternJson: string
  targetType: string
  targetId: number
  rateLimitPerMin: number
  dedupWindowSecs: number
  botSelfFilter: boolean
  enabled: boolean
  maxFires: number
  payloadTemplate: string
}

const formState = ref<FormState>(emptyForm())

function emptyForm(): FormState {
  return {
    name: '',
    patternType: 'cron',
    patternJson: '{"cron":"0 0 * * * *","timezone":"UTC"}',
    targetType: 'workflow',
    targetId: 0,
    rateLimitPerMin: 60,
    dedupWindowSecs: 60,
    botSelfFilter: true,
    enabled: true,
    maxFires: 0,
    payloadTemplate: '',
  }
}

async function reload() {
  if (!workspaceId.value) return
  try {
    const res = await triggerApi.list(workspaceId.value)
    triggers.value = (res.data as unknown as TriggerSummary[]) ?? []
  } catch (e) {
    console.error('listTriggers failed', e)
  }
}

function openCreate() {
  editing.value = null
  formState.value = emptyForm()
  formOpen.value = true
}

function openEdit(t: TriggerSummary) {
  editing.value = t
  formState.value = {
    name: t.name ?? '',
    patternType: t.patternType,
    patternJson: t.patternJson,
    targetType: t.targetType,
    targetId: t.targetId,
    rateLimitPerMin: t.rateLimitPerMin ?? 60,
    dedupWindowSecs: t.dedupWindowSecs ?? 60,
    botSelfFilter: t.botSelfFilter ?? true,
    enabled: t.enabled,
    maxFires: t.maxFires ?? 0,
    payloadTemplate: t.payloadTemplate ?? '',
  }
  formOpen.value = true
}

function closeForm() {
  formOpen.value = false
}

async function save() {
  if (!workspaceId.value) return
  busy.value = true
  try {
    const payload: Partial<TriggerSummary> = {
      workspaceId: workspaceId.value,
      ...formState.value,
    }
    if (editing.value?.id) {
      await triggerApi.update(editing.value.id, payload)
    } else {
      await triggerApi.create(payload)
    }
    formOpen.value = false
    await reload()
  } catch (e) {
    window.alert('Save failed: ' + (e as Error).message)
  } finally {
    busy.value = false
  }
}

async function toggleEnabled(t: TriggerSummary) {
  try {
    await triggerApi.update(t.id, { ...t, enabled: !t.enabled })
    await reload()
  } catch (e) {
    window.alert('Toggle failed: ' + (e as Error).message)
  }
}

async function remove(t: TriggerSummary) {
  if (!window.confirm(`Delete trigger "${t.name || t.id}"?`)) return
  try {
    await triggerApi.delete(t.id)
    await reload()
  } catch (e) {
    window.alert('Delete failed: ' + (e as Error).message)
  }
}

onMounted(reload)
watch(workspaceId, reload)
</script>

<style scoped>
.triggers-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.triggers-table {
  width: 100%;
  border-collapse: collapse;
  padding: 0;
  overflow: hidden;
}
.triggers-table th,
.triggers-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--mc-border, rgba(0, 0, 0, 0.06));
  text-align: left;
  font-size: 13px;
  vertical-align: top;
}
.triggers-table th {
  font-weight: 600;
  background: var(--mc-surface, rgba(0, 0, 0, 0.04));
}
.pattern-detail {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 11px;
  opacity: 0.7;
  margin-top: 2px;
}
.empty-row {
  text-align: center;
  opacity: 0.6;
  padding: 24px;
}
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.actions {
  display: flex;
  gap: 6px;
}
.form-card {
  padding: 16px;
}
.form-card header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  align-items: center;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.form-grid .span-2 {
  grid-column: span 2;
}
.form-grid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
}
.form-grid input,
.form-grid select,
.form-grid textarea {
  padding: 6px 8px;
  border: 1px solid var(--mc-border, rgba(0, 0, 0, 0.12));
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: 13px;
}
.form-grid textarea {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
}
.form-card footer {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.btn-primary,
.btn-ghost,
.btn-danger {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid var(--mc-border, rgba(0, 0, 0, 0.12));
  background: transparent;
  color: inherit;
}
.btn-primary {
  background: var(--mc-primary, #4084ff);
  border-color: var(--mc-primary, #4084ff);
  color: white;
}
.btn-danger {
  background: rgba(231, 76, 60, 0.12);
  border-color: rgba(231, 76, 60, 0.6);
  color: #c0392b;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
