(function () {
  const K = window.KUY;
  const $ = (id) => document.getElementById(id);

  // ---------- My code → my link ----------
  const myForm = $("myCodeForm"), myInput = $("myCode"), myError = $("myCodeError");
  const shareBox = $("shareBox"), linkEl = $("shareLink"), statusEl = $("shareStatus");
  let myLink = "";

  myForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const code = K.cleanCode(myInput.value);
    if (!code) {
      myError.textContent = K.t("refer.badCode");
      myError.hidden = false;
      shareBox.hidden = true;
      myInput.focus();
      return;
    }
    myError.hidden = true;
    myInput.value = code;
    myLink = K.shareLink(code);
    linkEl.textContent = myLink;
    statusEl.textContent = "";
    shareBox.hidden = false;
  });

  function selectLink() {
    const r = document.createRange();
    r.selectNodeContents(linkEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }

  $("copyBtn").addEventListener("click", () => {
    if (!myLink) return;
    const done = () => { statusEl.textContent = K.t("refer.copied"); };
    const fallback = () => { selectLink(); statusEl.textContent = K.t("refer.copyManual"); };
    try {
      navigator.clipboard.writeText(myLink).then(done, fallback);
    } catch (e) { fallback(); }
  });

  $("shareBtn").addEventListener("click", () => {
    if (!myLink) return;
    const text = K.t("refer.shareMessage");
    if (navigator.share) {
      navigator.share({ title: "Kuy", text, url: myLink }).catch(() => { /* closed or blocked */ });
    } else {
      $("copyBtn").click();
    }
  });

  // ---------- Friend's code ----------
  const fForm = $("friendCodeForm"), fInput = $("friendCode"), fError = $("friendCodeError");
  const applied = $("appliedBox"), appliedText = $("appliedText");

  function renderApplied() {
    const code = K.getRef();
    applied.hidden = !code;
    if (code) appliedText.textContent = K.t("refer.applied", { code });
  }

  fForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const code = K.cleanCode(fInput.value);
    if (!code) {
      fError.textContent = K.t("refer.badCode");
      fError.hidden = false;
      fInput.focus();
      return;
    }
    fError.hidden = true;
    K.setRef(code);
    fInput.value = "";
    renderApplied();
  });

  $("removeCode").addEventListener("click", () => { K.setRef(""); renderApplied(); });

  document.addEventListener("kuy:lang", () => {
    renderApplied();
    if (!myError.hidden) myError.textContent = K.t("refer.badCode");
    if (!fError.hidden) fError.textContent = K.t("refer.badCode");
    statusEl.textContent = "";
  });
})();
