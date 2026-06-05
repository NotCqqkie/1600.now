const DESMOS_UI_STATE_SUFFIXES = ["window", "layout", "open", "split-position"] as const;

export const getDesmosStoragePrefix = (storageScope: string) => `${storageScope}:desmos:`;

export const clearDesmosUiState = (storageArea: Storage, storageScope: string) => {
  const prefix = getDesmosStoragePrefix(storageScope);
  DESMOS_UI_STATE_SUFFIXES.forEach((suffix) => {
    storageArea.removeItem(`${prefix}${suffix}`);
  });
};
