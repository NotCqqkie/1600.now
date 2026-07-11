export const createAbortableRequestGuard = () => {
  const controller = new AbortController();
  let active = true;

  return {
    signal: controller.signal,
    canCommit: () => active,
    abort: () => {
      active = false;
      controller.abort();
    },
  };
};
