export interface UpdaterState {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  releaseNotes?: string
  forceUpdate?: boolean
  progress?: {
    percent: number
    bytesPerSecond?: number
    transferred?: number
    total?: number
  }
  error?: string
}

export interface MateClawAPI {
  /** 仅检查更新（不弹出原生对话框），通过 updater:state 事件推送结果 */
  checkForUpdates: () => Promise<UpdaterState>
  /** 开始下载更新 */
  startDownloadUpdate: () => Promise<void>
  /** 退出并安装更新 */
  installUpdate: () => Promise<void>
  /** 订阅更新状态变化，返回取消订阅函数 */
  onUpdaterState: (callback: (state: UpdaterState) => void) => () => void
  /** 获取当前应用版本号 */
  getAppVersion: () => Promise<string>
  /** 当前平台 */
  platform: NodeJS.Platform,
  /** 显示关于对话框 */
  showAbout: () => void
  /** 跳转更新日志页面 */
  showVersionHistory: () => void
}

declare global {
  interface Window {
    mateClawAPI?: MateClawAPI
  }
}

export {}