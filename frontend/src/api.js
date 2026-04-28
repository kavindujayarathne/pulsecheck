import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthCheck = error.config?.url?.includes("/auth/me");
    const isOnLogin = window.location.pathname === "/login";

    if (error.response?.status === 401 && !isAuthCheck && !isOnLogin) {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
