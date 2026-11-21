(function () {
  const K = window.KUY;
  const $ = (id) => document.getElementById(id);
  const form = $("wcForm");
  if (!form) return;
  const STORE = "kuy-visa-stay";
  const DAY = 864e5;

  let st = { mode: "end", end: "", entry: "", type: "45", days: "30" };
  try { st = Object.assign(st, JSON.parse(localStorage.getItem(STORE)) || {}); } catch (e) { /* none */ }
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(st)); } catch (e) { /* ignore */ } };

  let departures = null;

  // Dates are handled as plain calendar days in Vietnam time.
  const todayISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  const toUTC = (iso) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  const toISO = (ms) => new Date(ms).toISOString().slice(0, 10);
  const addDays = (iso, n) => toISO(toUTC(iso) + n * DAY);
  const diffDays = (a, b) => Math.round((toUTC(b) - toUTC(a)) / DAY);
  const valid = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso || "") && !Number.isNaN(toUTC(iso));
  const fmt = (iso, opts) => new Date(toUTC(iso) + 12 * 3600e3).toLocaleDateString(K.locale(),
    Object.assign({ weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }, opts || {}));

  function plural(n, key) {
    // en: day/days · ru: день/дня/дней · vi: ngày
    const forms = K.t(key).split("|");
    if (K.lang === "ru") {
      const a = Math.abs(n) % 10, b = Math.abs(n) % 100;
      return a === 1 && b !== 11 ? forms[0] : a >= 2 && a <= 4 && (b < 12 || b > 14) ? forms[1] : forms[2] || forms[1];
    }
    return Math.abs(n) === 1 ? forms[0] : forms[1] || forms[0];
  }

  function compute() {
    const total = st.mode === "entry" ? (st.type === "custom" ? Math.max(1, Math.min(365, parseInt(st.days, 10) || 0)) : Number(st.type)) : null;
    let end = "";
    if (st.mode === "end" && valid(st.end)) end = st.end;
    if (st.mode === "entry" && valid(st.entry) && total) end = addDays(st.entry, total - 1); // the entry day counts as day 1
    if (!end) return null;
    const today = todayISO();
    const left = diffDays(today, end);                        // 0 = today is the last day
    const span = total || (left > 45 ? 90 : 45);
    const used = st.mode === "entry" ? diffDays(st.entry, today) + 1 : span - left;
    return { end, left, total: span, frac: Math.max(0, Math.min(1, used / span)) };
  }

  function sync() {
    form.querySelectorAll('input[name="wcMode"]').forEach((r) => { r.checked = r.value === st.mode; });
    form.querySelectorAll('input[name="wcType"]').forEach((r) => { r.checked = r.value === st.type; });
    $("wcEndField").hidden = st.mode !== "end";
    $("wcEntryFields").hidden = st.mode !== "entry";
    $("wcDaysField").hidden = st.type !== "custom";
    $("wcEnd").value = st.end; $("wcEntry").value = st.entry; $("wcDays").value = st.days;
    $("wcEntry").max = todayISO();
  }

  function renderTrips(r) {
    const box = $("wcTrips");
    box.innerHTML = "";
    const today = todayISO();
    const latest = r.end;
    if (r.left < 0) {
      const p = document.createElement("p"); p.className = "wstep__note"; p.textContent = K.t("wc.overTrips"); box.appendChild(p);
      return;
    }
    if (departures === null) {
      const p = document.createElement("p"); p.className = "wstep__note"; p.textContent = K.t("wc.noSchedule"); box.appendChild(p);
    }
    const fit = (departures || []).filter((d) => d.departure_date >= today && d.departure_date <= latest).slice(0, 4);
    if (departures !== null && !fit.length) {
      const p = document.createElement("p"); p.className = "wstep__note"; p.textContent = K.t("wc.noTrips"); box.appendChild(p);
    }
    const list = document.createElement("div");
    list.className = "wc-trip-list";
    fit.forEach((d) => {
      const dest = String(d.destination_country || "").toLowerCase().startsWith("laos") ? "laos" : "cambodia";
      const daysBefore = diffDays(d.departure_date, latest);
      const row = document.createElement("div");
      row.className = "wc-trip";
      row.innerHTML = '<span class="wc-trip__flag" aria-hidden="true"></span><span class="wc-trip__main"><strong></strong><small></small></span><button type="button" class="btn btn--primary btn--sm"></button>';
      row.querySelector(".wc-trip__flag").textContent = dest === "laos" ? "🇱🇦" : "🇰🇭";
      row.querySelector("strong").textContent = fmt(d.departure_date, { year: undefined }) + " · " + K.t(dest === "laos" ? "vr.countryLaos" : "vr.countryCambodia");
      row.querySelector("small").textContent = daysBefore === 0 ? K.t("wc.onLastDay") : K.t("wc.daysBefore", { n: daysBefore, days: plural(daysBefore, "wc.dayForms") });
      const btn = row.querySelector("button");
      btn.textContent = K.t("wc.bookThis");
      btn.addEventListener("click", () => window.KUY_BOOK && window.KUY_BOOK.start({ dest, depId: d.id }));
      list.appendChild(row);
    });
    if (fit.length) box.appendChild(list);
    // Always offer a custom date a few days before the deadline
    const suggest = r.left >= 2 ? addDays(latest, -Math.min(3, r.left - 1)) : addDays(today, 1);
    const other = document.createElement("button");
    other.type = "button";
    other.className = "btn btn--light btn--sm wc-other";
    other.textContent = K.t("wc.requestDate", { date: fmt(suggest, { weekday: undefined, year: undefined }) });
    other.addEventListener("click", () => window.KUY_BOOK && window.KUY_BOOK.start({ date: suggest }));
    if (suggest > today) box.appendChild(other);
  }

  function renderReminders(r) {
    const bot = (K.reminderBot && K.reminderBot.username) || "";
    const tg = $("wcTg"), soon = $("wcTgSoon");
    tg.hidden = !bot; soon.hidden = !!bot;
    if (bot) tg.href = "https://t.me/" + bot + "?start=visa_" + r.end.replace(/-/g, "");
    // Google Calendar: all-day event 7 days before the last day (or today if that has passed)
    const remindOn = r.left > 7 ? addDays(r.end, -7) : todayISO();
    const d1 = remindOn.replace(/-/g, ""), d2 = addDays(remindOn, 1).replace(/-/g, "");
    const title = K.t("wc.calTitle", { date: fmt(r.end, { weekday: undefined }) });
    const details = K.t("wc.calDetails") + " " + location.href.split("#")[0] + "#book";
    $("wcCal").href = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(title) +
      "&dates=" + d1 + "/" + d2 + "&details=" + encodeURIComponent(details);
    $("wcCal").parentNode.parentNode.hidden = r.left < 0;
  }

  function render() {
    sync();
    const r = compute();
    const out = $("wcResult");
    out.hidden = !r;
    if (!r) return;
    $("wcDate").textContent = fmt(r.end);
    const bar = $("wcBar");
    let tone = "ok", msg;
    if (r.left < 0) { tone = "over"; $("wcLeft").textContent = K.t("wc.overBy", { n: -r.left, days: plural(-r.left, "wc.dayForms") }); msg = K.t("wc.msgOver"); }
    else if (r.left === 0) { tone = "over"; $("wcLeft").textContent = K.t("wc.today"); msg = K.t("wc.msgToday"); }
    else {
      $("wcLeft").textContent = K.t("wc.left", { n: r.left, days: plural(r.left, "wc.dayForms") });
      if (r.left <= 7) { tone = "urgent"; msg = K.t("wc.msgUrgent"); }
      else if (r.left <= 21) { tone = "soon"; msg = K.t("wc.msgSoon", { date: fmt(addDays(r.end, -7), { weekday: undefined, year: undefined }) }); }
      else { msg = K.t("wc.msgOk", { date: fmt(addDays(r.end, -14), { weekday: undefined, year: undefined }) }); }
    }
    out.dataset.tone = tone;
    bar.style.setProperty("--f", r.left < 0 ? 1 : r.frac.toFixed(3));
    bar.setAttribute("aria-label", $("wcLeft").textContent);
    $("wcMsg").textContent = msg;
    renderTrips(r);
    renderReminders(r);
  }

  form.addEventListener("submit", (e) => e.preventDefault());
  form.addEventListener("change", (e) => {
    const t = e.target;
    if (t.name === "wcMode") st.mode = t.value;
    if (t.name === "wcType") st.type = t.value;
    if (t.id === "wcEnd") st.end = t.value;
    if (t.id === "wcEntry") st.entry = t.value;
    if (t.id === "wcDays") st.days = t.value;
    save(); render();
  });
  form.addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "wcEnd") st.end = t.value;
    if (t.id === "wcEntry") st.entry = t.value;
    if (t.id === "wcDays") st.days = t.value;
    save(); render();
  });

  document.addEventListener("kuy:lang", render);
  (window.KUY_VISA_DATA || Promise.resolve({})).then((d) => {
    if (d && Array.isArray(d.departures)) {
      departures = d.departures.filter((x) => x && valid(x.departure_date)).sort((a, b) => a.departure_date.localeCompare(b.departure_date));
    }
    render();
  });
  render();
})();
