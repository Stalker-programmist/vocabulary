/**
 * training.js
 * Вход в тренировку: выбор темы (тега) и загрузка всех слов по теме.
 */

import { apiRequest } from "./api.js";
import { formatDate, setStatus } from "./utils.js";

function setText(node, text) {
  if (!node) return;
  node.textContent = text;
}

function clearTable(body) {
  if (!body) return;
  body.innerHTML = "";
}

function renderWordsTable(ctx, words) {
  const { elements } = ctx;
  clearTable(elements.trainingWordsBody);

  if (!elements.trainingWordsBody) return;

  if (!words.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "No words found for this theme.";
    row.appendChild(cell);
    elements.trainingWordsBody.appendChild(row);
    return;
  }

  for (const word of words) {
    const row = document.createElement("tr");

    const term = document.createElement("td");
    term.textContent = word.term;

    const translation = document.createElement("td");
    translation.textContent = word.translation;

    const tags = document.createElement("td");
    tags.textContent = word.tags || "";

    const stage = document.createElement("td");
    stage.textContent = String(word.stage);

    const nextReview = document.createElement("td");
    nextReview.textContent = formatDate(word.next_review);

    row.appendChild(term);
    row.appendChild(translation);
    row.appendChild(tags);
    row.appendChild(stage);
    row.appendChild(nextReview);
    elements.trainingWordsBody.appendChild(row);
  }
}

function buildThemeOptions(select, themes) {
  select.innerHTML = "";

  const all = document.createElement("option");
  all.value = "";
  all.textContent = "All words";
  select.appendChild(all);

  for (const theme of themes) {
    const option = document.createElement("option");
    option.value = theme.tag;
    option.textContent = `${theme.tag} (${theme.count})`;
    select.appendChild(option);
  }
}

export function initTraining(ctx) {
  const { elements, state } = ctx;

  state.training = {
    themesLoaded: false,
    themes: [],
    words: [],
  };

  const refreshThemes = async () => {
    if (!elements.trainingTheme) return;
    if (!state.isAuthed) return;
    setStatus(elements.trainingStatus, "Loading themes...");
    try {
      const themes = await apiRequest("/api/themes");
      state.training.themes = themes;
      state.training.themesLoaded = true;
      buildThemeOptions(elements.trainingTheme, themes);
      setStatus(elements.trainingStatus, "");
    } catch (error) {
      state.training.themesLoaded = false;
      setStatus(elements.trainingStatus, error?.message || "Failed to load themes");
    }
  };

  const loadWordsForTheme = async () => {
    if (!elements.trainingTheme) return;
    if (!state.isAuthed) return;

    const tag = elements.trainingTheme.value;
    setStatus(elements.trainingStatus, "Loading words...");

    try {
      const params = new URLSearchParams();
      params.set("limit", "2000");
      if (tag) params.set("tag", tag);
      const words = await apiRequest(`/api/words?${params.toString()}`);
      state.training.words = words;

      const title = tag ? `Loaded ${words.length} words for “${tag}”.` : `Loaded ${words.length} words.`;
      setText(elements.trainingCount, title);
      renderWordsTable(ctx, words);
      setStatus(elements.trainingStatus, "");
    } catch (error) {
      setStatus(elements.trainingStatus, error?.message || "Failed to load words");
    }
  };

  const clearTraining = () => {
    state.training.themesLoaded = false;
    state.training.themes = [];
    state.training.words = [];
    if (elements.trainingTheme) {
      elements.trainingTheme.innerHTML = "";
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Sign in to load themes";
      elements.trainingTheme.appendChild(option);
    }
    setText(elements.trainingCount, "No words loaded yet.");
    clearTable(elements.trainingWordsBody);
    setStatus(elements.trainingStatus, "");
  };

  elements.trainingStart?.addEventListener("click", () => {
    loadWordsForTheme();
  });

  window.addEventListener("auth:changed", (event) => {
    const isAuthed = Boolean(event?.detail?.isAuthed);
    if (!isAuthed) {
      clearTraining();
      return;
    }
    refreshThemes();
  });

  clearTraining();

  return {
    refreshThemes,
    loadWordsForTheme,
    clearTraining,
  };
}
