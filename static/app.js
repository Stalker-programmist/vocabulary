const state = {
  words: [],
  reviewQueue: [],
  currentReview: null,
  editingId: null,
};

const elements = {
  tabs: document.querySelectorAll(".tab"),
  sections: document.querySelectorAll(".section"),
  wordsBody: document.querySelector("#words-body"),
  form: document.querySelector("#word-form"),
  formTitle: document.querySelector("#form-title"),
  saveWord: document.querySelector("#save-word"),
  cancelEdit: document.querySelector("#cancel-edit"),
  formStatus: document.querySelector("#form-status"),
  searchStatus: document.querySelector("#search-status"),
  searchInput: document.querySelector("#search-input"),
  tagFilter: document.querySelector("#tag-filter"),
  refreshWords: document.querySelector("#refresh-words"),
  refreshReview: document.querySelector("#refresh-review"),
  reviewMeta: document.querySelector("#review-meta"),
  reviewTerm: document.querySelector("#review-term"),
  reviewTranslation: document.querySelector("#review-translation"),
  showTranslation: document.querySelector("#show-translation"),
  markGood: document.querySelector("#mark-good"),
  markBad: document.querySelector("#mark-bad"),
  reviewStatus: document.querySelector("#review-status"),
  reviewQueue: document.querySelector("#review-queue"),
  statDueToday: document.querySelector("#stat-due-today"),
  statReviewedToday: document.querySelector("#stat-reviewed-today"),
  statNew7d: document.querySelector("#stat-new-7d"),
  statDue7d: document.querySelector("#stat-due-7d"),
  refreshStats: document.querySelector("#refresh-stats"),
};

function setStatus(el, message, tone = "") {
  el.textContent = message;
  el.dataset.tone = tone;
}

async function apiRequest(path, options = {}) {
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

function formatDate(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\\d{4}-\\d{2}-\\d{2}$/.test(value)) {
    return value;
  }
  const dateValue = new Date(value);
  if (Number.isNaN(dateValue.getTime())) return value;
  return dateValue.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function resetForm() {
  elements.form.reset();
  state.editingId = null;
  elements.formTitle.textContent = "Add a word";
  elements.saveWord.textContent = "Add word";
  elements.cancelEdit.hidden = true;
  setStatus(elements.formStatus, "");
}

function startEdit(word) {
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

function renderWords(words) {
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
    editBtn.addEventListener("click", () => startEdit(word));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "ghost";
    deleteBtn.type = "button";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", async () => {
      if (!confirm("Delete this word?")) return;
      try {
        await apiRequest(`/api/words/${word.id}`, { method: "DELETE" });
        await loadWords();
        await loadStats();
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

async function loadWords() {
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
    renderWords(data);
    setStatus(elements.searchStatus, data.length ? "" : "No matches found.");
  } catch (err) {
    setStatus(elements.searchStatus, err.message || "Load failed");
  }
}

async function loadStats() {
  try {
    const data = await apiRequest("/api/stats");
    elements.statDueToday.textContent = data.today_due_count;
    elements.statReviewedToday.textContent = data.reviewed_today_count;
    elements.statNew7d.textContent = data.new_words_7d;
    elements.statDue7d.textContent = data.due_next_7d;
  } catch (err) {
    setStatus(elements.reviewStatus, err.message || "Stats failed");
  }
}

function setReviewButtons(enabled) {
  elements.markGood.disabled = !enabled;
  elements.markBad.disabled = !enabled;
}

function renderReviewCard() {
  if (!state.reviewQueue.length) {
    state.currentReview = null;
    elements.reviewMeta.textContent = "No words due right now.";
    elements.reviewTerm.textContent = "All caught up";
    elements.reviewTranslation.hidden = true;
    elements.reviewTranslation.textContent = "";
    elements.showTranslation.disabled = true;
    setReviewButtons(false);
    elements.reviewQueue.textContent = "Queue empty. Add more words to keep the loop going.";
    return;
  }

  if (!state.currentReview) {
    state.currentReview = state.reviewQueue.shift();
  }

  const word = state.currentReview;
  elements.reviewMeta.textContent = `Stage ${word.stage} - next review ${formatDate(word.next_review)}`;
  elements.reviewTerm.textContent = word.term;
  elements.reviewTranslation.textContent = word.translation;
  elements.reviewTranslation.hidden = true;
  elements.showTranslation.disabled = false;
  setReviewButtons(false);
  elements.reviewQueue.textContent = `Remaining in queue: ${state.reviewQueue.length}`;
}

async function loadReviewQueue() {
  setStatus(elements.reviewStatus, "Loading batch...");
  try {
    const data = await apiRequest("/api/review/today?limit=20");
    state.reviewQueue = data;
    state.currentReview = null;
    renderReviewCard();
    setStatus(elements.reviewStatus, "");
  } catch (err) {
    setStatus(elements.reviewStatus, err.message || "Review load failed");
  }
}

async function submitReview(result) {
  if (!state.currentReview) return;
  try {
    await apiRequest(`/api/review/${state.currentReview.id}`, {
      method: "POST",
      body: JSON.stringify({ result }),
    });
    state.currentReview = null;
    renderReviewCard();
    await loadStats();
    await loadWords();
  } catch (err) {
    setStatus(elements.reviewStatus, err.message || "Review failed");
  }
}

function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}

function switchSection(targetId) {
  elements.sections.forEach((section) => {
    section.classList.toggle("is-active", section.id === targetId);
  });
  elements.tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.section === targetId);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("page-loaded");
  resetForm();
  loadWords();
  loadReviewQueue();
  loadStats();

  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      switchSection(tab.dataset.section);
    });
  });

  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      term: elements.form.term.value.trim(),
      translation: elements.form.translation.value.trim(),
      example: elements.form.example.value.trim(),
      tags: elements.form.tags.value.trim(),
    };
    try {
      if (state.editingId) {
        await apiRequest(`/api/words/${state.editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setStatus(elements.formStatus, "Saved.");
      } else {
        await apiRequest("/api/words", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setStatus(elements.formStatus, "Added.");
      }
      resetForm();
      await loadWords();
      await loadStats();
    } catch (err) {
      setStatus(elements.formStatus, err.message || "Save failed");
    }
  });

  elements.cancelEdit.addEventListener("click", () => {
    resetForm();
  });

  elements.refreshWords.addEventListener("click", () => {
    loadWords();
  });

  elements.refreshReview.addEventListener("click", () => {
    loadReviewQueue();
  });

  elements.refreshStats.addEventListener("click", () => {
    loadStats();
  });

  elements.showTranslation.addEventListener("click", () => {
    elements.reviewTranslation.hidden = false;
    setReviewButtons(true);
  });

  elements.markGood.addEventListener("click", () => submitReview("good"));
  elements.markBad.addEventListener("click", () => submitReview("bad"));

  const runSearch = debounce(loadWords, 300);
  elements.searchInput.addEventListener("input", runSearch);
  elements.tagFilter.addEventListener("input", runSearch);
});
