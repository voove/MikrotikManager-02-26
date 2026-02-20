import Cookies from "js-cookie";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = Cookies.get("mm_token");
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export function setToken(token: string) {
  Cookies.set("mm_token", token, { expires: 7, sameSite: "strict" });
}

export function clearToken() {
  Cookies.remove("mm_token");
}

export function getToken() {
  return Cookies.get("mm_token");
}
