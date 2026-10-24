export function nextSetNumber(sets: { setNumber: number }[]): number {
  return sets.reduce((max, s) => Math.max(max, s.setNumber), 0) + 1;
}
