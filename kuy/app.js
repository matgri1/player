(function () {
  // ============================================================
  //  CONTACTS — fill these in and every button on the site updates.
  //  whatsapp:  phone number with country code, digits only, e.g. "84901234567"
  //  messenger: your Facebook page username, e.g. "kuyquynhon"
  //  telegram:  username without @, e.g. "kuy_quynhon"
  //  zalo:      phone number used on Zalo, e.g. "0901234567"
  //  Empty value = button scrolls to the Contact section.
  // ============================================================
  const CONTACTS = {
    whatsapp: "",
    messenger: "",
    telegram: "",
    zalo: ""
  };

  const I18N = window.KUY_I18N;
  const SUPPORTED = Object.keys(I18N);
  const DEFAULT_LANG = "en";
  const STORAGE_KEY = "kuy-lang";
  let currentLang = DEFAULT_LANG;

  function t(key) {
    return (I18N[currentLang] && I18N[currentLang][key]) ?? I18N[DEFAULT_LANG][key];
  }

  // ---------- Contact links ----------
  function linkFor(type, msgKey) {
    const v = CONTACTS[type];
    if (!v) return null;
    const text = encodeURIComponent(t(msgKey || "msg.general") || "");
    switch (type) {
      case "whatsapp":  return "https://wa.me/" + v + (text ? "?text=" + text : "");
      case "messenger": return "https://m.me/" + v;
      case "telegram":  return "https://t.me/" + v;
      case "zalo":      return "https://zalo.me/" + v;
    }
    return null;
  }

  function updateLinks() {
    document.querySelectorAll("[data-link]").forEach((el) => {
      const href = linkFor(el.dataset.link, el.dataset.msg);
      if (href) {
        el.href = href;
        el.target = "_blank";
        el.rel = "noopener";
      } else {
        el.href = "#contact";
        el.removeAttribute("target");
      }
    });
  }

  // ---------- Language ----------
  function getInitialLang() {
    const fromUrl = new URLSearchParams(location.search).get("lang");
    if (fromUrl && SUPPORTED.includes(fromUrl)) return fromUrl;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED.includes(saved)) return saved;
    } catch (e) { /* storage unavailable */ }
    return DEFAULT_LANG;
  }

  function setLang(lang) {
    currentLang = SUPPORTED.includes(lang) ? lang : DEFAULT_LANG;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const value = t(el.getAttribute("data-i18n"));
      if (value !== undefined) el.textContent = value;
    });
    document.documentElement.lang = currentLang;
    const title = t("meta.title");
    if (title && !document.querySelector('meta[name="claude:viewport-fit-sides"]')) document.title = title;

    document.querySelectorAll(".lang__btn").forEach((btn) => {
      const active = btn.dataset.lang === currentLang;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
    updateLinks();
    try { localStorage.setItem(STORAGE_KEY, currentLang); } catch (e) { /* ignore */ }
  }

  document.querySelectorAll(".lang__btn").forEach((btn) => {
    btn.addEventListener("click", () => setLang(btn.dataset.lang));
  });
  setLang(getInitialLang());

  // ---------- Mobile menu ----------
  const burger = document.getElementById("burger");
  const nav = document.getElementById("nav");
  function toggleMenu(open) {
    const isOpen = open ?? !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", isOpen);
    burger.setAttribute("aria-expanded", String(isOpen));
  }
  burger.addEventListener("click", () => toggleMenu());
  nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => toggleMenu(false)));

  // ---------- Year ----------
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
