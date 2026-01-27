import { apiRequest } from "./api.js";
import { formatDate, setStatus } from "./utils.js";

export function resetForm({ state, elements }) {
  elements.form.reset();
  state.editingId = null;
  elements.formTitle.textContent = "Add a word";
  elements.saveWord.textContent = "Add word";
  elements.cancelEdit.hidden = true;
  setStatus(elements.formStatus, "");
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
      if (!confirm("Delete this word?")) return;
      try {
        await apiRequest(`/api/words/${word.id}`, { method: "DELETE" });
        await loadWords(ctx);
      } catch (err) {
        setStatus(elements.formStatus, err.message || "Delete failed");
      }
    });

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

export async function loadWords(ctx) {
  const { state, elements } = ctx;
  const q = elements.searchInput.value.trim();
  const tag = elements.tagFilter.value.trim();
  const params = new URLSearchParams();
  if (q) params.append("q", q);
  if (tag) params.append("tag", tag);
  const query = params.toString();
  const path = query ? `/api/words?${query}` : "/api/words";
  setStatus(elements.searchStatus, "Loading...");
  try {
    const data = await apiRequest(path);
    state.words = data;
    renderWords(ctx, data);
    setStatus(elements.searchStatus, data.length ? "" : "No matches found.");
  } catch (err) {
    setStatus(elements.searchStatus, err.message || "Load failed");
  }
}

