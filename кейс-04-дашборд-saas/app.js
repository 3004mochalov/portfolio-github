'use strict';
const api = PortfolioAPI, $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
const labels = {active:'Активна',trial:'Пробный период',cancelled:'Отменена'};
let data, user, revision;
let preview = false;
const previewControls = document.createElement('div');
previewControls.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;margin:18px 0';
previewControls.innerHTML = '<button id="openPreview" type="button">Посмотреть демо без входа</button><button id="openLogin" type="button" hidden>Войти для управления</button>';
$('#message').after(previewControls);
const message = text => $('#message').textContent = text;
function filtered() {
  return data.customers.filter(c => c.name.toLowerCase().includes($('#search').value.toLowerCase()) && (!$('#status').value || c.status === $('#status').value))
    .sort((a,b)=>$('#sort').value === 'mrr' ? b.mrr-a.mrr : $('#sort').value === 'name' ? a.name.localeCompare(b.name,'ru') : b.date.localeCompare(a.date));
}
function table() {
  const rows = filtered(); $('#count').textContent = rows.length + ' компаний'; $('#empty').hidden = !!rows.length;
  $('#rows').innerHTML = rows.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.plan)}</td><td><span class="tag ${esc(c.status)}">${esc(labels[c.status]||c.status)}</span></td><td>${money(c.mrr)}</td><td>${esc(c.date)}</td></tr>`).join('');
}
function charts() {
  const months = data.revenue.slice(-Number($('#period').value)), max = Math.max(1,...months.map(m=>m.amount));
  $('#revenue').innerHTML = months.map(m=>`<div class="bar-col"><span>${money(m.amount)}</span><div class="bar" style="height:${Math.max(0,m.amount/max*155)}px"></div><span>${esc(m.month)}</span></div>`).join('');
  $('#funnel').innerHTML = data.funnel.map(f=>`<div class="funnel-row"><div><span>${esc(f.name)}</span><strong>${f.value.toLocaleString('ru-RU')}</strong></div><div class="track"><i style="width:${Math.min(100,Math.max(0,f.value/Math.max(1,data.funnel[0]?.value||0)*100))}%"></i></div></div>`).join('');
}
function render() {
  $('#workspace').textContent = data.workspace;
  const latest = data.revenue.at(-1)?.amount || 0;
  const metrics = [['Выручка за месяц',money(latest),'Последний месяц ряда'],['MRR клиентов',money(data.customers.filter(c=>c.status==='active').reduce((s,c)=>s+c.mrr,0)),'По активным подпискам'],['Активные клиенты',data.customers.filter(c=>c.status==='active').length,'В текущем списке'],['Выполнение цели',Math.round(latest/Math.max(1,data.goal)*100)+'%','Цель: '+money(data.goal)]];
  $('#metrics').innerHTML = metrics.map(([name,value,note])=>`<div class="metric"><span>${name}</span><strong>${value}</strong><small>${note}</small></div>`).join('');
  $('#settingsForm').elements.workspace.value = data.workspace; $('#settingsForm').elements.goal.value = data.goal;
  charts();table();
}
async function load() {
  try {
    await api.ready;
    if (api.online) user = (await api.call('me')).user;
    data = await api.content('analytics','data.json');
    preview = false;
    $('#openPreview').hidden = true; $('#openLogin').hidden = true;
    $('#login').hidden = true; $('#logout').hidden = !api.online;
    render(); await page('overview');
    message(api.online ? 'Сервер подключён. Данные демонстрационные.' : 'Статический просмотр. Для управления запустите сервер.');
  } catch(error) { $('#login').hidden = false; $('#openPreview').hidden = false; message(error.message); }
}
$('#openPreview').onclick = async () => {
  const button = $('#openPreview'); button.disabled = true;
  try {
    const response = await fetch('data.json');
    if (!response.ok) throw new Error('Не удалось загрузить демонстрационные данные.');
    data = await response.json(); preview = true; user = null; revision = undefined;
    $('#login').hidden = true; $('#logout').hidden = true;
    button.hidden = true; $('#openLogin').hidden = !api.online;
    render(); await page('overview');
    message('Демо без входа: графики, фильтры и CSV доступны. Серверные данные не изменяются.');
  } catch(error) { message(error.message); }
  finally { button.disabled = false; }
};
$('#openLogin').onclick = () => {
  ['overview','users','settings'].forEach(id => $('#'+id).hidden = true);
  $('#login').hidden = false; $('#openPreview').hidden = false; $('#openLogin').hidden = true;
  $('#loginForm [name=email]').focus();
};
async function page(name) {
  if (!data) return;
  ['overview','users','settings'].forEach(id=>$('#'+id).hidden=id!==name);
  document.querySelectorAll('[data-page]').forEach(b=>b.setAttribute('aria-current',b.dataset.page===name?'page':'false'));
  $('#breadcrumb').textContent = {overview:'Обзор',users:'Пользователи',settings:'Настройки'}[name];
  if(name==='users') {
    $('#userForm').hidden = preview || !api.online || user?.role!=='admin';
    if(preview || !api.online || user?.role!=='admin') { $('#userList').textContent='Управление доступно администратору на сервере.'; return; }
    try {
      const result=await api.call('admin/users');
      $('#userList').innerHTML=result.users.map(u=>`<article><div><strong>${esc(u.name)}</strong><p>${esc(u.email)} · ${esc(u.role)} · ${u.active?'Активен':'Отключён'}</p></div>${u.id!==user.id?`<button data-user="${u.id}" data-active="${u.active}">${u.active?'Отключить':'Включить'}</button>`:''}</article>`).join('');
      document.querySelectorAll('[data-user]').forEach(b=>b.onclick=async()=>{try{await api.call('admin/users/'+b.dataset.user,{method:'PATCH',body:JSON.stringify({active:b.dataset.active!=='1'})});await page('users');}catch(e){message(e.message);}});
    } catch(e){message(e.message);}
  }
  if(name==='settings' && !preview && api.online && user?.role==='admin') {
    try {const result=await api.call('admin/content/analytics');revision=result.revision;data=result.content;render();}catch(e){message(e.message);}
  }
}
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>page(b.dataset.page));
['search','status','sort'].forEach(id=>$('#'+id).oninput=table); $('#period').onchange=charts;
$('#theme').onclick=()=>{document.body.classList.toggle('light');$('#theme').textContent=document.body.classList.contains('light')?'Тёмная тема':'Светлая тема';};
$('#loginForm').onsubmit=async e=>{e.preventDefault();const b=e.currentTarget.querySelector('button');b.disabled=true;try{await api.login(e.currentTarget.email.value,e.currentTarget.password.value);e.target.reset();await load();}catch(error){message(error.message);}finally{b.disabled=false;}};
$('#logout').onclick=async()=>{await api.logout();location.reload();};
$('#settingsForm').onsubmit=async e=>{e.preventDefault();if(!api.online||user?.role!=='admin'){message('Для сохранения нужен вход администратора.');return;}try{const next={...data,workspace:e.currentTarget.workspace.value.trim(),goal:Number(e.currentTarget.goal.value)};const result=await api.call('admin/content/analytics',{method:'PUT',body:JSON.stringify({content:next,revision})});revision=result.revision;data=next;render();message('Настройки сохранены на сервере.');}catch(error){message(error.message);}};
$('#userForm').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget;try{await api.call('admin/users',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.reset();await page('users');message('Пользователь создан.');}catch(error){message(error.message);}};
$('#export').onclick=()=>{
  const cell=v=>'"'+String(/^[\s]*[=+\-@]/.test(String(v))?"'"+v:v).replaceAll('"','""')+'"';
  const csv='\ufeff'+[['Компания','Тариф','Статус','MRR','Дата'],...filtered().map(c=>[c.name,c.plan,labels[c.status],c.mrr,c.date])].map(r=>r.map(cell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='metric-customers.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
load();
