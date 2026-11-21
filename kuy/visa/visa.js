(function () {
  const K = window.KUY;
  const $ = (id) => document.getElementById(id);
  const schedEl = $("sched"), liveBadge = $("liveBadge"), refEl = $("vrRef");

  let departures = null;   // null = loading, [] = none, "error" = failed
  let visaFees = null;

  function getJSON(path) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    return fetch(K.visaApi + path, { signal: ctrl.signal, credentials: "omit" })
      .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .finally(() => clearTimeout(timer));
  }

  const vnd = (n) => Math.round(Number(n)).toLocaleString(K.locale()) + " ₫";

  function fmtDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12));
    return dt.toLocaleDateString(K.locale(), { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  }

  const STATUS = {
    confirmed: ["vr.stConfirmed", "ok"],
    open: ["vr.stOpen", "ok"],
    few_seats: ["vr.stFew", "warn"],
    recruiting: ["vr.stRecruiting", "info"],
    proposal_ready: ["vr.stProposal", "info"]
  };

  function country(dep) {
    const c = String(dep.destination_country || "").toLowerCase();
    if (c.startsWith("laos")) return ["🇱🇦", K.t("vr.countryLaos")];
    if (c.startsWith("cambod")) return ["🇰🇭", K.t("vr.countryCambodia")];
    return ["🛂", dep.destination_name || ""];
  }

  function renderSchedule() {
    schedEl.innerHTML = "";
    if (departures === null) {
      schedEl.innerHTML = '<p class="sched__state"></p>';
      schedEl.firstChild.textContent = K.t("vr.loading");
      return;
    }
    if (departures === "error" || !departures.length) {
      const box = document.createElement("div");
      box.className = "sched__empty";
      box.innerHTML = '<p></p><a class="btn btn--telegram" target="_blank" rel="noopener"></a>';
      box.querySelector("p").textContent = K.t(departures === "error" ? "vr.loadError" : "vr.noDepartures");
      const a = box.querySelector("a");
      a.textContent = K.t("vr.seeInTelegram");
      a.href = "https://t.me/" + "quytravel_bot";
      a.dataset.visa = "bot";
      schedEl.appendChild(box);
      document.dispatchEvent(new Event("kuy:relink"));
      return;
    }
    const list = document.createElement("ul");
    list.className = "sched__list";
    departures.slice(0, 10).forEach((dep) => {
      const [flag, name] = country(dep);
      const [stKey, stTone] = STATUS[dep.status] || ["vr.stRecruiting", "info"];
      const li = document.createElement("li");
      li.className = "dep";
      li.innerHTML =
        '<span class="dep__date"></span>' +
        '<span class="dep__route"><span class="dep__flag" aria-hidden="true"></span><span class="dep__name"></span><small class="dep__border"></small></span>' +
        '<span class="dep__time"></span>' +
        '<span class="dep__price"></span>' +
        '<span class="pill"></span>';
      li.querySelector(".dep__date").textContent = fmtDate(dep.departure_date);
      li.querySelector(".dep__flag").textContent = flag;
      li.querySelector(".dep__name").textContent = name;
      const border = dep.border_name || "";
      li.querySelector(".dep__border").textContent = (K.lang !== "ru" && /[А-яЁё]/.test(border)) ? "" : border;
      li.querySelector(".dep__time").textContent = dep.departure_time ? String(dep.departure_time).slice(0, 5) : "";
      li.querySelector(".dep__price").textContent = Number(dep.price_vnd) > 0
        ? K.t("vr.perPerson", { price: vnd(dep.price_vnd) })
        : K.t("vr.priceLater");
      const pill = li.querySelector(".pill");
      pill.textContent = K.t(stKey);
      pill.classList.add("pill--" + stTone);
      list.appendChild(li);
    });
    schedEl.appendChild(list);
  }

  function renderFees() {
    if (!visaFees) return;
    document.querySelectorAll("[data-fee]").forEach((el) => {
      const o = visaFees[el.dataset.fee];
      if (o && Number.isFinite(Number(o.fee))) el.textContent = vnd(o.fee);
    });
  }

  function renderRef() {
    const quy = K.quyCode(), other = K.getRef();
    if (quy) { refEl.textContent = K.t("vr.refQuy", { code: quy }); refEl.hidden = false; }
    else if (other) { refEl.textContent = K.t("vr.refOther", { code: other }); refEl.hidden = false; }
    else refEl.hidden = true;
  }

  function renderAll() { renderSchedule(); renderFees(); renderRef(); }

  getJSON("/journeys/recruitment/departures")
    .then((rows) => {
      departures = (Array.isArray(rows) ? rows : [])
        .filter((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d.departure_date || ""))
        .sort((a, b) => a.departure_date.localeCompare(b.departure_date));
      liveBadge.hidden = false;
    })
    .catch(() => { departures = "error"; })
    .finally(renderSchedule);

  getJSON("/journeys/visa-options")
    .then((o) => { if (o && typeof o === "object") { visaFees = o; renderFees(); } })
    .catch(() => { /* keep the default prices shown in the page */ });

  document.addEventListener("kuy:lang", renderAll);
})();
