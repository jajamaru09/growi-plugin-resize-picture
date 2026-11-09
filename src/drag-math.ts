/** ドラッグで広げられる上限（px）。原寸と容器幅の小さいほう。 */
export function dragLimitPx(naturalPx: number, containerPx: number): number {
  return Math.min(naturalPx, containerPx);
}

/** 表示幅を容器幅に対する % にし、5% 刻み（切り捨て）で 5〜100 に収める。 */
export function toPercent(widthPx: number, containerPx: number): number {
  if (!(containerPx > 0)) return 100;
  const stepped = Math.floor(((widthPx / containerPx) * 100) / 5) * 5;
  return Math.min(100, Math.max(5, stepped));
}
