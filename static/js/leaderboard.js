/**
 * leaderboard.js
 * Рейтинг пользователей: показываем топ по количеству выученных слов.
 */

import { apiRequest } from "./api.js";
import { setStatus } from "./utils.js";

function clearBody(body) {
  if (!body) return;
  body.innerHTML = "";
}

function setText(node, text) {
  if (!node) return;
  node.textContent = text;
}

function renderLeaderboard(ctx, rows) {
  const { elements } = ctx;
  clearBody(elements.leaderboardBody);
  if (!elements.leaderboardBody) return;

  if (!rows.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 2;
    cell.textContent = "No data yet. Master some words to appear here.";
    row.appendChild(cell);
    elements.leaderboardBody.appendChild(row);
    return;
  }

  for (const item of rows) {
    const row = document.createElement("tr");

    const user = document.createElement("td");
    user.textContent = item.user;

    const learned = document.createElement("td");
    learned.textContent = String(item.learned_words ?? 0);

    row.appendChild(user);
    row.appendChild(learned);
    elements.leaderboardBody.appendChild(row);
  }
}

export function initLeaderboard(ctx) {
  const { elements, state } = ctx;
  let currentRange = "7d";

  const clear = () => {
    clearBody(elements.leaderboardBody);
    if (elements.leaderboardBody) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 2;
      cell.textContent = "Sign in to see the leaderboard.";
      row.appendChild(cell);
      elements.leaderboardBody.appendChild(row);
    }
    setStatus(elements.leaderboardStatus, "");
  };

  const setActiveRangeButton = () => {
    if (!elements.leaderboardRangeButtons) return;
    elements.leaderboardRangeButtons.forEach((btn) => {
      const isActive = btn.dataset.leaderboardRange === currentRange;
      btn.classList.toggle("is-active", isActive);
    });
  };

  const refresh = async (range) => {
    if (!state.isAuthed) {
      clear();
      return;
    }
    if (range) currentRange = range;
    setActiveRangeButton();
    if (elements.leaderboardStatus) setStatus(elements.leaderboardStatus, "Loading...");
    try {
      const data = await apiRequest(
        `/api/leaderboard?limit=50&range=${encodeURIComponent(currentRange)}`
      );
      renderLeaderboard(ctx, Array.isArray(data) ? data : []);
      setStatus(elements.leaderboardStatus, "");
    } catch (error) {
      setStatus(elements.leaderboardStatus, error?.message || "Leaderboard failed");
    }
  };

  if (elements.leaderboardRangeButtons) {
    elements.leaderboardRangeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const range = btn.dataset.leaderboardRange || "7d";
        refresh(range);
      });
    });
  }

  window.addEventListener("auth:changed", (event) => {
    const isAuthed = Boolean(event?.detail?.isAuthed);
    if (!isAuthed) clear();
  });

  clear();
  setActiveRangeButton();
  return { refresh, clear };
}
