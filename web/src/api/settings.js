import { api } from "./client";

export const fetchDisplaySettings = async () => {
  const { data } = await api.get("/settings/display");
  return data;
};

export const updateDisplaySettings = async (payload) => {
  const { data } = await api.put("/settings/display", payload);
  return data;
};
