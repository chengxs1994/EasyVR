import { initializeI18n, refreshTitle } from './i18n.js';
import './i18n.css';
initializeI18n();
/** 独立路由只加载全景取景、住宅浏览或空间推演，无短剧工作台依赖。 */
async function start() {
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('tour') === 'ai-demo') await (await import('./tour/index.js')).ready;
    else if (params.get('tour') === 'home') await import('./panorama/home-view.js');
    else if (params.has('editor')) await import('./main.js');
    else await import('./panorama/index.js');
    refreshTitle();
  } catch (error) {
    document.getElementById('app').textContent = `页面未能打开：${error.message}`;
  }
}
start();
