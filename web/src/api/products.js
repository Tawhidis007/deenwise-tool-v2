import { api } from "./client";

export const fetchProducts = async () => {
  const { data } = await api.get("/products");
  return data.items || [];
};

export const createProduct = async (payload) => {
  const { data } = await api.post("/products", payload);
  return data;
};

export const updateProduct = async ({ id, payload }) => {
  const { data } = await api.put(`/products/${id}`, payload);
  return data;
};

export const deleteProduct = async (id) => {
  await api.delete(`/products/${id}`);
  return id;
};
