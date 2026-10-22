<template>
  <el-dropdown
    ref="dropdownRef"
    v-if="contextUsage"
    trigger="click"
    placement="top"
    :popper-options="popperOptions"
    popper-class="context-usage-popover"
    @visible-change="handleVisibleChange"
  >
    <el-progress
      type="circle"
      :percentage="usageTotal"
      :width="20"
      :show-text="false"
      :stroke-width="3"
      color="#333"
    />
    <template #dropdown>
      <div class="context-usage-dropdown">
        <div class="context-usage-dropdown__header">
          <span class="context-usage-dropdown__title">上下文用量</span>
          <button class="context-usage-dropdown__close" @click="closeDropdown">&times;</button>
        </div>
        <div class="context-usage-dropdown__summary">
          <span class="context-usage-dropdown__summary-percent">{{ usageTotal }}%</span>
          <span class="context-usage-dropdown__summary-detail">已使用 {{ usedLabel }} / 总共 {{ maxLabel }}</span>
        </div>
        <div ref="chartRef" class="context-usage-dropdown__chart"></div>
        <div class="context-usage-dropdown__legend">
          <span
            v-for="item in items"
            :key="item.key"
            class="context-usage-legend-item"
          >
            <span class="context-usage-legend-item__dot" :style="{ background: item.color }"></span>
            <span class="context-usage-legend-item__label">{{ item.label }}</span>
            <span class="context-usage-legend-item__value">{{ item.percentage }}%</span>
          </span>
        </div>
      </div>
    </template>
  </el-dropdown>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'

/** 上下文用量分类数据 */
export interface ContextUsageData {
  systemPrompt: number
  toolResults: number
  conversationHistory: number
  knowledgeRetrieval: number
  mcpAndSkills: number
  maxTokens: number
}

interface ContextUsageItem {
  key: string
  label: string
  value: number
  percentage: number
  color: string
}

const props = defineProps<{
  contextUsage?: ContextUsageData | null
}>()

const KEYS = ['systemPrompt', 'toolResults', 'conversationHistory', 'knowledgeRetrieval', 'mcpAndSkills'] as const

const COLORS: Record<string, string> = {
  systemPrompt: '#5470c6',
  toolResults: '#91cc75',
  conversationHistory: '#fac858',
  knowledgeRetrieval: '#ee6666',
  mcpAndSkills: '#73c0de',
}

const LABELS: Record<string, string> = {
  systemPrompt: '系统提示词',
  toolResults: '工具结果',
  conversationHistory: '对话历史',
  knowledgeRetrieval: '知识检索',
  mcpAndSkills: 'MCP及技能',
}

const items = computed<ContextUsageItem[]>(() => {
  const usage = props.contextUsage
  if (!usage) return []
  return KEYS.map((k) => ({
    key: k,
    label: LABELS[k],
    value: usage[k] || 0,
    percentage: usage.maxTokens > 0 ? Math.round(((usage[k] || 0) / usage.maxTokens) * 1000) / 10 : 0,
    color: COLORS[k],
  }))
})

const usedTotal = computed(() => {
  const usage = props.contextUsage
  if (!usage) return 0
  return KEYS.reduce((sum, k) => sum + (usage[k] || 0), 0)
})

const usedLabel = computed(() => {
  const val = usedTotal.value
  if (val >= 1000) return (val / 1000).toFixed(1) + 'K'
  return String(val)
})

const maxLabel = computed(() => {
  const max = props.contextUsage?.maxTokens ?? 0
  if (max >= 1000) return (max / 1000).toFixed(1) + 'K'
  return String(max)
})

const usageTotal = computed(() => {
  const usage = props.contextUsage
  if (!usage || !usage.maxTokens) return 0
  return Math.round((usedTotal.value / usage.maxTokens) * 1000) / 10
})

const popperOptions = {
  modifiers: [
    {
      name: 'offset',
      options: {
        offset: [-120, 8],
      },
    },
  ],
}

// ECharts
const dropdownRef = ref<any>(null)
const chartRef = ref<HTMLElement | null>(null)
let chartInstance: any = null
let echartsModule: typeof import('echarts') | null = null

async function getECharts() {
  if (!echartsModule) {
    echartsModule = await import('echarts')
  }
  return echartsModule
}

async function initChart() {
  const el = chartRef.value
  if (!el || !props.contextUsage) return

  await nextTick()
  const echarts = await getECharts()
  if (chartInstance) {
    chartInstance.dispose()
  }

  chartInstance = echarts.init(el)
  const list = items.value
  const option = {
    grid: {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      containLabel: false,
    },
    barGap: '-100%',
    xAxis: {
      type: 'value',
      max: 100,
      show: false,
    },
    yAxis: {
      type: 'category',
      data: [''],
      show: false,
    },
    series: [
      {
        name: 'background',
        type: 'bar',
        data: [100],
        itemStyle: {
          color: '#e8ecf1',
          borderRadius: [6, 6, 6, 6],
        },
        barWidth: 8,
        emphasis: { disabled: true },
        tooltip: { show: false },
      },
      ...list.map((item, index) => {
        const isFirst = index === 0
        const isLast = index === list.length - 1
        let br: number | number[] = 0
        if (isFirst) {
          br = [6, 0, 0, 6]
        } else if (isLast && usageTotal.value >= 100) {
          br = [0, 6, 6, 0]
        }
        return {
          name: item.label,
          type: 'bar',
          stack: 'total',
          data: [item.percentage],
          itemStyle: {
            color: item.color,
            borderRadius: br,
          },
          barWidth: 8,
        }
      }),
    ],
  }
  chartInstance.setOption(option)
}

function disposeChart() {
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
}

function closeDropdown() {
  dropdownRef.value?.handleClose?.()
}

function handleVisibleChange(visible: boolean) {
  if (visible) {
    setTimeout(() => initChart(), 0)
  } else {
    disposeChart()
  }
}
</script>

<style scoped>
:deep(.el-progress) {
  cursor: pointer;
}

:deep(.el-progress-circle__track) {
  stroke: #ccc;
}
</style>

<style>
.context-usage-popover {
  padding: 0 !important;
  border-radius: 14px !important;
  min-width: 280px !important;
}

.context-usage-dropdown {
  padding: 16px 18px 14px;
}

.context-usage-dropdown__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.context-usage-dropdown__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--mc-text-primary, #1e293b);
}

.context-usage-dropdown__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: var(--mc-text-tertiary, #94a3b8);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  border-radius: 4px;
  padding: 0;
  transition: background 0.15s, color 0.15s;
}

.context-usage-dropdown__close:hover {
  background: var(--mc-bg-hover, #f1f5f9);
  color: var(--mc-text-primary, #1e293b);
}

.context-usage-dropdown__summary {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.context-usage-dropdown__summary-percent {
  font-size: 16px;
  font-weight: 600;
  color: var(--mc-text-primary, #1e293b);
}

.context-usage-dropdown__summary-detail {
  font-size: 12px;
  color: var(--mc-text-tertiary, #94a3b8);
}

.context-usage-dropdown__chart {
  width: 100%;
  height: 22px;
}

.context-usage-dropdown__legend {
  display: flex;
  flex-direction: column;
  gap: 6px;
  /* margin-top: 12px; */
}

.context-usage-legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--mc-text-secondary, #64748b);
}

.context-usage-legend-item__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.context-usage-legend-item__label {
  flex: 1;
}

.context-usage-legend-item__value {
  font-variant-numeric: tabular-nums;
  color: #999;
  font-weight: 500;
}
</style>