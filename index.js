/* ==========================================================================
   Risveglio · 统一剧情智能面板（SillyTavern 第三方扩展）
   视觉：冷静 / 深邃 / 精密 / 未来感 / 运行中的生命感
        —— 黑灰米白骨架，识别色（强调色）暂未定，先留 --ris-accent 占位
   结构：底部悬浮胶囊 Dock（Risveglio 的视觉标志）+ 多页；当前为空白框架。
   ========================================================================== */

const extensionName = 'risveglio';
const VERSION = '1.0.0'; // 面板标题旁展示，更新时与 manifest.json 同步（版本每满 20 进位）

// ---------------- 图标（线性极简，技术感几何形） ----------------
const ICONS = {
    square: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>',
    circle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="7"/></svg>',
    diamond: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 4l7 8-7 8-7-8z"/></svg>',
    hex: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3l7.5 4.3v8.4L12 20l-7.5-4.3V7.3z"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

// ---------------- 页签定义（占位；后续改名/加页/减页只需改这里） ----------------
// 结构天然支持 [icon][label][badge?][active]；badge 可选，加 "badge: 'x'" 即显示。
const PAGES = [
    { id: 'm1', icon: ICONS.square,  name: '模块 1', code: 'MODULE 01' },
    { id: 'm2', icon: ICONS.circle,  name: '模块 2', code: 'MODULE 02' },
    { id: 'm3', icon: ICONS.diamond, name: '模块 3', code: 'MODULE 03' },
    { id: 'm4', icon: ICONS.hex,     name: '模块 4', code: 'MODULE 04' },
];

// ---------------- 面板 ----------------
function switchPage(name) {
    const panel = $('#st-risveglio');
    if (!panel.length) return;
    panel.find('.ris__page').removeClass('is-on').filter(`[data-page="${name}"]`).addClass('is-on');
    panel.find('.ris__dock-btn').removeClass('is-on').filter(`[data-page="${name}"]`).addClass('is-on');
}

function buildPanel() {
    if ($('#st-risveglio').length) return;
    const pages = PAGES.map((p, i) => `
        <section class="ris__page${i === 0 ? ' is-on' : ''}" data-page="${p.id}">
          <div class="ris__empty">
            <div class="ris__empty-code">${p.code}</div>
            <div class="ris__empty-msg">No system loaded.</div>
          </div>
        </section>`).join('');
    const dock = PAGES.map((p, i) => `
        <button type="button" class="ris__dock-btn${i === 0 ? ' is-on' : ''}" data-page="${p.id}" title="${p.name}">
          ${p.icon}
          <span class="ris__dock-label">${p.name}</span>
          ${p.badge ? `<span class="ris__dock-badge">${p.badge}</span>` : ''}
        </button>`).join('');
    const html = `
    <div id="st-risveglio" class="ris" style="display:none">
      <div class="ris__head">
        <div class="ris__brand">
          <span class="ris__brand-name">RISVEGLIO</span>
          <span class="ris__brand-ver">v${VERSION}</span>
        </div>
        <div class="ris__head-right">
          <div class="ris__status"><span class="ris__status-dot"></span><span class="ris__status-text">STANDBY</span></div>
          <button type="button" class="ris__close" title="关闭">${ICONS.close}</button>
        </div>
      </div>

      <div class="ris__body">${pages}</div>

      <div class="ris__dock">
        <div class="ris__dock-scroll">${dock}</div>
        <button type="button" class="ris__dock-more" title="扩展入口（待定）">${ICONS.more}</button>
      </div>
    </div>`;
    $('body').append(html);
}

function fitPanelToViewport() {
    // 面板由 CSS 固定铺满全屏，这里只清除可能残留的内联定位。
    const panel = $('#st-risveglio');
    if (!panel.length) return;
    panel.css({ top: '', bottom: '', left: '', right: '', width: '', maxWidth: '', maxHeight: '' });
}

function togglePanel(force) {
    const panel = $('#st-risveglio');
    if (!panel.length) return;
    const show = force === undefined ? !panel.is(':visible') : force;
    if (show) {
        fitPanelToViewport();
        panel.show();
    } else {
        panel.hide();
    }
    // 打开面板时给 body 打标记，用于移动端恢复触摸滚动（ST 移动端给 body 设了 touch-action:none）
    document.body.classList.toggle('st-risveglio-open', show);
}

// ---------------- 顶栏入口按钮 ----------------
function buildButton() {
    const btn = $(`
        <div id="st-risveglio-button" class="drawer" title="Risveglio" tabindex="0" role="button">
            <div class="drawer-icon fa-solid fa-circle-nodes fa-fw closedIcon interactable" title="Risveglio"></div>
        </div>`);
    btn.on('click', () => togglePanel());
    // 插入顶栏按钮群：排在 AI 配置按钮后面；找不到再逐级回退
    const anchor = $('#ai-config-button');
    if (anchor.length) anchor.after(btn);
    else {
        const holder = $('#top-settings-holder');
        if (holder.length) holder.append(btn);
        else {
            const menu = $('#extensionsMenu');
            if (menu.length) menu.append(btn);
            else $('body').append(btn);
        }
    }
}

// ---------------- 初始化 ----------------
jQuery(async () => {
    buildButton();
    buildPanel();

    const panel = $('#st-risveglio');
    panel.find('.ris__dock-btn').on('click', function () { switchPage($(this).data('page')); });
    panel.find('.ris__close').on('click', () => togglePanel(false));

    $(window).on('resize.st-risveglio', fitPanelToViewport);
    $(window).on('orientationchange.st-risveglio', () => setTimeout(fitPanelToViewport, 300));
});

// ST 自动更新扩展后会调用 manifest.hooks.update 指向的这个函数（此时新代码已 git pull 到磁盘），
// 在这里刷新页面以加载新版本，无需手动刷新。
export function reloadOnUpdate() {
    toastr.info('Risveglio 已更新，正在刷新页面以应用新版本...', undefined, { timeOut: 1500 });
    setTimeout(() => location.reload(), 1500);
}
