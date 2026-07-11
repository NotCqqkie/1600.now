interface ScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export const canScrollElementInDirection = (
  { scrollTop, scrollHeight, clientHeight }: ScrollMetrics,
  deltaY: number,
) => {
  if (Math.abs(deltaY) < 1) return false;
  const maxScrollTop = scrollHeight - clientHeight;
  if (maxScrollTop <= 1) return false;
  if (deltaY > 0) return scrollTop < maxScrollTop - 1;
  return scrollTop > 1;
};

export const getTouchScrollDelta = (previousTouchY: number, currentTouchY: number) =>
  previousTouchY - currentTouchY;
