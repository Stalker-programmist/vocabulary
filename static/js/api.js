export async function apiRequest(path, options = {}) {
  const settings = {
    headers: { "Content-Type": "application/json" },
    ...options,
  };
  const response = await fetch(path, settings);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

