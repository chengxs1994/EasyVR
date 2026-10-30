import layout from './layout.html?raw';

// 路由独立挂载界面，再初始化编辑与导览，沿用 EasyVR 的页面入口。
document.getElementById('app').innerHTML = layout;
export const ready = import('./main.js');
