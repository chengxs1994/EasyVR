import english from './locales/en.js';

export const LANGUAGE_KEY = 'easyvr.ui.language';
export const LANGUAGES = ['zh-CN', 'en'];
let language = 'zh-CN';
const spacing = new WeakMap();

/** 不支持的语言明确回退到中文，兼容存档中的无效配置。 */
export function normalizeLanguage(value) {
  return LANGUAGES.includes(value) ? value : 'zh-CN';
}
/** 只翻译显式声明的界面文案；未知文本和创作内容原样返回。 */
export function translate(key, locale = language) {
  return normalizeLanguage(locale) === 'en' ? english[key] || key : key;
}
/** HTML 文本与属性统一转义，避免名称或文案成为标记。 */
export function escapeUI(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
/** 输出可原位切换语言的显式 UI 标签；不要用于剧本或用户名称。 */
export function uiText(key) {
  return `<span data-ui="${escapeUI(key)}">${escapeUI(translate(key))}</span>`;
}
/** 从浏览器读取语言偏好；存储被禁用时仍可使用默认界面。 */
export function readLanguage(storage) {
  try { return normalizeLanguage(storage.getItem(LANGUAGE_KEY)); } catch { return 'zh-CN'; }
}
/** 保存语言偏好；隐私模式或存储已满时允许当前页面继续切换。 */
export function saveLanguage(storage, value) {
  try { storage.setItem(LANGUAGE_KEY, normalizeLanguage(value)); return true; } catch { return false; }
}
/** 翻译显式标记的节点及无障碍属性，不扫描输入值或未标记的用户内容。 */
export function localizeElement(element) {
  if (element.hasAttribute('data-ui')) {
    if (!spacing.has(element)) {
      const original = element.textContent;
      spacing.set(element, [original.match(/^\s*/)[0], original.match(/\s*$/)[0]]);
    }
    const [before, after] = spacing.get(element);
    const text = before + translate(element.getAttribute('data-ui')) + after;
    if (element.textContent !== text) element.textContent = text;
  }
  for (const attr of ['title', 'placeholder', 'aria-label']) {
    const key = element.getAttribute(`data-ui-${attr}`);
    if (key !== null && element.getAttribute(attr) !== translate(key)) element.setAttribute(attr, translate(key));
  }
}
const selector = '[data-ui],[data-ui-title],[data-ui-placeholder],[data-ui-aria-label]';
/** 按新增或变化的子树更新，避免预演每帧扫描整个导演台。 */
function localizeTree(root) {
  if (root.nodeType !== 1) return;
  if (root.matches(selector)) localizeElement(root);
  root.querySelectorAll(selector).forEach(localizeElement);
}
/** 各独立页面使用当前语言的标题，不把项目名称混入翻译词典。 */
export function refreshTitle() {
  const params = new URLSearchParams(location.search);
  const key = params.has('editor') ? '空间推演' : params.get('tour') === 'home' ? '住宅实景' : params.has('panorama') ? '全景场景取景器' : '全景场景取景器';
  document.title = `EasyVR · ${translate(key)}`;
}
/** 原位切换界面语言，保留未保存输入、焦点、机位和预演状态。 */
export function setLanguage(value) {
  language = normalizeLanguage(value);
  try { saveLanguage(localStorage, language); } catch { /* 禁用存储不阻止切换。 */ }
  document.documentElement.lang = language;
  refreshTitle();
  localizeTree(document.body);
  document.querySelectorAll('[data-language-picker]').forEach(el => { el.value = language; });
}
/** 在每种工作区的公共栏挂载仓库与语言入口，页面重绘后自动恢复。 */
function mountTools() {
  const host = document.querySelector('.wb-topbar, .header-actions, .pano-app > header, .home-links');
  if (!host || host.querySelector('.global-tools')) return;
  const tools = document.createElement('div');
  tools.className = 'global-tools';
  tools.innerHTML = `<label class="language-control"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg><select data-language-picker aria-label="界面语言" data-ui-aria-label="界面语言"><option value="zh-CN">简体中文</option><option value="en">English</option></select></label>`;
  tools.querySelector('select').value = language;
  tools.addEventListener('change', event => { if (event.target.matches('[data-language-picker]')) setLanguage(event.target.value); });
  host.append(tools);
  localizeTree(tools);
}
/** 统一启动多语言观察器，只处理源码中主动标记的 UI，后续弹窗同样生效。 */
export function initializeI18n() {
  try { language = readLanguage(localStorage); } catch { language = 'zh-CN'; }
  document.documentElement.lang = language;
  const observer = new MutationObserver(records => {
    const roots = new Set();
    for (const record of records) {
      if (record.type === 'attributes') roots.add(record.target);
      else for (const node of record.addedNodes) if (node.nodeType === 1) roots.add(node);
    }
    roots.forEach(localizeTree);
    mountTools();
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ui','data-ui-title','data-ui-placeholder','data-ui-aria-label'] });
  localizeTree(document.body);
  mountTools();
  refreshTitle();
  return observer;
}
