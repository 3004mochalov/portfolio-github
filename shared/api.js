/* Public GitHub Pages edition: seed data only, no server probing or login. */
window.PortfolioAPI = {
  ready: Promise.resolve(false),
  online: false,
  token: '',
  async content(_key, filename) {
    const response = await fetch(filename);
    if (!response.ok) throw new Error('Не удалось загрузить демонстрацию. Обновите страницу.');
    return response.json();
  },
  async call() { throw new Error('Управление доступно в серверной версии проекта.'); },
  async submit() { throw new Error('Демонстрация не отправляет заявки.'); }
};
