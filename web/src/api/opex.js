import { api } from "./client";

export const fetchOpex = async (params = { active: false }) => {
  const { data } = await api.get("/opex", { params });
  return data.items || [];
};

export const createOpex = async (payload) => {
  const { data } = await api.post("/opex", payload);
  return data;
};

export const updateOpex = async ({ id, payload }) => {
  const { data } = await api.put(`/opex/${id}`, payload);
  return data;
};

export const deleteOpex = async (id) => {
  await api.delete(`/opex/${id}`);
  return id;
};

export const saveCampaignOpex = async ({ campaignId, opexIds }) => {
  const { data } = await api.put(`/campaigns/${campaignId}/opex`, { opex_ids: opexIds });
  return data;
};

export const fetchCampaignOpex = async (campaignId) => {
  const { data } = await api.get(`/campaigns/${campaignId}/opex`);
  return data;
};

export const fetchCampaignProfitability = async (campaignId) => {
  const { data } = await api.get(`/campaigns/${campaignId}/profitability`);
  return data;
};
