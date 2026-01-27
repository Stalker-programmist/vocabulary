import { apiRequest } from "./js/api.js";
import { queryElements } from "./js/dom.js";
import { loadReviewQueue, revealTranslation, submitReview } from "./js/review.js";
import { createState } from "./js/state.js";
import { loadStats } from "./js/stats.js";
import { switchSection } from "./js/tabs.js";
import { debounce, setStatus } from "./js/utils.js";
import { loadWords, resetForm } from "./js/words.js";

document.addEventListener("DOMContentLoaded", () => {
  const ctx = {
    state: createState(),
    elements: queryElements(),
  };

  document.body.classList.add("page-loaded");
  resetForm(ctx);
  loadWords(ctx);
  loadReviewQueue(ctx);
  loadStats(ctx);

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
  ctx.elements.searchInput.addEventListener("input", runSearch);
  ctx.elements.tagFilter.addEventListener("input", runSearch);
});

