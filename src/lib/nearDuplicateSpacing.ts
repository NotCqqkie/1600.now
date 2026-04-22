/**
 * Reorders a list so that no two items sharing the same "fingerprint"
 * end up adjacent, while otherwise preserving the original order as much
 * as possible. Used to prevent near-identical question-bank items (same
 * wording, different numbers) from appearing back-to-back.
 *
 * If a fingerprint group is larger than ceil(n/2), perfect spacing is
 * impossible; remaining duplicates are appended at the end.
 */
export function spaceOutNearDuplicates<T>(
  items: T[],
  getFingerprint: (item: T) => string,
): T[] {
  if (items.length <= 1) return items.slice();

  const fps = items.map(getFingerprint);

  // Fast path — no duplicates at all.
  const counts = new Map<string, number>();
  for (const fp of fps) counts.set(fp, (counts.get(fp) ?? 0) + 1);
  let anyDup = false;
  for (const c of counts.values()) {
    if (c > 1) { anyDup = true; break; }
  }
  if (!anyDup) return items.slice();

  // First pass: stream through in original order; defer any item whose
  // fingerprint equals the one we just placed.
  const result: T[] = [];
  const resultFps: string[] = [];
  const deferred: { item: T; fp: string }[] = [];
  let prevFp: string | null = null;

  for (let i = 0; i < items.length; i++) {
    const fp = fps[i];
    if (fp === prevFp) {
      deferred.push({ item: items[i], fp });
      continue;
    }
    result.push(items[i]);
    resultFps.push(fp);
    prevFp = fp;
  }

  // Second pass: insert each deferred item into the earliest gap where
  // neither neighbor shares its fingerprint.
  for (const { item, fp } of deferred) {
    let inserted = false;
    for (let i = 1; i < result.length; i++) {
      if (resultFps[i - 1] !== fp && resultFps[i] !== fp) {
        result.splice(i, 0, item);
        resultFps.splice(i, 0, fp);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      // Oversized group — append; adjacency here is unavoidable.
      result.push(item);
      resultFps.push(fp);
    }
  }

  return result;
}

/**
 * Fingerprint for a question-bank item. Strips digits and collapses
 * whitespace so that questions with identical wording but different
 * numeric values (years, quantities, etc.) collide. Passage/stem text
 * is included because each bank question carries its own stem; genuinely
 * different questions produce different fingerprints even when they
 * share a skill.
 */
export function questionFingerprint(q: {
  prompt?: string;
  questionText?: string;
  passage?: string;
}): string {
  const raw = `${q.passage ?? ""}\n${q.questionText ?? ""}\n${q.prompt ?? ""}`;
  return raw
    .toLowerCase()
    .replace(/\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
