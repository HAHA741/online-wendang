export function createFortuneHelperRef<T extends object>(
  getWorkbook: () => T | null,
): { readonly current: T | null };
