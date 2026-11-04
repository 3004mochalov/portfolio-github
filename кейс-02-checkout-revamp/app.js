/* Checkout revamp: корзина -> доставка/оплата -> успех. ЗАКАЗЧИКУ СЮДА НЕ НАДО. */
"use strict";

const RU = new Intl.NumberFormat("ru-RU");
function fmt(n) { return RU.format(n) + " ₽"; }
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

let CFG = null;
const state = { step: 1, promo: 0, delivery: "courier", pay: "card" };
const CART_KEY = "powerfood.cart.v1";
let submitting = false;
let requestKey = crypto.randomUUID();
function saveCart() {
  try { localStorage.setItem(CART_KEY, JSON.stringify(CFG.cart.items.map(({id, qty}) => ({id, qty})))); }
  catch { document.getElementById("cartSub").textContent = "Браузер запретил сохранение корзины. Не закрывай страницу до оформления."; }
}

function goodsSum() {
  return CFG.cart.items.reduce((s, it) => s + it.price * it.qty, 0);
}
function discount() { return Math.round(goodsSum() * state.promo / 100); }
function shipCost(subtotal) {
  if (subtotal <= 0) return 0;
  if (subtotal >= CFG.shop.freeFrom) return 0;
  const m = CFG.delivery.methods.find((x) => x.id === state.delivery);
  return m ? m.price : 0;
}
function total() {
  const sub = goodsSum() - discount();
  return sub + shipCost(sub);
}

function renderSteps() {
  document.getElementById("steps").innerHTML = CFG.steps.map((t, i) => {
    const n = i + 1;
    const cls = n < state.step ? "step done" : (n === state.step ? "step now" : "step");
    return '<div class="' + cls + '">' + n + ". " + esc(t) + "</div>";
  }).join("");
}

function renderSummary() {
  const sub = goodsSum(), d = discount(), sh = shipCost(sub - d);
  const count = CFG.cart.items.reduce((s, it) => s + it.qty, 0);
  const left = CFG.shop.freeFrom - (sub - d);
  const freeHint = (sh > 0 && left > 0)
    ? '<div class="row mut"><span>' + esc(CFG.delivery.freeNote.replace("{left}", RU.format(left))) + "</span></div>" : "";
  const html =
    "<h3>" + esc(CFG.summary.title) + " · " + count + " " + esc(CFG.summary.countSuffix) + "</h3>" +
    '<div class="row"><span>' + esc(CFG.summary.goods) + "</span><span>" + fmt(sub) + "</span></div>" +
    (d > 0 ? '<div class="row disc"><span>' + esc(CFG.summary.discount) + "</span><span>−" + fmt(d) + "</span></div>" : "") +
    '<div class="row"><span>' + esc(CFG.summary.delivery) + "</span><span>" +
    (sub === 0 ? "—" : (sh === 0 ? esc(CFG.summary.free) : fmt(sh))) + "</span></div>" + freeHint +
    '<div class="total"><span>' + esc(CFG.summary.total) + "</span><b>" + fmt(sub - d + sh) + "</b></div>";
  document.getElementById("summary").innerHTML = html;
  document.getElementById("summary2").innerHTML = html;
}

function renderCart() {
  const box = document.getElementById("cartBox");
  if (CFG.cart.items.length === 0) {
    box.innerHTML = '<div class="empty">' + esc(CFG.cart.empty) + "</div>";
  } else {
    box.innerHTML = CFG.cart.items.map((it) =>
      '<div class="cart-item"><div><div class="nm">' + esc(it.name) + "</div>" +
      '<div class="sp">' + esc(it.spec) + "</div>" +
      '<div class="stepper"><button data-act="dec" data-id="' + it.id + '" aria-label="Меньше">−</button>' +
      '<span class="q">' + it.qty + "</span>" +
      '<button data-act="inc" data-id="' + it.id + '" aria-label="Больше">+</button>' +
      '<button class="rm" data-act="rm" data-id="' + it.id + '">Убрать</button></div></div>' +
      '<div class="pr">' + fmt(it.price * it.qty) +
      (it.old ? ' <span class="old">' + fmt(it.old * it.qty) + "</span>" : "") + "</div></div>"
    ).join("");
  }
  box.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    const it = CFG.cart.items.find((x) => x.id === b.dataset.id);
    if (!it) return;
    if (b.dataset.act === "inc") it.qty = Math.min(99, it.qty + 1);
    if (b.dataset.act === "dec") it.qty = Math.max(1, it.qty - 1);
    if (b.dataset.act === "rm") CFG.cart.items.splice(CFG.cart.items.indexOf(it), 1);
    saveCart(); renderCart(); renderSummary();
  }));
}

