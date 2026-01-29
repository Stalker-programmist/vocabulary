import { apiRequest } from "./js/api.js";
<<<<<<< HEAD
import { initAuthUI } from "./js/auth.js";
=======
import { initAuth } from "./js/auth.js";
>>>>>>> dce23febdb3bb8efd7e33cacfdea52a2dd384518
import { queryElements } from "./js/dom.js";
import { initWordsCardsDragAndDrop } from "./js/layout_drag.js";
import { initConfirmModal } from "./js/modal.js";
import { loadReviewQueue, revealTranslation, submitReview } from "./js/review.js";
import { createState } from "./js/state.js";
import { loadStats } from "./js/stats.js";
import { initStatsChart } from "./js/charts.js";
import { switchSection } from "./js/tabs.js";
import { debounce, setStatus } from "./js/utils.js";
import { loadWords, resetForm } from "./js/words.js";

<<<<<<< HEAD
function startApp(ctx) {
=======
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
    if (data && data.detail) return data.detail;
  } catch {
    // Not JSON, fall through.
  }
  return text;
}

async function importCsv(ctx) {
  const { importFile, importStatus } = ctx.elements;
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
    await loadWords(ctx);
    await loadStats(ctx);
  } catch (err) {
    setStatus(importStatus, err.message || "Import failed");
  }
}

async function exportCsv(ctx) {
  const { importStatus } = ctx.elements;
  if (importStatus) setStatus(importStatus, "Preparing export...");
  try {
    const response = await fetch("/api/words/export");
    if (!response.ok) {
      const text = await response.text();
      throw new Error(parseErrorMessage(text, response.statusText));
    }
    const blob = await response.blob();
    let filename = "vocabulary_words.csv";
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = /filename="?([^"]+)"?/.exec(disposition);
    if (match && match[1]) {
      filename = match[1];
    }
    downloadBlob(filename, blob);
    if (importStatus) setStatus(importStatus, "Export ready.");
  } catch (err) {
    if (importStatus) setStatus(importStatus, err.message || "Export failed");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const ctx = {
    state: createState(),
    elements: queryElements(),
  };

  document.body.classList.add("page-loaded");
  initWordsCardsDragAndDrop();
  initConfirmModal(ctx);
>>>>>>> dce23febdb3bb8efd7e33cacfdea52a2dd384518
  resetForm(ctx);

  const startApp = () => {
    loadWords(ctx);
    loadReviewQueue(ctx);
    loadStats(ctx);
    initStatsChart(ctx);
  };

  initAuth(ctx, startApp);

  ctx.elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      switchSection(ctx, tab.dataset.section);
    });
  });

  ctx.elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      term: ctx.elements.form.term.value.trim(),
      translation: ctx.elements.form.translation.value.trim(),
      example: ctx.elements.form.example.value.trim(),
      tags: ctx.elements.form.tags.value.trim(),
    };
    try {
      if (ctx.state.editingId) {
        await apiRequest(`/api/words/${ctx.state.editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setStatus(ctx.elements.formStatus, "Saved.");
      } else {
        await apiRequest("/api/words", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setStatus(ctx.elements.formStatus, "Added.");
      }
      resetForm(ctx);
      await loadWords(ctx);
      await loadStats(ctx);
    } catch (err) {
      setStatus(ctx.elements.formStatus, err.message || "Save failed");
    }
  });

  ctx.elements.cancelEdit.addEventListener("click", () => {
    resetForm(ctx);
  });

  ctx.elements.refreshWords.addEventListener("click", () => {
    loadWords(ctx);
  });

  if (ctx.elements.importCsv) {
    ctx.elements.importCsv.addEventListener("click", () => {
      importCsv(ctx);
    });
  }

  if (ctx.elements.exportCsv) {
    ctx.elements.exportCsv.addEventListener("click", () => {
      exportCsv(ctx);
    });
  }

  if (ctx.elements.importFile && ctx.elements.importStatus) {
    ctx.elements.importFile.addEventListener("change", () => {
      setStatus(ctx.elements.importStatus, "");
    });
  }

  ctx.elements.refreshReview.addEventListener("click", () => {
    loadReviewQueue(ctx);
  });

  ctx.elements.refreshStats.addEventListener("click", () => {
    loadStats(ctx);
  });

  ctx.elements.showTranslation.addEventListener("click", () => {
    revealTranslation(ctx);
  });

  ctx.elements.markGood.addEventListener("click", async () => {
    await submitReview(ctx, "good");
    await loadStats(ctx);
    await loadWords(ctx);
  });

  ctx.elements.markBad.addEventListener("click", async () => {
    await submitReview(ctx, "bad");
    await loadStats(ctx);
    await loadWords(ctx);
  });

  const runSearch = debounce(() => loadWords(ctx), 300);

  const syncSearchInputs = (value) => {
    if (ctx.elements.searchInput && ctx.elements.searchInput.value !== value) {
      ctx.elements.searchInput.value = value;
    }
    if (
      ctx.elements.wordlistSearchInput &&
      ctx.elements.wordlistSearchInput.value !== value
    ) {
      ctx.elements.wordlistSearchInput.value = value;
    }
  };

  if (ctx.elements.searchInput) {
    ctx.elements.searchInput.addEventListener("input", () => {
      syncSearchInputs(ctx.elements.searchInput.value);
      runSearch();
    });
  }

  if (ctx.elements.wordlistSearchInput) {
    ctx.elements.wordlistSearchInput.addEventListener("input", () => {
      syncSearchInputs(ctx.elements.wordlistSearchInput.value);
      runSearch();
    });
    syncSearchInputs(ctx.elements.searchInput?.value ?? "");
  }

  if (ctx.elements.wordlistClearSearch) {
    ctx.elements.wordlistClearSearch.addEventListener("click", async () => {
      syncSearchInputs("");
      await loadWords(ctx);
    });
  }

  ctx.elements.tagFilter.addEventListener("input", runSearch);
}

document.addEventListener("DOMContentLoaded", async () => {
  const ctx = {
    state: createState(),
    elements: queryElements(),
  };

  document.body.classList.add("page-loaded");
  initWordsCardsDragAndDrop();
  let started = false;
  const authed = await initAuthUI(ctx, {
    onAuthed: () => {
      if (started) return;
      started = true;
      startApp(ctx);
    },
  });

  if (authed && !started) {
    started = true;
    startApp(ctx);
  }
});
