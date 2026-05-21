<template>
  <div class="mc-page-shell">
    <div class="mc-page-frame">
      <div class="mc-page-inner models-page">
        <div class="mc-page-header">
          <div>
            <div class="mc-page-kicker">Model Hub</div>
            <h1 class="mc-page-title">{{ t('settings.model.title') }}</h1>
            <p class="mc-page-desc">{{ t('settings.model.desc') }}</p>
          </div>
          <button class="btn-primary" @click="onSyncModels" :disabled="refreshing">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            {{ refreshing ? '同步中' : '同步模型' }}
          </button>
          <!-- <button class="btn-primary" @click="openCreateProviderModal">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {{ t('settings.model.addProvider') }}
          </button> -->
        </div>

        <!-- 本地模型 -->
        <div v-if="localProviders.length" class="provider-group">
          <h3 class="group-title">
            <svg class="group-title__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            {{ t('settings.model.localProviders') }}
          </h3>
          <div class="provider-grid">
            <div v-for="provider in localProviders" :key="provider.id" class="provider-card mc-surface-card">
              <ProviderCard
                :provider="provider"
                :connection-testing-id="connectionTestingId"
                :connection-results="connectionResults"
                :is-provider-active="isProviderActive"
                :provider-status="providerStatus"
                :get-provider-icon="getProviderIcon"
                :on-icon-error="onIconError"
                @manage-models="openManageModelsModal"
                @provider-settings="openProviderConfigModal"
                @test-connection="handleTestConnection"
                @delete-provider="onDeleteProvider"
              />
            </div>
          </div>
        </div>

        <!-- 云端模型 -->
        <div v-if="cloudProviders.length" class="provider-group">
          <h3 class="group-title">
            <svg class="group-title__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
            </svg>
            {{ t('settings.model.cloudProviders') }}
          </h3>
          <div class="provider-grid">
            <div v-for="provider in cloudProviders" :key="provider.id" class="provider-card mc-surface-card">
              <ProviderCard
                :provider="provider"
                :connection-testing-id="connectionTestingId"
                :connection-results="connectionResults"
                :is-provider-active="isProviderActive"
                :provider-status="providerStatus"
                :get-provider-icon="getProviderIcon"
                :on-icon-error="onIconError"
                @manage-models="openManageModelsModal"
                @provider-settings="openProviderConfigModal"
                @test-connection="handleTestConnection"
                @delete-provider="onDeleteProvider"
              />
            </div>
          </div>
        </div>

        <!-- Embedding 模型（RFC Embedding UI） -->
        <EmbeddingModelsSection ref="embeddingModelsSectionRef" class="embedding-surface mc-surface-card" />

        <div v-if="savedTip" class="save-tip">{{ savedTip }}</div>
      </div>
    </div>

    <!-- Provider Config Modal -->
    <ProviderConfigModal
      :show="showProviderModal"
      :editing-provider="editingProvider"
      :form="providerForm"
      :advanced-open="advancedOpen"
      :protocol-options="protocolOptions"
      :base-url-placeholder="providerBaseUrlPlaceholder"
      :base-url-hint="providerBaseUrlHint"
      :api-key-placeholder="providerApiKeyPlaceholder"
      @close="closeProviderModal"
      @save="onSaveProvider"
      @toggle-advanced="advancedOpen = !advancedOpen"
      @oauth-login="handleOAuthLogin"
      @oauth-revoke="handleOAuthRevoke"
    />

    <!-- Manage Models Modal -->
    <ManageModelsModal
      :show="showManageModelsModal"
      :provider="currentProvider"
      :model-form="providerModelForm"
      :discovering="discovering"
      :discover-result="discoverResult"
      :selected-new-model-ids="selectedNewModelIds"
      :applying-models="applyingModels"
      :all-new-selected="allNewSelected"
      :testing-model-id="testingModelId"
      :model-test-results="modelTestResults"
      :is-extra-model="isExtraModel"
      :is-active-model="isActiveModel"
      :get-provider-icon="getProviderIcon"
      :on-icon-error="onIconError"
      @close="closeManageModelsModal"
      @discover="handleDiscoverModels"
      @toggle-select-all="toggleSelectAll"
      @toggle-model="onToggleModel"
      @apply-models="onApplyModels"
      @test-model="handleTestModel"
      @set-active="onSetActiveModel"
      @remove-model="onRemoveProviderModel"
      @add-model="onAddProviderModel"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import type { ProviderInfo, ProviderModelInfo } from '@/types'
import { useProviders } from './useProviders'
import ProviderCard from './ProviderCard.vue'
import EmbeddingModelsSection from './EmbeddingModelsSection.vue'
import ProviderConfigModal from './modals/ProviderConfigModal.vue'
import ManageModelsModal from './modals/ManageModelsModal.vue'

