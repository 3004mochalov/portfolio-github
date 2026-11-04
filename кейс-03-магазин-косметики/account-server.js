window.ServerAccount = {
  async open(core, show) {
    const api=PortfolioAPI, esc=core.escape;
    if (!api.token) {
      show('<p class="eyebrow">Серверный кабинет</p><h2 id="customerTitle">Добро пожаловать</h2><form id="serverAuth"><label>Имя (при регистрации)<input name="name" autocomplete="name"></label><label>Почта<input name="email" type="email" required autocomplete="username"></label><label>Пароль<input name="password" type="password" required autocomplete="current-password"></label><p>Для регистрации используйте пароль от 12 символов.</p><p id="authError" role="alert"></p><button class="button button-dark" name="action" value="login">Войти</button> <button class="button" name="action" value="register">Зарегистрироваться</button></form>');
      document.querySelector('#serverAuth').onsubmit=async e=>{
        e.preventDefault();const form=e.currentTarget, body=Object.fromEntries(new FormData(form));
        const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
        try {
          if(e.submitter?.value==='register')await api.call('register',{method:'POST',body:JSON.stringify(body)});
          await api.login(body.email,body.password);await this.open(core,show);
        }catch(error){document.querySelector('#authError').textContent=error.message;}
        finally{buttons.forEach(b=>b.disabled=false);}
      };return;
    }
    try {
      const [profile,history]=await Promise.all([api.call('me'),api.call('my-orders')]);
      show(`<p class="eyebrow">Серверный кабинет</p><h2 id="customerTitle">${esc(profile.user.name)}</h2><p>${esc(profile.user.email)}</p><button class="button" id="accountLogout">Выйти</button><section class="detail-block"><h3>Мои заказы</h3>${history.records.length?history.records.map(r=>`<article class="order-history"><strong>STORE-${r.id} · ${core.money(r.body.total)}</strong><p>${esc(({new:'Новый',processing:'В обработке',done:'Завершён',cancelled:'Отменён'})[r.status])}</p><p>${r.body.items.map(p=>esc(p.name)+' × '+p.qty).join(', ')}</p></article>`).join(''):'<p>Заказов пока нет. Заказы, оформленные после входа, появятся здесь.</p>'}</section><p>Онлайн-оплата и реальная программа лояльности не подключены.</p>`);
      document.querySelector('#accountLogout').onclick=async()=>{await api.logout();await this.open(core,show);};
    } catch(error) {show(`<h2 id="customerTitle">Не удалось открыть кабинет</h2><p>${esc(error.message)}</p><button class="button" id="accountRetry">Войти заново</button>`);document.querySelector('#accountRetry').onclick=async()=>{try{await api.logout();}catch{}await this.open(core,show);};}
  }
};
