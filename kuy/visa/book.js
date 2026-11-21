(function () {
  const K = window.KUY;
  const $ = (id) => document.getElementById(id);
  const form = $("wizard");
  if (!form) return;

  // ---------------- Data ----------------
  const DEFAULT_FEES = { stamp: 0, evisa90: 2150000, multivisa: 2800000 };
  const VISA_TYPES = ["stamp", "evisa90", "multivisa"];
  // Passports that do NOT get Vietnam's visa-free stamp (they need an e-visa).
  const NEEDS_EVISA = ["US", "CA", "AU"];
  const NATIONS = [
    ["US", "United States", "США", "Hoa Kỳ"],
    ["RU", "Russia", "Россия", "Nga"],
    ["UA", "Ukraine", "Украина", "Ukraina"],
    ["KZ", "Kazakhstan", "Казахстан", "Kazakhstan"],
    ["BY", "Belarus", "Беларусь", "Belarus"],
    ["GB", "United Kingdom", "Великобритания", "Vương quốc Anh"],
    ["CA", "Canada", "Канада", "Canada"],
    ["AU", "Australia", "Австралия", "Úc"],
    ["DE", "Germany", "Германия", "Đức"],
    ["FR", "France", "Франция", "Pháp"],
    ["OTHER", "Other country", "Другая страна", "Quốc gia khác"]
  ];
  const LANG_IDX = { en: 1, ru: 2, vi: 3 };
  const natName = (code, other) => {
    if (code === "OTHER") return other || "";
    const row = NATIONS.find((n) => n[0] === code);
    return row ? row[LANG_IDX[K.lang] || 1] : "";
  };

  let departures = null;          // live list or null
  let fees = { ...DEFAULT_FEES };
  const DRAFT = "kuy-visa-draft";

  const blank = () => ({
    step: 1, dest: "", when: "", reqDate: "",
    pax: [{ name: "", nat: "", natOther: "", visa: "" }],
    cName: "", channel: "telegram", cTg: "", cPhone: "", cPickup: "", cNote: "", cClub: K.quyCode() || "",
    code: "", idem: "", saved: false
  });
  let st = blank();
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT));
    if (saved && saved.pax && saved.step < 6) st = Object.assign(blank(), saved);
  } catch (e) { /* no draft */ }
  const save = () => { try { localStorage.setItem(DRAFT, JSON.stringify(st)); } catch (e) { /* ignore */ } };

  // ---------------- Helpers ----------------
  const vnd = (n) => Math.round(Number(n) || 0).toLocaleString(K.locale()) + " ₫";
  const todayISO = (offset) => {
    const d = new Date(Date.now() + (offset || 0) * 864e5);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(d);
  };
  const fmtDate = (iso) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString(K.locale(),
      { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  };
  const isCountry = (dep, dest) => String(dep.destination_country || "").toLowerCase().startsWith(dest === "laos" ? "laos" : "cambod");
  const depsFor = (dest) => (departures || []).filter((d) => isCountry(d, dest)).slice(0, 8);
  const chosenDep = () => (st.when && st.when !== "request" ? (departures || []).find((d) => String(d.id) === st.when) : null);
  const letters = (v) => (String(v || "").match(/\p{L}/gu) || []).length;
  const tgOk = (v) => /^[A-Za-z0-9_]{5,32}$/.test(String(v || "").replace(/^@/, ""));
  const phoneOk = (v) => /^\+\d[\d\s().-]{6,18}$/.test(String(v || "").trim()) && String(v).replace(/\D/g, "").length >= 8 && String(v).replace(/\D/g, "").length <= 15;
  const clubOk = (v) => !v || /^QUY[A-Z0-9]{6,40}$/.test(String(v).trim().toUpperCase());

  // ---------------- Validation ----------------
  function paxErrors(p) {
    const e = {};
    if (letters(p.name) < 2) e.name = "bk.eName";
    if (!p.nat) e.nat = "bk.eNat";
    else if (p.nat === "OTHER" && letters(p.natOther) < 2) e.natOther = "bk.eNatOther";
    if (!p.visa) e.visa = "bk.eVisa";
    else if (p.visa === "stamp" && NEEDS_EVISA.includes(p.nat)) e.visa = "bk.eStampUS";
    return e;
  }
  function stepErrors(n) {
    const e = {};
    if (n === 1 && !st.dest) e.dest = "bk.eDest";
    if (n === 2) {
      if (!st.when) e.when = "bk.eWhen";
      else if (st.when === "request" && !(st.reqDate && st.reqDate > todayISO(0) && st.reqDate <= todayISO(370))) e.when = "bk.eDate";
    }
    if (n === 3) st.pax.forEach((p, i) => { const pe = paxErrors(p); Object.keys(pe).forEach((k) => { e["pax" + i + "_" + k] = pe[k]; }); });
    if (n === 4) {
      if (letters(st.cName) < 2) e.cName = "bk.eCName";
      if (st.channel === "telegram" && !tgOk(st.cTg)) e.cTg = "bk.eTg";
      if (st.channel === "whatsapp" && !phoneOk(st.cPhone)) e.cPhone = "bk.ePhone";
      if (String(st.cPickup).trim().length < 3) e.cPickup = "bk.ePickup";
      if (!clubOk(st.cClub)) e.cClub = "bk.eClub";
    }
    return e;
  }

  // Share of the form filled in (0..1), for the car on the road
  function progress() {
    if (st.step >= 6) return 1;
    const c1 = st.dest ? 1 : 0;
    const c2 = Object.keys(stepErrors(2)).length ? 0 : 1;
    const per = st.pax.map((p) => 3 - Object.keys(paxErrors(p)).filter((k) => k !== "natOther").length).reduce((a, b) => a + b, 0);
    const c3 = per / (st.pax.length * 3);
    const f4 = ["cName", st.channel === "telegram" ? "cTg" : "cPhone", "cPickup"];
    const e4 = stepErrors(4);
    const c4 = f4.filter((k) => !e4[k]).length / f4.length;
    const c5 = st.step === 5 ? 0.6 : 0;
    return Math.min(0.97, (c1 + c2 * (st.step >= 2 ? 1 : 0) + c3 * (st.step >= 3 ? 1 : 0) + c4 * (st.step >= 4 ? 1 : 0) + c5) / 5);
  }

  // ---------------- Car on the road ----------------
  const trip = $("trip"), car = $("tripCar");
  let lastP = -1, moveTimer;
  function renderTrip() {
    const p = progress();
    trip.style.setProperty("--p", p.toFixed(3));
    if (Math.abs(p - lastP) > 0.001 && lastP >= 0) {
      trip.classList.add("is-moving");
      clearTimeout(moveTimer);
      moveTimer = setTimeout(() => trip.classList.remove("is-moving"), 1100);
    }
    lastP = p;
    trip.classList.toggle("is-arrived", p >= 1);
    const flag = st.dest === "laos" ? "🇱🇦" : st.dest === "cambodia" ? "🇰🇭" : "🏁";
    $("tripFlag").textContent = flag;
    $("tripFlagBig").textContent = flag;
    $("tripTo").textContent = K.t(st.dest === "laos" ? "bk.toLaos" : st.dest === "cambodia" ? "bk.toCambodia" : "bk.toBorder");
    const key = p >= 1 ? "bk.st5" : p >= 0.85 ? "bk.st4" : p >= 0.55 ? "bk.st3" : p >= 0.25 ? "bk.st2" : p > 0 ? "bk.st1" : "bk.st0";
    $("tripStatus").textContent = K.t(key);
  }

  // ---------------- Errors UI ----------------
  function clearErrors() {
    form.querySelectorAll(".field-error").forEach((el) => { el.hidden = true; el.textContent = ""; });
    form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
  }
  function showErrors(errs) {
    clearErrors();
    let first = null;
    Object.keys(errs).forEach((k) => {
      const box = form.querySelector('[data-error="' + k + '"]');
      if (box) { box.textContent = K.t(errs[k]); box.hidden = false; }
      const input = form.querySelector('[data-field="' + k + '"]') || $(k);
      if (input) { input.setAttribute("aria-invalid", "true"); if (!first) first = input; }
      else if (box && !first) first = box;
    });
    if (first) { first.focus && first.focus({ preventScroll: true }); first.scrollIntoView({ block: "center", behavior: "smooth" }); }
  }

  // ---------------- Step 2: departures ----------------
  function renderDeps() {
    const box = $("depChoices");
    box.innerHTML = "";
    const list = st.dest ? depsFor(st.dest) : [];
    if (departures === null) {
      const p = document.createElement("p"); p.className = "wstep__note"; p.textContent = K.t("bk.noSchedule"); box.appendChild(p);
    } else if (!list.length) {
      const p = document.createElement("p"); p.className = "wstep__note"; p.textContent = K.t("bk.noDeps"); box.appendChild(p);
    }
    list.forEach((d) => {
      const label = document.createElement("label");
      label.className = "choice choice--wide";
      label.innerHTML = '<input type="radio" name="when"><span class="choice__box choice__box--row">' +
        '<span class="dep-date"><b></b><small></small></span><span class="dep-info"><strong></strong><small></small></span><span class="pill"></span></span>';
      const input = label.querySelector("input");
      input.value = String(d.id);
      input.checked = st.when === input.value;
      const [y, m, dd] = d.departure_date.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, dd, 12));
      label.querySelector(".dep-date b").textContent = dt.toLocaleDateString(K.locale(), { day: "numeric", timeZone: "UTC" });
      label.querySelector(".dep-date small").textContent = dt.toLocaleDateString(K.locale(), { month: "short", weekday: "short", timeZone: "UTC" });
      label.querySelector(".dep-info strong").textContent = K.t("bk.departAt", { time: String(d.departure_time || "").slice(0, 5) || "—" });
      label.querySelector(".dep-info small").textContent = Number(d.price_vnd) > 0 ? K.t("vr.perPerson", { price: vnd(d.price_vnd) }) : K.t("vr.priceLater");
      const confirmed = ["confirmed", "open"].includes(d.status);
      const pill = label.querySelector(".pill");
      pill.textContent = K.t(confirmed ? "vr.stConfirmed" : d.status === "few_seats" ? "vr.stFew" : "vr.stRecruiting");
      pill.classList.add(confirmed ? "pill--ok" : d.status === "few_seats" ? "pill--warn" : "pill--info");
      box.appendChild(label);
    });
    form.querySelector('input[name="when"][value="request"]').checked = st.when === "request";
    $("dateField").hidden = st.when !== "request";
    const date = $("reqDate");
    date.min = todayISO(1); date.max = todayISO(370); date.value = st.reqDate || "";
  }

  // ---------------- Step 3: passengers ----------------
  function visaLabel(v) { return K.t("bk.v_" + v); }
  function renderPax() {
    $("paxVal").textContent = st.pax.length;
    $("paxMinus").disabled = st.pax.length <= 1;
    $("paxPlus").disabled = st.pax.length >= 20;
    $("paxMinus").setAttribute("aria-label", K.t("bk.paxLess"));
    $("paxPlus").setAttribute("aria-label", K.t("bk.paxMore"));
    const list = $("paxList");
    list.innerHTML = "";
    st.pax.forEach((p, i) => {
      const card = document.createElement("div");
      card.className = "pax";
      const id = (k) => "pax" + i + "_" + k;
      card.innerHTML =
        '<h3 class="pax__title"></h3>' +
        '<div class="field"><label class="field__label" for="' + id("name") + '"></label>' +
        '<input class="input" id="' + id("name") + '" data-field="' + id("name") + '" maxlength="120" autocomplete="' + (i === 0 ? "name" : "off") + '" spellcheck="false">' +
        '<p class="field__hint"></p><p class="field-error" data-error="' + id("name") + '" hidden></p></div>' +
        '<div class="field"><label class="field__label" for="' + id("nat") + '"></label>' +
        '<select class="input" id="' + id("nat") + '" data-field="' + id("nat") + '"></select>' +
        '<p class="field-error" data-error="' + id("nat") + '" hidden></p></div>' +
        '<div class="field" data-other hidden><label class="field__label" for="' + id("natOther") + '"></label>' +
        '<input class="input" id="' + id("natOther") + '" data-field="' + id("natOther") + '" maxlength="80">' +
        '<p class="field-error" data-error="' + id("natOther") + '" hidden></p></div>' +
        '<div class="field"><span class="field__label" id="' + id("visaL") + '"></span>' +
        '<div class="visa-pick" role="radiogroup" aria-labelledby="' + id("visaL") + '" data-field="' + id("visa") + '" tabindex="-1"></div>' +
        '<p class="field__warn" hidden></p><p class="field-error" data-error="' + id("visa") + '" hidden></p></div>';
      card.querySelector(".pax__title").textContent = K.t(i === 0 ? "bk.paxFirst" : "bk.paxN", { n: i + 1 });
      const labels = card.querySelectorAll(".field__label");
      labels[0].textContent = K.t("bk.fullName");
      card.querySelector(".field__hint").textContent = K.t("bk.fullNameHint");
      labels[1].textContent = K.t("bk.nationality");
      labels[2].textContent = K.t("bk.country");
      labels[3].textContent = K.t("bk.visaQ");

      const name = card.querySelector("#" + id("name"));
      name.value = p.name;
      name.placeholder = "JOHN SMITH";
      name.addEventListener("input", () => { p.name = name.value; save(); renderTrip(); });

      const sel = card.querySelector("#" + id("nat"));
      const ph = document.createElement("option"); ph.value = ""; ph.textContent = K.t("bk.choose"); sel.appendChild(ph);
      NATIONS.forEach((n) => { const o = document.createElement("option"); o.value = n[0]; o.textContent = n[LANG_IDX[K.lang] || 1]; sel.appendChild(o); });
      sel.value = p.nat;
      const other = card.querySelector("[data-other]");
      const otherIn = card.querySelector("#" + id("natOther"));
      other.hidden = p.nat !== "OTHER";
      otherIn.value = p.natOther;
      otherIn.addEventListener("input", () => { p.natOther = otherIn.value; save(); });

      const warn = card.querySelector(".field__warn");
      const pick = card.querySelector(".visa-pick");
      const updateWarn = () => {
        const bad = NEEDS_EVISA.includes(p.nat);
        warn.hidden = !bad;
        warn.textContent = bad ? K.t("bk.usHint") : "";
      };
      VISA_TYPES.forEach((v) => {
        const lab = document.createElement("label");
        lab.className = "vchoice";
        lab.innerHTML = '<input type="radio"><span><strong></strong><em></em><small></small></span>';
        const r = lab.querySelector("input");
        r.name = id("visa"); r.value = v; r.checked = p.visa === v;
        lab.querySelector("strong").textContent = visaLabel(v);
        lab.querySelector("em").textContent = Number(fees[v]) > 0 ? vnd(fees[v]) : K.t("bk.free");
        lab.querySelector("small").textContent = K.t("bk.vh_" + v);
        r.addEventListener("change", () => { p.visa = v; save(); renderTrip(); });
        pick.appendChild(lab);
      });
      sel.addEventListener("change", () => {
        p.nat = sel.value; other.hidden = p.nat !== "OTHER";
        if (NEEDS_EVISA.includes(p.nat) && p.visa === "stamp") { p.visa = ""; pick.querySelectorAll("input").forEach((x) => { x.checked = false; }); }
        updateWarn(); save(); renderTrip();
      });
      updateWarn();
      list.appendChild(card);
    });
  }

  // ---------------- Step 4: contact ----------------
  function renderContact() {
    $("cName").value = st.cName; $("cTg").value = st.cTg.replace(/^@/, ""); $("cPhone").value = st.cPhone;
    $("cPickup").value = st.cPickup; $("cNote").value = st.cNote; $("cClub").value = st.cClub;
    $("cPickup").placeholder = "FLC Sea Tower";
    form.querySelectorAll('input[name="channel"]').forEach((r) => { r.checked = r.value === st.channel; });
    $("tgField").hidden = st.channel !== "telegram";
    $("waField").hidden = st.channel !== "whatsapp";
  }

  // ---------------- Step 5: review & message ----------------
  function destName() { return K.t(st.dest === "laos" ? "vr.laos" : "vr.cambodia"); }
  function whenText() {
    const d = chosenDep();
    if (d) return fmtDate(d.departure_date) + " · " + K.t("bk.departAt", { time: String(d.departure_time || "").slice(0, 5) });
    return fmtDate(st.reqDate) + " · " + K.t("bk.requestedDate");
  }
  function totals() {
    const d = chosenDep();
    const perPerson = d && Number(d.price_vnd) > 0 ? Number(d.price_vnd) : null;
    const visa = st.pax.reduce((n, p) => n + (Number(fees[p.visa]) || 0), 0);
    return { perPerson, transport: perPerson ? perPerson * st.pax.length : null, visa, total: perPerson ? perPerson * st.pax.length + visa : null };
  }
  function contactText() {
    return st.channel === "telegram" ? "Telegram @" + st.cTg.replace(/^@/, "") : "WhatsApp " + st.cPhone.trim();
  }
  function buildMessage() {
    const t = totals();
    const lines = [
      "🛂 " + K.t("bk.mTitle") + " " + st.code,
      K.t("bk.mDest") + ": " + destName(),
      K.t("bk.mDate") + ": " + whenText(),
      K.t("bk.mPax", { n: st.pax.length }) + ":"
    ];
    st.pax.forEach((p, i) => lines.push("  " + (i + 1) + ". " + p.name.trim() + " — " + natName(p.nat, p.natOther.trim()) + " — " + visaLabel(p.visa)));
    lines.push(K.t("bk.mContact") + ": " + st.cName.trim() + ", " + contactText());
    lines.push(K.t("bk.mPickup") + ": " + st.cPickup.trim());
    if (st.cNote.trim()) lines.push(K.t("bk.mNote") + ": " + st.cNote.trim());
    if (st.cClub.trim()) lines.push(K.t("bk.mClub") + ": " + st.cClub.trim().toUpperCase());
    lines.push(t.total != null ? K.t("bk.mTotal") + ": " + vnd(t.total) : K.t("bk.mVisaTotal") + ": " + vnd(t.visa) + " · " + K.t("vr.priceLater"));
    return lines.join("\n");
  }
  function renderReview() {
    const box = $("review");
    box.innerHTML = "";
    const add = (title, rows, step) => {
      const sec = document.createElement("div");
      sec.className = "review__sec";
      sec.innerHTML = '<div class="review__head"><h3></h3><button type="button" class="review__edit"></button></div><ul></ul>';
      sec.querySelector("h3").textContent = title;
      const b = sec.querySelector(".review__edit");
      b.textContent = K.t("bk.edit"); b.addEventListener("click", () => go(step));
      rows.forEach((r) => { const li = document.createElement("li"); li.textContent = r; sec.querySelector("ul").appendChild(li); });
      box.appendChild(sec);
    };
    add(K.t("bk.n1"), [destName()], 1);
    add(K.t("bk.n2"), [whenText()], 2);
    add(K.t("bk.n3") + " (" + st.pax.length + ")", st.pax.map((p, i) => (i + 1) + ". " + p.name.trim() + " · " + natName(p.nat, p.natOther.trim()) + " · " + visaLabel(p.visa)), 3);
    const c = [st.cName.trim() + " · " + contactText(), K.t("bk.mPickup") + ": " + st.cPickup.trim()];
    if (st.cNote.trim()) c.push(K.t("bk.mNote") + ": " + st.cNote.trim());
    if (st.cClub.trim()) c.push(K.t("bk.mClub") + ": " + st.cClub.trim().toUpperCase());
    add(K.t("bk.n4"), c, 4);

    const t = totals();
    const tot = $("total");
    tot.innerHTML = "";
    const row = (label, value, strong) => {
      const r = document.createElement("div"); r.className = "total__row" + (strong ? " total__row--sum" : "");
      r.innerHTML = "<span></span><span></span>"; r.children[0].textContent = label; r.children[1].textContent = value; tot.appendChild(r);
    };
    row(K.t("bk.tTransport", { n: st.pax.length }), t.transport != null ? vnd(t.transport) : K.t("vr.priceLater"));
    row(K.t("bk.tVisa"), vnd(t.visa));
    row(K.t("bk.tTotal"), t.total != null ? vnd(t.total) : K.t("bk.tAfter"), true);
  }

  function renderDone() {
    $("doneCode").textContent = st.code;
    $("doneTitle").textContent = K.t(st.saved ? "bk.savedTitle" : "bk.doneTitle");
    $("doneText").textContent = K.t(st.saved ? "bk.savedText" : "bk.doneText", { channel: st.channel === "telegram" ? "Telegram" : "WhatsApp" });
    $("sendTg").querySelector("span").textContent = K.t(st.saved ? "bk.sendTgSaved" : "bk.sendTg");
    const msg = buildMessage();
    $("doneMsg").textContent = msg;
    const tg = $("sendTg");
    tg.href = K.visaLink("manager") + "?text=" + encodeURIComponent(msg);
    const wa = $("sendWa");
    wa.hidden = !K.hasContact("whatsapp");
    if (!wa.hidden) K.setContactLink(wa, "whatsapp", msg);
  }

  // ---------------- Navigation ----------------
  function show() {
    form.querySelectorAll(".wstep").forEach((el) => { el.hidden = Number(el.dataset.step) !== st.step; });
    $("stepsNav").querySelectorAll("li").forEach((li) => {
      const n = Number(li.dataset.step);
      li.classList.toggle("is-current", n === st.step);
      li.classList.toggle("is-done", n < st.step);
      if (n === st.step) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    $("wnav").hidden = st.step >= 6;
    $("backBtn").hidden = st.step === 1;
    $("nextBtn").textContent = K.t(st.step === 5 ? "bk.finish" : "bk.next");
    form.querySelectorAll('input[name="dest"]').forEach((r) => { r.checked = r.value === st.dest; });
    if (st.step === 2) renderDeps();
    if (st.step === 3) renderPax();
    if (st.step === 4) renderContact();
    if (st.step === 5) renderReview();
    if (st.step === 6) renderDone();
    renderTrip();
  }
  function go(n) {
    clearErrors();
    st.step = n; save(); show();
    const target = st.step === 6 ? form.querySelector(".wdone") : form.querySelector('.wstep[data-step="' + st.step + '"] .wstep__title');
    if (target) { target.setAttribute("tabindex", "-1"); target.focus({ preventScroll: true }); }
    trip.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const errs = stepErrors(st.step);
    if (Object.keys(errs).length) { showErrors(errs); return; }
    if (st.step === 5) { submitRequest(); return; }
    go(st.step + 1);
  });
  // ---------------- Sending to the Kuy server ----------------
  function payload() {
    const d = chosenDep();
    return {
      lang: K.lang,
      destination: st.dest,
      request_mode: d ? "scheduled" : "date_request",
      quy_trip_id: d ? d.id : null,
      travel_date: d ? d.departure_date : st.reqDate,
      departure_time: d ? String(d.departure_time || "").slice(0, 5) : null,
      passengers: st.pax.map((p) => ({ name: p.name.trim(), nationality_code: p.nat, nationality: p.nat === "OTHER" ? p.natOther.trim() : natName(p.nat), visa: p.visa })),
      contact_name: st.cName.trim(),
      contact_channel: st.channel,
      contact_value: st.channel === "telegram" ? st.cTg.replace(/^@/, "") : st.cPhone.trim(),
      pickup: st.cPickup.trim(),
      note: st.cNote.trim(),
      club_code: st.cClub.trim().toUpperCase() || null,
      ref_code: K.getRef() || null,
      est_price_per_person: d && Number(d.price_vnd) > 0 ? Number(d.price_vnd) : null,
      idempotency_key: st.idem,
      website: $("hpWebsite").value
    };
  }
  let sending = false;
  async function submitRequest() {
    if (sending) return;
    sending = true;
    const btn = $("nextBtn"), err = $("sendError");
    err.hidden = true;
    btn.disabled = true; btn.textContent = K.t("bk.sending");
    if (!st.idem) { st.idem = "web-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10); save(); }
    let saved = false, code = "";
    if (K.siteApi) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 12000);
        const res = await fetch(K.siteApi + "/visa/requests", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload()), signal: ctrl.signal, credentials: "omit"
        });
        clearTimeout(timer);
        const data = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
        if ((res.status === 200 || res.status === 201) && data && data.code) { saved = true; code = data.code; }
        else if (res.status === 400) {
          err.textContent = K.t("bk.serverCheck"); err.hidden = false;
          sending = false; btn.disabled = false; btn.textContent = K.t("bk.finish");
          return;
        }
        // 403/404/405/429/5xx: no server here or it can't take the request now → Telegram fallback
      } catch (e) { /* offline or no server (GitHub Pages) → Telegram fallback */ }
    }
    if (!code) code = "QN-" + todayISO(0).slice(2).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    st.code = code; st.saved = saved;
    sending = false; btn.disabled = false;
    go(6);
    try { localStorage.removeItem(DRAFT); } catch (e) { /* ignore */ }
  }

  $("backBtn").addEventListener("click", () => go(Math.max(1, st.step - 1)));
  $("newReq").addEventListener("click", () => { st = blank(); save(); go(1); });

  // Field listeners (static inputs)
  form.addEventListener("change", (e) => {
    const t = e.target;
    if (t.name === "dest") { if (st.dest !== t.value) st.when = ""; st.dest = t.value; }
    if (t.name === "when") { st.when = t.value; $("dateField").hidden = st.when !== "request"; if (st.when === "request") $("reqDate").focus(); }
    if (t.id === "reqDate") st.reqDate = t.value;
    if (t.name === "channel") { st.channel = t.value; renderContact(); }
    save(); renderTrip();
  });
  form.addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "reqDate") st.reqDate = t.value;
    if (t.id === "cName") st.cName = t.value;
    if (t.id === "cTg") { const v = t.value.replace(/^@+/, "").replace(/\s/g, ""); if (v !== t.value) t.value = v; st.cTg = v; }
    if (t.id === "cPhone") st.cPhone = t.value;
    if (t.id === "cPickup") st.cPickup = t.value;
    if (t.id === "cNote") st.cNote = t.value;
    if (t.id === "cClub") st.cClub = t.value.toUpperCase().replace(/\s/g, "");
    save(); renderTrip();
  });
  $("paxPlus").addEventListener("click", () => { if (st.pax.length < 20) { st.pax.push({ name: "", nat: st.pax[0].nat, natOther: st.pax[0].natOther, visa: "" }); save(); renderPax(); renderTrip(); } });
  $("paxMinus").addEventListener("click", () => { if (st.pax.length > 1) { st.pax.pop(); save(); renderPax(); renderTrip(); } });

  $("copyReq").addEventListener("click", () => {
    const msg = buildMessage(), status = $("copyStatus");
    const fallback = () => {
      const r = document.createRange(); r.selectNodeContents($("doneMsg"));
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      status.textContent = K.t("refer.copyManual");
    };
    try { navigator.clipboard.writeText(msg).then(() => { status.textContent = K.t("bk.copied"); }, fallback); } catch (err) { fallback(); }
  });

  // ---------------- Tabs ----------------
  const tabs = [...document.querySelectorAll('.tab[role="tab"]')];
  function openTab(name, focus) {
    tabs.forEach((tb) => {
      const on = tb.dataset.tab === name;
      tb.setAttribute("aria-selected", String(on));
      tb.tabIndex = on ? 0 : -1;
      $(tb.getAttribute("aria-controls")).hidden = !on;
      if (on && focus) tb.focus();
      if (on) { const bar = tb.parentNode; bar.scrollTo({ left: tb.offsetLeft - (bar.clientWidth - tb.offsetWidth) / 2, behavior: "smooth" }); }
    });
    if (name === "book") show();
    const want = name === "overview" ? "" : "#" + name;
    if (location.hash !== want) history.replaceState(null, "", want || location.pathname + location.search);
    document.dispatchEvent(new CustomEvent("kuy:tab", { detail: name }));
  }
  const tabFromHash = () => { const h = location.hash.slice(1); return tabs.some((t) => t.dataset.tab === h) ? h : "overview"; };
  tabs.forEach((tb, i) => {
    tb.addEventListener("click", () => openTab(tb.dataset.tab));
    tb.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      openTab(next.dataset.tab, true);
    });
  });
  document.querySelectorAll("[data-open-tab]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault(); openTab(a.dataset.openTab);
    document.querySelector(".tabs-bar").scrollIntoView({ block: "start", behavior: "smooth" });
  }));
  window.addEventListener("hashchange", () => openTab(tabFromHash()));

  // Lets other tabs start a booking with a destination / departure / date already chosen
  window.KUY_BOOK = {
    start(opts) {
      st.dest = opts.dest || st.dest;
      if (opts.depId) { st.when = String(opts.depId); }
      else if (opts.date) { st.when = "request"; st.reqDate = opts.date; }
      st.step = st.dest ? 2 : 1;
      save();
      openTab("book");
      document.querySelector(".tabs-bar").scrollIntoView({ block: "start", behavior: "smooth" });
    }
  };

  // ---------------- Start ----------------
  document.addEventListener("kuy:lang", () => { show(); });
  if (tabFromHash() !== "overview") openTab(tabFromHash());
  (window.KUY_VISA_DATA || Promise.resolve({})).then((d) => {
    if (d && Array.isArray(d.departures)) departures = d.departures.filter((x) => x && /^\d{4}-\d{2}-\d{2}$/.test(x.departure_date || "")).sort((a, b) => a.departure_date.localeCompare(b.departure_date));
    if (d && d.fees) VISA_TYPES.forEach((v) => { if (d.fees[v] && Number.isFinite(Number(d.fees[v].fee))) fees[v] = Number(d.fees[v].fee); });
    if (st.when && st.when !== "request" && !chosenDep()) st.when = "";
    show();
  });
  show();
})();