const { t } = useI18n()
const savedTip = ref('')
const embeddingModelsSectionRef = ref<InstanceType<typeof EmbeddingModelsSection> | null>(null)

const {
  providers,
  editingProvider,
  currentProvider,
  showProviderModal,
  showManageModelsModal,
  advancedOpen,
  discovering,
  discoverResult,
  selectedNewModelIds,
  applyingModels,
  connectionTestingId,
  connectionResults,
  testingModelId,
  modelTestResults,
  providerForm,
  providerModelForm,
  protocolOptions,
  allNewSelected,
  providerBaseUrlPlaceholder,
  providerBaseUrlHint,
  providerApiKeyPlaceholder,
  refreshing,
  loadProviders,
  loadActiveModel,
  openCreateProviderModal,
  openProviderConfigModal,
  closeProviderModal,
  saveProvider,
  deleteProvider,
  openManageModelsModal,
  closeManageModelsModal,
  isExtraModel,
  addProviderModel,
  removeProviderModel,
  isProviderActive,
  isActiveModel,
  setActiveModel,
  toggleSelectAll,
  handleDiscoverModels,
  handleApplyModels,
  handleTestConnection,
  handleTestModel,
  providerStatus,
  getProviderIcon,
  onIconError,
  handleOAuthLogin,
  handleOAuthRevoke,
  syncModels,
} = useProviders()

const localProviders = computed(() => providers.value.filter(p => p.isLocal))
const cloudProviders = computed(() => providers.value.filter(p => !p.isLocal))

onMounted(async () => {
  await Promise.all([loadProviders(), loadActiveModel()])
})

async function onSaveProvider() {
  try {
    await saveProvider()
    showSavedTip(t('settings.model.providerSaved'))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t('settings.messages.saveFailed'))
  }
}

async function onDeleteProvider(provider: ProviderInfo) {
  const deleted = await deleteProvider(provider)
  if (deleted) showSavedTip(t('settings.model.providerDeleted'))
}

async function onAddProviderModel() {
  try {
    await addProviderModel()
    showSavedTip(t('settings.model.modelAdded'))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t('settings.model.modelAddFailed'))
  }
}

async function onRemoveProviderModel(model: ProviderModelInfo) {
  try {
    await removeProviderModel(model)
    showSavedTip(t('settings.model.modelRemoved'))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t('settings.model.modelRemoveFailed'))
  }
}

async function onSetActiveModel(model: ProviderModelInfo) {
  try {
    await setActiveModel(model)
    showSavedTip(t('settings.model.activeChanged'))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t('settings.model.activeChangeFailed'))
  }
}

async function onApplyModels() {
  const added = await handleApplyModels()
  if (added) showSavedTip(t('settings.model.discovery.addedCount', { count: added }))
}

async function onSyncModels() {
  const synced = await syncModels()
  if (synced) {
    await embeddingModelsSectionRef.value?.refresh()
  }
}

function onToggleModel(modelId: string) {
  const idx = selectedNewModelIds.value.indexOf(modelId)
  if (idx >= 0) {
    selectedNewModelIds.value.splice(idx, 1)
  } else {
    selectedNewModelIds.value.push(modelId)
  }
}

function showSavedTip(message: string) {
  savedTip.value = message
  window.setTimeout(() => { savedTip.value = '' }, 2500)
}
</script>

<style scoped>
.models-page { gap: 18px; }

.provider-group {
  margin-bottom: 28px;
}

.group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 14px;
  font-size: 16px;
  font-weight: 600;
  color: var(--mc-text-primary);
}

.group-title__icon {
  flex-shrink: 0;
  color: var(--mc-text-secondary);
}

.provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 18px;
}
.provider-card {
  padding: 20px;
  transition: all 0.15s;
}
.provider-card:hover {
  border-color: var(--mc-primary-light);
  box-shadow: var(--mc-shadow-medium);
  transform: translateY(-2px);
}
.embedding-surface {
  padding: 20px;
  margin-top: 8px;
}
.btn-primary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: linear-gradient(135deg, var(--mc-primary), var(--mc-primary-hover));
  color: white;
  border: none;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--mc-shadow-soft);
}
.btn-primary:hover { background: var(--mc-primary-hover); }

.save-tip { position: fixed; right: 24px; bottom: 24px; background: var(--mc-text-primary); color: var(--mc-text-inverse); padding: 10px 14px; border-radius: 10px; box-shadow: 0 10px 30px rgba(124, 63, 30, 0.22); }

@media (max-width: 900px) {
  .btn-primary {
    width: 100%;
    justify-content: center;
  }
}
@media (max-width: 640px) {
  .provider-grid { grid-template-columns: 1fr; }
}
</style>
