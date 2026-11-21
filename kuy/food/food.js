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

  function render() {
    menuEl.innerHTML = "";
    MENU.forEach((d) => {
      const [name, desc] = d[K.lang] || d.en;
      const card = document.createElement("article");
      card.className = "dish";
      card.innerHTML =
        '<img class="dish__img" width="400" height="300" loading="lazy" alt="">' +
        '<div class="dish__body"><div class="dish__head"><h3 class="dish__name"></h3><span class="dish__price"></span></div>' +
        '<p class="dish__desc"></p><a class="btn btn--primary dish__btn"></a></div>';
      const img = card.querySelector("img");
      img.src = d.img; img.alt = name;
      card.querySelector(".dish__name").textContent = name;
      const price = card.querySelector(".dish__price");
      if (d.price) price.textContent = d.price; else price.remove();
      card.querySelector(".dish__desc").textContent = desc;
      const btn = card.querySelector(".dish__btn");
      btn.textContent = K.t("food.order");
      K.setContactLink(btn, "whatsapp", K.t("msg.foodItem", { item: name }));
      menuEl.appendChild(card);
    });
  }

  document.addEventListener("kuy:lang", render);
})();
