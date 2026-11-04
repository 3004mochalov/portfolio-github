/* Движок визитки: читает config.json и строит страницу.
   ЗАКАЗЧИКУ СЮДА ЛЕЗТЬ НЕ НУЖНО. */
"use strict";

const FALLBACK_PHOTO = "portrait.svg";
const CHECK_SVG = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none">' +
  '<path d="M3.5 10.5l4 4 9-10" stroke="#346538" stroke-width="2.2"' +
  ' stroke-linecap="round" stroke-linejoin="round"/></svg>';

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function render(cfg) {
  document.title = cfg.meta.title;
  document.querySelector('meta[name="description"]').setAttribute("content", cfg.meta.description);

  const c = cfg.contacts, h = cfg.hero;
  document.getElementById("logo").textContent = c.name;
  const nav = document.getElementById("mainNav");
  const anchors = ["about", "results", "plans", "faq"];
  nav.innerHTML = cfg.nav.map((t, i) =>
    '<a href="#' + anchors[i] + '">' + esc(t) + "</a>").join("");
  const phone = document.getElementById("headPhone");
  phone.href = "tel:" + c.phoneTel;
  phone.textContent = c.phoneDisplay;
  document.getElementById("headCta").textContent = h.ctaHeader;

  document.getElementById("heroBadge").textContent = h.badge;
  document.getElementById("heroTitle").textContent = h.title;
  document.getElementById("heroLead").textContent = h.lead;
  document.getElementById("heroCta1").textContent = h.ctaMain;
  document.getElementById("heroCta2").textContent = h.ctaSecond;
  document.getElementById("stats").innerHTML = cfg.stats.map((s, i) =>
    '<div class="cell reveal" style="--index:' + i + '"><div class="num">' + esc(s.num) +
    '</div><div class="lbl">' + esc(s.lbl) + "</div></div>").join("");

  const a = cfg.about;
  document.getElementById("aboutTitle").textContent = a.title;
  document.getElementById("aboutSub").textContent = a.sub;
  const img = document.getElementById("aboutPhoto");
  img.alt = a.photoAlt;
  img.src = a.photo || FALLBACK_PHOTO;
  img.onerror = function () { img.onerror = null; img.src = FALLBACK_PHOTO; };
  document.getElementById("aboutText").innerHTML =
    a.paragraphs.map((p) => "<p>" + esc(p) + "</p>").join("");

  const r = cfg.results;
  document.getElementById("resTitle").textContent = r.title;
  document.getElementById("resSub").textContent = r.sub;
  document.getElementById("resList").innerHTML = r.items.map((it) =>
    '<li class="reveal"><div>' + CHECK_SVG + "</div><div><b>" + esc(it.b) +
    "</b> <span>" + esc(it.t) + "</span></div></li>").join("");

  const p = cfg.plans;
  document.getElementById("plansTitle").textContent = p.title;
  document.getElementById("plansSub").textContent = p.sub;
  document.getElementById("plansGrid").innerHTML = p.items.map((pl, i) =>
    '<div class="plan reveal' + (pl.hot ? " hot" : "") + '" style="--index:' + i + '">' +
    (pl.hot && pl.badge ? '<span class="badge">' + esc(pl.badge) + "</span>" : "") +
    '<div class="p-name">' + esc(pl.name) + '</div><div class="p-price">' + esc(pl.price) +
    '</div><div class="p-per">' + esc(pl.per) + "</div><ul>" +
    pl.features.map((f) => "<li>" + esc(f) + "</li>").join("") + "</ul></div>").join("");

  const f = cfg.faq;
  document.getElementById("faqTitle").textContent = f.title;
  document.getElementById("faqSub").textContent = f.sub;
  document.getElementById("faqList").innerHTML = f.items.map((it) =>
    '<details><summary>' + esc(it.q) + '<span class="pm">+</span></summary>' +
    '<p class="a">' + esc(it.a) + "</p></details>").join("");
  document.querySelectorAll(".faq details").forEach((d) => {
    d.addEventListener("toggle", () => {
      d.querySelector(".pm").textContent = d.open ? "\u2013" : "+";
    });
  });

  const fm = cfg.form;
  document.getElementById("formTitle").textContent = fm.title;
  document.getElementById("formSub").textContent = fm.sub;
  document.getElementById("lbName").textContent = fm.nameLabel;
  document.getElementById("fName").placeholder = fm.namePh;
  document.getElementById("lbPhone").textContent = fm.phoneLabel;
  document.getElementById("fPhone").placeholder = fm.phonePh;
  document.getElementById("phoneHint").textContent = fm.phoneHint;
  document.getElementById("lbMsg").innerHTML = esc(fm.msgLabel) +
    ' <span style="font-weight:400;color:var(--muted)">' + esc(fm.msgOpt) + "</span>";
  document.getElementById("fMsg").placeholder = fm.msgPh;
  document.getElementById("sendBtn").textContent = fm.submit;
  document.getElementById("formOk").textContent = fm.okText;

  document.getElementById("footName").textContent = c.name;
  const fp = document.getElementById("footPhone");
  fp.href = "tel:" + c.phoneTel;
  fp.textContent = c.phoneDisplay;
  const tg = document.getElementById("footTg");
  tg.href = c.telegram;
  tg.textContent = c.telegramText;
  const vk = document.getElementById("footVk");
  vk.href = c.vk;
  vk.textContent = c.vkText;

  let requestKey = crypto.randomUUID();
  const consent = document.createElement('label');
  consent.style.cssText = 'display:block;font-size:12px;margin:16px 0';
  consent.innerHTML = '<input type="checkbox" required id="leadConsent"> Согласен на сохранение имени, телефона и комментария для обработки заявки. Учебный проект — используйте тестовые данные.';
  document.getElementById('sendBtn').before(consent);
  document.getElementById("leadForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const name = document.getElementById("fName").value.trim();
    const phoneV = document.getElementById("fPhone").value.trim();
    const msg = document.getElementById("fMsg").value.trim();
    if (name.length < 2 || !/^[78]\d{10}$/.test(phoneV.replace(/\D/g,''))) { alert('Укажите имя и телефон: +7 и 10 цифр.'); return; }
    if (PortfolioAPI.online) {
      const button = document.getElementById('sendBtn'); button.disabled = true;
      const result = document.getElementById('formOk'); result.style.display = 'block';
      try {
        const saved = await PortfolioAPI.submit('leads/tutor', {name,phone:phoneV,message:msg,consent:document.getElementById('leadConsent').checked}, requestKey);
        result.textContent = 'Заявка №' + saved.id + ' сохранена на сервере. Это демонстрация; реального звонка не будет.';
        requestKey = crypto.randomUUID(); ev.target.reset();
      } catch(error) { result.textContent = error.message + ' Заявка не подтверждена; поля сохранены.'; }
      finally { button.disabled = false; }
      return;
    }
    document.getElementById("formOk").style.display = "block";
    document.getElementById('formOk').textContent = 'Статический просмотр: заявка не отправлена. Для проверки сохранения запустите сервер.';
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        const st = e.target.style;
        st.transitionDelay = ((+st.getPropertyValue("--index") || 0) * 80) + "ms";
        e.target.classList.add("visible");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
}

PortfolioAPI.content('tutor', 'config.json')
  .then(render)
  .catch(() => { document.getElementById("loadError").style.display = "block"; });
