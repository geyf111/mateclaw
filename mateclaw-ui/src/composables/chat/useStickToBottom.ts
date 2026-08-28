/**
 * 智能滚动 Composable
 * 参考 @agentscope-ai/chat 的 StickToBottom 实现，提供智能的自动滚动体验
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'

export interface StickToBottomOptions {
  /** 是否启用 */
  enabled?: boolean
  /** 触发滚动的偏移阈值（像素） */
  offset?: number
  /** 是否使用平滑滚动 */
  smooth?: boolean
  /** 滚动持续时间（毫秒） */
  duration?: number
}

export interface StickToBottomReturn {
  /** 是否在底部 */
  isAtBottom: import('vue').Ref<boolean>
  /** 是否在底部附近 */
  isNearBottom: import('vue').ComputedRef<boolean>
  /** 是否被用户滚动中断 */
  escapedFromLock: import('vue').Ref<boolean>
  /** 滚动元素引用 */
  scrollRef: import('vue').Ref<HTMLElement | null>
  /** 内容元素引用 */
  contentRef: import('vue').Ref<HTMLElement | null>
  /** 滚动到底部 */
  scrollToBottom: (options?: { force?: boolean; smooth?: boolean }) => Promise<void>
  /** 停止自动滚动 */
  stopScroll: () => void
  /** Preserve the current viewport across a user-triggered content expansion. */
  holdScrollPosition: () => void
  /** 检查是否在底部 */
  checkIsAtBottom: () => boolean
}

// 默认配置
const DEFAULT_OPTIONS: Required<StickToBottomOptions> = {
  enabled: true,
  offset: 0,
  smooth: true,
  duration: 350,
}

