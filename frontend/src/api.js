import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

let refreshPromise = null;

const refreshAccessToken = () => {
  if (refreshPromise) return refreshPromise;
  refreshPromise = axios
    .post("/api/auth/refresh", null, { withCredentials: true })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {};
    const url = original.url || "";
    const status = error.response?.status;
    const isAuthCheck = url.includes("/auth/me");
    const isRefreshCall = url.includes("/auth/refresh");
    const isOnLogin = window.location.pathname === "/login";

    if (status === 401 && !isRefreshCall && !original._retried) {
      original._retried = true;
      try {
        await refreshAccessToken();
        return api(original);
      } catch {
        if (!isAuthCheck && !isOnLogin) {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