function renderDelivery() {
  const pickup = state.delivery === "pickup";
  ["fAddr", "lbAddr", "errAddr"].forEach((id) => document.getElementById(id).hidden = pickup);
  document.getElementById("pickupField").hidden = !pickup;
  document.getElementById("methods").innerHTML = CFG.delivery.methods.map((m) =>
    '<label class="opt' + (state.delivery === m.id ? " sel" : "") + '">' +
    '<input type="radio" name="dm" value="' + m.id + '"' + (state.delivery === m.id ? " checked" : "") + ">" +
    "<span><span class='on'>" + esc(m.name) + "</span><br><span class='od'>" + esc(m.desc) +
    "</span></span><span class='op'>" + fmt(m.price) + "</span></label>"
  ).join("");
  document.getElementById("pays").innerHTML = CFG.delivery.pays.map((p) =>
    '<label class="opt' + (state.pay === p.id ? " sel" : "") + '">' +
    '<input type="radio" name="pm" value="' + p.id + '"' + (state.pay === p.id ? " checked" : "") + ">" +
    "<span><span class='on'>" + esc(p.name) + "</span><br><span class='od'>" + esc(p.desc) + "</span></span></label>"
  ).join("");
  document.querySelectorAll('input[name="dm"]').forEach((r) =>
    r.addEventListener("change", () => { state.delivery = r.value; renderDelivery(); renderSummary(); }));
  document.querySelectorAll('input[name="pm"]').forEach((r) =>
    r.addEventListener("change", () => { state.pay = r.value; renderDelivery(); }));
}

function fieldBad(input, errEl, bad) {
  input.classList.toggle("bad", bad);
  errEl.classList.toggle("show", bad);
  return !bad;
}

