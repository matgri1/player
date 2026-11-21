(function () {
  const K = window.KUY;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- 1. Example chat plays like a real conversation ----------
  const chatBody = document.querySelector(".chat__body");
  const replayBtn = document.getElementById("chatReplay");
  let timers = [];

  function playChat() {
    if (!chatBody) return;
    timers.forEach(clearTimeout); timers = [];
    chatBody.querySelectorAll(".bubble--typing").forEach((el) => el.remove());
    const bubbles = [...chatBody.querySelectorAll(".bubble")];
    if (reduceMotion) { bubbles.forEach((b) => b.classList.remove("is-hidden")); return; }

    bubbles.forEach((b) => b.classList.add("is-hidden"));
    let at = 400;
    bubbles.forEach((b) => {
      if (b.classList.contains("bubble--them")) {
        const typing = document.createElement("p");
        typing.className = "bubble bubble--them bubble--typing";
        typing.setAttribute("aria-hidden", "true");
        typing.innerHTML = "<span></span><span></span><span></span>";
        timers.push(setTimeout(() => chatBody.insertBefore(typing, b), at));
        at += 1100;
        timers.push(setTimeout(() => { typing.remove(); b.classList.remove("is-hidden"); }, at));
      } else {
        timers.push(setTimeout(() => b.classList.remove("is-hidden"), at));
      }
      at += 900;
    });
  }
  if (replayBtn) replayBtn.addEventListener("click", playChat);
  playChat();

  // ---------- 2. Live clock: time in Quy Nhon vs. the visitor ----------
  const clockEl = document.getElementById("clock");
  const VN_OFFSET = 7; // Vietnam is UTC+7 all year, no daylight saving

  function hoursWord(n) {
    const lang = K.lang;
    if (lang === "ru") {
      const i = Math.floor(n), m10 = i % 10, m100 = i % 100;
      if (n !== i) return "часа";
      if (m10 === 1 && m100 !== 11) return "час";
      if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "часа";
      return "часов";
    }
    if (lang === "vi") return "giờ";
    return n === 1 ? "hour" : "hours";
  }

  function updateClock() {
    if (!clockEl) return;
    const time = new Date().toLocaleTimeString(K.locale(), {
      timeZone: "Asia/Ho_Chi_Minh", hour: "numeric", minute: "2-digit"
    });
    const visitorOffset = -new Date().getTimezoneOffset() / 60;
    const diff = VN_OFFSET - visitorOffset;
    const n = Math.abs(diff);
    const nText = n.toLocaleString(K.locale()) + " " + hoursWord(n);
    let rel = K.t("clock.same");
    if (diff > 0) rel = K.t("clock.ahead", { n: nText });
    if (diff < 0) rel = K.t("clock.behind", { n: nText });
    clockEl.querySelector(".clock__time").textContent = K.t("clock.now", { time });
    clockEl.querySelector(".clock__rel").textContent = rel;
  }
  setInterval(updateClock, 20000);

  // ---------- 3. Tours: tap places to add them to the message ----------
  const tourBtn = document.getElementById("tourCta");
  const picks = [...document.querySelectorAll(".pick")];

  function updateTourLink() {
    if (!tourBtn) return;
    const chosen = picks.filter((p) => p.getAttribute("aria-pressed") === "true").map((p) => p.textContent.trim());
    const msg = chosen.length
      ? K.t("msg.toursPick", { places: chosen.join(", ") })
      : K.t("msg.tours");
    K.setContactLink(tourBtn, "whatsapp", msg);
    const count = document.getElementById("tourCount");
    if (count) count.textContent = chosen.length ? " (" + chosen.length + ")" : "";
  }
  picks.forEach((p) => p.addEventListener("click", () => {
    p.setAttribute("aria-pressed", String(p.getAttribute("aria-pressed") !== "true"));
    updateTourLink();
  }));

  document.addEventListener("kuy:lang", () => { updateClock(); updateTourLink(); });
})();
