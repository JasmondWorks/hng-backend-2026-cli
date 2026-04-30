import { API_URL } from "./config";
import { Credentials } from "../types";

interface RequestOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

export async function apiRequest<T>(
  creds: Credentials,
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, params } = options;

  let url = `${API_URL}/api${path}`;

  if (params) {
    const query = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined) query.set(key, String(val));
    }
    const qs = query.toString();
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${creds.access_token}`,
      "X-API-Version": "1",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json() as T;

  if (!res.ok) {
    const err = data as { message?: string };
    throw new Error(err.message ?? `Request failed with status ${res.status}`);
  }

  return data;
}