function render(cfg) {
  CFG = cfg;
  state.pay = cfg.delivery.pays[0]?.id || 'cod';
  const originalItems = structuredClone(cfg.cart.items);
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY));
    if (Array.isArray(saved)) cfg.cart.items = saved.flatMap((entry) => {
      const item = cfg.cart.items.find((p) => p.id === entry.id);
      return item && Number.isInteger(entry.qty) && entry.qty > 0 ? [{...item, qty: Math.min(99, entry.qty)}] : [];
    });
  } catch { /* Повреждённое хранилище не мешает открыть исходную корзину. */ }
  /* Связка с маркетом: ?cart=whey:1,creatine:2 заменяет состав корзины.
     Неизвестные id молча пропускаются — чужой мусор оформление не ломает. */
  const qp = new URLSearchParams(location.search).get("cart");
  if (qp) {
    const incoming = [];
    qp.split(",").forEach((pair) => {
      const parts = pair.split(":");
      const it = originalItems.find((x) => x.id === parts[0]);
      const q = parseInt(parts[1], 10);
      if (it && q > 0) incoming.push(Object.assign({}, it, { qty: Math.min(q, 99) }));
    });
    cfg.cart.items = [...new Map(incoming.map(item => [item.id, item])).values()];
    const cleanUrl = new URL(location.href); cleanUrl.searchParams.delete("cart");
    history.replaceState(null, "", cleanUrl);
  }
  /* Кнопка «назад в магазин» — только если в конфиге задан backUrl */
  if (cfg.backUrl) {
    const b = document.createElement("button");
    b.className = "btn btn-ghost";
    b.style.width = "auto";
    b.textContent = cfg.backLabel || "В магазин";
    b.addEventListener("click", () => { location.href = cfg.backUrl; });
    const navBox = document.querySelector("#viewCart .nav-btns");
    if (navBox) navBox.prepend(b);
  }
  document.title = cfg.meta.title;
  document.querySelector('meta[name="description"]').setAttribute("content", cfg.meta.description);
  document.getElementById("logo").textContent = cfg.shop.name;
  document.getElementById("logo2").textContent = cfg.shop.name + " · спасибо, что ты с нами";
  const sup = document.getElementById("support");
  sup.innerHTML = "Помощь: <a href='tel:" + cfg.shop.supportTel + "'>" + esc(cfg.shop.supportPhone) + "</a>";

  // корзина
  document.getElementById("cartTitle").textContent = cfg.cart.title;
  document.getElementById("cartSub").textContent = cfg.cart.sub;
  document.getElementById("demoNotice").hidden = Boolean(cfg.apiEndpoint);
  document.getElementById("pickupPoint").innerHTML = '<option value="">Выбери пункт</option>' + (cfg.delivery.pickupPoints || []).map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>').join('');
  saveCart();
  document.getElementById("promoIn").placeholder = cfg.cart.promoPh;
  document.getElementById("promoBtn").textContent = "OK";
  document.getElementById("toDelivery").textContent = "К доставке →";
  document.getElementById("promoBtn").addEventListener("click", () => {
    const v = document.getElementById("promoIn").value.trim().toUpperCase();
    const msg = document.getElementById("promoMsg");
    if (v === cfg.cart.promoCode.toUpperCase()) {
      state.promo = cfg.cart.promoPct;
      msg.className = "promo-msg ok";
      msg.textContent = cfg.cart.promoOk;
    } else {
      state.promo = 0;
      msg.className = "promo-msg bad";
      msg.textContent = cfg.cart.promoBad;
    }
    renderSummary();
  });
  document.getElementById("toDelivery").addEventListener("click", () => {
    if (CFG.cart.items.length === 0) return;
    state.step = 2; sync();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // доставка
  const d = cfg.delivery;
  document.getElementById("dlvTitle").textContent = d.title;
  document.getElementById("dlvSub").textContent = d.sub;
  document.getElementById("ctTitle").textContent = d.contactTitle;
  const F = {
    name: ["fName", "lbName", "errName", d.nameLabel, d.namePh],
    phone: ["fPhone", "lbPhone", "errPhone", d.phoneLabel, d.phonePh],
    mail: ["fMail", "lbMail", "errMail", d.mailLabel, d.mailPh],
    city: ["fCity", "lbCity", "errCity", d.cityLabel, d.cityPh],
    addr: ["fAddr", "lbAddr", "errAddr", d.addrLabel, d.addrPh],
  };
  Object.keys(F).forEach((k) => {
    document.getElementById(F[k][1]).innerHTML = esc(F[k][3]) +
      (k === "msg" ? "" : ' <span class="req">*</span>');
    document.getElementById(F[k][0]).placeholder = F[k][4];
  });
  document.getElementById("lbMsg").innerHTML = esc(d.commentLabel) +
    ' <span style="font-weight:400;color:var(--muted)">' + esc(d.commentOpt) + "</span>";
  document.getElementById("fMsg").placeholder = d.commentPh;
  document.getElementById("addrTitle").textContent = d.addrTitle;
  document.getElementById("mTitle").textContent = "Способ доставки";
  document.getElementById("pTitle").textContent = d.payTitle;
  document.getElementById("backBtn").textContent = d.back;
  document.getElementById("sendBtn").textContent = d.submit;
  document.getElementById("formErr").textContent = d.errFix;
  document.getElementById("backBtn").addEventListener("click", () => {
    state.step = 1; sync();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  document.getElementById("sendBtn").addEventListener("click", async () => {
    if (submitting || !CFG.cart.items.length) return;
    const v = (id) => document.getElementById(id).value.trim();
    let ok = true;
    ok = fieldBad(document.getElementById("fName"),
      document.getElementById("errName"), v("fName").length < 2) && ok;
    const digits = v("fPhone").replace(/\D/g, "");
    ok = fieldBad(document.getElementById("fPhone"),
      document.getElementById("errPhone"), !(digits.length === 11 && /^[78]/.test(digits))) && ok;
    ok = fieldBad(document.getElementById("fMail"),
      document.getElementById("errMail"), !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v("fMail"))) && ok;
    ok = fieldBad(document.getElementById("fCity"),
      document.getElementById("errCity"), v("fCity").length < 2) && ok;
    ok = fieldBad(document.getElementById("fAddr"),
      document.getElementById("errAddr"), state.delivery !== "pickup" && v("fAddr").length < 5) && ok;
    ok = fieldBad(document.getElementById("pickupPoint"), document.getElementById("errPickup"), state.delivery === "pickup" && !v("pickupPoint")) && ok;
    ["errName", "errPhone", "errMail", "errCity", "errAddr"].forEach((id, i) => {
      document.getElementById(id).textContent = [
        "Укажи имя — курьер должен знать, к кому едет.",
        "Формат телефона: +7 и 10 цифр.",
        "Похоже, в адресе почты опечатка.",
        "Укажи город.",
        "Нужны улица, дом и квартира."
      ][i];
    });
    document.getElementById("formErr").classList.toggle("show", !ok);
    document.getElementById("formErr").textContent = d.errFix;
    if (!ok) { document.querySelector('.bad')?.focus(); return; }
    const order = {
      items: CFG.cart.items, total: total(), promoCode: state.promo ? CFG.cart.promoCode : '',
      name: v("fName"), phone: v("fPhone"), mail: v("fMail"),
      city: v("fCity"), addr: v("fAddr"), msg: v("fMsg"),
      delivery: state.delivery, pay: state.pay,
      pickupPoint: state.delivery === "pickup" ? v("pickupPoint") : null
    };
    const done = (num) => {
      document.getElementById("orderNum").textContent = num;
      CFG.cart.items = []; saveCart();
      state.step = 3; sync();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    submitting = true;
    const button = document.getElementById("sendBtn"); button.disabled = true; button.textContent = "Отправляем…";
    try {
    if (CFG.apiEndpoint) {
      const response = await fetch(CFG.apiEndpoint, { method: "POST", signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey },
        body: JSON.stringify(order) })
      if (!response.ok) throw new Error("HTTP " + response.status);
      const result = await response.json();
      if (!result.num && !result.id) throw new Error("Нет подтверждения сервера");
      done(result.num || result.id);
      requestKey = crypto.randomUUID();
    } else {
      document.getElementById("okTitle").textContent = "Демонстрация завершена";
      document.getElementById("okText").innerHTML = 'Тестовый номер <span id="orderNum"></span>. Заказ в магазин не отправлен, оплата не списывалась.';
      done("DEMO-" + Date.now());
    }
    } catch {
      const error = document.getElementById("formErr");
      error.textContent = "Не удалось получить подтверждение. Корзина и поля сохранены на странице. Уточни статус у поддержки перед повторной отправкой.";
      error.classList.add("show");
    } finally { submitting = false; button.disabled = false; button.textContent = d.submit; }
  });

  // успех
  document.getElementById("okTitle").textContent = cfg.success.title;
  document.getElementById("okText").innerHTML = esc(cfg.success.text).replace("{num}",
    '<span class="num" id="orderNum"></span>');
  document.getElementById("againBtn").textContent = cfg.success.again;
  document.getElementById("againBtn").addEventListener("click", () => { location.href = cfg.backUrl || "./"; });

  sync();
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); }
  }), { threshold: 0.1 });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
}

function sync() {
  renderSteps();
  document.getElementById("viewCart").style.display = state.step === 1 ? "" : "none";
  document.getElementById("viewDlv").style.display = state.step === 2 ? "" : "none";
  document.getElementById("viewOk").style.display = state.step === 3 ? "" : "none";
  if (state.step === 1) { renderCart(); }
  if (state.step === 2) { renderDelivery(); }
  renderSummary();
}

PortfolioAPI.content('checkout', 'config.json')
  .then(render)
  .catch(() => { document.getElementById("loadError").style.display = "block"; });
