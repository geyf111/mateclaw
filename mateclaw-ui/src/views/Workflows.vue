<template>
  <div class="mc-page-shell">
    <div class="mc-page-frame">
      <div class="mc-page-inner workflows-page">
        <div class="mc-page-header">
          <div>
            <div class="mc-page-kicker">Workflows</div>
            <h1 class="mc-page-title">Workflow Editor</h1>
            <p class="mc-page-desc">
              Author multi-step workflows. Save the draft as you go, compile to surface diagnostics,
              then publish a revision when it is ready to run.
            </p>
          </div>
          <button class="btn-primary" @click="openCreate">+ New Workflow</button>
        </div>

        <div class="workflows-grid">
          <!-- left: list -->
          <aside class="workflows-list mc-surface-card">
            <div class="list-header">
              <span>Defined ({{ workflows.length }})</span>
              <button class="btn-ghost" @click="reload">Refresh</button>
            </div>
            <ul class="list-body">
              <li
                v-for="wf in workflows"
                :key="wf.id"
                class="list-row"
                :class="{ active: selectedId === wf.id }"
                @click="select(wf.id)"
              >
                <div class="list-row-name">
                  {{ wf.name || '(unnamed)' }}
                  <span v-if="wf.latestRevisionId" class="badge published">v{{ wf.latestRevisionId }}</span>
                  <span v-else class="badge draft">draft</span>
                </div>
                <div class="list-row-desc">{{ wf.description || '-' }}</div>
              </li>
              <li v-if="!workflows.length" class="list-empty">No workflows yet — create one to get started.</li>
            </ul>
          </aside>

          <!-- middle: editor -->
          <section class="workflows-editor mc-surface-card" v-if="selected">
            <header class="editor-header">
              <input v-model="selected.name" class="editor-name" placeholder="Workflow name" />
              <input v-model="selected.description" class="editor-desc" placeholder="Optional description" />
              <div class="editor-actions">
                <button class="btn-ghost" :disabled="busy" @click="saveMeta">Save Meta</button>
                <button class="btn-ghost" :disabled="busy" @click="saveDraft">Save Draft</button>
                <button class="btn-ghost" :disabled="busy" @click="compile">Compile</button>
                <button class="btn-primary" :disabled="busy" @click="publish">Publish</button>
                <button class="btn-danger" :disabled="busy" @click="remove">Delete</button>
              </div>
            </header>
            <textarea
              v-model="draftJson"
              class="editor-body"
              spellcheck="false"
              placeholder='{"steps":[{"name":"step-a","agentName":"...","mode":{"type":"sequential"},"promptTemplate":"..."}]}'
            />
            <div v-if="compileErrors.length" class="errors-panel">
              <div class="errors-title">{{ compileErrors.length }} compile error(s)</div>
              <ul>
                <li v-for="(err, idx) in compileErrors" :key="idx">
                  <code>{{ err.code }}</code>
                  <span class="err-path">@ {{ err.path }}</span>
                  <span class="err-msg">— {{ err.message }}</span>
                </li>
              </ul>
            </div>
            <div v-else-if="lastStatus" class="status-panel" :class="lastStatusKind">
              {{ lastStatus }}
            </div>
          </section>

          <section class="workflows-empty mc-surface-card" v-else>
            <p>Select a workflow on the left, or click "New Workflow" to start a fresh draft.</p>
          </section>

          <!-- right: runs -->
          <aside class="workflows-runs mc-surface-card" v-if="selected">
            <header class="runs-header">
              <span>Recent runs ({{ runs.length }})</span>
              <button class="btn-ghost" @click="reloadRuns">Refresh</button>
            </header>
            <ul class="runs-list">
              <li v-for="run in runs" :key="run.id" class="run-row" @click="loadRun(run.id)">
                <div class="run-row-line">
                  <span class="run-state" :class="'state-' + run.state">{{ run.state }}</span>
                  <span class="run-time">{{ formatTime(run.startedAt) }}</span>
                </div>
                <div class="run-row-meta">
                  <span>run #{{ run.id }}</span>
                  <span v-if="run.triggeredBy">· {{ run.triggeredBy }}</span>
                  <span v-if="run.errorMessage" class="run-err">· {{ run.errorMessage }}</span>
                </div>
              </li>
              <li v-if="!runs.length" class="runs-empty">No runs yet.</li>
            </ul>
            <section v-if="runDetail" class="run-detail">
              <div class="run-detail-title">Run #{{ runDetail.run.id }} — {{ runDetail.run.state }}</div>
              <ol class="run-steps">
                <li v-for="step in runDetail.steps" :key="step.id">
                  <span class="step-state" :class="'state-' + step.state">{{ step.state }}</span>
                  <span class="step-name">{{ step.stepName || '(unnamed)' }}</span>
                  <span v-if="step.durationMs != null" class="step-duration">{{ step.durationMs }} ms</span>
                  <span v-if="step.errorMessage" class="step-err">{{ step.errorMessage }}</span>
                </li>
              </ol>
            </section>
          </aside>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  workflowApi,
  type WorkflowSummary,
  type WorkflowRun,
  type WorkflowRunStep,
  type WorkflowCompileError,
  type WorkflowCompileFailure,
} from '@/api'
import { useWorkspaceStore } from '@/stores/useWorkspaceStore'

