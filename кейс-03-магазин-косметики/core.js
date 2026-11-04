/* VERDE Store Core. Core owns storefront and extension lifecycle; mods are optional. */
(() => {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const money = new Intl.NumberFormat("ru-RU");
  const safe = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const state = { data: null, filter: "Всё", query: "", limit: 24, cart: readCart(), modules: [], hooks: { productActions: [], routes: [] } };

  function readCart() {
    try { const value = JSON.parse(localStorage.getItem("verde.cart.v1") || "{}"); return value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).filter(([,q]) => Number.isInteger(q) && q > 0 && q <= 99)) : {}; }
    catch { return {}; }
  }
  function saveCart() { try { localStorage.setItem("verde.cart.v1", JSON.stringify(state.cart)); } catch { toast("Хранилище недоступно: корзина сохранится только до закрытия страницы."); } }
  function product(id) { return state.data.products.find((p) => p.id === id); }
  function count() { return Object.values(state.cart).reduce((n, q) => n + q, 0); }
  function subtotal() { return Object.entries(state.cart).reduce((n, [id, q]) => n + (product(id)?.price || 0) * q, 0); }
  function toast(text) {
    const node = $("#toast"); node.textContent = text; node.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove("show"), 2200);
  }

  const api = {
    version: "1.0.0",
    get data() { return state.data; },
    money: (v) => money.format(v) + " ₽",
    escape: safe,
    toast,
    addToCart(id, qty = 1) {
      if (!product(id)) return;
      state.cart[id] = Math.min(99, (state.cart[id] || 0) + qty);
      saveCart(); renderCart(); toast("Добавлено в корзину");
    },
    registerProductAction(fn) { state.hooks.productActions.push(fn); },
    registerAdminRoute(fn) { state.hooks.routes.push(fn); },
    registerModule(info) { state.modules.push(info); },
    getModules() { return structuredClone(state.modules); },
    getCart() { return structuredClone(state.cart); },
    clearCart() { state.cart = {}; saveCart(); renderCart(); },
    closeCart,
    updateProduct(id, patch) {
      const p = product(id); if (!p) return false;
      Object.assign(p, patch); renderCatalog(); renderCart(); return true;
    },
    replaceProducts(products) {
      state.data.products = products;
      state.data.categories = ["Всё", ...new Set(products.map(p => p.category).filter(Boolean))];
      state.filter = "Всё"; state.limit = 24;
      renderFilters(); renderCatalog(); renderCart();
    },
    downloadData() {
      const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = "store.json"; a.click(); URL.revokeObjectURL(a.href);
    },
    downloadProducts() {
      const blob = new Blob([JSON.stringify(state.data.products, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = "products.json"; a.click(); URL.revokeObjectURL(a.href);
    }
  };
  window.StoreCore = api;

  function renderHeaderAndHero() {
    const s = state.data.store;
    $("#brandName").textContent = s.name; $("#footerBrand").textContent = s.name;
    $("#footerLine").textContent = s.footer.line;
    $("#footerEmail").textContent = s.footer.email; $("#footerEmail").href = "mailto:" + s.footer.email;
    $("#footerBrandNote").textContent = s.footer.note || s.footer.line;
    $("#footerInstagram").href = s.footer.instagram || "#";
    $("#footerInstagram").textContent = s.footer.instagramLabel || "Instagram";
    $("#footerTelegram").href = s.footer.telegram || "#";
    $("#footerTelegram").textContent = s.footer.telegramLabel || "Telegram";
    $("#footerShipping").textContent = s.footer.shipping || "Доставка по России · Оплата при оформлении";
    $("#footerLegal").textContent = s.footer.legal || "Информация о составе и использовании указана в карточках товаров.";
    $("#heroEyebrow").textContent = s.hero.eyebrow;
    $("#heroTitle").textContent = s.hero.title;
    $("#heroTitle").style.whiteSpace = "pre-line";
    $("#heroText").textContent = s.hero.text;
    $("#heroNote").textContent = s.hero.note;
    $("#heroCaption").textContent = s.hero.caption;
    setImage($("#heroImage"), s.hero.image);
    setImage($("#storyImage"), s.story.image);
    $("#storyTitle").textContent = s.story.title;
    $("#storyText").textContent = s.story.text;
    document.title = s.name + " — натуральная косметика";
    document.querySelector('meta[name="description"]').content = s.footer.line;
  }
  function setImage(img, url) {
    img.src = url || "";
    img.onerror = () => { img.onerror = null; img.src = "https://picsum.photos/seed/verde-botanical/1100/850"; };
  }
  function renderFilters() {
    $("#filters").innerHTML = state.data.categories.map((c) =>
      `<button class="filter-chip" data-filter="${safe(c)}" aria-pressed="${state.filter === c}">${safe(c)}</button>`).join("");
    $$("[data-filter]").forEach((b) => b.addEventListener("click", () => {
      state.filter = b.dataset.filter; state.limit = 24; renderFilters(); renderCatalog();
    }));
  }
  function visibleProducts() {
    const max = Number($("#maxPrice").value) || Infinity;
    const items = state.data.products.filter((p) => (state.filter === "Всё" || p.category === state.filter) && p.price <= max &&
      (p.name + " " + p.short + " " + p.ingredients).toLowerCase().includes(state.query.toLowerCase()));
    const sort = $("#catalogSort").value;
    return sort === "default" ? items : items.sort((a,b) => sort === "price" ? a.price-b.price : a.name.localeCompare(b.name, "ru"));
  }
  function renderCatalog() {
    const items = visibleProducts();
    $("#resultCount").textContent = items.length + " средств";
    $("#emptyState").hidden = items.length > 0;
    $("#loadMore").hidden = items.length <= state.limit;
    $("#productGrid").innerHTML = items.slice(0, state.limit).map((p) => `
      <article class="product-card">
        <div class="product-image" data-detail="${safe(p.id)}" tabindex="0" role="button" aria-label="Подробнее: ${safe(p.name)}">
          <img src="${safe(p.image)}" alt="${safe(p.imageAlt)}" loading="lazy">
          ${p.badge ? `<span class="product-label">${safe(p.badge)}</span>` : ""}
          <button class="quick-add" data-add="${safe(p.id)}">Добавить в корзину</button>
        </div>
        <div class="product-info"><span class="product-category">${safe(p.category)}</span>
          <h3 class="product-name">${safe(p.name)}</h3><p class="product-desc">${safe(p.short)}</p>
          <div class="product-bottom"><span class="product-price">${api.money(p.price)} ${p.oldPrice ? `<del>${api.money(p.oldPrice)}</del>` : ""}</span><span class="product-volume">${safe(p.volume)}</span></div>
          <button class="mobile-add" data-add="${safe(p.id)}">Добавить · ${api.money(p.price)}</button>
        </div>
      </article>`).join("");
    $$('[data-add]').forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation(); api.addToCart(b.dataset.add);
    }));
    $$('[data-detail]').forEach((node) => {
      const open = () => showProduct(node.dataset.detail);
      node.addEventListener("click", (e) => { if (!e.target.closest("button")) open(); });
      node.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
    state.hooks.productActions.forEach((fn) => fn($("#productGrid"), api));
  }
  function showProduct(id) {
    const p = product(id); if (!p) return;
    $("#productDetail").innerHTML = `<div class="detail-layout"><img class="detail-image" src="${safe(p.image)}" alt="${safe(p.imageAlt)}">
      <div class="detail-copy"><span class="product-category">${safe(p.category)} · ${safe(p.volume)}</span>
      <h2>${safe(p.name)}</h2><p>${safe(p.description)}</p><div class="detail-price">${api.money(p.price)}</div>
      <button class="button button-dark" id="detailAdd">Добавить в корзину <span>+</span></button>
      <div class="detail-block"><h3>Состав</h3><p>${safe(p.ingredients)}</p></div>
      <div class="detail-block"><h3>Как использовать</h3><p>${safe(p.howTo)}</p></div>
       <div class="detail-block"><h3>Отзывы</h3><div id="productReviews"></div></div>
       <div class="detail-block"><h3>Похожие средства</h3>${state.data.products.filter(x => x.id !== id).sort((a,b) => Number(b.category === p.category)-Number(a.category === p.category)).slice(0,3).map(x => `<button class="related-product" data-related="${safe(x.id)}">${safe(x.name)} · ${api.money(x.price)}</button>`).join("")}</div></div></div>`;
    $$('[data-related]').forEach(b => b.onclick = () => showProduct(b.dataset.related));
    document.dispatchEvent(new CustomEvent("store:product", {detail: p}));
    $("#detailAdd").addEventListener("click", () => api.addToCart(id));
    $("#productDialog").showModal();
  }
  function renderJournal() {
    $("#journalGrid").innerHTML = state.data.journal.map((j,i) => `<article class="journal-card"><span class="journal-type">${safe(j.type)}</span><h3>${safe(j.title)}</h3><p>${safe(j.text)}</p><button class="text-link" data-article="${i}">Читать статью →</button></article>`).join("");
  }
  function renderCart() {
    Object.keys(state.cart).forEach(id => { if (!product(id)) delete state.cart[id]; });
    const ids = Object.keys(state.cart).filter((id) => product(id));
    $("#cartCount").textContent = count(); $("#drawerCount").textContent = count() ? `(${count()})` : "";
    $("#cartLines").innerHTML = ids.length ? ids.map((id) => {
      const p = product(id), q = state.cart[id];
      return `<div class="cart-line"><img src="${safe(p.image)}" alt=""><div><div class="cart-line-name">${safe(p.name)}</div><div class="cart-line-meta">${safe(p.volume)} · ${safe(p.category)}</div><div class="line-controls"><button data-dec="${safe(id)}" aria-label="Уменьшить">−</button><span>${q}</span><button data-inc="${safe(id)}" aria-label="Увеличить">+</button><button class="remove" data-remove="${safe(id)}">Удалить</button></div></div><span class="line-price">${api.money(p.price * q)}</span></div>`;
    }).join("") : `<div class="empty-state">Корзина пока пуста.<br>Добавь средство из каталога.</div>`;
    const sum = subtotal(), left = Math.max(0, state.data.store.freeDeliveryFrom - sum);
    $("#freeDeliveryNote").textContent = sum === 0 ? "" : left ? `До бесплатной доставки осталось ${api.money(left)}` : "Доставка будет бесплатной";
    $("#cartTotal").textContent = api.money(sum);
    $$('[data-inc]').forEach((b) => b.onclick = () => { state.cart[b.dataset.inc] = Math.min(99, state.cart[b.dataset.inc] + 1); saveCart(); renderCart(); });
    $$('[data-dec]').forEach((b) => b.onclick = () => { state.cart[b.dataset.dec] = Math.max(1, state.cart[b.dataset.dec] - 1); saveCart(); renderCart(); });
    $$('[data-remove]').forEach((b) => b.onclick = () => { delete state.cart[b.dataset.remove]; saveCart(); renderCart(); });
  }
  function openCart() { renderCart(); $("#cartDrawer").classList.add("open"); $("#cartDrawer").setAttribute("aria-hidden", "false"); $("#drawerBackdrop").hidden = false; document.body.style.overflow = "hidden"; }
  function closeCart() { $("#cartDrawer").classList.remove("open"); $("#cartDrawer").setAttribute("aria-hidden", "true"); $("#drawerBackdrop").hidden = true; document.body.style.overflow = ""; }
  function loadMods() {
    fetch("modules.json").then((r) => r.ok ? r.json() : { modules: [] }).then(async (config) => {
      // The module registry is physically inside mods/. The root config only
      // switches modules on/off; extension definitions live with the extensions.
      const registry = config.registry
        ? await fetch(config.registry).then((r) => r.ok ? r.json() : { modules: [] }).catch(() => ({ modules: [] }))
        : config;
      const switches = new Map((config.modules || []).map((m) => [m.id, m.enabled]));
      const params = new URLSearchParams(location.search);
      const localDev = ["localhost", "127.0.0.1"].includes(location.hostname) && params.get("admin") === "1";
      const enabled = (registry.modules || []).filter((m) => {
        const configured = switches.has(m.id) ? switches.get(m.id) : m.enabled;
        // Admin ships disabled unless explicitly enabled on localhost for demo review.
        return m.id === "admin" ? (configured && localDev) : configured;
      });
      return Promise.all(enabled.map((m) => new Promise((resolve) => {
        if (m.style) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = m.style; document.head.append(l); }
        const s = document.createElement("script"); s.src = m.entry; s.onload = resolve; s.onerror = () => { toast(`Модуль ${m.name} не загрузился`); resolve(); }; document.body.append(s);
      })));
    }).catch(() => { /* Отсутствующий modules.json не мешает магазину. */ });
  }
  function bindCore() {
    $("#openCart").onclick = openCart; $("#closeCart").onclick = closeCart; $("#drawerBackdrop").onclick = closeCart;
    $("#checkoutButton").onclick = openCheckout;
    $("#closeProduct").onclick = () => $("#productDialog").close();
    $("#productDialog").addEventListener("click", (e) => { if (e.target === $("#productDialog")) $("#productDialog").close(); });
    $("#search").addEventListener("input", (e) => { state.query = e.target.value; state.limit = 24; renderCatalog(); });
    ["#maxPrice", "#catalogSort"].forEach(s => $(s).oninput = () => { state.limit = 24; renderCatalog(); });
    $("#loadMore").onclick = () => { state.limit += 24; renderCatalog(); };
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCart(); });
  }
  function openCheckout() {
    window.StoreCustomer.openCheckout();
  }
  async function boot() {
    try {
      state.data = await PortfolioAPI.content('store', 'data/store.json'); renderHeaderAndHero(); renderFilters(); renderCatalog(); renderJournal(); renderCart(); bindCore();
      window.StoreCustomer.init(api); await loadMods();
    } catch (e) { $("#emptyState").hidden = false; $("#emptyState").textContent = "Не удалось загрузить data/store.json. Запусти проект через serve.bat."; console.error(e); }
  }
  boot();
})();
