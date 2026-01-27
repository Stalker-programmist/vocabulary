export function switchSection({ elements }, targetId) {
  elements.sections.forEach((section) => {
    section.classList.toggle("is-active", section.id === targetId);
  });
  elements.tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.section === targetId);
  });
}

