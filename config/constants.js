const URLS = {
  offsets:
    "https://raw.githubusercontent.com/a2x/cs2-dumper/refs/heads/main/output/offsets.json",
  clientDll:
    "https://raw.githubusercontent.com/a2x/cs2-dumper/refs/heads/main/output/client_dll.json",
};

const REQUIRED_KEYS = [
  "dwViewMatrix",
  "dwLocalPlayerPawn",
  "dwEntityList",
  "m_hPlayerPawn",
  "m_iHealth",
  "m_lifeState",
  "m_iTeamNum",
  "m_vOldOrigin",
  "m_pGameSceneNode",
  "m_modelState",
  "m_boneArray",
  "m_nodeToWorld",
  "m_sSanitizedPlayerName",
];

const DEFAULTS = {
  m_boneArray: 128,
};

const CACHE_TTL_MS = 5 * 60 * 1000;

module.exports = { URLS, REQUIRED_KEYS, DEFAULTS, CACHE_TTL_MS };
