/**
 * Up/down boundary check for a display_order-sorted list rendered in one flat table (Topics,
 * Subtopics) — the list itself already comes back scope-then-order sorted (admin-topics'/
 * admin-subtopics' own `.order(scopeColumn).order("display_order")`), so a row is only "first"/
 * "last" relative to its own scope group, not the whole table. Exams/Subjects have no scope
 * (global order), so callers there just pass `undefined` for `scopeKey`, matching plain
 * first/last-of-array checks.
 */
export function isFirstInScope<T>(list: T[], index: number, scopeKey?: (item: T) => string): boolean {
  if (index === 0) return true
  if (!scopeKey) return false
  return scopeKey(list[index]) !== scopeKey(list[index - 1])
}

export function isLastInScope<T>(list: T[], index: number, scopeKey?: (item: T) => string): boolean {
  if (index === list.length - 1) return true
  if (!scopeKey) return false
  return scopeKey(list[index]) !== scopeKey(list[index + 1])
}
