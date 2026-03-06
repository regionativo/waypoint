const STORAGE = chrome.storage.local;

export async function get(keys) {
  return STORAGE.get(keys);
}

export async function set(data) {
  return STORAGE.set(data);
}

export async function remove(keys) {
  return STORAGE.remove(keys);
}

export async function getAll() {
  return STORAGE.get(null);
}

const SCHEMA_VERSION = 1;

export async function initialize() {
  const { schemaVersion } = await get('schemaVersion');
  if (!schemaVersion) {
    await set({
      schemaVersion: SCHEMA_VERSION,
      bookmarks: {},
      tagIndex: {},
      tagUsage: {},
      domainTags: {},
      speedDial: [null, null, null, null, null, null, null, null, null, null],
    });
  }
}
