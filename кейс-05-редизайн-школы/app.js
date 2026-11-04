'use strict';
const $=s=>document.querySelector(s), api=PortfolioAPI;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let requestKey=crypto.randomUUID();
async function boot(){try{
  const d=await api.content('school','data.json');
  ['eyebrow','title','description','formTitle','formText'].forEach(id=>$('#'+id).textContent=d[id]);
  $('#email').textContent=d.email;$('#email').href='mailto:'+d.email;
  $('#planGrid').innerHTML=d.plans.map((p,i)=>`<article class="plan"><span class="eyebrow">ФОРМАТ / 0${i+1}</span><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><div class="price">${p.price.toLocaleString('ru-RU')} ₽</div><small>${esc(p.unit)}</small><a class="button" href="#apply">Мне подходит <span>↗</span></a></article>`).join('');
  $('#steps').innerHTML=d.steps.map((s,i)=>`<article class="step"><span>0${i+1} /</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></article>`).join('');
  if(!api.online)$('#result').textContent='Статический просмотр: отправка заявок доступна при запуске сервера.';
}catch(error){$('#result').textContent=error.message;}}
$('#leadForm').onsubmit=async e=>{
  e.preventDefault();const form=e.currentTarget, button=$('#submit');
  const body=Object.fromEntries(new FormData(form));body.consent=form.consent.checked;body.name=body.name.trim();
  if(body.name.length<2||!/^[78]\d{10}$/.test(body.phone.replace(/\D/g,''))){$('#result').textContent='Укажите имя и телефон: +7 и 10 цифр.';return;}
  if(!api.online){$('#result').textContent='Это статический просмотр. Заявка не отправлена. Запустите сервер для проверки.';return;}
  button.disabled=true;
  try{const result=await api.submit('leads/school',body,requestKey);$('#result').textContent='Заявка №'+result.id+' сохранена на сервере. Это учебная школа: реального звонка не будет.';requestKey=crypto.randomUUID();form.reset();}
  catch(error){$('#result').textContent=error.message+' Поля сохранены, можно повторить отправку.';}
  finally{button.disabled=false;}
};boot();
