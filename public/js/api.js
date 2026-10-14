/* Cliente de la API REST. La sesión viaja en una cookie HttpOnly. */

async function request(path, { method = "GET", body } = {}) {
  const options = { method, credentials: "same-origin", headers: {} };
  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(path, options);
  } catch {
    throw new Error("No pudimos conectar con el servidor.");
  }
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body = {}) => request(path, { method: "POST", body }),
  patch: (path, body = {}) => request(path, { method: "PATCH", body }),
  del: (path) => request(path, { method: "DELETE" }),

  // Atajos con significado de dominio
  cars: (status = "all") => request(`/api/cars?status=${status}`),
  car: (id) => request(`/api/cars/${id}`),
  createCar: (data) => request("/api/cars", { method: "POST", body: data }),
  updateCar: (id, data) => request(`/api/cars/${id}`, { method: "PATCH", body: data }),
  deleteCar: (id) => request(`/api/cars/${id}`, { method: "DELETE" }),

  addCarPhoto: (id, data) => request(`/api/cars/${id}/photos`, { method: "POST", body: data }),
  updatePhoto: (id, data) => request(`/api/photos/${id}`, { method: "PATCH", body: data }),
  deletePhoto: (id) => request(`/api/photos/${id}`, { method: "DELETE" }),

  addMod: (carId, data) => request(`/api/cars/${carId}/modifications`, { method: "POST", body: data }),
  updateMod: (id, data) => request(`/api/modifications/${id}`, { method: "PATCH", body: data }),
  deleteMod: (id) => request(`/api/modifications/${id}`, { method: "DELETE" }),
  addModPhoto: (id, data) => request(`/api/modifications/${id}/photos`, { method: "POST", body: data }),
  deleteModPhoto: (id) => request(`/api/mod-photos/${id}`, { method: "DELETE" }),

  addStory: (carId, data) => request(`/api/cars/${carId}/story`, { method: "POST", body: data }),
  updateStory: (id, data) => request(`/api/story/${id}`, { method: "PATCH", body: data }),
  deleteStory: (id) => request(`/api/story/${id}`, { method: "DELETE" }),
  addStoryPhoto: (id, data) => request(`/api/story/${id}/photos`, { method: "POST", body: data }),
  updateStoryPhoto: (id, data) => request(`/api/story-photos/${id}`, { method: "PATCH", body: data }),
  deleteStoryPhoto: (id) => request(`/api/story-photos/${id}`, { method: "DELETE" }),

  garage: () => request("/api/garage"),
  timeline: () => request("/api/timeline"),
  featured: (limit = 24) => request(`/api/memories/featured?limit=${limit}`),
  memoryToday: () => request("/api/memories/today"),
  stats: () => request("/api/stats"),

  // Servicios externos
  decodeVin: (vin) => request(`/api/vin?vin=${encodeURIComponent(vin)}`),

  // Asistente de escritura con IA
  aiStatus: () => request("/api/ai/status"),
  aiAssist: (data) => request("/api/ai/assist", { method: "POST", body: data }),
};
