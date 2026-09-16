export interface VerticalWheelLikeEvent {
  deltaX: number;
  deltaY: number;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export interface WheelScrollTopOptions {
  currentTop: number;
  scrollHeight: number;
  clientHeight: number;
  deltaY: number;
  deltaMode?: number;
}

export function shouldHandleVerticalWheel(
  event: VerticalWheelLikeEvent,
): boolean;

export function calculateWheelScrollTop(
  options: WheelScrollTopOptions,
): number;
