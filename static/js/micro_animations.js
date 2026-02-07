/**
 * micro_animations.js
 * Микро-анимации для ключевых действий (scale + ripple) на кнопках.
 */

function shouldIgnoreButton(button) {
  if (!button) return true;
  if (button.disabled) return true;
  if (button.getAttribute("aria-disabled") === "true") return true;
  if (button.dataset.ripple === "false") return true;
  if (button.classList.contains("drag-handle")) return true;
  return false;
}

function createRipple(button, clientX, clientY) {
  const rect = button.getBoundingClientRect();
  const size = Math.ceil(Math.max(rect.width, rect.height) * 2);

  const x = clientX ? clientX - rect.left : rect.width / 2;
  const y = clientY ? clientY - rect.top : rect.height / 2;

  const ripple = document.createElement("span");
  ripple.className = "ripple-circle";
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${x - size / 2}px`;
  ripple.style.top = `${y - size / 2}px`;

  button.appendChild(ripple);

  const cleanup = () => ripple.remove();
  ripple.addEventListener("animationend", cleanup, { once: true });
}

export function initMicroAnimations() {
  // Делегируем события на документ, чтобы не навешивать слушатели на каждую кнопку.
  document.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest("button");
      if (!button) return;
      if (shouldIgnoreButton(button)) return;

      // Риппл делаем только на «ключевых» кнопках/действиях.
      const isKeyAction = button.matches(".primary, .ghost, .good, .bad, .tab");
      if (!isKeyAction) return;

      createRipple(button, event.clientX, event.clientY);
    },
    { passive: true }
  );
}

