/**
 * toast.js
 * Лёгкие уведомления (toast) для фронтенда без библиотек.
 */

let container = null;

function ensureContainer() {
  if (container) return container;
  const node = document.createElement("div");
  node.className = "toast-stack";
  node.setAttribute("role", "status");
  node.setAttribute("aria-live", "polite");
  document.body.appendChild(node);
  container = node;
  return node;
}

export function showToast(message, { timeoutMs = 2600 } = {}) {
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) return;

  const host = ensureContainer();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = text;
  host.appendChild(toast);

  const cleanup = () => toast.remove();
  toast.addEventListener("animationend", (event) => {
    if (event.animationName === "toast-out") cleanup();
  });

  window.setTimeout(() => {
    toast.dataset.closing = "true";
  }, timeoutMs);
}

export function initToasts() {
  ensureContainer();

  window.addEventListener("app:toast", (event) => {
    const detail = event?.detail || {};
    showToast(detail.message || detail.text || "");
  });
}

