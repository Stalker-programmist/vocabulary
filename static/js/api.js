export async function apiRequest(path, options = {}) {
  const settings = {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...options,
  };

  const response = await fetch(path, settings);
  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent("auth:required"));
      window.dispatchEvent(
        new CustomEvent("app:toast", {
          detail: { message: "Please sign in to use this feature." },
        })
      );
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
