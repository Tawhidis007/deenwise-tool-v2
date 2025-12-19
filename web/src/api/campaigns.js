import { api } from "./client";

export const fetchCampaigns = async () => {
  const { data } = await api.get("/campaigns");
  return data.items || [];
};

export const createCampaign = async (payload) => {
  const { data } = await api.post("/campaigns", payload);
  return data;
};

export const updateCampaign = async ({ id, payload }) => {
  const { data } = await api.put(`/campaigns/${id}`, payload);
  return data;
};

export const fetchCampaignInputs = async (id) => {
  const { data } = await api.get(`/campaigns/${id}/inputs`);
  return data;
};

export const saveCampaignQuantities = async ({ id, quantities }) => {
  const { data } = await api.put(`/campaigns/${id}/quantities`, { quantities });
  return data;
};

export const saveCampaignMonthWeights = async ({ id, weights }) => {
  const { data } = await api.put(`/campaigns/${id}/month-weights`, weights);
  return data;
};

export const saveProductMonthWeights = async ({ id, weights }) => {
  const { data } = await api.put(`/campaigns/${id}/product-month-weights`, weights);
  return data;
};

export const saveSizeBreakdown = async ({ id, sizes }) => {
  const { data } = await api.put(`/campaigns/${id}/sizes`, sizes);
  return data;
};

export const fetchCampaignForecast = async (id) => {
  const { data } = await api.get(`/campaigns/${id}/forecast`, {
    params: { includeSizes: true },
  });
  return data;
};
