/**
 * auth.js
 * Модуль авторизации (логин/регистрация/выход) для фронтенда.
 *
 * Важно: бэкенд использует cookie-based сессию (`/api/auth/*`), поэтому
 * здесь нет JWT/Bearer токенов — только запросы и обновление UI.
 */

import { apiRequest } from "./api.js";

function getErrorMessage(error) {
  const message = error?.message;
  return typeof message === "string" && message.trim()
    ? message
    : "Request failed";
}

export function initAuthUI(ctx, { onAuthed } = {}) {
  const el = ctx.elements;

  const state = {
    mode: "login", // "login" | "register"
    user: null,
    isOpen: false,
  };

  const setAppControlsEnabled = (enabled) => {
    const shouldDisable = !enabled;

    const setDisabled = (node) => {
      if (!node) return;
      if ("disabled" in node) node.disabled = shouldDisable;
      if (shouldDisable) node.setAttribute("aria-disabled", "true");
      else node.removeAttribute("aria-disabled");
    };

    [
      el.refreshWords,
      el.saveWord,
      el.cancelEdit,
      el.searchInput,
      el.tagFilter,
      el.starredFilter,
      el.wordlistSearchInput,
      el.wordlistClearSearch,
      el.importFile,
      el.importFileBtn,
      el.importCsv,
      el.exportCsv,
      el.refreshStats,
      el.refreshProfile,
      el.trainingTheme,
      el.trainingStart,
    ].forEach(setDisabled);

    if (el.statsRangeButtons && typeof el.statsRangeButtons.forEach === "function") {
      el.statsRangeButtons.forEach(setDisabled);
    }
    if (
      el.leaderboardRangeButtons &&
      typeof el.leaderboardRangeButtons.forEach === "function"
    ) {
      el.leaderboardRangeButtons.forEach(setDisabled);
    }
  };

  const emitAuthChanged = () => {
    window.dispatchEvent(
      new CustomEvent("auth:changed", {
        detail: {
          isAuthed: ctx.state.isAuthed,
          user: state.user,
        },
      })
    );
  };

  const setAuthModeText = () => {
    const isRegister = state.mode === "register";
    if (el.authTitle) {
      el.authTitle.textContent = isRegister ? "Create account" : "Sign in";
    }
    if (el.authSubmit) {
      el.authSubmit.textContent = isRegister ? "Create account" : "Sign in";
    }
    if (el.authSwitchMode) {
      el.authSwitchMode.textContent = isRegister
        ? "I already have an account"
        : "Create account";
    }
  };

  const clearAuthForm = () => {
    if (el.authError) el.authError.textContent = "";
    // Не сбрасываем email при переключении режимов — удобнее пользователю.
    if (el.authPassword) el.authPassword.value = "";
  };

  const openModal = (mode) => {
    if (mode) state.mode = mode;
    state.isOpen = true;
    setAuthModeText();
    clearAuthForm();
    if (el.authModal) el.authModal.hidden = false;
    document.body.classList.add("auth-required");
    el.authEmail?.focus?.();
  };

  const closeModal = () => {
    state.isOpen = false;
    if (el.authModal) el.authModal.hidden = true;
    document.body.classList.remove("auth-required");
  };

  const setLoggedOutUI = () => {
    state.user = null;
    ctx.state.isAuthed = false;
    if (el.authStatus) el.authStatus.textContent = "Not signed in";
    if (el.authLoginBtn) el.authLoginBtn.hidden = false;
    if (el.authRegisterBtn) el.authRegisterBtn.hidden = false;
    if (el.authLogoutBtn) el.authLogoutBtn.hidden = true;
    setAppControlsEnabled(false);
    emitAuthChanged();
  };

  const setLoggedInUI = (user) => {
    state.user = user ?? null;
    ctx.state.isAuthed = Boolean(state.user);
    if (el.authStatus) el.authStatus.textContent = user?.email || "Signed in";
    if (el.authLoginBtn) el.authLoginBtn.hidden = true;
    if (el.authRegisterBtn) el.authRegisterBtn.hidden = true;
    if (el.authLogoutBtn) el.authLogoutBtn.hidden = false;
    setAppControlsEnabled(true);
    emitAuthChanged();
  };

  const refreshMe = async () => {
    try {
      const me = await apiRequest("/api/auth/me");
      setLoggedInUI(me);
      return true;
    } catch {
      setLoggedOutUI();
      return false;
    }
  };

  const submit = async () => {
    const email = el.authEmail?.value?.trim() || "";
    const password = el.authPassword?.value || "";

    if (!email || !password) {
      if (el.authError) {
        el.authError.textContent = "Email and password are required.";
      }
      return;
    }

    const path = state.mode === "register" ? "/api/auth/register" : "/api/auth/login";

    try {
      const user = await apiRequest(path, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setLoggedInUI(user);
      closeModal();
      onAuthed?.(user);
    } catch (error) {
      if (el.authError) el.authError.textContent = getErrorMessage(error);
    }
  };

  const logout = async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } finally {
      setLoggedOutUI();
      openModal("login");
    }
  };

  // Если любая часть приложения получает 401, показываем логин.
  window.addEventListener("auth:required", () => {
    if (!state.isOpen) openModal("login");
  });

  el.authLoginBtn?.addEventListener("click", () => openModal("login"));
  el.authRegisterBtn?.addEventListener("click", () => openModal("register"));
  el.authLogoutBtn?.addEventListener("click", logout);

  el.authSwitchMode?.addEventListener("click", () => {
    state.mode = state.mode === "register" ? "login" : "register";
    setAuthModeText();
    clearAuthForm();
  });

  el.authClose?.addEventListener("click", closeModal);
  el.authBackdrop?.addEventListener("click", closeModal);

  el.authForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    submit();
  });

  // По умолчанию блокируем действия, пока не проверили сессию.
  setLoggedOutUI();

  // Инициализация: если не авторизован — покажем модалку логина.
  return refreshMe().then((ok) => {
    if (ok) {
      closeModal();
      onAuthed?.(state.user);
      return true;
    }
    openModal("login");
    return false;
  });
}
