(function () {
  // ============================================================
  //  CONTACTS — fill these in and every contact button updates.
  //  whatsapp:  phone with country code, digits only, e.g. "84901234567"
  //  messenger: Facebook page username, e.g. "kuyquynhon"
  //  telegram:  username without @, e.g. "kuy_quynhon"
  //  zalo:      phone number used on Zalo, e.g. "0901234567"
  //  Empty value = the button scrolls to the Contact section.
  // ============================================================
  const CONTACTS = {
    whatsapp: "",
    messenger: "",
    telegram: "",
    zalo: ""
  };

  // ============================================================
  //  SUBSITES — where the service buttons lead.
  //  Relative paths = pages inside this site.
  //  To connect a separate site, put its full address instead,
  //  e.g. visa: "https://visa.kuy.com"
  // ============================================================
  const SUBSITES = {
    visa: "visa/index.html",
    exchange: "exchange/index.html",
    food: "food/index.html"
  };

  const I18N = window.KUY_I18N;
  const SUPPORTED = Object.keys(I18N);
  const DEFAULT_LANG = "en";
  const STORAGE_KEY = "kuy-lang";
  const ROOT = document.body.dataset.root || "";       // "" on home page, "../" on subpages
  const HOME = ROOT ? ROOT + "index.html" : "";
  let currentLang = DEFAULT_LANG;

  function t(key, vars) {
    let s = (I18N[currentLang] && I18N[currentLang][key]) ?? I18N[DEFAULT_LANG][key];
    if (s && vars) Object.keys(vars).forEach((k) => { s = s.split("{" + k + "}").join(vars[k]); });
    return s;
  }

  // ---------- Contact links ----------
  function linkFor(type, text) {
    const v = CONTACTS[type];
    if (!v) return null;
    const q = text ? "?text=" + encodeURIComponent(text) : "";
    switch (type) {
      case "whatsapp":  return "https://wa.me/" + v + q;
      case "messenger": return "https://m.me/" + v;
      case "telegram":  return "https://t.me/" + v;
      case "zalo":      return "https://zalo.me/" + v;
    }
    return null;
  }

  function setContactLink(el, type, text) {
    const href = linkFor(type, text);
    if (href) {
      el.href = href; el.target = "_blank"; el.rel = "noopener";
    } else {
      el.href = HOME + "#contact"; el.removeAttribute("target");
    }
  }

  function updateLinks() {
    document.querySelectorAll("[data-link]").forEach((el) => {
      setContactLink(el, el.dataset.link, t(el.dataset.msg || "msg.general"));
    });
    document.querySelectorAll("[data-subsite]").forEach((el) => {
      const url = SUBSITES[el.dataset.subsite];
      if (!url) return;
      el.href = /^https?:\/\//.test(url) ? url : ROOT + url;
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
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
    });
    document.documentElement.lang = currentLang;
    const titleKey = document.body.dataset.titleKey || "meta.title";
    if (!document.querySelector('meta[name="claude:viewport-fit-sides"]')) document.title = t(titleKey);

    document.querySelectorAll(".lang__btn").forEach((btn) => {
      const active = btn.dataset.lang === currentLang;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
    updateLinks();
    try { localStorage.setItem(STORAGE_KEY, currentLang); } catch (e) { /* ignore */ }
    document.dispatchEvent(new CustomEvent("kuy:lang", { detail: currentLang }));
  }

  // Shared helpers for page scripts (exchange calculator, food menu)
  window.KUY = {
    t,
    setContactLink,
    get lang() { return currentLang; },
    locale() { return { en: "en-US", ru: "ru-RU", vi: "vi-VN" }[currentLang] || "en-US"; }
  };

  document.querySelectorAll(".lang__btn").forEach((btn) => {
    btn.addEventListener("click", () => setLang(btn.dataset.lang));
  });

  // ---------- Mobile menu ----------
  const burger = document.getElementById("burger");
  const nav = document.getElementById("nav");
  if (burger && nav) {
    const toggleMenu = (open) => {
      const isOpen = open ?? !nav.classList.contains("is-open");
      nav.classList.toggle("is-open", isOpen);
      burger.setAttribute("aria-expanded", String(isOpen));
    };
    burger.addEventListener("click", () => toggleMenu());
    nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => toggleMenu(false)));
  }

  // ---------- Year ----------
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // Page scripts load after this file and listen for "kuy:lang",
  // so apply the language once the whole page is parsed.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setLang(getInitialLang()));
  } else {
    setLang(getInitialLang());
  }
})();
