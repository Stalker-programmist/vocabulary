import { apiRequest } from "./api.js";
import { confirmAction } from "./modal.js";
import { formatDate, setStatus } from "./utils.js";

export function resetForm({ state, elements }) {
  elements.form.reset();
  state.editingId = null;
  elements.formTitle.textContent = "Add a word";
  elements.saveWord.textContent = "Add word";
  elements.cancelEdit.hidden = true;
  setStatus(elements.formStatus, "");
}

async function toggleStar(ctx, word) {
  const { elements } = ctx;
  try {
    await apiRequest(`/api/words/${word.id}`, {
      method: "PATCH",
      body: JSON.stringify({ starred: !Boolean(word.starred) }),
    });
    await loadWords(ctx);
    // Если профиль открыт — обновим список избранного.
    ctx.profile?.refresh?.();
  } catch (error) {
    setStatus(elements.formStatus, error?.message || "Failed to update");
  }
}

function startEdit({ state, elements }, word) {
  state.editingId = word.id;
  elements.formTitle.textContent = "Edit word";
  elements.saveWord.textContent = "Save changes";
  elements.cancelEdit.hidden = false;
  elements.form.term.value = word.term;
  elements.form.translation.value = word.translation;
  elements.form.example.value = word.example || "";
  elements.form.tags.value = word.tags || "";
  elements.form.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function renderWords(ctx, words) {
  const { elements } = ctx;
  elements.wordsBody.innerHTML = "";
  if (!words.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.textContent = "No words yet. Add the first one.";
    row.appendChild(cell);
    elements.wordsBody.appendChild(row);
    return;
  }

  words.forEach((word) => {
    const row = document.createElement("tr");

    const term = document.createElement("td");
    term.textContent = word.term;

    const translation = document.createElement("td");
    translation.textContent = word.translation;

    const example = document.createElement("td");
    example.textContent = word.example || "";

    const tags = document.createElement("td");
    tags.textContent = word.tags || "";

    const stage = document.createElement("td");
    stage.textContent = word.stage;

    const nextReview = document.createElement("td");
    nextReview.textContent = formatDate(word.next_review);

    const actions = document.createElement("td");
    const actionsWrap = document.createElement("div");
    actionsWrap.className = "actions";

    const starBtn = document.createElement("button");
    starBtn.className = "star-btn";
    starBtn.type = "button";
    starBtn.textContent = word.starred ? "★" : "☆";
    starBtn.title = word.starred ? "Unstar" : "Star";
    starBtn.setAttribute("aria-label", starBtn.title);
    starBtn.dataset.starred = word.starred ? "1" : "0";
    starBtn.addEventListener("click", () => toggleStar(ctx, word));

    const editBtn = document.createElement("button");
    editBtn.className = "ghost";
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => startEdit(ctx, word));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "ghost";
    deleteBtn.type = "button";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", async () => {
      const ok = await confirmAction(ctx, "Delete this word?");
      if (!ok) return;
      try {
        await apiRequest(`/api/words/${word.id}`, { method: "DELETE" });
        await loadWords(ctx);
      } catch (err) {
        setStatus(elements.formStatus, err.message || "Delete failed");
      }
    });

    actionsWrap.appendChild(starBtn);
    actionsWrap.appendChild(editBtn);
    actionsWrap.appendChild(deleteBtn);
    actions.appendChild(actionsWrap);

    row.appendChild(term);
    row.appendChild(translation);
    row.appendChild(example);
    row.appendChild(tags);
    row.appendChild(stage);
    row.appendChild(nextReview);
    row.appendChild(actions);

    elements.wordsBody.appendChild(row);
  });
}

function updatePagingUI(ctx, totalLoaded) {
  const { state, elements } = ctx;
  const paging = state.wordsPaging;

  if (elements.wordlistPrev) elements.wordlistPrev.disabled = !paging.hasPrev;
  if (elements.wordlistNext) elements.wordlistNext.disabled = !paging.hasNext;

  if (elements.wordlistPageInfo) {
    if (!totalLoaded) {
      elements.wordlistPageInfo.textContent = "0";
      return;
    }
    const start = paging.offset + 1;
    const end = paging.offset + Math.min(paging.pageSize, totalLoaded);
    elements.wordlistPageInfo.textContent = `${start}–${end}`;
  }
}

function buildQueryKey({ q, tag, starredOnly, pageSize }) {
  return JSON.stringify({ q, tag, starredOnly, pageSize });
}

export async function loadWords(ctx, { resetOffset = false } = {}) {
  const { state, elements } = ctx;
  const paging = state.wordsPaging;
  const q = elements.searchInput.value.trim();
  const tag = elements.tagFilter.value.trim();
  const params = new URLSearchParams();
  if (q) params.append("q", q);
  if (tag) params.append("tag", tag);
  const starredOnly = Boolean(elements.starredFilter?.checked);
  if (starredOnly) params.append("starred", "true");
  const pageSize = Number(elements.wordlistPageSize?.value || paging.pageSize || 10);
  paging.pageSize = [5, 10, 15, 20].includes(pageSize) ? pageSize : 10;

  const key = buildQueryKey({ q, tag, starredOnly, pageSize: paging.pageSize });
  const keyChanged = key !== paging.lastKey;
  if (resetOffset || keyChanged) paging.offset = 0;
  paging.lastKey = key;

  const limit = paging.pageSize + 1;
  params.append("limit", String(limit));
  params.append("offset", String(paging.offset));
  const query = params.toString();
  const path = query ? `/api/words?${query}` : "/api/words";
  setStatus(elements.searchStatus, "Loading...");
  try {
    const data = await apiRequest(path);
    const rows = Array.isArray(data) ? data : [];
    paging.hasNext = rows.length > paging.pageSize;
    paging.hasPrev = paging.offset > 0;
    const pageRows = rows.slice(0, paging.pageSize);

    state.words = pageRows;
    renderWords(ctx, pageRows);
    updatePagingUI(ctx, rows.length);
    setStatus(elements.searchStatus, pageRows.length ? "" : "No matches found.");
  } catch (err) {
    setStatus(elements.searchStatus, err.message || "Load failed");
  }
}

