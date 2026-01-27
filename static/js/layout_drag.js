const STORAGE_KEY = "vocabulary.words.cards.order.v1";

function getCardId(cardEl) {
  return cardEl?.dataset?.cardId || null;
}

function loadOrder() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveOrder(cards) {
  const ids = cards.map(getCardId).filter(Boolean);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

function applySavedOrder(container) {
  const saved = loadOrder();
  if (!saved || !saved.length) return;

  const cards = Array.from(container.querySelectorAll(".card[data-card-id]"));
  const byId = new Map(cards.map((card) => [getCardId(card), card]));

  const ordered = [];
  saved.forEach((id) => {
    const card = byId.get(id);
    if (card) ordered.push(card);
  });
  cards.forEach((card) => {
    if (!ordered.includes(card)) ordered.push(card);
  });

  ordered.forEach((card) => container.appendChild(card));
}

function nearestCard(container, x, y, excludeEl) {
  const cards = Array.from(container.querySelectorAll(".card[data-card-id]")).filter(
    (el) => el !== excludeEl
  );

  let best = null;
  let bestDist = Infinity;

  cards.forEach((card) => {
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = card;
    }
  });

  return best;
}

function clearDropTargets(container) {
  container
    .querySelectorAll(".card.is-drop-target")
    .forEach((el) => el.classList.remove("is-drop-target"));
}

export function initWordsCardsDragAndDrop() {
  const container = document.querySelector("#words .grid");
  if (!container) return;

  applySavedOrder(container);

  let draggingCard = null;
  let preview = null;
  const transparentImg = new Image();
  transparentImg.src =
    "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

  const handles = container.querySelectorAll(".drag-handle[draggable='true']");
  handles.forEach((handle) => {
    handle.addEventListener("dragstart", (event) => {
      const card = handle.closest(".card[data-card-id]");
      if (!card) return;
      draggingCard = card;
      card.classList.add("is-dragging");

      // Required for Firefox to initiate drag.
      event.dataTransfer?.setData("text/plain", getCardId(card) || "");
      event.dataTransfer && (event.dataTransfer.effectAllowed = "move");
      event.dataTransfer?.setDragImage(transparentImg, 0, 0);

      preview = card.cloneNode(true);
      preview.classList.add("drag-preview");
      preview.style.width = `${card.offsetWidth}px`;
      document.body.appendChild(preview);
    });

    handle.addEventListener("dragend", () => {
      if (draggingCard) draggingCard.classList.remove("is-dragging");
      draggingCard = null;
      clearDropTargets(container);
      saveOrder(Array.from(container.querySelectorAll(".card[data-card-id]")));
      if (preview) {
        preview.remove();
        preview = null;
      }
    });
  });

  document.addEventListener("dragover", (event) => {
    if (!preview) return;
    preview.style.left = `${event.clientX}px`;
    preview.style.top = `${event.clientY}px`;
  });

  container.addEventListener("dragover", (event) => {
    if (!draggingCard) return;
    event.preventDefault();

    const target = nearestCard(container, event.clientX, event.clientY, draggingCard);
    clearDropTargets(container);
    if (target) target.classList.add("is-drop-target");
  });

  container.addEventListener("drop", (event) => {
    if (!draggingCard) return;
    event.preventDefault();

    const target = nearestCard(container, event.clientX, event.clientY, draggingCard);
    clearDropTargets(container);
    if (!target || target === draggingCard) return;

    const rect = target.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const before = event.clientY < cy || (Math.abs(event.clientY - cy) < 12 && event.clientX < cx);

    if (before) {
      container.insertBefore(draggingCard, target);
    } else {
      container.insertBefore(draggingCard, target.nextSibling);
    }

    saveOrder(Array.from(container.querySelectorAll(".card[data-card-id]")));
  });
}

