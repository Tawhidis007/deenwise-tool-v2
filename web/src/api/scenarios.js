import { api } from "./client";

export const fetchScenarios = async () => {
  const { data } = await api.get("/scenarios");
  return data.items || [];
};

export const createScenario = async (payload) => {
  const { data } = await api.post("/scenarios", payload);
  return data;
};

export const updateScenario = async ({ id, payload }) => {
  const { data } = await api.put(`/scenarios/${id}`, payload);
  return data;
};

export const deleteScenario = async (id) => {
  await api.delete(`/scenarios/${id}`);
  return id;
};

export const linkScenarioCampaign = async ({ id, campaign_id }) => {
  const { data } = await api.put(`/scenarios/${id}/campaign`, { campaign_id });
  return data;
};

export const saveScenarioProducts = async ({ id, rows }) => {
  const { data } = await api.put(`/scenarios/${id}/products`, rows);
  return data;
};

export const saveScenarioOpex = async ({ id, rows }) => {
  const { data } = await api.put(`/scenarios/${id}/opex`, rows);
  return data;
};

export const saveScenarioFx = async ({ id, rows }) => {
  const { data } = await api.put(`/scenarios/${id}/fx`, rows);
  return data;
};

export const fetchScenarioForecast = async (id) => {
  const { data } = await api.get(`/scenarios/${id}/forecast`);
  return data;
};
