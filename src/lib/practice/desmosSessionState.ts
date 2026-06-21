export type DesmosStorageKeys = Readonly<{
  calculator: string;
  window: string;
  layout: string;
  open: string;
  splitPosition: string;
}>;

export const getDesmosStoragePrefix = (storageScope: string): string => `${storageScope}:desmos:`;

export const getDesmosStorageKeys = (storageScope: string): DesmosStorageKeys => {
  const prefix = getDesmosStoragePrefix(storageScope);
  return {
    calculator: `${prefix}calculator`,
    window: `${prefix}window`,
    layout: `${prefix}layout`,
    open: `${prefix}open`,
    splitPosition: `${prefix}split-position`,
  };
};

export const clearDesmosUiState = (storageArea: Storage, storageScope: string): void => {
  const keys = getDesmosStorageKeys(storageScope);
  storageArea.removeItem(keys.window);
  storageArea.removeItem(keys.layout);
  storageArea.removeItem(keys.open);
  storageArea.removeItem(keys.splitPosition);
};
