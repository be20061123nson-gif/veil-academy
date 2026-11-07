export function readSetting(key) {
  try { return globalThis.localStorage?.getItem(key) ?? null; }
  catch { return null; }
}

export function writeSetting(key, value) {
  try { globalThis.localStorage?.setItem(key, String(value)); return true; }
  catch { return false; }
}
