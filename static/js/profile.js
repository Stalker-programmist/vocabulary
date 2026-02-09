/**
 * profile.js
 * Страница профиля:
 * - данные аккаунта
 * - сводка по словам
 * - список избранных (starred)
 */

import { apiRequest } from "./api.js";
import { formatDate, setStatus } from "./utils.js";

function setText(node, text) {
  if (!node) return;
  node.textContent = text;
}

function clearBody(body) {
  if (!body) return;
  body.innerHTML = "";
}

function renderStarredTable(ctx, words) {
  const { elements } = ctx;
  clearBody(elements.profileStarredBody);
  if (!elements.profileStarredBody) return;

  if (!words.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.textContent = "No favourites yet. Star a word from the list.";
    row.appendChild(cell);
    elements.profileStarredBody.appendChild(row);
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

    const actions = document.createElement("td");
    const wrap = document.createElement("div");
    wrap.className = "actions";

    const unstar = document.createElement("button");
    unstar.type = "button";
    unstar.className = "ghost";
    unstar.textContent = "Unstar";
    unstar.addEventListener("click", async () => {
      try {
        await apiRequest(`/api/words/${word.id}`, {
          method: "PATCH",
          body: JSON.stringify({ starred: false }),
        });
        await ctx.profile.refresh();
      } catch (error) {
        setStatus(elements.profileStatus, error?.message || "Failed to update");
      }
    });

    wrap.appendChild(unstar);
    actions.appendChild(wrap);

    row.appendChild(term);
    row.appendChild(translation);
    row.appendChild(tags);
    row.appendChild(actions);

    elements.profileStarredBody.appendChild(row);
  }
}

export function initProfile(ctx) {
  const { elements, state } = ctx;

  const clearProfile = () => {
    setText(elements.profileEmail, "—");
    setText(elements.profileCreatedAt, "—");
    setText(elements.profileTotalWords, "0");
    setText(elements.profileStarredWords, "0");
    setText(elements.profileDueToday, "0");
    setText(elements.profileStarredCount, "No favourites yet.");
    clearBody(elements.profileStarredBody);
    setStatus(elements.profileStatus, "");
  };

  const refresh = async () => {
    if (!state.isAuthed) {
      clearProfile();
      return;
    }

    setStatus(elements.profileStatus, "Loading...");
    try {
      const [me, summary, starred] = await Promise.all([
        apiRequest("/api/auth/me"),
        apiRequest("/api/profile"),
        apiRequest("/api/words?starred=true&limit=2000"),
      ]);

      setText(elements.profileEmail, me?.email || "—");
      setText(elements.profileCreatedAt, formatDate(me?.created_at));
      setText(elements.profileTotalWords, String(summary?.total_words ?? 0));
      setText(elements.profileStarredWords, String(summary?.starred_words ?? 0));
      setText(elements.profileDueToday, String(summary?.due_today ?? 0));

      const count = Array.isArray(starred) ? starred.length : 0;
      setText(
        elements.profileStarredCount,
        count ? `Starred words: ${count}` : "No favourites yet."
      );
      renderStarredTable(ctx, Array.isArray(starred) ? starred : []);

      setStatus(elements.profileStatus, "");
    } catch (error) {
      setStatus(elements.profileStatus, error?.message || "Failed to load profile");
    }
  };

  elements.refreshProfile?.addEventListener("click", refresh);

  window.addEventListener("auth:changed", (event) => {
    const isAuthed = Boolean(event?.detail?.isAuthed);
    if (!isAuthed) clearProfile();
  });

  clearProfile();

  return { refresh, clearProfile };
}

