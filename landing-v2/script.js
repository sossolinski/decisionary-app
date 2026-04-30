const header = document.querySelector("[data-header]");
const replaceHistoryLinks = document.querySelectorAll("[data-history-replace='true']");

function updateHeader() {
  if (!header) return;
  header.classList.toggle("is-solid", window.scrollY > 18);
}

function bindReplaceHistoryLinks() {
  replaceHistoryLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const href = link.getAttribute("href");
      if (!href) return;

      event.preventDefault();
      window.location.replace(href);
    });
  });
}

window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();
bindReplaceHistoryLinks();
