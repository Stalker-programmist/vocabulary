/**
 * app.js
 * Главный клиентский bootstrap: инициализация UI, подписка на события,
 * авторизация и первичная загрузка данных.
 */

import { apiRequest } from "./js/api.js";
import { initAuthUI } from "./js/auth.js";
import { queryElements } from "./js/dom.js";
import { initWordsCardsDragAndDrop } from "./js/layout_drag.js";
import { initMicroAnimations } from "./js/micro_animations.js";
import { initConfirmModal } from "./js/modal.js";
import { loadReviewQueue, revealTranslation, submitReview } from "./js/review.js";
import { createState } from "./js/state.js";
import { loadStats } from "./js/stats.js";
import { initStatsChart } from "./js/charts.js";
import { switchSection } from "./js/tabs.js";
import { initToasts } from "./js/toast.js";
import { debounce, setStatus } from "./js/utils.js";
import { loadWords, resetForm } from "./js/words.js";

function downloadBlob(filename, blob) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function parseErrorMessage(text, fallback) {
  if (!text) return fallback;
  try {
    const data = JSON.parse(text);
    if (data && typeof data.detail === "string") return data.detail;
  } catch {
    // Not JSON.
  }
  return text;
}

async function importCsv(ctx) {
  const { importFile, importFileName, importStatus } = ctx.elements;
  if (!importFile || !importStatus) return;
  if (!importFile.files || !importFile.files.length) {
    setStatus(importStatus, "Choose a CSV file first.");
    return;
  }

  const formData = new FormData();
  formData.append("file", importFile.files[0]);
  setStatus(importStatus, "Importing...");

  try {
    const response = await fetch("/api/words/import", {
      method: "POST",
      credentials: "same-origin",
      body: formData,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(parseErrorMessage(text, response.statusText));
    }
    const data = await response.json();
    const skipped = data.skipped ? `, skipped ${data.skipped}` : "";
    setStatus(importStatus, `Imported ${data.imported}${skipped}.`);
    importFile.value = "";
    if (importFileName) importFileName.textContent = "No file chosen";
    await loadWords(ctx);
    await loadStats(ctx);
  } catch (error) {
    setStatus(importStatus, error?.message || "Import failed");
  }
}

async function exportCsv(ctx) {
  const { importStatus } = ctx.elements;
  if (importStatus) setStatus(importStatus, "Preparing export...");

  try {
    const response = await fetch("/api/words/export", {
      method: "GET",
      credentials: "same-origin",
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(parseErrorMessage(text, response.statusText));
    }
    const blob = await response.blob();
    let filename = "vocabulary_words.csv";
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = /filename="?([^"]+)"?/.exec(disposition);
    if (match?.[1]) filename = match[1];
    downloadBlob(filename, blob);
    if (importStatus) setStatus(importStatus, "Export ready.");
  } catch (error) {
    if (importStatus) setStatus(importStatus, error?.message || "Export failed");
  }
}

function startApp(ctx) {
  loadWords(ctx);
  loadReviewQueue(ctx);
  loadStats(ctx);
  initStatsChart(ctx);
}

function bindUI(ctx) {
  const { elements } = ctx;

  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      switchSection(ctx, tab.dataset.section);
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
      if (ctx.state.editingId) {
        await apiRequest(`/api/words/${ctx.state.editingId}`, {
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

      resetForm(ctx);
      await loadWords(ctx);
      await loadStats(ctx);
    } catch (error) {
      setStatus(elements.formStatus, error?.message || "Save failed");
    }
  });

  elements.cancelEdit.addEventListener("click", () => resetForm(ctx));
  elements.refreshWords.addEventListener("click", () => loadWords(ctx));
  elements.refreshReview.addEventListener("click", () => loadReviewQueue(ctx));
  elements.refreshStats.addEventListener("click", () => loadStats(ctx));

  elements.importCsv?.addEventListener("click", () => importCsv(ctx));
  elements.exportCsv?.addEventListener("click", () => exportCsv(ctx));
  elements.importFileBtn?.addEventListener("click", () => elements.importFile?.click());
  elements.importFile?.addEventListener("change", () => {
    setStatus(elements.importStatus, "");
    if (!elements.importFileName) return;
    const file = elements.importFile.files?.[0];
    elements.importFileName.textContent = file?.name || "No file chosen";
  });

  elements.showTranslation.addEventListener("click", () => revealTranslation(ctx));

  elements.markGood.addEventListener("click", async () => {
    await submitReview(ctx, "good");
    await loadStats(ctx);
    await loadWords(ctx);
  });

  elements.markBad.addEventListener("click", async () => {
    await submitReview(ctx, "bad");
    await loadStats(ctx);
    await loadWords(ctx);
  });

  const runSearch = debounce(() => loadWords(ctx), 300);

  const syncSearchInputs = (value) => {
    if (elements.searchInput && elements.searchInput.value !== value) {
      elements.searchInput.value = value;
    }
    if (
      elements.wordlistSearchInput &&
      elements.wordlistSearchInput.value !== value
    ) {
      elements.wordlistSearchInput.value = value;
    }
  };

  elements.searchInput?.addEventListener("input", () => {
    syncSearchInputs(elements.searchInput.value);
    runSearch();
  });

  elements.wordlistSearchInput?.addEventListener("input", () => {
    syncSearchInputs(elements.wordlistSearchInput.value);
    runSearch();
  });

  if (elements.wordlistSearchInput) {
    syncSearchInputs(elements.searchInput?.value ?? "");
  }

  elements.wordlistClearSearch?.addEventListener("click", async () => {
    syncSearchInputs("");
    await loadWords(ctx);
  });

  elements.tagFilter.addEventListener("input", runSearch);
}

document.addEventListener("DOMContentLoaded", async () => {
  const ctx = {
    state: createState(),
    elements: queryElements(),
  };

  document.body.classList.add("page-loaded");
  initWordsCardsDragAndDrop();
  initMicroAnimations();
  initToasts();
  initConfirmModal(ctx);
  resetForm(ctx);
  bindUI(ctx);

  let started = false;
  const ensureStarted = () => {
    if (started) return;
    started = true;
    startApp(ctx);
  };

  const authed = await initAuthUI(ctx, { onAuthed: ensureStarted });
  if (authed) ensureStarted();
});
