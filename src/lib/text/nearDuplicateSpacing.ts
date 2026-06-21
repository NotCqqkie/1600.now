export function spaceOutNearDuplicates<T>(
  items: T[],
  getFingerprint: (item: T) => string,
): T[] {
  if (items.length <= 1) return items.slice();

  const fps = items.map(getFingerprint);
  const counts = new Map<string, number>();
  for (const fp of fps) counts.set(fp, (counts.get(fp) ?? 0) + 1);
  let anyDup = false;
  for (const c of counts.values()) {
    if (c > 1) { anyDup = true; break; }
  }
  if (!anyDup) return items.slice();
  const result: T[] = [];
  const resultFps: string[] = [];
  const deferred: { item: T; fp: string }[] = [];
  const appendResult = (item: T, fp: string) => {
    result.push(item);
    resultFps.push(fp);
  };
  const insertResult = (index: number, item: T, fp: string) => {
    result.splice(index, 0, item);
    resultFps.splice(index, 0, fp);
  };
  let prevFp: string | null = null;

  for (let i = 0; i < items.length; i++) {
    const fp = fps[i];
    if (fp === prevFp) {
      deferred.push({ item: items[i], fp });
      continue;
    }
    appendResult(items[i], fp);
    prevFp = fp;
  }
  for (const { item, fp } of deferred) {
    let inserted = false;
    for (let i = 1; i < result.length; i++) {
      if (resultFps[i - 1] !== fp && resultFps[i] !== fp) {
        insertResult(i, item, fp);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      appendResult(item, fp);
    }
  }

  return result;
}

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
