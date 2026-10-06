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
    // ---------------- 适配层（防火墙） ----------------
    // Runtime 只通过 window.Risveglio.adapters.* 读上游，绝不直接碰 window.Serendipity / window.Amor / 聊天 API。
    // Promise.allSettled 动态加载：任一 adapter 解析失败都只降级、不产生未处理 Promise rejection，也不拖垮面板壳（Contract §11）。
    const settled = await Promise.allSettled([
        import('./adapters/serendipity.js'),
        import('./adapters/amor.js'),
        import('./adapters/chat.js'),
        import('./adapters/capability.js'),
        import('./runtime/revision.js'),
        import('./runtime/entry.js'),
        import('./runtime/trigger.js'),
    ]);
    window.Risveglio = window.Risveglio || {};
    window.Risveglio.adapters = window.Risveglio.adapters || {};
    if (settled[0].status === 'fulfilled') window.Risveglio.adapters.serendipity = settled[0].value.SerendipityAdapter;
    else console.warn('[Risveglio] SerendipityAdapter 加载失败，已降级：', settled[0].reason);
    if (settled[1].status === 'fulfilled') window.Risveglio.adapters.amor = settled[1].value.AmorAdapter;
    else console.warn('[Risveglio] AmorAdapter 加载失败，已降级：', settled[1].reason);
    if (settled[2].status === 'fulfilled') window.Risveglio.adapters.chat = settled[2].value.ChatAdapter;
    else console.warn('[Risveglio] ChatAdapter 加载失败，已降级：', settled[2].reason);

    // Capability Probe：只检测能力、不启动能力（Contract §8）。产出 Adapter Matrix 供 Runtime 初始化用。
    if (settled[3].status === 'fulfilled') {
        try {
            window.Risveglio.matrix = settled[3].value.runCapabilityProbe(window.Risveglio.adapters);
        } catch (err) {
            console.warn('[Risveglio] Capability Probe 失败：', err);
        }
    } else {
        console.warn('[Risveglio] Capability Probe 模块加载失败：', settled[3].reason);
    }
    if (window.Risveglio.matrix) {
        console.log('[Risveglio] Adapter Matrix:', window.Risveglio.matrix);
    }

    // Runtime Revision v1：Adapter 状态 → 稳定指纹 → changed。只比较、不解释（Phase 2）。
    if (settled[4].status === 'fulfilled') {
        window.Risveglio.revision = {
            compute: () => settled[4].value.computeRevision(window.Risveglio.adapters, window.Risveglio.matrix),
            last: () => settled[4].value.lastRevision(),
        };
        try {
            const baseline = window.Risveglio.revision.compute();
            console.log('[Risveglio] Revision baseline:', baseline);
        } catch (err) {
            console.warn('[Risveglio] Revision 基线计算失败：', err);
        }
    } else {
        console.warn('[Risveglio] Runtime Revision 模块加载失败：', settled[4].reason);
    }

    // Core AI 配置（Phase 6）：第三套独立 API（url/model/key）+ 生成 tokenBudget。默认禁用。
    // 暂不接 UI/持久化，未来由设置页写入 window.Risveglio.coreConfig。
    window.Risveglio.coreConfig = window.Risveglio.coreConfig || {
        enabled: false,
        api: { url: '', key: '', model: '' },
        tokenBudget: 0,
    };

    // Runtime Entry（Phase 6）：computeRevision → NO CHANGE Gate → stop / (continue → Context → World → Actor → Guard → Core Input)。
    // run() 只做确定性组装（到 Core Input），generate() 是独立显式步骤（唯一发请求/非确定的位置）。
    if (settled[5].status === 'fulfilled') {
        window.Risveglio.runtime = {
            run: () => settled[5].value.run(window.Risveglio.adapters, window.Risveglio.matrix, window.Risveglio.coreConfig),
            generate: (coreInput) => settled[5].value.generateCore(coreInput, window.Risveglio.coreConfig),
            assemble: () => settled[5].value.assembleContext(window.Risveglio.adapters, window.Risveglio.matrix),
            world: (ctx) => settled[5].value.assembleWorld(ctx),
            actor: (ctx, world) => settled[5].value.assembleActor(ctx, world),
            guard: (world, actor) => settled[5].value.assembleGuard(world, actor),
        };
        try {
            const decision = window.Risveglio.runtime.run();
            console.log('[Risveglio] Runtime gate (init, 预期 no_change):', decision);
        } catch (err) {
            console.warn('[Risveglio] Runtime gate 运行失败：', err);
        }
    } else {
        console.warn('[Risveglio] Runtime Entry 模块加载失败：', settled[5].reason);
    }

    // Trigger（Phase 8）：Runtime 唤醒编排层。只暴露手动 window.Risveglio.trigger()，
    // 合并并发触发、调用既有 runtime.run()；不比较指纹、不自动生成、不接 ST 自动事件。
    if (settled[6].status === 'fulfilled') {
        window.Risveglio.trigger = () => settled[6].value.trigger(
            settled[5].value?.run,
            window.Risveglio.adapters,
            window.Risveglio.matrix,
            window.Risveglio.coreConfig,
        );
    } else {
        console.warn('[Risveglio] Trigger 模块加载失败：', settled[6].reason);
    }

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