const workspaceStore = useWorkspaceStore()
const workspaceId = computed(() => workspaceStore.currentWorkspaceId)

const workflows = ref<WorkflowSummary[]>([])
const selectedId = ref<number | null>(null)
const selected = ref<WorkflowSummary | null>(null)
const draftJson = ref('')
const compileErrors = ref<WorkflowCompileError[]>([])
const lastStatus = ref('')
const lastStatusKind = ref<'ok' | 'err'>('ok')
const busy = ref(false)

const runs = ref<WorkflowRun[]>([])
const runDetail = ref<{ run: WorkflowRun; steps: WorkflowRunStep[] } | null>(null)

async function reload() {
  if (!workspaceId.value) return
  try {
    const res = await workflowApi.list(workspaceId.value)
    workflows.value = (res.data as unknown as WorkflowSummary[]) ?? []
  } catch (e) {
    console.error('listWorkflows failed', e)
  }
}

async function select(id: number) {
  selectedId.value = id
  try {
    const res = await workflowApi.get(id)
    selected.value = res.data as unknown as WorkflowSummary
    draftJson.value = selected.value?.draftJson ?? ''
    compileErrors.value = []
    lastStatus.value = ''
    await reloadRuns()
  } catch (e) {
    console.error('getWorkflow failed', e)
  }
}

async function reloadRuns() {
  if (!selectedId.value) return
  try {
    const res = await workflowApi.runs(selectedId.value, 50)
    runs.value = (res.data as unknown as WorkflowRun[]) ?? []
  } catch (e) {
    console.error('listRuns failed', e)
  }
}

async function loadRun(runId: number) {
  try {
    const res = await workflowApi.runDetail(runId)
    runDetail.value = res.data as unknown as { run: WorkflowRun; steps: WorkflowRunStep[] }
  } catch (e) {
    console.error('getRun failed', e)
  }
}

async function openCreate() {
  if (!workspaceId.value) return
  const name = window.prompt('New workflow name:', 'untitled-workflow')
  if (!name) return
  busy.value = true
  try {
    const res = await workflowApi.create({
      workspaceId: workspaceId.value,
      name,
      enabled: true,
    })
    const created = res.data as unknown as WorkflowSummary
    await reload()
    if (created?.id) await select(created.id)
  } catch (e) {
    setStatus('Create failed: ' + (e as Error).message, 'err')
  } finally {
    busy.value = false
  }
}

async function saveMeta() {
  if (!selected.value) return
  busy.value = true
  try {
    await workflowApi.update(selected.value.id, {
      name: selected.value.name,
      description: selected.value.description,
      enabled: selected.value.enabled,
    })
    setStatus('Metadata saved.', 'ok')
    await reload()
  } catch (e) {
    setStatus('Save failed: ' + (e as Error).message, 'err')
  } finally {
    busy.value = false
  }
}

async function saveDraft() {
  if (!selected.value) return
  busy.value = true
  try {
    await workflowApi.saveDraft(selected.value.id, draftJson.value)
    setStatus('Draft saved.', 'ok')
  } catch (e) {
    setStatus('Save draft failed: ' + (e as Error).message, 'err')
  } finally {
    busy.value = false
  }
}

async function compile() {
  if (!selected.value) return
  busy.value = true
  compileErrors.value = []
  try {
    await workflowApi.saveDraft(selected.value.id, draftJson.value)
    await workflowApi.compile(selected.value.id)
    setStatus('Compile OK.', 'ok')
  } catch (e) {
    handleCompileError(e)
  } finally {
    busy.value = false
  }
}

async function publish() {
  if (!selected.value) return
  busy.value = true
  compileErrors.value = []
  try {
    await workflowApi.saveDraft(selected.value.id, draftJson.value)
    const note = window.prompt('Optional publish note:', '') ?? undefined
    await workflowApi.publish(selected.value.id, note)
    setStatus('Published.', 'ok')
    await reload()
  } catch (e) {
    handleCompileError(e)
  } finally {
    busy.value = false
  }
}

async function remove() {
  if (!selected.value) return
  if (!window.confirm(`Delete workflow "${selected.value.name}"? This is reversible via the audit log.`)) return
  busy.value = true
  try {
    await workflowApi.delete(selected.value.id)
    selected.value = null
    selectedId.value = null
    draftJson.value = ''
    await reload()
    setStatus('Deleted.', 'ok')
  } catch (e) {
    setStatus('Delete failed: ' + (e as Error).message, 'err')
  } finally {
    busy.value = false
  }
}

