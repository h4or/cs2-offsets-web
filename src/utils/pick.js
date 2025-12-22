function applyDefaults(resultObj, defaults) {
  for (const [k, v] of Object.entries(defaults)) {
    if (!(k in resultObj) || resultObj[k] == null) resultObj[k] = v;
  }
}

function pickRequiredKeys(merged, requiredKeys, defaults) {
  const result = {};
  for (const key of requiredKeys) {
    if (key in merged) result[key] = merged[key];
  }

  applyDefaults(result, defaults);

  const missingKeys = requiredKeys.filter((k) => !(k in result));
  return { result, missingKeys };
}

module.exports = { pickRequiredKeys };
