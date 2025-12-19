import { api } from "./client";

export const exportProducts = async () => {
  const { data } = await api.get("/exports/products");
  return data;
};

export const exportOpex = async () => {
  const { data } = await api.get("/exports/opex");
  return data;
};

export const exportCampaign = async (id) => {
  const { data } = await api.get(`/exports/campaigns/${id}`);
  return data;
};

export const exportScenario = async (id) => {
  const { data } = await api.get(`/exports/scenarios/${id}`);
  return data;
};
