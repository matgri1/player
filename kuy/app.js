(function () {
  // ============================================================
  //  CONTACTS — fill these in and every contact button updates.
  //  whatsapp:  phone with country code, digits only, e.g. "84901234567"
  //  telegram:  username without @, e.g. "kuy_quynhon"
  //  messenger: Facebook page username, e.g. "kuyquynhon"
  //  zalo:      phone number used on Zalo, e.g. "0901234567"
  //  Empty value = the button scrolls to the Contact section.
  // ============================================================
  const CONTACTS = {
    whatsapp: "",
    telegram: "",
    messenger: "",
    zalo: ""
  };

  // Main chat app per site language: Russian speakers → Telegram, others → WhatsApp.
  const PRIMARY_CHANNEL = { en: "whatsapp", ru: "telegram", vi: "whatsapp" };

  // ============================================================
  //  REFERRAL PROGRAM — rewards shown on the site.
  //  SITE_URL: public address used in share links (with / at the end).
  // ============================================================
  const REFERRAL = {
    friend: "$5",   // discount for the invited friend on the first order
    you: "$5"       // reward for the person who invited
  };
  const SITE_URL = "https://matgri1.github.io/player/kuy/";

  // ============================================================
  //  SUBSITES — where the service buttons lead.
  //  Relative paths = pages inside this site.
  //  To connect a separate site, put its full address instead,
  //  e.g. visa: "https://visa.kuy.com"
  // ============================================================
  // ============================================================
  //  VISA RUNS — the QUY Travel booking system (Telegram bot + web app).
  //  Booking, sign-in and QUY Club bonuses live there.
  // ============================================================
  const VISA_APP = {
    web: "https://82-27-201-63.nip.io/quytravel/",     // booking website
    api: "https://82-27-201-63.nip.io/quytravel/api",  // public schedule & prices
    bot: "quytravel_bot",                               // Telegram bot username
    manager: "quynhon_visarun"                          // Telegram of the visa run manager
  };

  const SUBSITES = {
    visa: "visa/index.html",
    exchange: "exchange/index.html",
    food: "food/index.html",
    refer: "refer/index.html"
  };

  const I18N = window.KUY_I18N;
  const SUPPORTED = Object.keys(I18N);
  const DEFAULT_LANG = "en";
  const STORAGE_KEY = "kuy-lang";
  const REF_KEY = "kuy-ref";
  const REF_HIDE_KEY = "kuy-ref-banner-hidden";
  const ROOT = document.body.dataset.root || "";       // "" on home page, "../" on subpages
  const HOME = ROOT ? ROOT + "index.html" : "";
  let currentLang = DEFAULT_LANG;

  // ---------- Small storage helpers (storage can be blocked) ----------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  function t(key, vars) {
    let s = (I18N[currentLang] && I18N[currentLang][key]) ?? I18N[DEFAULT_LANG][key];
    if (typeof s !== "string") return s;
    const all = Object.assign({ friend: REFERRAL.friend, you: REFERRAL.you }, vars || {});
    Object.keys(all).forEach((k) => { s = s.split("{" + k + "}").join(all[k]); });
    return s;
  }

  // ---------- Referral code ----------
  function cleanCode(raw) {
    const c = String(raw || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
    return c.length >= 3 && c.length <= 20 ? c : "";
  }
  function getRef() { return cleanCode(store.get(REF_KEY)); }
  function setRef(code) {
    const c = cleanCode(code);
    if (c) { store.set(REF_KEY, c); store.del(REF_HIDE_KEY); } else { store.del(REF_KEY); }
    updateLinks();
    renderRefBanner();
    return c;
  }
  // A code from a link (?ref=CODE) is saved unless the visitor already has one.
  (function captureRefFromUrl() {
    const fromUrl = cleanCode(new URLSearchParams(location.search).get("ref"));
    if (fromUrl && !getRef()) { store.set(REF_KEY, fromUrl); store.del(REF_HIDE_KEY); }
  })();

  // QUY Club codes look like QUY + letters/numbers; only those are understood by the visa system.
  const quyCode = () => { const c = getRef(); return /^QUY[A-Z0-9]{6,40}$/.test(c) ? c : ""; };
  function visaLink(kind) {
    const c = quyCode();
    if (kind === "bot") return "https://t.me/" + VISA_APP.bot + (c ? "?startapp=ref_" + c : "/app");
    if (kind === "manager") return "https://t.me/" + VISA_APP.manager;
    return VISA_APP.web + (c ? "?ref=" + encodeURIComponent(c) : "");
  }

  function shareLink(code) { return SITE_URL + "?ref=" + encodeURIComponent(code); }

  // ---------- Contact links ----------
  const primaryChannel = () => PRIMARY_CHANNEL[currentLang] || "whatsapp";

  function linkFor(type, text) {
    if (type === "primary") type = primaryChannel();
    const v = CONTACTS[type];
    if (!v) return null;
    const ref = getRef();
    const full = (text || "") + (ref && type !== "messenger" && type !== "zalo" ? "\n\n" + t("ref.line", { code: ref }) : "");
    const q = full ? "?text=" + encodeURIComponent(full) : "";
    switch (type) {
      case "whatsapp":  return "https://wa.me/" + v + q;
      case "telegram":  return "https://t.me/" + v + q;
      case "messenger": return "https://m.me/" + v;
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
    document.querySelectorAll("[data-visa]").forEach((el) => {
      el.href = visaLink(el.dataset.visa); el.target = "_blank"; el.rel = "noopener";
    });
    // Buttons with class btn--channel take the look of the main chat app.
    const ch = primaryChannel();
    document.body.classList.toggle("channel-telegram", ch === "telegram");
    document.body.classList.toggle("channel-whatsapp", ch !== "telegram");
  }

  // ---------- "Invited by a friend" banner ----------
  let banner = null;
  function renderRefBanner() {
    const code = getRef();
    if (!code || store.get(REF_HIDE_KEY)) { if (banner) banner.hidden = true; return; }
    if (!banner) {
      banner = document.createElement("div");
      banner.className = "ref-banner";
      banner.innerHTML =
        '<div class="container ref-banner__inner">' +
        '<span class="ref-banner__icon" aria-hidden="true">🎁</span>' +
        '<p class="ref-banner__text"><strong></strong> <span></span></p>' +
        '<button type="button" class="ref-banner__close">×</button></div>';
      banner.querySelector(".ref-banner__close").addEventListener("click", () => {
        store.set(REF_HIDE_KEY, "1"); banner.hidden = true;
      });
      const header = document.querySelector(".header");
      header.parentNode.insertBefore(banner, header.nextSibling);
    }
    banner.hidden = false;
    banner.querySelector(".ref-banner__text strong").textContent = t("ref.bannerTitle");
    banner.querySelector(".ref-banner__text span").textContent = t(/^QUY[A-Z0-9]{6,40}$/.test(code) ? "ref.bannerQuy" : "ref.bannerText", { code });
    banner.querySelector(".ref-banner__close").setAttribute("aria-label", t("ref.bannerClose"));
  }

  // ---------- Language ----------
  function getInitialLang() {
    const fromUrl = new URLSearchParams(location.search).get("lang");
    if (fromUrl && SUPPORTED.includes(fromUrl)) return fromUrl;
    const saved = store.get(STORAGE_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;
    return DEFAULT_LANG;
  }

  function setLang(lang) {
    currentLang = SUPPORTED.includes(lang) ? lang : DEFAULT_LANG;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const value = t(el.getAttribute("data-i18n"));
      if (value !== undefined) el.textContent = value;
    });
    document.querySelectorAll("[data-i18n-label]").forEach((el) => {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-label")));
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
    renderRefBanner();
    store.set(STORAGE_KEY, currentLang);
    document.dispatchEvent(new CustomEvent("kuy:lang", { detail: currentLang }));
  }

  // Shared helpers for page scripts
  window.KUY = {
    t,
    setContactLink,
    getRef,
    setRef,
    cleanCode,
    shareLink,
    visaApi: VISA_APP.api,
    visaLink,
    hasContact: (type) => !!CONTACTS[type],
    quyCode,
    get lang() { return currentLang; },
    locale() { return { en: "en-US", ru: "ru-RU", vi: "vi-VN" }[currentLang] || "en-US"; }
  };

  document.querySelectorAll(".lang__btn").forEach((btn) => {
    btn.addEventListener("click", () => setLang(btn.dataset.lang));
  });
  document.addEventListener("kuy:relink", updateLinks);

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
