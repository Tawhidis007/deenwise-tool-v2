import { api } from "./client";

export const login = async ({ username, password }) => {
  const { data } = await api.post("/auth/login", { username, password });
  return data;
};

export const changePassword = async ({ username, currentPassword, newPassword }) => {
  const { data } = await api.post("/auth/change-password", {
    username,
    current_password: currentPassword,
    new_password: newPassword,
  });
  return data;
};
