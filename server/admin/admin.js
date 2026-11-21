(function () {
  const $ = (id) => document.getElementById(id);
  const STATUS = { new: "Новая", contacted: "Связались", confirmed: "Подтверждена", completed: "Завершена", cancelled: "Отменена" };
  const VISA = { stamp: "Штамп 45 дн.", evisa90: "E-visa 90 дн.", multivisa: "Мультивиза" };
  const DEST = { laos: ["🇱🇦", "Лаос · Бо И"], cambodia: ["🇰🇭", "Камбоджа · Ле Тхань"] };

  // ---------- helpers ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
    return el;
  }
  async function api(path, opts) {
    const res = await fetch("/api/admin" + path, Object.assign({ credentials: "same-origin", headers: { "Content-Type": "application/json" } }, opts || {}));
    const data = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
    if (res.status === 401 && path !== "/login") { showLogin(); throw new Error("auth"); }
    if (!res.ok) throw new Error((data && data.error) || "Ошибка " + res.status);
    return data;
  }
  const vnToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  const fmtDay = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" });
  const fmtDT = (ts) => new Date(ts).toLocaleString("ru-RU", { timeZone: "Asia/Ho_Chi_Minh", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const vnd = (n) => n == null ? "—" : Number(n).toLocaleString("ru-RU") + " ₫";
  const pill = (s) => h("span", { class: "pill st-" + s }, STATUS[s] || s);
  const plural = (n, a, b, c) => { const m = n % 10, k = n % 100; return m === 1 && k !== 11 ? a : m >= 2 && m <= 4 && (k < 12 || k > 14) ? b : c; };
  function contactLink(r) {
    if (r.contact_channel === "telegram") return "https://t.me/" + r.contact_value.replace(/^@/, "");
    return "https://wa.me/" + r.contact_value.replace(/\D/g, "");
  }

  // ---------- login ----------
  function showLogin() { $("appView").hidden = true; $("loginView").hidden = false; $("lLogin").focus(); }
  function showApp() { $("loginView").hidden = true; $("appView").hidden = false; go(current); }
  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("loginError"); err.hidden = true;
    try {
      await api("/login", { method: "POST", body: JSON.stringify({ login: $("lLogin").value, password: $("lPass").value }) });
      $("lPass").value = "";
      showApp();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
  $("logoutBtn").addEventListener("click", async () => { await api("/logout", { method: "POST" }).catch(() => {}); showLogin(); });

  // ---------- navigation ----------
  let current = "overview";
  function go(view, opts) {
    current = view;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.view === view));
    document.querySelectorAll(".view").forEach((v) => { v.hidden = v.id !== "view-" + view; });
    if (view === "overview") loadOverview();
    if (view === "requests") { if (opts && opts.status !== undefined) $("filters").status.value = opts.status; loadRequests(); }
    if (view === "groups") loadGroups();
  }
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => go(t.dataset.view)));
  document.querySelectorAll("[data-goto]").forEach((b) => b.addEventListener("click", () => go(b.dataset.goto, { status: b.dataset.status })));

  // ---------- overview ----------
  async function loadOverview() {
    const [s, fresh, groups] = await Promise.all([api("/stats"), api("/requests?status=new"), api("/groups")]);
    $("newBadge").hidden = !s.by_status.new; $("newBadge").textContent = s.by_status.new;
    const card = (label, value, sub, accent) => h("div", { class: "card" + (accent ? " card--accent" : "") }, h("div", { class: "card__label" }, label), h("div", { class: "card__value" }, value), sub ? h("div", { class: "card__sub" }, sub) : null);
    $("statCards").replaceChildren(
      card("Новые", s.by_status.new, "ждут ответа", s.by_status.new > 0),
      card("Сегодня", s.new_today, "заявок поступило"),
      card("Едут за 14 дней", s.next14.pax, plural(s.next14.pax, "человек", "человека", "человек") + " · " + s.next14.n + " " + plural(s.next14.n, "заявка", "заявки", "заявок")),
      card("Подтверждено", s.by_status.confirmed, "ждут поездки")
    );
    $("latestNew").replaceChildren(fresh.length ? h("div", { class: "mini-list" }, fresh.slice(0, 6).map(miniRow)) : h("p", { class: "empty" }, "Новых заявок нет 🎉"));
    $("nextGroups").replaceChildren(groups.length ? h("div", { class: "mini-list" }, groups.slice(0, 5).map((g) =>
      h("div", { class: "mini-row", onclick: () => go("groups") },
        h("span", { class: "group__flag" }, DEST[g.destination][0]),
        h("div", { class: "mini-row__main" }, h("b", {}, fmtDay(g.travel_date)), " · ", DEST[g.destination][1]),
        h("b", {}, g.pax + " чел."), h("span", { class: "muted" }, g.requests + " " + plural(g.requests, "заявка", "заявки", "заявок"))))) : h("p", { class: "empty" }, "Пока никто не записался."));
  }
  function miniRow(r) {
    return h("div", { class: "mini-row", onclick: () => openRequest(r.id) },
      h("span", { class: "code" }, r.code),
      h("div", { class: "mini-row__main" }, DEST[r.destination][0], " ", fmtDay(r.travel_date), " · ", r.pax_count, " чел. · ", r.contact_name),
      h("span", { class: "muted" }, fmtDT(r.created_at)));
  }

  // ---------- requests ----------
  let reqTimer;
  async function loadRequests() {
    const f = new FormData($("filters"));
    const qs = new URLSearchParams([...f.entries()].filter(([, v]) => v)).toString();
    const rows = await api("/requests" + (qs ? "?" + qs : ""));
    const body = $("reqTable").tBodies[0];
    body.replaceChildren(...rows.map((r) => h("tr", { onclick: () => openRequest(r.id) },
      h("td", {}, fmtDT(r.created_at)),
      h("td", {}, h("span", { class: "code" }, r.code)),
      h("td", {}, DEST[r.destination][0], " ", fmtDay(r.travel_date), r.departure_time ? " " + r.departure_time : "",
        h("div", { class: "muted" }, r.request_mode === "scheduled" ? "рейс из расписания" : "желаемая дата")),
      h("td", {}, r.pax_count),
      h("td", {}, r.contact_name, h("div", { class: "muted" }, r.contact_value)),
      h("td", {}, pill(r.status)))));
    $("reqEmpty").hidden = rows.length > 0;
  }
  $("filters").addEventListener("input", () => { clearTimeout(reqTimer); reqTimer = setTimeout(loadRequests, 300); });
  $("filters").addEventListener("submit", (e) => e.preventDefault());

  // ---------- groups ----------
  $("groupsFrom").value = vnToday();
  $("groupsFrom").addEventListener("change", loadGroups);
  async function loadGroups() {
    const groups = await api("/groups?from=" + encodeURIComponent($("groupsFrom").value || vnToday()));
    $("groupList").replaceChildren(...(groups.length ? groups.map(groupCard) : [h("p", { class: "empty" }, "На эти даты заявок нет.")]));
  }
  function groupCard(g) {
    const body = h("div", { class: "group__body", hidden: true },
      h("div", { class: "table-wrap" }, h("table", { class: "table" },
        h("thead", {}, h("tr", {}, h("th", {}, "Пассажир"), h("th", {}, "Гражданство"), h("th", {}, "Виза"), h("th", {}, "Заявка"), h("th", {}, "Посадка"), h("th", {}, "Статус"))),
        h("tbody", {}, g.items.flatMap((r) => r.passengers.map((p, i) => h("tr", { onclick: () => openRequest(r.id) },
          h("td", {}, p.name), h("td", {}, p.nationality), h("td", {}, VISA[p.visa] || p.visa),
          h("td", {}, i === 0 ? h("span", {}, h("span", { class: "code" }, r.code), h("div", { class: "muted" }, r.contact_name + " · " + r.contact_value)) : h("span", { class: "muted" }, "↳ " + r.code)),
          h("td", {}, i === 0 ? r.pickup : ""), h("td", {}, i === 0 ? pill(r.status) : "")))))))
    );
    const head = h("div", { class: "group__head", role: "button", tabindex: "0", "aria-expanded": "false" },
      h("span", { class: "group__flag" }, DEST[g.destination][0]),
      h("div", { class: "group__title" }, h("b", {}, fmtDay(g.travel_date)), h("div", { class: "muted" }, DEST[g.destination][1] + " · " + g.requests + " " + plural(g.requests, "заявка", "заявки", "заявок"))),
      h("div", { class: "group__chips" }, Object.entries(g.by_status).map(([s, n]) => h("span", { class: "pill st-" + s }, STATUS[s] + ": " + n))),
      h("div", { class: "group__pax" }, g.pax, h("small", {}, " чел."))
    );
    const toggle = () => { body.hidden = !body.hidden; head.setAttribute("aria-expanded", String(!body.hidden)); };
    head.addEventListener("click", toggle);
    head.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
    return h("div", { class: "group" }, head, body);
  }

  // ---------- request drawer ----------
  const drawer = $("drawer");
  drawer.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeDrawer));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !drawer.hidden) closeDrawer(); });
  function closeDrawer() { drawer.hidden = true; go(current); }

  async function openRequest(id) {
    const r = await api("/requests/" + id);
    $("dTitle").replaceChildren("Заявка ", h("span", { class: "code" }, r.code));
    const status = h("select", { class: "status-select" }, Object.entries(STATUS).map(([k, v]) => h("option", { value: k, selected: k === r.status }, v)));
    const note = h("textarea", { placeholder: "Заметка для команды: договорились, оплата, место в автобусе…" }); note.value = r.admin_note || "";
    const saved = h("span", { class: "saved", hidden: true }, "Сохранено ✓");
    const save = h("button", { class: "btn btn--primary btn--sm", onclick: async () => {
      save.disabled = true;
      try { await api("/requests/" + r.id, { method: "PATCH", body: JSON.stringify({ status: status.value, admin_note: note.value }) }); saved.hidden = false; setTimeout(() => { saved.hidden = true; }, 2500); }
      catch (e) { alertBox.textContent = e.message; alertBox.hidden = false; }
      finally { save.disabled = false; }
    } }, "Сохранить");
    const alertBox = h("p", { class: "error", hidden: true });
    const transport = r.est_price_per_person ? r.est_price_per_person * r.pax_count : null;

    $("dBody").replaceChildren(
      h("div", { class: "sec" }, h("h3", {}, "Статус"), h("div", { class: "row" }, status, save, saved), alertBox),
      h("div", { class: "sec" }, h("h3", {}, "Поездка"), h("dl", { class: "dl" },
        h("dt", {}, "Направление"), h("dd", {}, DEST[r.destination].join(" ")),
        h("dt", {}, "Дата"), h("dd", {}, fmtDay(r.travel_date) + (r.departure_time ? ", выезд " + r.departure_time : "")),
        h("dt", {}, "Тип"), h("dd", {}, r.request_mode === "scheduled" ? "Рейс из расписания QUY (id " + r.quy_trip_id + ")" : "Желаемая дата, нужно собрать группу"),
        h("dt", {}, "Посадка"), h("dd", {}, r.pickup),
        h("dt", {}, "Оценка"), h("dd", {}, "проезд " + vnd(transport) + " · визы " + vnd(r.est_visa_total)))),
      h("div", { class: "sec" }, h("h3", {}, "Пассажиры (" + r.pax_count + ")"), h("div", { class: "table-wrap" }, h("table", { class: "table" },
        h("tbody", {}, r.passengers.map((p, i) => h("tr", {}, h("td", {}, (i + 1) + ". " + p.name), h("td", {}, p.nationality), h("td", {}, VISA[p.visa] || p.visa))))))),
      h("div", { class: "sec" }, h("h3", {}, "Контакт"), h("dl", { class: "dl" },
        h("dt", {}, "Имя"), h("dd", {}, r.contact_name),
        h("dt", {}, r.contact_channel === "telegram" ? "Telegram" : "WhatsApp"), h("dd", {}, r.contact_value),
        r.note ? [h("dt", {}, "Комментарий"), h("dd", {}, r.note)] : null,
        r.club_code ? [h("dt", {}, "QUY Club"), h("dd", {}, h("span", { class: "code" }, r.club_code))] : null,
        r.ref_code ? [h("dt", {}, "Реф. код"), h("dd", {}, h("span", { class: "code" }, r.ref_code))] : null,
        h("dt", {}, "Язык сайта"), h("dd", {}, { en: "английский", ru: "русский", vi: "вьетнамский" }[r.lang] || r.lang)),
        h("div", { class: "row", style: "margin-top:10px" },
          h("a", { class: "btn btn--sm " + (r.contact_channel === "telegram" ? "btn--tg" : "btn--wa"), href: contactLink(r), target: "_blank", rel: "noopener" }, "Написать клиенту"))),
      h("div", { class: "sec" }, h("h3", {}, "Заметка"), note),
      h("div", { class: "sec" }, h("h3", {}, "История"), h("div", { class: "log" }, r.log.map((l) =>
        h("div", {}, fmtDT(l.created_at) + " · " + (l.actor === "site" ? "сайт" : l.actor) + " · " +
          (l.action === "created" ? "заявка создана" : "изменено: " + [l.details.status ? "статус → " + (STATUS[l.details.status] || l.details.status) : "", l.details.admin_note ? "заметка" : ""].filter(Boolean).join(", "))))))
    );
    drawer.hidden = false;
    status.focus();
  }

  // ---------- start ----------
  setInterval(() => { if (!$("appView").hidden && drawer.hidden && current !== "groups") go(current); }, 60000);
  api("/me").then(showApp).catch(() => {});
})();
