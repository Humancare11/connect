import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  withCredentials: true,
});

// Auto-attach token to every request.
// Do NOT override an Authorization header that was explicitly set by the caller
// (e.g. VideoCall sends doctorToken directly to avoid a stale userToken taking over).
api.interceptors.request.use((config) => {
  if (!config.headers?.Authorization) {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;