(function () {
  const K = window.KUY;
  const $ = (id) => document.getElementById(id);
  const listEl = $("ckList");
  if (!listEl) return;

  // ============================================================
  //  CHECKLIST — edit items here. "only" limits an item to one border.
  //  Text keys live in i18n.js (ck.*). Test version: later this list
  //  moves into the Telegram bot.
  // ============================================================
  const GROUPS = [
    { key: "ck.gDocs", icon: "🛂", items: [
      { id: "passport" }, { id: "evisa" }, { id: "copy" }, { id: "photos", only: "cambodia" }
    ] },
    { key: "ck.gMoney", icon: "💵", items: [
      { id: "usd", only: "cambodia" }, { id: "laosFee", only: "laos" }, { id: "dong" }, { id: "fare" }
    ] },
    { key: "ck.gRoad", icon: "🎒", items: [
      { id: "water" }, { id: "jacket" }, { id: "power" }, { id: "pills" }, { id: "pen" }
    ] },
    { key: "ck.gMorning", icon: "⏰", items: [
      { id: "alarm" }, { id: "notify" }, { id: "hotel" }
    ] }
  ];

  const STORE = "kuy-visa-checklist";
  let st = { dest: "all", done: {} };
  try { st = Object.assign(st, JSON.parse(localStorage.getItem(STORE)) || {}); } catch (e) { /* none */ }
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(st)); } catch (e) { /* ignore */ } };

  const visible = (it) => !it.only || st.dest === "all" || it.only === st.dest;

  function renderProgress() {
    const items = GROUPS.flatMap((g) => g.items).filter(visible);
    const n = items.filter((it) => st.done[it.id]).length;
    $("ckCount").textContent = K.t("ck.count", { n, total: items.length });
    $("ckFill").style.width = (items.length ? (n / items.length) * 100 : 0) + "%";
    const all = n === items.length && items.length > 0;
    $("ckIcon").textContent = all ? "✅" : "🧳";
    $("ckCount").parentNode.parentNode.classList.toggle("is-complete", all);
    if (all) $("ckCount").textContent = K.t("ck.allDone");
  }

  function render() {
    document.querySelectorAll('input[name="ckDest"]').forEach((r) => { r.checked = r.value === st.dest; });
    listEl.innerHTML = "";
    GROUPS.forEach((g) => {
      const items = g.items.filter(visible);
      if (!items.length) return;
      const sec = document.createElement("fieldset");
      sec.className = "ck-group";
      sec.innerHTML = '<legend class="ck-group__title"><span aria-hidden="true"></span> <b></b></legend>';
      sec.querySelector("span").textContent = g.icon;
      sec.querySelector("b").textContent = K.t(g.key);
      items.forEach((it) => {
        const label = document.createElement("label");
        label.className = "ck-item";
        label.innerHTML = '<input type="checkbox"><span class="ck-item__box" aria-hidden="true"></span><span class="ck-item__text"><strong></strong><small></small></span>';
        const box = label.querySelector("input");
        box.id = "ck_" + it.id;
        box.checked = !!st.done[it.id];
        label.querySelector("strong").textContent = K.t("ck.i_" + it.id);
        const hint = K.t("ck.h_" + it.id);
        const small = label.querySelector("small");
        if (hint && hint !== "ck.h_" + it.id) small.textContent = hint; else small.remove();
        if (it.only) {
          const tag = document.createElement("em");
          tag.className = "ck-item__tag";
          tag.textContent = it.only === "laos" ? "🇱🇦 " + K.t("vr.countryLaos") : "🇰🇭 " + K.t("vr.countryCambodia");
          label.querySelector(".ck-item__text").appendChild(tag);
        }
        box.addEventListener("change", () => {
          if (box.checked) st.done[it.id] = 1; else delete st.done[it.id];
          save(); renderProgress();
        });
        sec.appendChild(label);
      });
      listEl.appendChild(sec);
    });
    renderProgress();
  }

  document.querySelectorAll('input[name="ckDest"]').forEach((r) => r.addEventListener("change", () => { st.dest = r.value; save(); render(); }));
  $("ckReset").addEventListener("click", () => { st.done = {}; save(); render(); });
  document.addEventListener("kuy:lang", render);
  render();
})();
