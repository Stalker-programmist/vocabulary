import { apiRequest } from "./api.js";
<<<<<<< HEAD

function normalizeError(err) {
  const msg = err?.message || "Request failed";
  try {
    const parsed = JSON.parse(msg);
    if (typeof parsed?.detail === "string") return parsed.detail;
  } catch {
    // ignore
  }
  return msg;
}

export function initAuthUI(ctx, { onAuthed } = {}) {
  const el = ctx.elements;
  const state = {
    mode: "login", // login | register
    user: null,
  };

  const openModal = (mode) => {
    state.mode = mode || state.mode;
    if (el.authTitle) {
      el.authTitle.textContent =
        state.mode === "register" ? "Create account" : "Sign in";
    }
    if (el.authSubmit) {
      el.authSubmit.textContent =
        state.mode === "register" ? "Create account" : "Sign in";
    }
    if (el.authSwitchMode) {
      el.authSwitchMode.textContent =
        state.mode === "register" ? "I already have an account" : "Create account";
    }
    if (el.authError) el.authError.textContent = "";
    if (el.authModal) el.authModal.hidden = false;
    document.body.classList.add("auth-required");
  };

  const closeModal = () => {
    if (el.authModal) el.authModal.hidden = true;
    document.body.classList.remove("auth-required");
  };

  const setLoggedOutUI = () => {
    if (el.authStatus) el.authStatus.textContent = "Not signed in";
    if (el.authLoginBtn) el.authLoginBtn.hidden = false;
    if (el.authRegisterBtn) el.authRegisterBtn.hidden = false;
    if (el.authLogoutBtn) el.authLogoutBtn.hidden = true;
  };

  const setLoggedInUI = (user) => {
    state.user = user;
    if (el.authStatus) el.authStatus.textContent = user?.email || "Signed in";
    if (el.authLoginBtn) el.authLoginBtn.hidden = true;
    if (el.authRegisterBtn) el.authRegisterBtn.hidden = true;
    if (el.authLogoutBtn) el.authLogoutBtn.hidden = false;
  };

  const refreshMe = async () => {
    try {
      const me = await apiRequest("/api/auth/me");
      setLoggedInUI(me);
      closeModal();
      return true;
    } catch {
      setLoggedOutUI();
      return false;
    }
  };

  const submitAuth = async () => {
    const email = el.authEmail?.value?.trim() || "";
    const password = el.authPassword?.value || "";
    if (!email || !password) {
      if (el.authError) el.authError.textContent = "Email and password are required";
      return;
    }
    try {
      const path = state.mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const user = await apiRequest(path, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setLoggedInUI(user);
      closeModal();
      onAuthed && onAuthed(user);
    } catch (err) {
      if (el.authError) el.authError.textContent = normalizeError(err);
    }
  };

  window.addEventListener("auth:required", () => {
    openModal("login");
  });

  el.authLoginBtn?.addEventListener("click", () => openModal("login"));
  el.authRegisterBtn?.addEventListener("click", () => openModal("register"));
  el.authSwitchMode?.addEventListener("click", () => {
    openModal(state.mode === "register" ? "login" : "register");
  });
  el.authClose?.addEventListener("click", () => closeModal());
  el.authBackdrop?.addEventListener("click", () => closeModal());

  el.authForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitAuth();
  });

  el.authLogoutBtn?.addEventListener("click", async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } finally {
      state.user = null;
      setLoggedOutUI();
      openModal("login");
    }
  });

  // Initial check
  return refreshMe().then((ok) => {
    if (!ok) openModal("login");
    return ok;
  });
}

=======
import { setStatus } from "./utils.js";

function showAuth(elements) {
  elements.authScreen.classList.add("is-active");
  elements.authScreen.setAttribute("aria-hidden", "false");
  document.body.classList.add("auth-mode");
}

function hideAuth(elements) {
  elements.authScreen.classList.remove("is-active");
  elements.authScreen.setAttribute("aria-hidden", "true");
  document.body.classList.remove("auth-mode");
}

function setAuthTab(elements, name) {
  elements.authTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.authTab === name);
  });
  elements.authPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.authPanel === name);
  });
}

async function checkSession() {
  try {
    await apiRequest("/api/auth/me");
    return true;
  } catch {
    return false;
  }
}

export async function initAuth(ctx, onAuthed) {
  const { elements } = ctx;
  if (!elements.authScreen) return onAuthed();

  window.addEventListener("auth:required", () => {
    showAuth(elements);
    setAuthTab(elements, "login");
  });

  elements.authTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setAuthTab(elements, tab.dataset.authTab);
    });
  });

  elements.registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = elements.registerEmail.value.trim();
    const password = elements.registerPassword.value.trim();
    setStatus(elements.registerStatus, "Sending code...");
    try {
      await apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setStatus(elements.registerStatus, "Code sent. Check your email.");
      elements.verifyEmail.value = email;
      setAuthTab(elements, "verify");
    } catch (err) {
      setStatus(elements.registerStatus, err.message || "Registration failed");
    }
  });

  elements.verifyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = elements.verifyEmail.value.trim();
    const code = elements.verifyCode.value.trim();
    setStatus(elements.verifyStatus, "Verifying...");
    try {
      await apiRequest("/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      setStatus(elements.verifyStatus, "Verified. You can sign in.");
      setAuthTab(elements, "login");
      elements.loginEmail.value = email;
    } catch (err) {
      setStatus(elements.verifyStatus, err.message || "Verification failed");
    }
  });

  elements.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = elements.loginEmail.value.trim();
    const password = elements.loginPassword.value.trim();
    setStatus(elements.loginStatus, "Signing in...");
    try {
      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      window.localStorage.setItem("vocabulary.token", data.access_token);
      setStatus(elements.loginStatus, "");
      hideAuth(elements);
      onAuthed();
    } catch (err) {
      setStatus(elements.loginStatus, err.message || "Login failed");
    }
  });

  elements.logoutButton?.addEventListener("click", () => {
    window.localStorage.removeItem("vocabulary.token");
    showAuth(elements);
    setAuthTab(elements, "login");
  });

  const authed = await checkSession();
  if (authed) {
    hideAuth(elements);
    onAuthed();
  } else {
    showAuth(elements);
    setAuthTab(elements, "login");
  }
}
>>>>>>> dce23febdb3bb8efd7e33cacfdea52a2dd384518
