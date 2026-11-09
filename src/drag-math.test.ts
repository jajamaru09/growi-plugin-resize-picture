import { describe, it, expect } from 'vitest';
import { dragLimitPx, toPercent } from './drag-math';

describe('drag-math', () => {
  it('dragLimitPx は原寸と容器の小さいほう', () => {
    expect(dragLimitPx(300, 800)).toBe(300);
    expect(dragLimitPx(1600, 800)).toBe(800);
  });
  it('toPercent は 5% 刻みで 5〜100', () => {
    expect(toPercent(400, 800)).toBe(50);
    expect(toPercent(10, 800)).toBe(5);
    expect(toPercent(820, 800)).toBe(100);
    expect(toPercent(286, 800)).toBe(35);
  });
});
