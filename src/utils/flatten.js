function flattenDllMap(obj) {
  const flat = {};
  for (const dll of Object.values(obj || {})) {
    if (dll && typeof dll === "object") Object.assign(flat, dll);
  }
  return flat;
}

function flattenClientJson(remoteData) {
  if (!remoteData || typeof remoteData !== "object") return {};
  if (!remoteData["client.dll"]) return {};

  const client = remoteData["client.dll"];
  if (!client || typeof client !== "object") return {};
  if (!client.classes || typeof client.classes !== "object") return {};

  const flat = {};
  for (const cls of Object.values(client.classes)) {
    if (cls?.fields && typeof cls.fields === "object") {
      Object.assign(flat, cls.fields);
    }
  }
  return flat;
}

module.exports = { flattenDllMap, flattenClientJson };