function handleCompileError(e: unknown) {
  // The HTTP layer rejects with an `Error` whose message is the body's
  // msg field. The structured errors list lives on the response body's
  // data field; we have to dig it out of the raw axios error if present.
  const err = e as { response?: { data?: { data?: WorkflowCompileFailure } }; message?: string }
  const failure = err.response?.data?.data
  if (failure?.errors?.length) {
    compileErrors.value = failure.errors
    setStatus(`${failure.errorCount} compile error(s) — see panel below.`, 'err')
  } else {
    setStatus(err.message || 'Compile / publish failed.', 'err')
  }
}

function setStatus(msg: string, kind: 'ok' | 'err') {
  lastStatus.value = msg
  lastStatusKind.value = kind
}

function formatTime(iso?: string) {
  if (!iso) return '-'
  return iso.replace('T', ' ').slice(0, 19)
}

onMounted(reload)
watch(workspaceId, reload)
</script>

<style scoped>
.workflows-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.workflows-grid {
  display: grid;
  grid-template-columns: 280px 1fr 320px;
  gap: 16px;
  align-items: stretch;
  min-height: 480px;
}
.workflows-list,
.workflows-editor,
.workflows-runs,
.workflows-empty {
  padding: 12px;
  display: flex;
  flex-direction: column;
}
.list-header,
.runs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
  opacity: 0.85;
}
.list-body,
.runs-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
}
.list-row,
.run-row {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 4px;
  transition: background 0.12s ease;
}
.list-row:hover,
.run-row:hover {
  background: var(--mc-surface-hover, rgba(0, 0, 0, 0.05));
}
.list-row.active {
  background: var(--mc-primary-bg, rgba(64, 132, 255, 0.18));
}
.list-row-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}
.list-row-desc {
  font-size: 12px;
  opacity: 0.7;
  margin-top: 2px;
}
.badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: var(--mc-surface-hover, rgba(0, 0, 0, 0.06));
}
.badge.published {
  background: #2ecc71;
  color: white;
}
.badge.draft {
  background: #ffb84d;
  color: white;
}
.list-empty,
.runs-empty {
  font-size: 13px;
  opacity: 0.6;
  padding: 12px 4px;
}
.editor-header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}
.editor-name {
  flex: 0 0 200px;
  font-weight: 600;
}
.editor-desc {
  flex: 1;
}
.editor-name,
.editor-desc {
  padding: 6px 8px;
  border: 1px solid var(--mc-border, rgba(0, 0, 0, 0.1));
  border-radius: 6px;
  background: transparent;
  color: inherit;
}
.editor-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.editor-body {
  flex: 1;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  padding: 12px;
  border: 1px solid var(--mc-border, rgba(0, 0, 0, 0.1));
  border-radius: 6px;
  background: var(--mc-surface, rgba(0, 0, 0, 0.02));
  color: inherit;
  resize: vertical;
  min-height: 320px;
}
.errors-panel {
  margin-top: 12px;
  padding: 10px;
  border-radius: 6px;
  background: rgba(255, 80, 80, 0.08);
  border: 1px solid rgba(255, 80, 80, 0.4);
}
.errors-title {
  font-weight: 600;
  margin-bottom: 6px;
}
.errors-panel ul {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
  list-style: disc;
}
.errors-panel code {
  font-weight: 600;
  margin-right: 6px;
}
.err-path {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 11px;
  opacity: 0.85;
}
.err-msg {
  margin-left: 4px;
}
.status-panel {
  margin-top: 12px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 13px;
}
.status-panel.ok {
  background: rgba(46, 204, 113, 0.12);
  border: 1px solid rgba(46, 204, 113, 0.4);
}
.status-panel.err {
  background: rgba(255, 80, 80, 0.08);
  border: 1px solid rgba(255, 80, 80, 0.4);
}
.runs-list {
  max-height: 340px;
}
.run-row-line {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}
.run-state,
.step-state {
  text-transform: uppercase;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.08);
}
.state-succeeded { background: rgba(46, 204, 113, 0.2); color: #1e8449; }
.state-failed    { background: rgba(231, 76, 60, 0.18); color: #c0392b; }
.state-paused    { background: rgba(255, 184, 77, 0.22); color: #b8730a; }
.state-skipped   { background: rgba(149, 165, 166, 0.22); color: #444; }
.state-running   { background: rgba(52, 152, 219, 0.18); color: #1a5276; }
.run-row-meta {
  font-size: 11px;
  opacity: 0.7;
  margin-top: 2px;
}
.run-err {
  color: #c0392b;
}
.run-detail {
  margin-top: 12px;
  padding: 10px;
  border-radius: 6px;
  background: var(--mc-surface, rgba(0, 0, 0, 0.04));
}
.run-detail-title {
  font-weight: 600;
  margin-bottom: 6px;
}
.run-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 12px;
}
.run-steps li {
  padding: 4px 0;
  display: flex;
  align-items: center;
  gap: 6px;
  border-top: 1px dashed rgba(0, 0, 0, 0.06);
}
.step-name {
  font-weight: 500;
}
.step-duration,
.step-err {
  margin-left: auto;
  font-size: 11px;
  opacity: 0.7;
}
.step-err {
  color: #c0392b;
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
@media (max-width: 1100px) {
  .workflows-grid {
    grid-template-columns: 1fr;
  }
}
</style>
