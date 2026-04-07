export type EnderStorageColor = {
  name: string;
  color: number;
};

export type EnderStorageItem = {
  name: string;
  displayName: string;
  rawName: string;
  maxCount: number;
  count: number;
  mapColor?: number;
  mapColour?: number;
  itemGroups: Record<string, unknown>;
  tags: Record<string, unknown>;
  [key: string]: unknown;
};

export type EnderStorageChest = {
  colors: EnderStorageColor[];
  contents: Record<string, EnderStorageItem>;
  name?: string;
  description?: string;
  displayName?: string;
  [key: string]: unknown;
};

export type EnderStorageCollection = {
  data: EnderStorageChest[];
  retrievedAt: string;
};

export type EnderStorageMeta = {
  timestamp: string;
  elapsed: number;
  version: string;
  requestId: string;
  [key: string]: unknown;
};

export type EnderStorageApiPayload = {
  success: boolean;
  data: EnderStorageCollection;
  meta?: EnderStorageMeta;
  [key: string]: unknown;
};

export type EnderStoragePayload = EnderStorageApiPayload | EnderStorageChest[];

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isChest = (value: unknown): value is EnderStorageChest => {
  if (!isObject(value)) {
    return false;
  }

  const { colors, contents } = value;
  return Array.isArray(colors) && isObject(contents);
};

export const isEnderStoragePayload = (value: unknown): value is EnderStoragePayload => {
  if (Array.isArray(value)) {
    return value.every(isChest);
  }

  if (!isObject(value)) {
    return false;
  }

  const data = value.data;
  if (!isObject(data)) {
    return false;
  }

  const chests = data.data;
  return Array.isArray(chests) && chests.every(isChest);
};
