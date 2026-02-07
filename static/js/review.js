import { apiRequest } from "./api.js";
import { formatDate, setStatus } from "./utils.js";

function setReviewButtons({ elements }, enabled) {
  elements.markGood.disabled = !enabled;
  elements.markBad.disabled = !enabled;
}

export function renderReviewCard({ state, elements }) {
  if (!state.reviewQueue.length) {
    state.currentReview = null;
    elements.reviewMeta.textContent = "No words due right now.";
    elements.reviewTerm.textContent = "All caught up";
    elements.reviewTranslation.hidden = true;
    elements.reviewTranslation.textContent = "";
    elements.showTranslation.disabled = true;
    setReviewButtons({ elements }, false);
    elements.reviewQueue.textContent =
      "Queue empty. Add more words to keep the loop going.";
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
  setReviewButtons({ elements }, false);
  elements.reviewQueue.textContent = `Remaining in queue: ${state.reviewQueue.length}`;
}

export async function loadReviewQueue(ctx) {
  const { state, elements } = ctx;
  setStatus(elements.reviewStatus, "Loading batch...");
  try {
    const data = await apiRequest("/api/review/today?limit=20");
    state.reviewQueue = data;
    state.currentReview = null;
    renderReviewCard(ctx);
    setStatus(elements.reviewStatus, "");
  } catch (err) {
    setStatus(elements.reviewStatus, err.message || "Review load failed");
  }
}

export async function submitReview(ctx, result) {
  const { state, elements } = ctx;
  if (!state.currentReview) return;
  try {
    await apiRequest(`/api/review/${state.currentReview.id}`, {
      method: "POST",
      body: JSON.stringify({ result }),
    });
    state.currentReview = null;
    renderReviewCard(ctx);
  } catch (err) {
    setStatus(elements.reviewStatus, err.message || "Review failed");
  }
}

export function revealTranslation(ctx) {
  ctx.elements.reviewTranslation.hidden = false;
  setReviewButtons(ctx, true);
}

