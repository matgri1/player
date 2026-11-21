(function () {
  // ============================================================
  //  MENU — edit dishes here.
  //  img:   picture file in food/img/ (swap the drawings for real photos,
  //         e.g. "img/pelmeni.jpg")
  //  price: text like "120,000 ₫" — leave "" to hide the price.
  // ============================================================
  const MENU = [
    { id: "pelmeni", img: "img/pelmeni.svg", price: "",
      en: ["Pelmeni (Russian dumplings)", "Juicy meat dumplings served with sour cream and dill."],
      ru: ["Пельмени", "Сочные пельмени с мясом, со сметаной и укропом."],
      vi: ["Pelmeni (sủi cảo kiểu Nga)", "Sủi cảo nhân thịt mọng nước, ăn kèm kem chua và thì là."] },
    { id: "syrniki", img: "img/syrniki.svg", price: "",
      en: ["Syrniki (cheese pancakes)", "Golden farmer’s cheese pancakes with sour cream and berries."],
      ru: ["Сырники", "Золотистые сырники из творога со сметаной и ягодами."],
      vi: ["Syrniki (bánh phô mai)", "Bánh phô mai tươi chiên vàng, ăn kèm kem chua và quả mọng."] },
    { id: "oreshki", img: "img/oreshki.svg", price: "",
      en: ["Chocolate oreshki", "Walnut-shaped chocolate cookies filled with caramel condensed milk."],
      ru: ["Шоколадные орешки", "Шоколадное печенье-орешки с начинкой из варёной сгущёнки."],
      vi: ["Bánh óc chó sô-cô-la", "Bánh quy sô-cô-la hình quả óc chó, nhân sữa đặc caramel."] },
    { id: "borscht", img: "img/borscht.svg", price: "",
      en: ["Borscht", "Classic beet soup with beef and vegetables, topped with sour cream."],
      ru: ["Борщ", "Классический борщ с говядиной и овощами, со сметаной."],
      vi: ["Súp borscht", "Súp củ dền truyền thống với thịt bò và rau, kèm kem chua."] },
    { id: "blini", img: "img/blini.svg", price: "",
      en: ["Blini (Russian crepes)", "Thin crepes with jam, honey or condensed milk."],
      ru: ["Блины", "Тонкие блины с вареньем, мёдом или сгущёнкой."],
      vi: ["Blini (bánh crepe Nga)", "Bánh crepe mỏng ăn kèm mứt, mật ong hoặc sữa đặc."] },
    { id: "vareniki", img: "img/vareniki.svg", price: "",
      en: ["Cherry vareniki", "Soft dumplings with a sweet and tangy cherry filling."],
      ru: ["Вареники с вишней", "Нежные вареники с кисло-сладкой вишнёвой начинкой."],
      vi: ["Vareniki nhân anh đào", "Bánh nhân anh đào mềm, vị chua ngọt."] }
  ];

  const K = window.KUY;
  const menuEl = document.getElementById("menu");
  const bar = document.getElementById("orderBar");
  const STORE = "kuy-food-order";

  // cart = { dishId: quantity }
  let cart = {};
  try { cart = JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { cart = {}; }
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(cart)); } catch (e) { /* ignore */ } };
  const nameOf = (d) => (d[K.lang] || d.en)[0];

  function setQty(id, q) {
    if (q > 0) cart[id] = Math.min(q, 99); else delete cart[id];
    save();
    renderControls();
    renderBar();
  }

  function renderControls() {
    MENU.forEach((d) => {
      const box = menuEl.querySelector('[data-dish="' + d.id + '"] .dish__ctrl');
      if (!box) return;
      const q = cart[d.id] || 0;
      box.innerHTML = "";
      if (!q) {
        const add = document.createElement("button");
        add.type = "button";
        add.className = "btn btn--primary dish__add";
        add.textContent = "+ " + K.t("food.add");
        add.addEventListener("click", () => setQty(d.id, 1));
        box.appendChild(add);
      } else {
        box.innerHTML =
          '<div class="stepper" role="group">' +
          '<button type="button" class="stepper__btn" data-d="-1">−</button>' +
          '<output class="stepper__val" aria-live="polite"></output>' +
          '<button type="button" class="stepper__btn" data-d="1">+</button></div>';
        const g = box.querySelector(".stepper");
        g.setAttribute("aria-label", nameOf(d));
        box.querySelector('[data-d="-1"]').setAttribute("aria-label", K.t("food.less"));
        box.querySelector('[data-d="1"]').setAttribute("aria-label", K.t("food.more"));
        box.querySelector(".stepper__val").textContent = q;
        box.querySelectorAll(".stepper__btn").forEach((b) =>
          b.addEventListener("click", () => setQty(d.id, q + Number(b.dataset.d))));
      }
      box.closest(".dish").classList.toggle("is-picked", q > 0);
    });
  }

  function renderBar() {
    const items = MENU.filter((d) => cart[d.id]);
    const total = items.reduce((n, d) => n + cart[d.id], 0);
    bar.hidden = total === 0;
    document.body.classList.toggle("has-order", total > 0);
    if (!total) return;
    bar.querySelector(".order-bar__count").textContent = total;
    bar.querySelector(".order-bar__label").textContent = K.t("food.inOrder");
    bar.querySelector(".order-bar__list").textContent =
      items.map((d) => cart[d.id] + " × " + nameOf(d)).join(", ");
    const lines = items.map((d) => "• " + cart[d.id] + " × " + nameOf(d)).join("\n");
    K.setContactLink(bar.querySelector(".order-bar__send"), "primary", K.t("msg.foodOrder", { items: lines }));
    bar.querySelector(".order-bar__send span").textContent = K.t("food.send");
    bar.querySelector(".order-bar__clear").textContent = K.t("food.clear");
  }

  function render() {
    menuEl.innerHTML = "";
    MENU.forEach((d) => {
      const [name, desc] = d[K.lang] || d.en;
      const card = document.createElement("article");
      card.className = "dish";
      card.dataset.dish = d.id;
      card.innerHTML =
        '<div class="dish__media"><img class="dish__img" width="400" height="300" loading="lazy" alt=""></div>' +
        '<div class="dish__body"><div class="dish__head"><h3 class="dish__name"></h3><span class="dish__price"></span></div>' +
        '<p class="dish__desc"></p><div class="dish__ctrl"></div></div>';
      const img = card.querySelector("img");
      img.src = d.img; img.alt = name;
      card.querySelector(".dish__name").textContent = name;
      const price = card.querySelector(".dish__price");
      if (d.price) price.textContent = d.price; else price.remove();
      card.querySelector(".dish__desc").textContent = desc;
      menuEl.appendChild(card);
    });
    renderControls();
    renderBar();
  }

  bar.querySelector(".order-bar__clear").addEventListener("click", () => { cart = {}; save(); renderControls(); renderBar(); });
  document.addEventListener("kuy:lang", render);
})();