export function useStickToBottom(
  options: StickToBottomOptions = {}
): StickToBottomReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  const scrollRef = ref<HTMLElement | null>(null)
  const contentRef = ref<HTMLElement | null>(null)
  
  const isAtBottom = ref(true)
  const escapedFromLock = ref(false)
  let isScrolling = false
  let lastScrollTop = 0
  let isSelecting = false
  // Incremented whenever the user takes over scrolling. A smooth scroll can
  // finish asynchronously after a wheel/touch gesture, so its completion must
  // not restore the sticky state or leave the browser moving toward an old
  // bottom position.
  let scrollRequestId = 0

  const cancelPendingScroll = () => {
    scrollRequestId += 1
    isScrolling = false

    const element = scrollRef.value
    if (!element) return

    // CSS sets scroll-behavior: smooth on the list. Temporarily overriding it
    // makes this a synchronous no-op scroll, which cancels a native smooth
    // scroll already in progress.
    const previousScrollBehavior = element.style.scrollBehavior
    element.style.scrollBehavior = 'auto'
    element.scrollTo({ top: element.scrollTop, behavior: 'auto' })
    element.style.scrollBehavior = previousScrollBehavior
  }

  // 是否在底部附近
  const isNearBottom = computed(() => {
    if (!scrollRef.value) return false
    const { scrollHeight, scrollTop, clientHeight } = scrollRef.value
    return scrollHeight - scrollTop - clientHeight <= opts.offset
  })

  // 检查是否在底部
  const checkIsAtBottom = () => {
    if (!scrollRef.value) return false
    const { scrollHeight, scrollTop, clientHeight } = scrollRef.value
    return scrollHeight - scrollTop - clientHeight <= opts.offset
  }

  // 滚动到底部
  const scrollToBottom = async (scrollOptions?: { force?: boolean; smooth?: boolean }) => {
    const { force = false, smooth = opts.smooth } = scrollOptions || {}
    
    if (!scrollRef.value) return
    
    // 如果用户已经向上滚动，且不强制滚动，则跳过
    if (!force && escapedFromLock.value) return
    
    // 如果正在选择文本，不滚动
    if (isSelecting) return

    const element = scrollRef.value
    const requestId = ++scrollRequestId
    const targetScrollTop = element.scrollHeight - element.clientHeight

    // 已经在底部，无需滚动
    if (element.scrollTop >= targetScrollTop - 1) return

    isScrolling = true

    if (smooth && 'scrollBehavior' in document.documentElement.style) {
      // 使用原生平滑滚动
      element.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
      
      // 等待滚动完成
      await new Promise<void>((resolve) => {
        const startedAt = performance.now()
        const checkScrollEnd = () => {
          if (!isScrolling || Math.abs(element.scrollTop - targetScrollTop) < 1
              || performance.now() - startedAt > opts.duration * 2) {
            isScrolling = false
            lastScrollTop = element.scrollTop
            resolve()
          } else {
            requestAnimationFrame(checkScrollEnd)
          }
        }
        setTimeout(checkScrollEnd, opts.duration)
      })
    } else {
      // The list itself declares `scroll-behavior: smooth`. Override it for
      // streamed updates: each token must land at the latest bottom instead of
      // repeatedly restarting a smooth animation that can never catch up.
      // Keep the programmatic-scroll marker until the next frame as browsers
      // dispatch the corresponding `scroll` event asynchronously. Otherwise
      // that event can be mistaken for a user scrolling down and prematurely
      // release an escaped sticky lock.
      isScrolling = true
      const previousScrollBehavior = element.style.scrollBehavior
      element.style.scrollBehavior = 'auto'
      element.scrollTo({ top: targetScrollTop, behavior: 'auto' })
      element.style.scrollBehavior = previousScrollBehavior
      lastScrollTop = element.scrollTop
      requestAnimationFrame(() => {
        if (requestId === scrollRequestId) isScrolling = false
      })
    }

    // A user gesture interrupted this request while awaiting the native
    // smooth-scroll completion. Do not overwrite the state it established.
    if (requestId !== scrollRequestId) return

    isAtBottom.value = true
  }

  // 停止自动滚动
  const stopScroll = () => {
    cancelPendingScroll()
    escapedFromLock.value = true
    isAtBottom.value = false
  }

  /**
   * A disclosure (for example a completed turn's execution timeline) changes
   * content height without representing new chat output. Treat it as the user
   * choosing to inspect history: retain the exact viewport and suspend the
   * sticky-bottom lock until they deliberately scroll back to the bottom.
   *
   * Two animation frames cover both browser scroll anchoring and the
   * ResizeObserver callback that run after Vue flushes the expanded DOM.
   */
  const holdScrollPosition = () => {
    const element = scrollRef.value
    if (!element) return

    cancelPendingScroll()
    const scrollTop = element.scrollTop
    escapedFromLock.value = true
    isAtBottom.value = false

    let remainingFrames = 2
    const restore = () => {
      element.scrollTop = scrollTop
      lastScrollTop = scrollTop
      remainingFrames -= 1
      if (remainingFrames > 0) requestAnimationFrame(restore)
    }
    requestAnimationFrame(restore)
  }

  // 处理滚动事件
  const handleScroll = () => {
    if (!scrollRef.value) return

    const element = scrollRef.value
    const currentScrollTop = element.scrollTop

    if (isScrolling) {
      // Programmatic stick-to-bottom scrolling only moves downward. A reverse
      // movement therefore came from the user (for example keyboard scrolling)
      // and must take precedence over the pending request.
      if (currentScrollTop < lastScrollTop) {
        cancelPendingScroll()
        escapedFromLock.value = true
        isAtBottom.value = false
      }
      lastScrollTop = currentScrollTop
      return
    }

    // 检测滚动方向
    const isScrollingUp = currentScrollTop < lastScrollTop
    const isScrollingDown = currentScrollTop > lastScrollTop
    
    lastScrollTop = currentScrollTop

    // 向上滚动，用户想要查看历史内容，中断自动滚动
    if (isScrollingUp) {
      escapedFromLock.value = true
      isAtBottom.value = false
    }

    // DOM scroll metrics are not reactive, so `isNearBottom` (a computed
    // value) can still contain the initial bottom state. Read the element's
    // current position here; otherwise any small downward wheel movement after
    // scrolling up incorrectly releases the sticky lock.
    if (isScrollingDown && checkIsAtBottom()) {
      escapedFromLock.value = false
      isAtBottom.value = true
    }
  }

  // 处理鼠标滚轮
  const handleWheel = (e: WheelEvent) => {
    if (!scrollRef.value) return
    
    // 如果用户向上滚动，确保我们记录这个行为
    if (e.deltaY < 0) {
      cancelPendingScroll()
      escapedFromLock.value = true
      isAtBottom.value = false
    }
  }

  // 处理鼠标/触摸开始（选择文本）
  const handlePointerDown = () => {
    // Dragging the scrollbar and touch scrolling do not emit a wheel event.
    // Cancel any in-flight smooth scroll here so their subsequent scroll
    // events are handled as user intent rather than being ignored.
    cancelPendingScroll()
    isSelecting = true
  }

  const handlePointerUp = () => {
    isSelecting = false
    // 选择结束后检查是否在底部
    setTimeout(() => {
      if (checkIsAtBottom()) {
        escapedFromLock.value = false
        isAtBottom.value = true
      }
    }, 100)
  }

  // ResizeObserver 监听内容变化
  let resizeObserver: ResizeObserver | null = null

  onMounted(() => {
    if (!scrollRef.value) return

    const element = scrollRef.value

    // 添加事件监听
    element.addEventListener('scroll', handleScroll, { passive: true })
    element.addEventListener('wheel', handleWheel, { passive: true })
    element.addEventListener('mousedown', handlePointerDown)
    element.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('mouseup', handlePointerUp)
    document.addEventListener('touchend', handlePointerUp)

    // 监听内容变化
    if (contentRef.value && window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        // 内容变化时，如果在底部则保持滚动到底部
        if (opts.enabled && isAtBottom.value && !escapedFromLock.value) {
          scrollToBottom({ smooth: false })
        }
      })
      resizeObserver.observe(contentRef.value)
    }

    // 初始化滚动位置
    if (opts.enabled) {
      scrollToBottom({ smooth: false })
    }
  })

  onUnmounted(() => {
    if (!scrollRef.value) return

    const element = scrollRef.value

    // 移除事件监听
    element.removeEventListener('scroll', handleScroll)
    element.removeEventListener('wheel', handleWheel)
    element.removeEventListener('mousedown', handlePointerDown)
    element.removeEventListener('touchstart', handlePointerDown)
    document.removeEventListener('mouseup', handlePointerUp)
    document.removeEventListener('touchend', handlePointerUp)

    // 断开 ResizeObserver
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
  })

  return {
    isAtBottom,
    isNearBottom,
    escapedFromLock,
    scrollRef,
    contentRef,
    scrollToBottom,
    stopScroll,
    holdScrollPosition,
    checkIsAtBottom,
  }
}

export default useStickToBottom
