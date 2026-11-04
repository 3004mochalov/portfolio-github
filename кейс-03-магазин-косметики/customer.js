/* Покупательские сценарии. Локальные данные явно обозначены как демонстрационные. */
(() => {
  "use strict";
  const $ = s => document.querySelector(s);
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const ORDER_KEY = "verde.demo.orders.v1", PROFILE_KEY = "verde.profile.v1";
  let core, esc, busy = false;
  let requestKey = crypto.randomUUID();
  const orders = () => { const list = read(ORDER_KEY, []); return Array.isArray(list) ? list : []; };
  const balance = () => orders().reduce((n,o) => n + (o.earned || 0) - (o.spent || 0), 0);
  const phoneValid = value => /^[78]\d{10}$/.test(value.replace(/\D/g, ""));
  function show(html) {
    $("#customerContent").innerHTML = html;
    if (!$("#customerDialog").open) $("#customerDialog").showModal();
  }
  function account() {
    if (PortfolioAPI.online) { window.ServerAccount.open(core, show); return; }
    const p = read(PROFILE_KEY, {});
    show(`<p class="eyebrow">Личный кабинет · демо</p><h2 id="customerTitle">Твой уход</h2>
      <p>Профиль и история на этом устройстве. Это локальный кабинет без регистрации и серверной авторизации.</p>
      <form id="profileForm"><label>Имя<input name="name" value="${esc(p.name || "")}" required maxlength="100"></label><label>Телефон<input name="phone" type="tel" value="${esc(p.phone || "")}" required></label><label>Почта<input name="email" type="email" value="${esc(p.email || "")}"></label><p class="field-error" id="profileError" role="alert"></p><button class="button button-dark">Сохранить профиль</button></form>
      <section class="detail-block"><h3>Клуб BOTANICA</h3><p><strong>${balance()} демо-баллов</strong></p><p>5% от суммы товаров после скидки возвращаются баллами. 1 балл = 1 ₽, списать можно до 20% стоимости товаров. Баллы тестовые, начисляются за локальный демо-заказ.</p></section>
      <section class="detail-block"><h3>История демо-заказов</h3>${orders().length ? orders().map(o => `<article class="order-history"><strong>${esc(o.number)}</strong><p>${esc(o.status)} · ${core.money(o.total)}</p><p>${(o.items || []).map(i => `${esc(i.name)} × ${i.qty}`).join(", ")}</p><p>${esc(o.city || "")} · ${esc(o.address || "")}</p><small>Начислено: ${o.earned || 0} · Списано: ${o.spent || 0}</small></article>`).join("") : "<p>Заказов пока нет.</p>"}</section>`);
    $("#profileForm").onsubmit = e => {
      e.preventDefault(); const value = Object.fromEntries(new FormData(e.currentTarget));
      value.name = value.name.trim(); value.phone = value.phone.trim();
      if (value.name.length < 2 || !phoneValid(value.phone)) { $("#profileError").textContent = "Укажи имя от двух символов и телефон: +7 и 10 цифр."; return; }
      try { write(PROFILE_KEY, value); core.toast("Профиль сохранён на этом устройстве"); }
      catch { $("#profileError").textContent = "Браузер не разрешил сохранить профиль."; }
    };
  }
  function article(index) {
    const item = core.data.journal[index];
    show(`<p class="eyebrow">${esc(item.type)}</p><h2 id="customerTitle">${esc(item.title)}</h2>${(item.body || [item.text]).map(p => `<p>${esc(p)}</p>`).join("")}<button class="button" id="articleBack">Вернуться к журналу</button>`);
    $("#articleBack").onclick = () => $("#customerDialog").close();
  }
  function reviews(product) {
    const key = "verde.reviews." + product.id;
    const saved = read(key, []);
    const list = [...(product.reviews || []), ...(Array.isArray(saved) ? saved : [])];
    $("#productReviews").innerHTML = `${list.length ? list.map(r => `<article class="review"><strong>${esc(r.name)} · ${esc(r.rating)}/5</strong><p>${esc(r.text)}</p><small>${r.verified ? "Подтверждённый отзыв бренда" : "Локальный демонстрационный отзыв"}</small></article>`).join("") : "<p>Отзывов пока нет. Подтверждённые отзывы бренда ещё не загружены.</p>"}
      <form id="reviewForm"><label>Имя<input name="name" required minlength="2" maxlength="80"></label><label>Оценка<select name="rating"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select></label><label>Отзыв<textarea name="text" required minlength="10" maxlength="2000"></textarea></label><p>Тестовый отзыв будет виден только в этом браузере.</p><p id="reviewError" role="alert" class="field-error"></p><button class="button">Добавить демо-отзыв</button></form>`;
    $("#reviewForm").onsubmit = e => {
      e.preventDefault(); const r = Object.fromEntries(new FormData(e.currentTarget)); r.name = r.name.trim(); r.text = r.text.trim();
      if (r.name.length < 2 || r.text.length < 10) { $("#reviewError").textContent = "Укажи имя и отзыв не короче 10 символов."; return; }
      try { write(key, [...(Array.isArray(saved) ? saved : []), {...r, verified:false}]); reviews(product); }
      catch { $("#reviewError").textContent = "Не удалось сохранить отзыв в браузере."; }
    };
  }
  function openCheckout() {
    const cart = core.getCart();
    const items = Object.entries(cart).flatMap(([id,qty]) => { const p = core.data.products.find(p => p.id === id); return p ? [{id,qty,name:p.name,price:p.price}] : []; });
    if (!items.length) { core.toast("Сначала добавь средство в корзину"); return; }
    core.closeCart();
    const profile = read(PROFILE_KEY, {}), demo = !core.data.orderEndpoint;
    const subtotal = items.reduce((n,p) => n+p.price*p.qty,0);
    const shipping = core.data.shipping;
    const points = core.data.pickupPoints || [];
    show(`<p class="eyebrow">Оформление ${demo ? "· демо" : ""}</p><h2 id="customerTitle">Доставка и оплата</h2>
      <p>${demo ? "Тестовый заказ сохранится в этом браузере. Деньги не списываются; адреса пунктов и тарифы демонстрационные." : "Заказ будет отправлен в API магазина. Итог подтверждает сервер."}</p>
      <form id="customerCheckout" novalidate>
      <label>Имя<input id="orderName" name="name" autocomplete="name" value="${esc(profile.name || "")}"></label><p id="nameError" class="field-error"></p>
      <label>Телефон<input id="orderPhone" name="phone" type="tel" autocomplete="tel" value="${esc(profile.phone || "")}"></label><p id="phoneError" class="field-error"></p>
      <label>Почта<input name="email" type="email" autocomplete="email" value="${esc(profile.email || "")}"></label><p id="emailError" class="field-error"></p>
      <label>Город<input name="city" autocomplete="address-level2"></label><p id="cityError" class="field-error"></p>
      <label>Способ доставки<select name="delivery" id="orderDelivery">${shipping.map(s => `<option value="${esc(s.id)}">${esc(s.name)} · ${esc(s.days)} · ${core.money(s.price)}</option>`).join("")}</select></label>
      <label id="addressField">Адрес<input name="address" autocomplete="street-address"></label><p id="addressError" class="field-error"></p>
      <label id="pointField">Пункт выдачи<select name="point"><option value="">Выбери пункт</option>${points.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select></label><p id="pointError" class="field-error"></p>
      <label>Оплата<select name="payment">${core.data.paymentLabels.map(p => `<option>${esc(p)}</option>`).join("")}</select></label>
      ${demo ? `<label class="check-label"><input type="checkbox" name="usePoints">Списать демо-баллы (доступно ${balance()})</label>` : ""}
      <div id="checkoutSummary" class="detail-block" aria-live="polite"></div><p id="checkoutError" class="field-error" role="alert"></p>
      <button class="button button-dark" id="placeOrder">${demo ? "Создать демо-заказ" : "Отправить заказ"}</button></form>`);
    const form = $("#customerCheckout");
    function amounts() {
      const values = Object.fromEntries(new FormData(form));
      const spent = demo && values.usePoints ? Math.max(0, Math.min(balance(), Math.floor(subtotal*.2))) : 0;
      const delivery = shipping.find(s => s.id === values.delivery);
      const fee = subtotal-spent >= core.data.store.freeDeliveryFrom ? 0 : delivery.price;
      return {spent, fee, total:subtotal-spent+fee, earned:demo ? Math.floor((subtotal-spent)*.05) : 0};
    }
    function update() {
      const pickup = form.elements.delivery.value === "pickup";
      $("#addressField").hidden = pickup; $("#pointField").hidden = !pickup;
      const a = amounts();
      $("#checkoutSummary").innerHTML = `<p>Товары: ${core.money(subtotal)}<br>Баллы: −${core.money(a.spent)}<br>Доставка: ${core.money(a.fee)}</p><strong>Итого: ${core.money(a.total)}</strong>${demo ? `<p>Начислим ${a.earned} демо-баллов</p>` : ""}`;
    }
    form.onchange = update; update();
    form.onsubmit = async e => {
      e.preventDefault(); if (busy) return;
      const values = Object.fromEntries(new FormData(form));
      Object.keys(values).forEach(k => values[k] = values[k].trim());
      const invalid = {
        name: values.name.length < 2 ? "Укажи имя от двух символов." : "",
        phone: !phoneValid(values.phone) ? "Телефон: +7 и 10 цифр." : "",
        email: values.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email) ? "Проверь адрес почты." : "",
        city: values.city.length < 2 ? "Укажи город." : "",
        address: values.delivery !== "pickup" && values.address.length < 5 ? "Укажи улицу, дом и квартиру." : "",
        point: values.delivery === "pickup" && !points.some(p => p.id === values.point) ? "Выбери пункт выдачи." : ""
      };
      Object.entries(invalid).forEach(([key,msg]) => { $("#"+key+"Error").textContent = msg; form.elements[key].setAttribute("aria-invalid", Boolean(msg)); form.elements[key].setAttribute("aria-describedby", key+"Error"); });
      const first = Object.keys(invalid).find(k => invalid[k]); if (first) { form.elements[first].focus(); return; }
      busy = true; $("#placeOrder").disabled = true; $("#placeOrder").textContent = "Отправляем…";
      const order = {...values, ...amounts(), items, createdAt:new Date().toISOString(), status:demo ? "Демонстрационный" : "Создан", address:values.delivery === "pickup" ? points.find(p => p.id === values.point).name : values.address};
      try {
        if (demo) { order.number = "DEMO-" + crypto.randomUUID().slice(0,8); write(ORDER_KEY, [order,...orders()]); }
        else {
          const response = await fetch(core.data.orderEndpoint, {method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":requestKey,...(PortfolioAPI.token?{Authorization:'Bearer '+PortfolioAPI.token}:{})},body:JSON.stringify(order),signal:AbortSignal.timeout(15000)});
          if (!response.ok) throw new Error("HTTP " + response.status);
          const result = await response.json(); if (!result.id && !result.number) throw new Error("Нет номера заказа");
           order.number = result.number || result.id;
           requestKey = crypto.randomUUID();
        }
        core.clearCart();
        show(`<p class="eyebrow">${demo ? "Демо завершено" : "Заказ создан"}</p><h2 id="customerTitle">${esc(order.number)}</h2><p>${demo ? "Заказ сохранён на этом устройстве. Деньги не списывались. История и баллы доступны в кабинете." : "Сервер подтвердил создание заказа. Статус оплаты необходимо подтвердить в системе магазина."}</p><button class="button" id="afterOrder">${demo ? "Открыть кабинет" : "Продолжить покупки"}</button>`);
        $("#afterOrder").onclick = demo ? account : () => $("#customerDialog").close();
      } catch { $("#checkoutError").textContent = "Подтверждение не получено. Корзина осталась на месте. Уточни статус у поддержки перед повторной отправкой."; }
      finally { busy = false; if ($("#placeOrder")) { $("#placeOrder").disabled = false; $("#placeOrder").textContent = demo ? "Создать демо-заказ" : "Отправить заказ"; } }
    };
  }
  window.StoreCustomer = {openCheckout, init(api) {
    core = api; esc = core.escape;
    $("#openAccount").onclick = account;
    $("#closeCustomer").onclick = () => { if (!busy) $("#customerDialog").close(); };
    $("#customerDialog").addEventListener("cancel", e => { if (busy) e.preventDefault(); });
    document.addEventListener("store:product", e => reviews(e.detail));
    document.querySelectorAll("[data-article]").forEach(b => b.onclick = () => article(Number(b.dataset.article)));
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const observer = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("appeared"); observer.unobserve(e.target); } }), {threshold:.05});
      document.querySelectorAll(".catalog-section,.editorial,.journal-section").forEach(el => { el.classList.add("appear"); observer.observe(el); });
    }
  }};
})();
