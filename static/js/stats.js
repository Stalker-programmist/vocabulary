import { apiRequest } from "./api.js";
import { setStatus } from "./utils.js";

export async function loadStats({ elements }) {
  try {
    const data = await apiRequest("/api/stats");
    elements.statDueToday.textContent = data.today_due_count;
    elements.statDue7d.textContent = data.due_next_7d;
    elements.statNew1d.textContent = data.new_words_1d;
    elements.statNew7d.textContent = data.new_words_7d;
    elements.statNew30d.textContent = data.new_words_30d;
    elements.statNew365d.textContent = data.new_words_365d;
    elements.statReviews1d.textContent = data.reviews_1d;
    elements.statReviews7d.textContent = data.reviews_7d;
    elements.statReviews30d.textContent = data.reviews_30d;
    elements.statReviews365d.textContent = data.reviews_365d;
  } catch (err) {
    if (elements.statsChartStatus) {
      setStatus(elements.statsChartStatus, err.message || "Stats failed");
    }
  }
}

