const axios = require("axios");

const http = axios.create({
  timeout: 15000,
  headers: { "User-Agent": "offset-server/1.0" },
});

async function fetchJson(url) {
  const res = await http.get(url);
  return res.data;
}

module.exports = { http, fetchJson };
