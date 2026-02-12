const STORAGE_PREFIX = "vocabulary.cards.order.v2";
const ITEM_SELECTOR = ".card[data-card-id], .stat-card[data-card-id]";
const DROP_TARGET_SELECTOR = ".card.is-drop-target, .stat-card.is-drop-target";

function getItemId(itemEl) {
  return itemEl?.dataset?.cardId || null;
}

function getContainerKey(container) {
  const scope = container?.dataset?.dndScope;
  if (scope) return `${STORAGE_PREFIX}:${scope}`;
  return `${STORAGE_PREFIX}:default`;
}

function loadOrder(container) {
  try {
    const raw = window.localStorage.getItem(getContainerKey(container));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveOrder(container) {
  const items = Array.from(container.querySelectorAll(ITEM_SELECTOR));
  const ids = items.map(getItemId).filter(Boolean);
  window.localStorage.setItem(getContainerKey(container), JSON.stringify(ids));
}

function applySavedOrder(container) {
  const saved = loadOrder(container);
  if (!saved || !saved.length) return;

  const items = Array.from(container.querySelectorAll(ITEM_SELECTOR));
  const byId = new Map(items.map((item) => [getItemId(item), item]));

  const ordered = [];
  saved.forEach((id) => {
    const item = byId.get(id);
    if (item) ordered.push(item);
  });
  items.forEach((item) => {
    if (!ordered.includes(item)) ordered.push(item);
  });

  ordered.forEach((item) => container.appendChild(item));
}

function nearestItem(container, x, y, excludeEl) {
  const items = Array.from(container.querySelectorAll(ITEM_SELECTOR)).filter(
    (el) => el !== excludeEl
  );

  let best = null;
  let bestDist = Infinity;

  items.forEach((item) => {
    const rect = item.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = item;
    }
  });

  return best;
}

function clearDropTargets(container) {
  container
    .querySelectorAll(DROP_TARGET_SELECTOR)
    .forEach((el) => el.classList.remove("is-drop-target"));
}

let globalListenersReady = false;
let active = {
  container: null,
  item: null,
  preview: null,
};

function ensureGlobalListeners() {
  if (globalListenersReady) return;
  globalListenersReady = true;

  document.addEventListener("dragover", (event) => {
    if (!active.preview) return;
    active.preview.style.left = `${event.clientX}px`;
    active.preview.style.top = `${event.clientY}px`;
  });
}

function initContainer(container) {
  if (!container) return;

  applySavedOrder(container);

  const transparentImg = new Image();
  transparentImg.src =
    "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

  const handles = container.querySelectorAll(".drag-handle[draggable='true']");
  handles.forEach((handle) => {
    handle.addEventListener("dragstart", (event) => {
      const item = handle.closest(ITEM_SELECTOR);
      if (!item) return;
      active.container = container;
      active.item = item;
      item.classList.add("is-dragging");

      // Required for Firefox to initiate drag.
      event.dataTransfer?.setData("text/plain", getItemId(item) || "");
      event.dataTransfer && (event.dataTransfer.effectAllowed = "move");
      event.dataTransfer?.setDragImage(transparentImg, 0, 0);

      active.preview = item.cloneNode(true);
      active.preview.classList.add("drag-preview");
      active.preview.style.width = `${item.offsetWidth}px`;
      document.body.appendChild(active.preview);
    });

    handle.addEventListener("dragend", () => {
      if (active.item) active.item.classList.remove("is-dragging");
      if (active.container) {
        clearDropTargets(active.container);
        saveOrder(active.container);
      }
      if (active.preview) {
        active.preview.remove();
      }
      active = { container: null, item: null, preview: null };
    });
  });

  container.addEventListener("dragover", (event) => {
    if (!active.item || active.container !== container) return;
    event.preventDefault();

    const target = nearestItem(container, event.clientX, event.clientY, active.item);
    clearDropTargets(container);
    if (target) target.classList.add("is-drop-target");
  });

  container.addEventListener("drop", (event) => {
    if (!active.item || active.container !== container) return;
    event.preventDefault();

    const target = nearestItem(container, event.clientX, event.clientY, active.item);
    clearDropTargets(container);
    if (!target || target === active.item) return;

    const rect = target.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const before =
      event.clientY < cy ||
      (Math.abs(event.clientY - cy) < 12 && event.clientX < cx);

    if (before) {
      container.insertBefore(active.item, target);
    } else {
      container.insertBefore(active.item, target.nextSibling);
    }

    saveOrder(container);
  });
}

export function initCardsDragAndDrop() {
  ensureGlobalListeners();
  const containers = document.querySelectorAll(
    "#words .grid, #review .grid, #profile .grid, #stats .stats-grid"
  );
  containers.forEach(initContainer);
}

// Обратная совместимость: старое имя функции.
export function initWordsCardsDragAndDrop() {
  initCardsDragAndDrop();
}

