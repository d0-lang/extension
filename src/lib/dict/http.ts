import { normalizeServerUrl } from "../storage"

export const endpoint = (baseUrl: string, path: string): string =>
  `${normalizeServerUrl(baseUrl)}${path}`

export const readJson = async <T>(response: Response, label: string): Promise<T> => {
  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}
