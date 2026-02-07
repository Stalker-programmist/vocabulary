let resolver = null;
let modalReady = false;

function closeModal(elements, value) {
  if (!elements.confirmModal) return;
  elements.confirmModal.classList.remove("is-open");
  elements.confirmModal.setAttribute("aria-hidden", "true");
  if (resolver) {
    resolver(value);
    resolver = null;
  }
}

export function initConfirmModal({ elements }) {
  if (modalReady) return;
  if (!elements.confirmModal) return;
  modalReady = true;

  if (elements.confirmCancel) {
    elements.confirmCancel.forEach((btn) => {
      btn.addEventListener("click", () => closeModal(elements, false));
    });
  }

  if (elements.confirmAccept) {
    elements.confirmAccept.addEventListener("click", () =>
      closeModal(elements, true)
    );
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal(elements, false);
    }
  });
}

export function confirmAction({ elements }, message) {
  if (!elements.confirmModal || !elements.confirmMessage) {
    return Promise.resolve(window.confirm(message));
  }
  if (resolver) {
    return Promise.resolve(false);
  }
  elements.confirmMessage.textContent = message;
  elements.confirmModal.classList.add("is-open");
  elements.confirmModal.setAttribute("aria-hidden", "false");
  return new Promise((resolve) => {
    resolver = resolve;
  });
}
