import { apiRequest } from "./api.js";
import { setStatus } from "./utils.js";

export async function loadStats({ elements }) {
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

