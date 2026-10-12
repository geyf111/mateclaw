import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UpdaterState } from '@/types/mateClaw'
import { mcToast } from '@/composables/useMcToast'

export const downloadState = reactive({
  visible: false,
  mode: 'downloading' as 'downloading' | 'downloaded',
  progressPercent: 0,
  transferred: 0,
  total: 0,
  bytesPerSecond: 0,
})

let _unsub: (() => void) | null = null
let _userClosed = false

export function hideDownloader() {
  downloadState.visible = false
  _userClosed = true
}

export function useUpdateFlow() {
  const { t } = useI18n()

  function start() {
    if (!window.mateClawAPI) {
      mcToast.info(t('updater.onlyInClient'))
      return
    }

    _unsub?.()
    _unsub = null

    downloadState.mode = 'downloading'
    downloadState.progressPercent = 0
    downloadState.transferred = 0
    downloadState.total = 0
    downloadState.bytesPerSecond = 0
    downloadState.visible = true
    _userClosed = false

    _unsub = window.mateClawAPI.onUpdaterState((s: UpdaterState) => {
      if (s.status === 'available') {
        window.mateClawAPI!.startDownloadUpdate()
        return
      }

      if (s.status === 'not-available') {
        mcToast.success(t('updater.alreadyLatest'))
        _unsub?.()
        _unsub = null
        downloadState.visible = false
        return
      }

      if (s.status === 'error') {
        mcToast.error(s.error || t('updater.checkFailed'))
        _unsub?.()
        _unsub = null
        downloadState.visible = false
        return
      }

      if (s.status === 'downloading' && s.progress) {
        downloadState.progressPercent = Math.round(s.progress.percent)
        downloadState.transferred = s.progress.transferred ?? 0
        downloadState.total = s.progress.total ?? 0
        downloadState.bytesPerSecond = s.progress.bytesPerSecond ?? 0
        if (!_userClosed) {
          downloadState.visible = true
        }
        return
      }

      if (s.status === 'downloaded') {
        downloadState.mode = 'downloaded'
        downloadState.visible = true
        _userClosed = false
        return
      }
    })

    window.mateClawAPI.checkForUpdates()
  }

  return { start }
}