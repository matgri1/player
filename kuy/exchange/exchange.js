(function () {
  // ============================================================
  //  EXCHANGE RATES — edit these numbers.
  //  rate  = how many Vietnamese dong you give for 1 unit.
  //  quick = the amount buttons under the input.
  //  SAMPLE: true shows a "sample rates" note; set to false once rates are real.
  //  UPDATED: text shown as "Updated ..." (leave "" to hide).
  // ============================================================
  const SAMPLE = true;
  const UPDATED = "";
  const CURRENCIES = [
    { code: "USD", symbol: "$", rate: 26000, quick: [100, 500, 1000] },
    { code: "EUR", symbol: "€", rate: 30000, quick: [100, 500, 1000] },
    { code: "RUB", symbol: "₽", rate: 320,   quick: [10000, 50000, 100000] }
  ];

  const K = window.KUY;
  const $ = (id) => document.getElementById(id);
  const form = $("calc"), amountEl = $("amount"), curEl = $("currency");
  const resultEl = $("result"), rateLineEl = $("rateLine"), quickEl = $("quick");
  const ctaEl = $("exchangeCta"), ratesBody = $("ratesBody");

  const fmt = (n) => Math.round(n).toLocaleString(K.locale());
  const current = () => CURRENCIES.find((c) => c.code === curEl.value) || CURRENCIES[0];
  const parseAmount = () => {
    const n = parseFloat(String(amountEl.value).replace(/[\s,]/g, "").replace(/[^\d.]/g, ""));
    return isFinite(n) && n > 0 ? n : 0;
  };

  function calc() {
    const c = current();
    const amount = parseAmount();
    resultEl.value = fmt(amount * c.rate) + " ₫";
    resultEl.textContent = resultEl.value;
    rateLineEl.textContent = K.t("ex.rateLine", { cur: c.code, rate: fmt(c.rate) });
    K.setContactLink(ctaEl, "whatsapp",
      K.t("msg.exchangeAmount", { amount: fmt(amount), cur: c.code, rate: fmt(c.rate) }));
  }

  function renderQuick() {
    const c = current();
    quickEl.innerHTML = "";
    c.quick.forEach((q) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = (c.code === "RUB" ? fmt(q) + " " + c.symbol : c.symbol + fmt(q));
      b.addEventListener("click", () => { amountEl.value = String(q); calc(); });
      quickEl.appendChild(b);
    });
  }

  function render() {
    const selected = curEl.value || CURRENCIES[0].code;
    curEl.innerHTML = "";
    CURRENCIES.forEach((c) => {
      const o = document.createElement("option");
      o.value = c.code;
      o.textContent = c.code + " — " + K.t("cur." + c.code);
      curEl.appendChild(o);
    });
    curEl.value = selected;

    ratesBody.innerHTML = "";
    CURRENCIES.forEach((c) => {
      const tr = document.createElement("tr");
      tr.innerHTML = '<th scope="row"><strong></strong><small></small></th><td></td>';
      tr.querySelector("strong").textContent = c.code;
      tr.querySelector("small").textContent = K.t("cur." + c.code);
      tr.querySelector("td").textContent = fmt(c.rate) + " ₫";
      ratesBody.appendChild(tr);
    });

    $("sample").hidden = !SAMPLE;
    $("updated").textContent = UPDATED ? K.t("ex.updated", { date: UPDATED }) : "";
    renderQuick();
    calc();
  }

  amountEl.addEventListener("input", calc);
  curEl.addEventListener("change", () => { renderQuick(); calc(); });
  form.addEventListener("submit", (e) => e.preventDefault());
  document.addEventListener("kuy:lang", render);
})();
