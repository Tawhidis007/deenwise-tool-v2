import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const authToken =
  import.meta.env.VITE_SUPABASE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE ||
  "";

export const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});
