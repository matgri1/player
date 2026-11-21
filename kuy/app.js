(function () {
  const I18N = window.KUY_I18N;
  const SUPPORTED = Object.keys(I18N);
  const DEFAULT_LANG = "en";
  const STORAGE_KEY = "kuy-lang";

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
    const dict = I18N[lang] || I18N[DEFAULT_LANG];
    const fallback = I18N[DEFAULT_LANG];

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const value = dict[key] ?? fallback[key];
      if (value !== undefined) el.textContent = value;
    });

    document.documentElement.lang = lang;
    if (dict["meta.title"]) document.title = dict["meta.title"];

    document.querySelectorAll(".lang__btn").forEach((btn) => {
      const active = btn.dataset.lang === lang;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });

    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }
  }

  document.querySelectorAll(".lang__btn").forEach((btn) => {
    btn.addEventListener("click", () => setLang(btn.dataset.lang));
  });

  setLang(getInitialLang());

  // ---------- Header on scroll ----------
  const header = document.querySelector(".header");
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 20);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ---------- Mobile menu ----------
  const burger = document.getElementById("burger");
  const nav = document.getElementById("nav");
  function toggleMenu(open) {
    const isOpen = open ?? !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", isOpen);
    header.classList.toggle("menu-open", isOpen);
    burger.setAttribute("aria-expanded", String(isOpen));
  }
  burger.addEventListener("click", () => toggleMenu());
  nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => toggleMenu(false)));

  // ---------- Orbit radius (responsive) ----------
  const orbit = document.querySelector(".orbit");
  function sizeOrbit() {
    if (!orbit) return;
    const k = window.innerWidth <= 600 ? 0.35 : 0.41;
    orbit.style.setProperty("--orbit-r", orbit.offsetWidth * k + "px");
  }
  window.addEventListener("resize", sizeOrbit);
  sizeOrbit();

  // ---------- Reveal on scroll ----------
  const revealEls = document.querySelectorAll(".pillar, .card, .step, .contact, .about__text, .section__head");
  if ("IntersectionObserver" in window) {
    revealEls.forEach((el) => el.classList.add("reveal"));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach((el) => io.observe(el));
  }

  // ---------- Year ----------
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
