export async function apiRequest(path, options = {}) {
  const token = window.localStorage.getItem("vocabulary.token");
  const settings = {
    headers: { "Content-Type": "application/json" },
    ...options,
  };
  if (token) {
    settings.headers = {
      ...settings.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  const response = await fetch(path, settings);
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent("auth:required"));
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      window.localStorage.removeItem("vocabulary.token");
      window.dispatchEvent(new CustomEvent("auth:required"));
    }
    const contentType = response.headers.get("Content-Type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      throw new Error(data?.detail || response.statusText);
    }
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}
