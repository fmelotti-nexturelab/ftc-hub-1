import { apiClient } from "@/api/client"

// Client per /api/utilities/check-prezzi
// Lista cambi prezzi: GET per leggere lo stato corrente, PUT per sostituire.
export const checkPrezziApi = {
  getLista: (entity) =>
    apiClient.get(`/api/utilities/check-prezzi/lista/${entity}`).then((r) => r.data),

  replaceLista: (entity, { items, source_filename }) =>
    apiClient
      .put(`/api/utilities/check-prezzi/lista/${entity}`, {
        items,
        source_filename,
      })
      .then((r) => r.data),
}
