import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

const TOKEN_KEY = "complybd_token";
const USER_KEY = "complybd_user";

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Response handling.
 *
 * Two jobs:
 *
 * 1. A stale token would otherwise make every screen fail with an unexplained
 *    error. On a 401 the session is cleared and the app returns to the login
 *    page — except when the failing call *is* the login attempt, where the
 *    server's own message ("Invalid credentials") is what the user needs.
 *
 * 2. Callers throughout the app read `err.response.data.message`. When the API
 *    is unreachable there is no response at all, so that read yields undefined
 *    and the UI shows a blank error. Filling in a useful message here means
 *    every screen gets a sensible one without repeating the check.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || "";
    const isAuthCall = url.includes("/auth/login") || url.includes("/auth/me");

    if (status === 401 && !isAuthCall) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }

    if (!error.response) {
      error.response = {
        data: {
          message:
            "Cannot reach the ComplyBD API. Check that the server is running on port 5000 (npm run dev).",
        },
      };
    } else if (!error.response.data?.message) {
      const fallback = {
        403: "You do not have access to this.",
        404: "That record no longer exists.",
        500: "The server hit an unexpected error. Check the API logs.",
      };
      error.response.data = {
        ...error.response.data,
        message: fallback[status] || `Request failed (${status}).`,
      };
    }

    return Promise.reject(error);
  }
);

export default api;
