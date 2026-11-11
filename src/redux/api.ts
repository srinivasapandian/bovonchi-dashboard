import axios from "axios";
import { CREDENTIALS } from "../constants";

/** Revamp API – axios instance for product catalog / category endpoints */
const REVAMP_API = axios.create({
  baseURL: (process.env.REACT_APP_API_ENDPOINT_REVAMP || "").replace(/\/$/, ""),
  timeout: 30000,
});

REVAMP_API.interceptors.request.use((config) => {
  try {
    const stored = localStorage.getItem(CREDENTIALS);
    if (stored) {
      const creds = JSON.parse(stored);
      const token = creds?.accessToken || creds?.access_token;
      if (token) {
        config.headers.set("Authorization", `Bearer ${token}`);
      }
    }
  } catch {
    // ignore parse errors
  }
  return config;
});

REVAMP_API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response) {
      switch (err?.response?.status) {
        case 401:
          localStorage.clear();
          window.location.href = "/login";
          break;
        case 403:
        case 409:
        case 400:
        case 500:
          return err?.response;
        default:
          break;
      }
    } else {
      console.error("REVAMP API ERROR:", err);
    }
    throw err;
  }
);

export { REVAMP_API };
