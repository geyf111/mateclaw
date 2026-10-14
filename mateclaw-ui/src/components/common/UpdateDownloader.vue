<template>
  <Transition name="updater-fade">
    <div v-if="downloadState.visible" class="update-downloader">
      <div class="update-downloader__inner">
        <div class="update-downloader__ring">
          <template v-if="downloadState.mode === 'downloading'">
            <svg class="update-downloader__svg" viewBox="0 0 52 52">
              <circle
                class="update-downloader__track"
                cx="26" cy="26" r="21"
              />
              <circle
                class="update-downloader__arc"
                cx="26" cy="26" r="21"
                :style="{ strokeDashoffset: arcOffset }"
              />
            </svg>
            <span class="update-downloader__pct">{{ downloadState.progressPercent }}%</span>
          </template>
          <template v-else>
            <span class="update-downloader__check">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          </template>
        </div>

        <div class="update-downloader__body">
          <template v-if="downloadState.mode === 'downloading'">
            <div class="update-downloader__title">
              {{ $t('updater.downloading') }} ({{ downloadState.progressPercent }}%)
            </div>
            <div class="update-downloader__info">
              {{ transferredText }} / {{ totalText }}
              <span v-if="speedText" class="update-downloader__speed">({{ speedText }})</span>
            </div>
          </template>
          <template v-else>
            <div class="update-downloader__title">{{ $t('updater.downloadCompleteHint') }}</div>
            <button class="update-downloader__btn" @click="install">
              {{ $t('updater.restartToUpgrade') }}
            </button>
          </template>
        </div>

        <button class="update-downloader__close" @click="hideDownloader" :aria-label="$t('common.close')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { downloadState, hideDownloader } from '@/composables/useUpdateFlow'

const CIRCUMFERENCE = 2 * Math.PI * 21

const arcOffset = computed(() => {
  return CIRCUMFERENCE * (1 - downloadState.progressPercent / 100)
})

function formatSize(bytes: number): string {
  if (bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const transferredText = computed(() => formatSize(downloadState.transferred))
const totalText = computed(() => formatSize(downloadState.total))

const speedText = computed(() => {
  const bps = downloadState.bytesPerSecond
  if (bps <= 0) return ''
  if (bps < 1024 * 1024) return (bps / 1024).toFixed(0) + ' KB/s'
  return (bps / (1024 * 1024)).toFixed(1) + ' MB/s'
})

function install() {
  window.mateClawAPI?.installUpdate()
}
</script>

<style scoped>
.update-downloader {
  position: fixed;
  top: 50px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2500;
  pointer-events: auto;
}

.update-downloader__inner {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255, 250, 245, 0.88);
  backdrop-filter: blur(32px) saturate(180%);
  -webkit-backdrop-filter: blur(32px) saturate(180%);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.6) inset, 0 12px 36px rgba(25, 14, 8, 0.16);
  color: var(--mc-text-primary);
  font-size: 13px;
  min-width: 280px;
  max-width: 400px;
}

:global(html.dark .update-downloader__inner) {
  background: rgba(32, 26, 22, 0.9);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06) inset, 0 12px 36px rgba(0, 0, 0, 0.5);
}

.update-downloader__ring {
  position: relative;
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.update-downloader__svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.update-downloader__track {
  fill: none;
  stroke: var(--mc-bg-muted);
  stroke-width: 4;
}

.update-downloader__arc {
  fill: none;
  stroke: var(--mc-primary);
  stroke-width: 4;
  stroke-linecap: round;
  stroke-dasharray: 131.95;
  transition: stroke-dashoffset 0.35s ease;
}

.update-downloader__pct {
  font-size: 12px;
  font-weight: 700;
  color: var(--mc-text-primary);
  z-index: 1;
}

.update-downloader__check {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--mc-success);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 0 0 5px rgba(90, 138, 90, 0.14);
}

.update-downloader__body {
  flex: 1;
  min-width: 0;
}

.update-downloader__title {
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.update-downloader__info {
  margin-top: 2px;
  font-size: 12px;
  color: var(--mc-text-muted);
  line-height: 1.4;
}

.update-downloader__speed {
  margin-left: 2px;
}

.update-downloader__btn {
  margin-top: 6px;
  padding: 5px 16px;
  border: none;
  border-radius: 8px;
  background: var(--mc-primary);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.update-downloader__btn:hover {
  opacity: 0.9;
}

.update-downloader__close {
  flex-shrink: 0;
  align-self: flex-start;
  border: none;
  background: none;
  color: var(--mc-text-muted);
  cursor: pointer;
  padding: 2px;
  line-height: 1;
  margin-left: auto;
  margin-top: -2px;
  margin-right: -4px;
  border-radius: 6px;
}

.update-downloader__close:hover {
  color: var(--mc-text-primary);
  background: var(--mc-bg-muted);
}

.updater-fade-enter-active,
.updater-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}

.updater-fade-enter-from,
.updater-fade-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>