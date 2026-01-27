import { apiRequest } from "./api.js";
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
