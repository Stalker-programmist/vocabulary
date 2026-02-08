/**
 * training.js
 * Режим тренировки:
 * - Уровень 1: выбор ответа (1 правильный + 3 отвлекающих)
 * - Уровень 2: сопоставление (8 слов + 8 переводов)
 */

import { apiRequest } from "./api.js";
import { formatDate, setStatus } from "./utils.js";

function setText(node, text) {
  if (!node) return;
  node.textContent = text;
}

function safeStatus(node, message, tone = "") {
  if (!node) return;
  setStatus(node, message, tone);
}

function setHidden(node, hidden) {
  if (!node) return;
  node.hidden = Boolean(hidden);
}

function clearTable(body) {
  if (!body) return;
  body.innerHTML = "";
}

function shuffleInPlace(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function shuffled(items) {
  return shuffleInPlace([...items]);
}

function sample(items, count) {
  if (count <= 0) return [];
  if (items.length <= count) return shuffled(items);
  return shuffled(items).slice(0, count);
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
    level: 1,
    level1: null,
    level2: null,
  };

  const updateHint = () => {
    if (!elements.trainingHint) return;
    const loaded = state.training.words.length > 0;
    elements.trainingHint.textContent = loaded
      ? `Loaded ${state.training.words.length} word(s). Choose a level and start.`
      : "Load words first.";
  };

  const resetGames = () => {
    state.training.level1 = null;
    state.training.level2 = null;
    setHidden(elements.trainingLevel1Card, true);
    setHidden(elements.trainingLevel2Card, true);
    if (elements.trainingL1Choices) elements.trainingL1Choices.innerHTML = "";
    setText(elements.trainingL1Question, "—");
    setText(elements.trainingL1Progress, "No session yet.");
    setText(elements.trainingL2Progress, "Pair 8 terms with their translations.");
    if (elements.trainingL2Terms) elements.trainingL2Terms.innerHTML = "";
    if (elements.trainingL2Translations) elements.trainingL2Translations.innerHTML = "";
    safeStatus(elements.trainingL2Status, "");
    safeStatus(elements.trainingGameStatus, "");
  };

  const refreshThemes = async () => {
    if (!elements.trainingTheme) return;
    if (!state.isAuthed) return;
    safeStatus(elements.trainingStatus, "Loading themes...");
    try {
      const themes = await apiRequest("/api/themes");
      state.training.themes = themes;
      state.training.themesLoaded = true;
      buildThemeOptions(elements.trainingTheme, themes);
      safeStatus(elements.trainingStatus, "");
    } catch (error) {
      state.training.themesLoaded = false;
      safeStatus(elements.trainingStatus, error?.message || "Failed to load themes");
    }
  };

  const loadWordsForTheme = async () => {
    if (!elements.trainingTheme) return;
    if (!state.isAuthed) return;

    const tag = elements.trainingTheme.value;
    safeStatus(elements.trainingStatus, "Loading words...");

    try {
      const params = new URLSearchParams();
      params.set("limit", "2000");
      if (tag) params.set("tag", tag);
      const words = await apiRequest(`/api/words?${params.toString()}`);
      state.training.words = words;
      resetGames();
      updateHint();

      const title = tag ? `Loaded ${words.length} words for “${tag}”.` : `Loaded ${words.length} words.`;
      setText(elements.trainingCount, title);
      renderWordsTable(ctx, words);
      safeStatus(elements.trainingStatus, "");
    } catch (error) {
      safeStatus(elements.trainingStatus, error?.message || "Failed to load words");
    }
  };

  const startLevel1 = () => {
    const words = state.training.words;
    if (words.length < 4) {
      throw new Error("Level 1 needs at least 4 words in the loaded set.");
    }

    const queue = shuffled(words);
    state.training.level1 = {
      queue,
      index: 0,
      correct: 0,
      answered: false,
      lastWasCorrect: null,
    };

    setHidden(elements.trainingLevel1Card, false);
    setHidden(elements.trainingLevel2Card, true);
    renderLevel1();
  };

  const buildLevel1Choices = (word, allWords) => {
    const correctTranslation = String(word.translation || "").trim();
    if (!correctTranslation) {
      throw new Error("This word has no translation.");
    }
    const pool = [];
    for (const w of allWords) {
      if (!w || w.id === word.id) continue;
      const t = String(w.translation || "").trim();
      if (!t) continue;
      if (t === correctTranslation) continue;
      pool.push(t);
    }

    const uniquePool = [...new Set(pool)];
    if (uniquePool.length < 3) {
      throw new Error("Not enough unique distractors in this word set (need 3).");
    }

    const distractors = sample(uniquePool, 3);
    const options = shuffled([correctTranslation, ...distractors]);
    return { correctTranslation, options };
  };

  const renderLevel1 = () => {
    const session = state.training.level1;
    if (!session) return;

    const total = session.queue.length;
    const word = session.queue[session.index];

    if (!word) {
      setText(
        elements.trainingL1Progress,
        `Done. Score: ${session.correct}/${total}.`
      );
      setText(elements.trainingL1Question, "Session complete.");
      if (elements.trainingL1Choices) elements.trainingL1Choices.innerHTML = "";
      if (elements.trainingL1Next) elements.trainingL1Next.disabled = true;
      if (elements.trainingL1Skip) elements.trainingL1Skip.disabled = true;
      return;
    }

    if (elements.trainingL1Next) elements.trainingL1Next.disabled = true;
    if (elements.trainingL1Skip) elements.trainingL1Skip.disabled = false;

    session.answered = false;
    session.lastWasCorrect = null;

    setText(
      elements.trainingL1Progress,
      `Question ${session.index + 1}/${total} • Score ${session.correct}/${session.index}`
    );
    setText(elements.trainingL1Question, `Choose the translation for: “${word.term}”`);
    safeStatus(elements.trainingGameStatus, "");
    let correctTranslation;
    let options;
    try {
      const result = buildLevel1Choices(word, session.queue);
      correctTranslation = result.correctTranslation;
      options = result.options;
    } catch (error) {
      safeStatus(
        elements.trainingGameStatus,
        error?.message || "Failed to generate question"
      );
      if (elements.trainingL1Choices) elements.trainingL1Choices.innerHTML = "";
      if (elements.trainingL1Next) elements.trainingL1Next.disabled = true;
      if (elements.trainingL1Skip) elements.trainingL1Skip.disabled = true;
      return;
    }

    if (!elements.trainingL1Choices) return;
    elements.trainingL1Choices.innerHTML = "";
    for (const optionText of options) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn ghost";
      btn.textContent = optionText;
      btn.dataset.correct = optionText === correctTranslation ? "1" : "0";
      btn.addEventListener("click", () => {
        if (session.answered) return;
        session.answered = true;
        const isCorrect = btn.dataset.correct === "1";
        session.lastWasCorrect = isCorrect;
        if (isCorrect) session.correct += 1;

        const children = Array.from(elements.trainingL1Choices.children);
        for (const child of children) {
          child.disabled = true;
          const correct = child.dataset.correct === "1";
          child.classList.toggle("is-correct", correct);
          child.classList.toggle("is-wrong", !correct && child === btn);
        }

        if (elements.trainingL1Next) elements.trainingL1Next.disabled = false;
        if (elements.trainingL1Skip) elements.trainingL1Skip.disabled = true;
        safeStatus(
          elements.trainingGameStatus,
          isCorrect ? "Correct." : `Wrong. Correct answer: ${correctTranslation}`
        );

        setText(
          elements.trainingL1Progress,
          `Question ${session.index + 1}/${total} • Score ${session.correct}/${session.index + 1}`
        );
      });
      elements.trainingL1Choices.appendChild(btn);
    }
  };

  const nextLevel1 = () => {
    const session = state.training.level1;
    if (!session) return;
    if (session.index >= session.queue.length) return;
    session.index += 1;
    renderLevel1();
  };

  const skipLevel1 = () => {
    const session = state.training.level1;
    if (!session) return;
    if (session.index >= session.queue.length) return;
    session.index += 1;
    renderLevel1();
  };

  const startLevel2 = () => {
    const words = state.training.words;
    if (words.length < 8) {
      throw new Error("Level 2 needs at least 8 words in the loaded set.");
    }

    const setWords = sample(words, 8);
    const terms = shuffled(setWords);
    const translations = shuffled(setWords);

    state.training.level2 = {
      terms,
      translations,
      selectedTermId: null,
      selectedTranslationId: null,
      pairs: new Map(), // termId -> translationId
      reverse: new Map(), // translationId -> termId
      checked: false,
    };

    setHidden(elements.trainingLevel2Card, false);
    setHidden(elements.trainingLevel1Card, true);
    renderLevel2();
  };

  const clearLevel2Selections = () => {
    const session = state.training.level2;
    if (!session) return;
    session.selectedTermId = null;
    session.selectedTranslationId = null;
  };

  const unpairTerm = (session, termId) => {
    const existingTranslationId = session.pairs.get(termId);
    if (existingTranslationId) {
      session.pairs.delete(termId);
      session.reverse.delete(existingTranslationId);
    }
  };

  const unpairTranslation = (session, translationId) => {
    const existingTermId = session.reverse.get(translationId);
    if (existingTermId) {
      session.reverse.delete(translationId);
      session.pairs.delete(existingTermId);
    }
  };

  const renderMatchItem = (kind, word, session) => {
    const id = String(word.id);
    const isPaired =
      kind === "term" ? session.pairs.has(id) : session.reverse.has(id);
    const item = document.createElement("button");
    item.type = "button";
    item.className = "match-item";
    item.dataset.kind = kind;
    item.dataset.wordId = id;
    item.dataset.paired = isPaired ? "1" : "0";

    const labelNode = document.createElement("span");
    labelNode.className = "match-label";
    labelNode.textContent = kind === "term" ? word.term : word.translation;

    const badgeNode = document.createElement("span");
    badgeNode.className = "match-badge";
    badgeNode.textContent = isPaired ? "✓" : "";

    item.appendChild(labelNode);
    item.appendChild(badgeNode);

    const selected =
      (kind === "term" && session.selectedTermId === id) ||
      (kind === "translation" && session.selectedTranslationId === id);
    item.classList.toggle("is-selected", selected);
    item.classList.toggle("is-paired", isPaired);

    if (session.checked && isPaired) {
      const correct =
        kind === "term"
          ? session.pairs.get(id) === id
          : session.reverse.get(id) === id;
      item.classList.toggle("is-correct", correct);
      item.classList.toggle("is-wrong", !correct);
    }

    item.addEventListener("click", () => {
      if (session.checked) return;

      const alreadyPaired = item.dataset.paired === "1";
      if (alreadyPaired) {
        if (kind === "term") unpairTerm(session, id);
        else unpairTranslation(session, id);
        clearLevel2Selections();
        renderLevel2();
        return;
      }

      if (kind === "term") session.selectedTermId = id;
      else session.selectedTranslationId = id;

      const termId = session.selectedTermId;
      const translationId = session.selectedTranslationId;
      if (termId && translationId) {
        // Both selected, create pair.
        unpairTerm(session, termId);
        unpairTranslation(session, translationId);
        session.pairs.set(termId, translationId);
        session.reverse.set(translationId, termId);
        clearLevel2Selections();
      }

      renderLevel2();
    });

    return item;
  };

  const renderLevel2 = () => {
    const session = state.training.level2;
    if (!session) return;
    safeStatus(elements.trainingGameStatus, "");
    if (!session.checked) safeStatus(elements.trainingL2Status, "");

    const pairedCount = session.pairs.size;
    setText(elements.trainingL2Progress, `Pairs: ${pairedCount}/8`);
    if (elements.trainingL2Check) {
      elements.trainingL2Check.disabled = pairedCount !== 8 || session.checked;
    }

    if (elements.trainingL2Terms) elements.trainingL2Terms.innerHTML = "";
    if (elements.trainingL2Translations) elements.trainingL2Translations.innerHTML = "";

    for (const w of session.terms) {
      elements.trainingL2Terms?.appendChild(renderMatchItem("term", w, session));
    }
    for (const w of session.translations) {
      elements.trainingL2Translations?.appendChild(
        renderMatchItem("translation", w, session)
      );
    }
  };

  const checkLevel2 = () => {
    const session = state.training.level2;
    if (!session) return;
    if (session.pairs.size !== 8) {
      safeStatus(elements.trainingL2Status, "Match all 8 pairs first.");
      return;
    }
    session.checked = true;
    let correct = 0;
    for (const [termId, translationId] of session.pairs.entries()) {
      if (termId === translationId) correct += 1;
    }
    safeStatus(elements.trainingL2Status, `Score: ${correct}/8`);
    renderLevel2();
  };

  const resetLevel2 = () => {
    state.training.level2 = null;
    setHidden(elements.trainingLevel2Card, true);
    if (elements.trainingL2Terms) elements.trainingL2Terms.innerHTML = "";
    if (elements.trainingL2Translations) elements.trainingL2Translations.innerHTML = "";
    safeStatus(elements.trainingL2Status, "");
  };

  const clearTraining = () => {
    state.training.themesLoaded = false;
    state.training.themes = [];
    state.training.words = [];
    state.training.level = 1;
    resetGames();
    updateHint();
    if (elements.trainingTheme) {
      elements.trainingTheme.innerHTML = "";
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Sign in to load themes";
      elements.trainingTheme.appendChild(option);
    }
    setText(elements.trainingCount, "No words loaded yet.");
    clearTable(elements.trainingWordsBody);
    safeStatus(elements.trainingStatus, "");
  };

  elements.trainingStart?.addEventListener("click", () => {
    loadWordsForTheme();
  });

  elements.trainingRun?.addEventListener("click", () => {
    try {
      const loaded = state.training.words.length > 0;
      if (!loaded) throw new Error("Load words first.");
      const level = Number(elements.trainingLevel?.value || "1");
      state.training.level = level;
      resetGames();
      if (level === 1) startLevel1();
      else startLevel2();
    } catch (error) {
      safeStatus(elements.trainingGameStatus, error?.message || "Failed to start training");
    }
  });

  elements.trainingReset?.addEventListener("click", () => {
    resetGames();
    updateHint();
  });

  elements.trainingL1Next?.addEventListener("click", () => nextLevel1());
  elements.trainingL1Skip?.addEventListener("click", () => skipLevel1());

  elements.trainingL2New?.addEventListener("click", () => {
    try {
      const loaded = state.training.words.length > 0;
      if (!loaded) throw new Error("Load words first.");
      resetLevel2();
      startLevel2();
    } catch (error) {
      safeStatus(elements.trainingGameStatus, error?.message || "Failed to start Level 2");
    }
  });

  elements.trainingL2Check?.addEventListener("click", () => checkLevel2());

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
