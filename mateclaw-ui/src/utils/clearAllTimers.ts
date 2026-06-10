/**
 * 清空当前页面所有定时器（Timeout / Interval）
 * TypeScript 安全版本
 */
export function clearAllTimers(): void {
  // 获取当前最大定时器 ID（TS 类型：number）
  let maxTimerId: number = window.setTimeout(() => {});

  // 从最大 ID 向下清空所有定时器
  while (maxTimerId > 0) {
    window.clearTimeout(maxTimerId);
    window.clearInterval(maxTimerId);
    maxTimerId--;
  }
}