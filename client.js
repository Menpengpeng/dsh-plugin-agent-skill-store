// Agent Skill 商店客户端：侧边栏入口 + 主面板（浏览/搜索/推荐/收藏/详情/评分笔记）。
// 所有个人数据都来自 Host 端本机存储，这里不做任何外部请求。
window.__ModuleLoader__.load({
  id: '@local/dsh-plugin-agent-skill-store',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useRef, useState } = React;

    const API = '/api/agent-skill-store';
    /** 每页条数的兜底值；实际值以 Host 下发的 meta.pageSize 为准。 */
    const DEFAULT_PAGE_SIZE = 48;

    const css = `
      .ss-page{height:100%;overflow:auto;padding:0 24px 48px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);box-sizing:border-box}
      .ss-head{position:sticky;top:0;z-index:6;display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:54px;margin:0 -24px 16px;padding:0 24px;background:var(--dsw-alias-bg-base);border-bottom:1px solid var(--dsw-alias-border-l1)}
      .ss-head h1{margin:0;font-size:17px;font-weight:650;display:flex;align-items:center;gap:8px}
      .ss-count{font-size:11px;font-weight:500;color:var(--dsw-alias-label-secondary);padding:2px 8px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1)}
      .ss-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      .ss-btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:7px;padding:7px 11px;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:6px;line-height:1.2}
      .ss-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .ss-btn.primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border:0}
      .ss-btn.primary:hover{opacity:.9}
      .ss-btn:disabled{opacity:.5;cursor:default}
      .ss-btn.sm{padding:4px 8px;font-size:12px;border-radius:6px}
      .ss-muted{color:var(--dsw-alias-label-secondary);font-size:12px}
      .ss-caption{color:var(--dsw-alias-label-caption);font-size:11px}
      .ss-error{padding:10px 14px;border-radius:9px;margin-bottom:14px;font-size:13px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent);border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 35%,transparent);color:var(--dsw-alias-state-error-primary)}
      .ss-ok{padding:10px 14px;border-radius:9px;margin-bottom:14px;font-size:13px;background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 12%,transparent);border:1px solid color-mix(in srgb,var(--dsw-alias-state-success-primary) 35%,transparent);color:var(--dsw-alias-state-success-primary)}

      /* 概览（已移入「来源分布」标签页） */
      .ss-ov-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:10px}
      .ss-ov-head h2{margin:0;font-size:13px;font-weight:600}
      .ss-bar{display:flex;height:10px;border-radius:999px;overflow:hidden;background:var(--dsw-alias-bg-layer-2);margin-bottom:10px}
      .ss-bar span{display:block;height:100%;cursor:pointer;transition:opacity .12s}
      .ss-bar span:hover{opacity:.78}
      .ss-src-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:6px 14px}
      .ss-src{display:flex;align-items:center;gap:7px;font-size:12px;padding:3px 6px;border-radius:6px;cursor:pointer;border:1px solid transparent}
      .ss-src:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .ss-src.on{border-color:var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2)}
      .ss-src-dot{width:9px;height:9px;border-radius:3px;flex:none}
      .ss-src-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .ss-src-num{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary);font-size:11px}
      .ss-cat-chart{display:flex;flex-direction:column;gap:5px;margin-top:12px;padding-top:12px;border-top:1px solid var(--dsw-alias-border-l1)}
      .ss-cat-row{display:grid;grid-template-columns:minmax(120px,200px) 1fr 46px;gap:9px;align-items:center;font-size:11px;cursor:pointer;padding:2px 4px;border-radius:5px}
      .ss-cat-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .ss-cat-row.on{background:var(--dsw-alias-bg-layer-2)}
      .ss-cat-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary)}
      .ss-cat-track{height:7px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}
      .ss-cat-fill{height:100%;border-radius:999px;background:var(--dsw-alias-button-primary-fill)}
      .ss-cat-num{text-align:right;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-caption)}

      /* 发现区 */
      .ss-discover{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);margin-bottom:16px;overflow:hidden}
      .ss-tabs{display:flex;gap:2px;padding:8px 10px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}
      .ss-tab{border:0;background:none;color:var(--dsw-alias-label-secondary);padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:2px solid transparent;margin-bottom:-1px;border-radius:6px 6px 0 0}
      .ss-tab:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
      .ss-tab.on{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-button-primary-fill);font-weight:600}
      .ss-tab-body{padding:14px 16px}
      .ss-ai-row{display:flex;gap:8px;margin-bottom:9px}
      .ss-input{flex:1;min-width:0;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px 11px;font-size:13px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:inherit;box-sizing:border-box}
      .ss-input:focus{outline:none;border-color:var(--dsw-alias-button-primary-fill)}
      .ss-examples{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
      .ss-example{border:1px dashed var(--dsw-alias-border-l2);background:none;color:var(--dsw-alias-label-secondary);border-radius:999px;padding:4px 10px;font-size:11px;cursor:pointer;line-height:1.5}
      .ss-example:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l3);background:var(--dsw-alias-interactive-bg-hover)}
      .ss-pairing{margin-top:11px;padding:9px 12px;border-radius:8px;font-size:12px;line-height:1.6;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary)}
      .ss-roles{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
      .ss-role{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:5px 12px;font-size:12px;cursor:pointer;line-height:1.4}
      .ss-role:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
      .ss-role.on{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border-color:transparent;font-weight:600}

      /* 主体布局 */
      .ss-layout{display:grid;grid-template-columns:190px minmax(0,1fr);gap:20px;align-items:start}
      @media (max-width:980px){.ss-layout{grid-template-columns:minmax(0,1fr)}}
      .ss-side{border:1px solid var(--dsw-alias-border-l1);border-radius:11px;background:var(--dsw-alias-bg-layer-1);padding:10px 0;position:sticky;top:70px;max-height:calc(100vh - 100px);overflow:auto}
      @media (max-width:980px){.ss-side{position:static;max-height:none;display:none}.ss-side.open{display:block}}
      .ss-side-group{padding:4px 12px 8px}
      .ss-side-title{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--dsw-alias-label-caption);margin:6px 0 5px;font-weight:600}
      .ss-side-item{display:flex;justify-content:space-between;align-items:center;gap:6px;padding:5px 8px;border-radius:6px;font-size:12px;cursor:pointer;color:var(--dsw-alias-label-secondary);border:1px solid transparent;line-height:1.35}
      .ss-side-item:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
      .ss-side-item.on{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);font-weight:600}
      .ss-side-item span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .ss-side-num{font-variant-numeric:tabular-nums;font-size:10px;color:var(--dsw-alias-label-caption);flex:none}

      /* 工具条 */
      .ss-toolbar{display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap}
      .ss-search{position:relative;flex:1;min-width:190px}
      .ss-search .ss-input{width:100%;padding-left:30px}
      .ss-search-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:12px;color:var(--dsw-alias-label-caption);pointer-events:none}
      .ss-tags{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px}
      .ss-tag{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:3px 10px;font-size:11px;cursor:pointer;line-height:1.5}
      .ss-tag:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
      .ss-tag.on{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border-color:transparent;font-weight:600}
      .ss-active-filters{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:11px}
      .ss-chip{display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:3px 9px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary)}
      .ss-chip button{border:0;background:none;color:inherit;cursor:pointer;padding:0;font-size:12px;line-height:1;opacity:.7}
      .ss-chip button:hover{opacity:1}

      /* 卡片网格 */
      .ss-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:12px}
      .ss-card{border:1px solid var(--dsw-alias-border-l1);border-radius:11px;background:var(--dsw-alias-bg-layer-1);padding:13px 14px;display:flex;flex-direction:column;gap:7px;transition:border-color .12s,box-shadow .12s}
      .ss-card:hover{border-color:var(--dsw-alias-border-l3);box-shadow:0 2px 10px rgba(0,0,0,.06)}
      .ss-card-top{display:flex;gap:10px;align-items:flex-start}
      .ss-avatar{width:32px;height:32px;border-radius:8px;flex:none;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;line-height:1;user-select:none}
      .ss-card-main{min-width:0;flex:1}
      .ss-card-name{margin:0;font-size:13px;font-weight:650;line-height:1.35;cursor:pointer;word-break:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .ss-card-name:hover{color:var(--dsw-alias-button-primary-fill);text-decoration:underline}
      .ss-card-cat{font-size:10px;color:var(--dsw-alias-label-caption);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .ss-card-desc{margin:0;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;min-height:3.1em}
      .ss-card-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:auto;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l1)}
      .ss-src-tag{display:inline-flex;align-items:center;gap:5px;font-size:10px;color:#fff;padding:2px 7px;border-radius:999px;line-height:1.6;max-width:130px;overflow:hidden}
      .ss-src-tag span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .ss-card-btns{display:flex;gap:4px;align-items:center}
      .ss-icon-btn{border:1px solid transparent;background:none;cursor:pointer;padding:4px 6px;border-radius:6px;font-size:13px;line-height:1;color:var(--dsw-alias-label-caption)}
      .ss-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
      .ss-icon-btn.on{color:#e0a800}
      .ss-rating-badge{font-size:10px;padding:2px 6px;border-radius:5px;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 16%,transparent);color:var(--dsw-alias-state-warn-primary);border:1px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary) 32%,transparent);line-height:1.5;white-space:nowrap}
      .ss-new-badge{font-size:9px;padding:1px 5px;border-radius:4px;background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 16%,transparent);color:var(--dsw-alias-state-success-primary);border:1px solid color-mix(in srgb,var(--dsw-alias-state-success-primary) 32%,transparent);line-height:1.6}

      .ss-more{display:flex;justify-content:center;padding:18px 0 4px}
      .ss-empty{text-align:center;padding:44px 20px;color:var(--dsw-alias-label-secondary);font-size:13px}
      .ss-empty h3{margin:0 0 6px;font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}
      .ss-empty p{margin:0;font-size:12px;line-height:1.6}

      /* 详情侧栏 */
      .ss-overlay{position:fixed;inset:0;background:rgba(0,0,0,.34);z-index:40;display:flex;justify-content:flex-end;animation:ss-fade .14s ease-out}
      @keyframes ss-fade{from{opacity:0}to{opacity:1}}
      .ss-panel{width:min(520px,100%);height:100%;background:var(--dsw-alias-bg-base);border-left:1px solid var(--dsw-alias-border-l2);display:flex;flex-direction:column;animation:ss-slide .18s ease-out;box-shadow:-6px 0 24px rgba(0,0,0,.14)}
      @keyframes ss-slide{from{transform:translateX(24px);opacity:.6}to{transform:translateX(0);opacity:1}}
      .ss-panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:16px 18px 12px;border-bottom:1px solid var(--dsw-alias-border-l1)}
      .ss-panel-title{margin:0;font-size:15px;font-weight:650;line-height:1.35;word-break:break-word}
      .ss-panel-body{flex:1;overflow:auto;padding:16px 18px 28px}
      .ss-close{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);border-radius:7px;cursor:pointer;font-size:14px;line-height:1;padding:5px 9px;flex:none}
      .ss-close:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
      .ss-block{margin-bottom:18px}
      .ss-block>h3{margin:0 0 7px;font-size:11px;font-weight:600;color:var(--dsw-alias-label-caption);text-transform:uppercase;letter-spacing:.05em}
      .ss-block p{margin:0;font-size:13px;line-height:1.65;color:var(--dsw-alias-label-primary);word-break:break-word}
      .ss-kv{display:grid;grid-template-columns:78px 1fr;gap:6px 10px;font-size:12px;line-height:1.6}
      .ss-kv dt{color:var(--dsw-alias-label-caption)}
      .ss-kv dd{margin:0;color:var(--dsw-alias-label-primary);word-break:break-all}
      .ss-kv dd a{color:var(--dsw-alias-button-primary-fill);text-decoration:none}
      .ss-kv dd a:hover{text-decoration:underline}
      .ss-cmd{position:relative;display:flex;align-items:center;gap:8px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:9px 10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;line-height:1.5;word-break:break-all}
      .ss-cmd code{flex:1;min-width:0;color:var(--dsw-alias-label-primary)}
      .ss-note-hint{font-size:11px;line-height:1.6;color:var(--dsw-alias-label-secondary);margin-top:7px}
      .ss-stars{display:flex;gap:3px;margin-bottom:8px}
      .ss-star{border:0;background:none;cursor:pointer;font-size:19px;line-height:1;padding:0 1px;color:var(--dsw-alias-border-l3);transition:color .1s}
      .ss-star.on{color:#e0a800}
      .ss-star:hover{color:#e0a800}
      .ss-textarea{width:100%;min-height:74px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px 10px;font-size:12px;line-height:1.6;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:inherit;resize:vertical;box-sizing:border-box}
      .ss-textarea:focus{outline:none;border-color:var(--dsw-alias-button-primary-fill)}
      .ss-similar{display:flex;flex-direction:column;gap:2px}
      .ss-similar-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:7px;cursor:pointer;font-size:12px;border:1px solid transparent}
      .ss-similar-item:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l1)}
      .ss-similar-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .ss-spinner{display:inline-block;width:12px;height:12px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:ss-spin .7s linear infinite}
      @keyframes ss-spin{to{transform:rotate(360deg)}}
    `;

    /**
     * 样式以 React 元素形式挂在组件树里，而不是工厂执行时写进 document.head。
     * 这样组件卸载（槽位折叠、插件卸载）时样式随节点一起移除，不会残留累积。
     */
    function Styles() {
      return h('style', { 'data-agent-skill-store': '' }, css);
    }

    // ---------------------------------------------------------------- 工具
    /** 侧边栏图标 */
    function Icon() {
      return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' },
        h('rect', { x: 3, y: 3, width: 18, height: 18, rx: 4 }),
        h('path', { d: 'M7 8h6M7 12h10M7 16h5' }));
    }

    async function api(path, options) {
      const res = await fetch(`${API}${path}`, options);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `请求失败（HTTP ${res.status}）`);
      return data;
    }

    function post(body) {
      return api('', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    /** 取名字首字：中文取第一个字符，英文取首字母大写。 */
    function initials(name) {
      const text = String(name || '').trim();
      if (!text) return '?';
      const ch = text[0];
      return /[a-z]/.test(ch) ? ch.toUpperCase() : ch;
    }

    function copyText(text) {
      if (!text) return Promise.resolve(false);
      if (navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
      }
      // 兼容无剪贴板权限的环境
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return Promise.resolve(ok);
      } catch {
        return Promise.resolve(false);
      }
    }

    // ---------------------------------------------------------------- 卡片
    function SkillCard({ skill, source, favorited, note, onOpen, onToggleFav, onCopy, onVisit }) {
      const rating = note?.rating;
      return h('article', { className: 'ss-card' },
        h('div', { className: 'ss-card-top' },
          h('div', {
            className: 'ss-avatar',
            style: { background: source.color },
            'aria-hidden': 'true',
          }, initials(skill.name)),
          h('div', { className: 'ss-card-main' },
            h('h3', {
              className: 'ss-card-name',
              title: skill.name,
              onClick: () => onOpen(skill),
              role: 'button',
              tabIndex: 0,
              onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(skill); } },
            }, skill.name),
            h('div', { className: 'ss-card-cat', title: skill.category }, skill.category))),
        h('p', { className: 'ss-card-desc', title: skill.desc }, skill.desc || '（暂无描述）'),
        h('div', { className: 'ss-card-foot' },
          h('div', { style: { display: 'flex', gap: '5px', alignItems: 'center', minWidth: 0, flexWrap: 'wrap' } },
            h('span', { className: 'ss-src-tag', style: { background: source.color }, title: source.label },
              h('span', null, source.label)),
            skill.untranslated ? h('span', { className: 'ss-new-badge', title: '这条是同步新增的，描述尚未翻译' }, '待翻译') : null,
            rating ? h('span', { className: 'ss-rating-badge', title: note?.note ? `我的笔记：${note.note}` : '我的评分' }, `我的评分 ${rating}★`) : null),
          h('div', { className: 'ss-card-btns' },
            h('button', {
              className: `ss-icon-btn ${favorited ? 'on' : ''}`,
              title: favorited ? '取消收藏' : '收藏',
              'aria-label': favorited ? '取消收藏' : '收藏',
              'aria-pressed': favorited ? 'true' : 'false',
              onClick: () => onToggleFav(skill),
            }, favorited ? '★' : '☆'),
            h('button', { className: 'ss-icon-btn', title: '复制链接', 'aria-label': '复制链接', onClick: () => onCopy(skill) }, '⧉'),
            h('button', { className: 'ss-icon-btn', title: '打开原始链接', 'aria-label': '打开原始链接', onClick: () => onVisit(skill) }, '↗'))));
    }

    // ---------------------------------------------------------------- 推荐卡片
    // AI 推荐与角色推荐共用：结构比浏览卡片简洁，只保留理由/描述与两个动作。
    function PickCard({ skill, source, favorited, showReason, onOpen, onToggleFav, onCopy }) {
      const line = showReason && skill.reason ? skill.reason : skill.desc;
      return h('article', { className: 'ss-card' },
        h('div', { className: 'ss-card-top' },
          h('div', { className: 'ss-avatar', style: { background: source.color }, 'aria-hidden': 'true' }, initials(skill.name)),
          h('div', { className: 'ss-card-main' },
            h('h3', {
              className: 'ss-card-name',
              title: skill.name,
              onClick: () => onOpen(skill),
              role: 'button',
              tabIndex: 0,
              onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(skill); } },
            }, skill.name),
            h('div', { className: 'ss-card-cat', title: skill.category }, skill.category))),
        h('p', { className: 'ss-card-desc', title: line }, line || '（暂无描述）'),
        h('div', { className: 'ss-card-foot' },
          h('span', { className: 'ss-src-tag', style: { background: source.color }, title: source.label },
            h('span', null, source.label)),
          h('div', { className: 'ss-card-btns' },
            h('button', {
              className: `ss-icon-btn ${favorited ? 'on' : ''}`,
              title: favorited ? '取消收藏' : '收藏',
              'aria-label': favorited ? '取消收藏' : '收藏',
              onClick: () => onToggleFav(skill),
            }, favorited ? '★' : '☆'),
            h('button', { className: 'ss-icon-btn', title: '复制链接', 'aria-label': '复制链接', onClick: () => onCopy(skill) }, '⧉'))));
    }

    // ---------------------------------------------------------------- 详情面板
    function DetailPanel({ skill, source, installState, onInstall, favorited, note, similar, onClose, onToggleFav, onOpen, onSaveNote, onDeleteNote, onCopy }) {
      const [rating, setRating] = useState(note?.rating || 0);
      const [text, setText] = useState(note?.note || '');
      const [saving, setSaving] = useState(false);
      const [saved, setSaved] = useState('');
      const panelRef = useRef(null);

      useEffect(() => {
        setRating(note?.rating || 0);
        setText(note?.note || '');
        setSaved('');
      }, [skill.id]);

      // Esc 关闭
      useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [onClose]);

      useEffect(() => { panelRef.current?.focus(); }, [skill.id]);

      const install = skill.install || {};

      const save = async () => {
        if (!rating) { setSaved('请先选择评分'); return; }
        setSaving(true);
        try {
          await onSaveNote(skill, rating, text);
          setSaved('已保存');
        } catch (error) {
          setSaved(`保存失败：${error.message}`);
        } finally {
          setSaving(false);
        }
      };

      return h('div', { className: 'ss-overlay', onClick: onClose, role: 'presentation' },
        h('aside', {
          className: 'ss-panel',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': `skill 详情：${skill.name}`,
          tabIndex: -1,
          ref: panelRef,
          onClick: (e) => e.stopPropagation(),
        },
          h('div', { className: 'ss-panel-head' },
            h('div', { style: { minWidth: 0 } },
              h('h2', { className: 'ss-panel-title' }, skill.name),
              h('div', { className: 'ss-caption', style: { marginTop: '3px' } }, skill.category)),
            h('button', { className: 'ss-close', onClick: onClose, title: '关闭（Esc）', 'aria-label': '关闭' }, '✕')),

          h('div', { className: 'ss-panel-body' },
            h('div', { className: 'ss-block' },
              h('p', null, skill.desc || '（暂无描述）')),

            h('div', { className: 'ss-block', style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
              h('button', { className: `ss-btn ${favorited ? '' : 'primary'}`, onClick: () => onToggleFav(skill) },
                favorited ? '★ 已收藏' : '☆ 收藏'),
              h('button', { className: 'ss-btn', onClick: () => window.open(skill.url, '_blank', 'noopener') }, '打开原始链接 ↗')),

            h('div', { className: 'ss-block' },
              h('h3', null, '基本信息'),
              h('dl', { className: 'ss-kv' },
                h('dt', null, '来源合集'),
                h('dd', null,
                  h('span', { className: 'ss-src-tag', style: { background: source.color, verticalAlign: 'middle' } }, h('span', null, source.label)),
                  source.note ? h('div', { className: 'ss-caption', style: { marginTop: '4px' } }, source.note) : null),
                h('dt', null, '链接'),
                h('dd', null, h('a', { href: skill.url, target: '_blank', rel: 'noopener noreferrer' }, skill.url)))),

            h('div', { className: 'ss-block' },
              h('h3', null, '安装方式'),
              h('button', { className: 'ss-btn primary', disabled: installState?.phase === 'pending' || installState?.phase === 'done', onClick: () => onInstall(skill) },
                installState?.phase === 'pending' ? h('span', null, h('i', { className: 'ss-spinner' }), ' 正在安装…') : installState?.phase === 'done' ? '已安装到 DSH' : '一键安装到 DSH'),
              installState?.message ? h('div', { className: installState.phase === 'done' ? 'ss-ok' : 'ss-error', role: 'status' }, installState.message) : null,
              install.command
                ? h('div', { className: 'ss-cmd' },
                  h('code', null, install.command),
                  h('button', { className: 'ss-btn sm', onClick: () => onCopy(install.command) }, '复制'))
                : null,
              install.hint ? h('div', { className: 'ss-note-hint' }, install.hint) : null,
              h('div', { className: 'ss-note-hint' },
                '也可以手动复制：把 skill 目录放到 agent 的 skills 目录即可，例如 Claude Code 用 ',
                h('code', null, '.claude/skills/'),
                '，Cursor 用 ',
                h('code', null, '.cursor/skills/'),
                '。')),

            h('div', { className: 'ss-block' },
              h('h3', null, '我的评分与笔记'),
              h('div', { className: 'ss-stars' },
                [1, 2, 3, 4, 5].map((n) => h('button', {
                  key: n,
                  className: `ss-star ${n <= rating ? 'on' : ''}`,
                  onClick: () => setRating(n),
                  title: `${n} 星`,
                  'aria-label': `${n} 星`,
                }, n <= rating ? '★' : '☆'))),
              h('textarea', {
                className: 'ss-textarea',
                placeholder: '记下用途、注意事项或试用感受（仅存本机）',
                value: text,
                maxLength: 4000,
                onChange: (e) => setText(e.target.value),
              }),
              h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' } },
                h('button', { className: 'ss-btn primary', onClick: save, disabled: saving },
                  saving ? h('span', null, h('i', { className: 'ss-spinner' }), ' 保存中') : '保存'),
                note ? h('button', { className: 'ss-btn', onClick: () => onDeleteNote(skill) }, '删除笔记') : null,
                saved ? h('span', { className: 'ss-caption' }, saved) : null)),

            similar.length
              ? h('div', { className: 'ss-block' },
                h('h3', null, '同类 skill'),
                h('div', { className: 'ss-similar' },
                  similar.map((s) => h('div', {
                    key: s.id,
                    className: 'ss-similar-item',
                    onClick: () => onOpen(s),
                    role: 'button',
                    tabIndex: 0,
                    onKeyDown: (e) => { if (e.key === 'Enter') onOpen(s); },
                  },
                    h('span', { className: 'ss-avatar', style: { background: source.color, width: '20px', height: '20px', borderRadius: '5px', fontSize: '10px' } }, initials(s.name)),
                    h('span', { className: 'ss-similar-name', title: s.name }, s.name),
                    h('span', { className: 'ss-caption' }, s.source)))))
              : null)));
    }

    // ---------------------------------------------------------------- 主界面
    function Store() {
      const [boot, setBoot] = useState(null);
      const [error, setError] = useState('');
      const [toast, setToast] = useState('');
      const [loading, setLoading] = useState(true);

      /** 每页条数：以 Host 配置为准，未拿到时用兜底值。 */
      const pageSize = useCallback(
        () => Number(boot?.meta?.pageSize) || DEFAULT_PAGE_SIZE,
        [boot],
      );

      // 浏览状态
      const [query, setQuery] = useState('');
      const [appliedQuery, setAppliedQuery] = useState('');
      const [source, setSource] = useState('');
      const [group, setGroup] = useState('');
      const [tag, setTag] = useState('');
      const [onlyFavorites, setOnlyFavorites] = useState(false);

      // 结果
      const [results, setResults] = useState([]);
      const [total, setTotal] = useState(0);
      const [page, setPage] = useState(1);
      const [loadingMore, setLoadingMore] = useState(false);

      // 发现区
      const [tab, setTab] = useState('ai');
      const [need, setNeed] = useState('');
      const [aiResult, setAiResult] = useState(null);
      const [aiLoading, setAiLoading] = useState(false);
      const [role, setRole] = useState('');

      // 详情
      const [detail, setDetail] = useState(null);
      const detailRequest = useRef(0);
      const installLocks = useRef(new Set());
      const [installs, setInstalls] = useState({});
      const installSkill = async (skill) => {
        const skillId = skill.id;
        if (installLocks.current.has(skillId)) return;
        if (!window.confirm(`将「${skill.name}」安装到 DSH？\n来源：${sourceOfKey(skill.source).label}\n${skill.url}\n第三方技能可能包含不安全的指令或脚本。请核实来源，仅安装你信任的内容。`)) return;
        installLocks.current.add(skillId);
        const update = (state) => setInstalls((prev) => ({ ...prev, [skillId]: state }));
        update({ phase: 'pending' });
        try {
          const { name, files } = await post({ type: 'install-skill', skillId });
          const count = Array.isArray(files) ? files.length : files;
          if (!name || !Number.isInteger(count) || count < 0) throw new Error('未收到有效的安装结果');
          update({ phase: 'done', message: `安装成功：${name}（${count} 个文件）` });
        } catch (error) {
          installLocks.current.delete(skillId);
          update({ phase: 'error', message: `安装失败：${error.message}` });
        }
      };
      const [similar, setSimilar] = useState([]);
      const [sideOpen, setSideOpen] = useState(false);
      const [syncing, setSyncing] = useState(false);

      const favSet = useMemo(() => new Set((boot?.favorites || []).map((f) => f.skillId)), [boot]);
      const notes = boot?.notes || {};
      const sourceMap = useMemo(() => {
        const map = {};
        for (const s of boot?.sources || []) map[s.key] = s;
        return map;
      }, [boot]);

      const sourceOfKey = useCallback((key) => sourceMap[key] || { key, label: key, color: '#475569', note: '' }, [sourceMap]);

      const showToast = useCallback((text) => {
        setToast(text);
        window.setTimeout(() => setToast(''), 2200);
      }, []);

      // 首次加载
      useEffect(() => {
        let alive = true;
        api('?action=bootstrap')
          .then((data) => { if (alive) { setBoot(data); setError(''); } })
          .catch((e) => { if (alive) setError(e.message); })
          .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
      }, []);

      // 检索：筛选条件变化时重新查第一页
      const runSearch = useCallback(async (target) => {
        const body = {
          type: 'search',
          query: target.query ?? appliedQuery,
          source: target.source ?? source,
          group: target.group ?? group,
          tag: target.tag ?? tag,
          page: 1,
          pageSize: pageSize(),
          ids: (target.onlyFavorites ?? onlyFavorites) ? (boot?.favorites || []).map((f) => f.skillId) : [],
        };
        const data = await post(body);
        setResults(data.skills || []);
        setTotal(data.total || 0);
        setPage(1);
      }, [appliedQuery, source, group, tag, onlyFavorites, boot]);

      useEffect(() => {
        if (!boot) return;
        let alive = true;
        runSearch({}).catch((e) => { if (alive) setError(e.message); });
        return () => { alive = false; };
      }, [boot, appliedQuery, source, group, tag, onlyFavorites]);

      const loadMore = async () => {
        setLoadingMore(true);
        try {
          const next = page + 1;
          const data = await post({
            type: 'search',
            query: appliedQuery,
            source,
            group,
            tag,
            page: next,
            pageSize: pageSize(),
            ids: onlyFavorites ? (boot?.favorites || []).map((f) => f.skillId) : [],
          });
          setResults((prev) => [...prev, ...(data.skills || [])]);
          setPage(next);
        } catch (e) {
          setError(e.message);
        } finally {
          setLoadingMore(false);
        }
      };

      const refreshBoot = async () => {
        const data = await api('?action=bootstrap');
        setBoot(data);
        return data;
      };

      const toggleFav = async (skill) => {
        try {
          await post({ type: 'toggle-favorite', skillId: skill.id });
          const data = await refreshBoot();
          showToast(data.favorites.some((f) => f.skillId === skill.id) ? '已收藏' : '已取消收藏');
        } catch (e) {
          setError(e.message);
        }
      };

      /** 打开详情。进面板时向 Host 要安装命令与同类 skill，避免在客户端重复推导。 */
      const openDetail = useCallback(async (skill) => {
        const request = ++detailRequest.current;
        setDetail(skill);
        setSimilar([]);
        try {
          const data = await post({ type: 'detail', skillId: skill.id });
          if (request !== detailRequest.current) return;
          setDetail(data.skill);
          setSimilar(data.similar || []);
        } catch (e) {
          if (request !== detailRequest.current) return;
          // 详情补充信息拿不到时，先用列表里已有的字段把面板打开
          setError(e.message);
        }
      }, []);

      const saveNote = async (skill, rating, note) => {
        await post({ type: 'save-note', skillId: skill.id, rating, note });
        await refreshBoot();
        showToast('已保存评分与笔记');
      };

      const deleteNote = async (skill) => {
        try {
          await post({ type: 'delete-note', skillId: skill.id });
          await refreshBoot();
          setDetail((d) => (d && d.id === skill.id ? { ...d } : d));
          showToast('已删除笔记');
        } catch (e) {
          setError(e.message);
        }
      };

      const copy = async (text) => {
        const ok = await copyText(typeof text === 'string' ? text : text.url);
        showToast(ok ? '已复制到剪贴板' : '复制失败，请手动选择');
      };

      const runAi = async (text) => {
        const needText = (text ?? need).trim();
        if (!needText) return;
        setAiLoading(true);
        setAiResult(null);
        try {
          const data = await post({ type: 'recommend', need: needText });
          setAiResult(data);
        } catch (e) {
          setError(e.message);
        } finally {
          setAiLoading(false);
        }
      };

      const runRole = async (key) => {
        setRole(key);
        setAiLoading(true);
        try {
          const data = await post({ type: 'role-recommend', role: key });
          setAiResult({ picks: data.skills.map((s) => ({ ...s, reason: '' })), pairing: '', role: key });
        } catch (e) {
          setError(e.message);
        } finally {
          setAiLoading(false);
        }
      };

      const doSync = async () => {
        setSyncing(true);
        try {
          const result = await post({ type: 'sync' });
          await refreshBoot();
          if (result.status === 'empty') showToast('今日无新增');
          else if (result.status === 'error') setError(result.message || '同步失败');
          else showToast(`同步完成，新增 ${result.added} 条`);
        } catch (e) {
          setError(e.message);
        } finally {
          setSyncing(false);
        }
      };

      const activeFilters = [
        appliedQuery ? { key: 'q', label: `搜索：${appliedQuery}`, clear: () => { setQuery(''); setAppliedQuery(''); } } : null,
        source ? { key: 's', label: `来源：${sourceOfKey(source).label}`, clear: () => setSource('') } : null,
        group ? { key: 'g', label: `大类：${group}`, clear: () => setGroup('') } : null,
        tag ? { key: 't', label: `标签：${tag}`, clear: () => setTag('') } : null,
        onlyFavorites ? { key: 'f', label: '仅看收藏', clear: () => setOnlyFavorites(false) } : null,
      ].filter(Boolean);

      if (loading) {
        return h(React.Fragment, null,
          h(Styles),
          h('div', { className: 'ss-page' },
            h('div', { className: 'ss-head' }, h('h1', null, 'Agent Skill 商店')),
            h('div', { className: 'ss-empty' }, h('span', { className: 'ss-spinner' }), ' 正在加载 skill 数据…')));
      }

      const ov = boot?.overview;
      // 侧边栏显示「全库」每个大类有多少个，不能用当前页结果推算
      const groupCounts = boot?.groupCounts || {};

      // 来源分布做成独立 tab：内容与原来的概览一致，只是不再常驻页面顶部
      const overviewPanel = ov
        ? h('div', null,
          h('div', { className: 'ss-ov-head' },
            h('h2', null, '来源分布'),
            h('span', { className: 'ss-caption' }, `共 ${ov.total} 个 skill，点方块可筛选`)),
          h('div', { className: 'ss-bar', role: 'presentation' },
            ov.sources.filter((s) => s.count).map((s) => h('span', {
              key: s.key,
              style: { background: s.color, width: `${s.share * 100}%` },
              title: `${s.label}：${s.count} 个（${(s.share * 100).toFixed(1)}%）`,
              onClick: () => setSource(source === s.key ? '' : s.key),
            }))),
          h('div', { className: 'ss-src-list' },
            ov.sources.map((s) => h('div', {
              key: s.key,
              className: `ss-src ${source === s.key ? 'on' : ''}`,
              onClick: () => setSource(source === s.key ? '' : s.key),
              role: 'button',
              tabIndex: 0,
              onKeyDown: (e) => { if (e.key === 'Enter') setSource(source === s.key ? '' : s.key); },
            },
              h('span', { className: 'ss-src-dot', style: { background: s.color } }),
              h('span', { className: 'ss-src-name', title: s.repo }, s.label),
              h('span', { className: 'ss-src-num' }, `${s.count} · ${(s.share * 100).toFixed(1)}%`)))),
          h('div', { className: 'ss-cat-chart' },
            h('div', { className: 'ss-caption', style: { marginBottom: '3px' } }, '分类 Top 10'),
            ov.topCategories.map((c) => {
              const max = ov.topCategories[0]?.count || 1;
              return h('div', {
                key: c.category,
                className: `ss-cat-row ${group === c.category.split(' / ')[0] ? 'on' : ''}`,
                onClick: () => setGroup(group === c.category.split(' / ')[0] ? '' : c.category.split(' / ')[0]),
                title: `筛选：${c.category}`,
              },
                h('span', { className: 'ss-cat-label', title: c.category }, c.category),
                h('span', { className: 'ss-cat-track' }, h('span', { className: 'ss-cat-fill', style: { width: `${(c.count / max) * 100}%` } })),
                h('span', { className: 'ss-cat-num' }, c.count));
            })))
        : h('div', { className: 'ss-empty', style: { padding: '18px' } }, '还没有可展示的统计数据');

      return h(React.Fragment, null,
        h(Styles),
        h('div', { className: 'ss-page' },
        h('div', { className: 'ss-head' },
          h('h1', null,
            'Agent Skill 商店',
            h('span', { className: 'ss-count' }, `${boot?.meta?.total || 0} 个 skill`)),
          h('div', { className: 'ss-actions' },
            h('button', { className: 'ss-btn sm', onClick: () => setSideOpen((v) => !v) }, '筛选'),
            h('button', {
              className: `ss-btn sm ${onlyFavorites ? 'primary' : ''}`,
              onClick: () => setOnlyFavorites((v) => !v),
            }, `★ 收藏 ${(boot?.favorites || []).length}`),
            h('button', { className: 'ss-btn sm', onClick: doSync, disabled: syncing, title: '立即检查 7 个来源是否有新增 skill' },
              syncing ? h('span', null, h('i', { className: 'ss-spinner' }), ' 同步中') : '检查更新'))),

        error ? h('div', { className: 'ss-error', onClick: () => setError('') , role: 'alert' }, error) : null,
        toast ? h('div', { className: 'ss-ok', role: 'status' }, toast) : null,

        // ---- 概览已移入「来源分布」标签页 ----

        // ---- 发现 ----
        h('section', { className: 'ss-discover' },
          h('div', { className: 'ss-tabs' },
            h('button', { className: `ss-tab ${tab === 'ai' ? 'on' : ''}`, onClick: () => setTab('ai') }, 'AI 智能推荐'),
            h('button', { className: `ss-tab ${tab === 'role' ? 'on' : ''}`, onClick: () => setTab('role') }, '按角色推荐'),
            h('button', { className: `ss-tab ${tab === 'ov' ? 'on' : ''}`, onClick: () => setTab('ov') }, '来源分布')),
          h('div', { className: 'ss-tab-body' },
            tab === 'ov'
              ? overviewPanel
              : tab === 'ai'
              ? h('div', null,
                h('div', { className: 'ss-ai-row' },
                  h('input', {
                    className: 'ss-input',
                    placeholder: '用一句话说你要做什么，例如：帮我把设计稿转成 React 组件',
                    value: need,
                    maxLength: 200,
                    onChange: (e) => setNeed(e.target.value),
                    onKeyDown: (e) => { if (e.key === 'Enter') runAi(); },
                  }),
                  h('button', { className: 'ss-btn primary', onClick: () => runAi(), disabled: aiLoading },
                    aiLoading ? h('span', null, h('i', { className: 'ss-spinner' }), ' 分析中') : '推荐')),
                h('div', { className: 'ss-examples' },
                  (boot?.examples || []).map((ex) => h('button', {
                    key: ex,
                    className: 'ss-example',
                    onClick: () => { setNeed(ex); runAi(ex); },
                  }, ex))),
                aiLoading ? h('div', { className: 'ss-empty', style: { padding: '18px' } }, h('span', { className: 'ss-spinner' }), ' 正在从候选里挑选…') : null,
                aiResult && !aiLoading
                  ? h('div', null,
                    aiResult.picks?.length
                      ? h('div', { className: 'ss-grid' },
                        aiResult.picks.map((p) => h(PickCard, {
                          key: p.id,
                          skill: p,
                          source: sourceOfKey(p.source),
                          favorited: favSet.has(p.id),
                          showReason: true,
                          onOpen: openDetail,
                          onToggleFav: toggleFav,
                          onCopy: copy,
                        })))
                      : h('div', { className: 'ss-empty' },
                        h('h3', null, '没有找到合适的 skill'),
                        h('p', null, aiResult.reason || '换个说法再试一次')),
                    aiResult.pairing ? h('div', { className: 'ss-pairing' }, h('strong', null, '搭配建议：'), aiResult.pairing) : null,
                    aiResult.degraded ? h('div', { className: 'ss-caption', style: { marginTop: '8px' } }, aiResult.reason) : null)
                  : null)
              : h('div', null,
                h('div', { className: 'ss-roles' },
                  (boot?.roles || []).map((r) => h('button', {
                    key: r.key,
                    className: `ss-role ${role === r.key ? 'on' : ''}`,
                    title: r.summary,
                    onClick: () => runRole(r.key),
                  }, r.key))),
                aiLoading
                  ? h('div', { className: 'ss-empty', style: { padding: '18px' } }, h('span', { className: 'ss-spinner' }), ' 正在挑选…')
                  : (aiResult?.role
                    ? (aiResult.picks?.length
                      ? h('div', { className: 'ss-grid' },
                        aiResult.picks.map((p) => h(PickCard, {
                          key: p.id,
                          skill: p,
                          source: sourceOfKey(p.source),
                          favorited: favSet.has(p.id),
                          showReason: false,
                          onOpen: openDetail,
                          onToggleFav: toggleFav,
                          onCopy: copy,
                        })))
                      : h('div', { className: 'ss-empty' }, h('p', null, '该角色下暂无匹配的 skill')))
                    : h('div', { className: 'ss-caption' }, '选一个角色，看看这个角色最常用的 skill。'))))),

        // ---- 浏览 ----
        h('div', { className: 'ss-layout' },
          h('nav', { className: `ss-side ${sideOpen ? 'open' : ''}`, 'aria-label': '筛选' },
            h('div', { className: 'ss-side-group' },
              h('div', { className: 'ss-side-title' }, '大类'),
              h('div', {
                className: `ss-side-item ${!group ? 'on' : ''}`,
                onClick: () => setGroup(''),
              }, h('span', null, '全部'), h('span', { className: 'ss-side-num' }, boot?.meta?.total || 0)),
              (boot?.groupOrder || []).map((g) => {
                const count = groupCounts[g] || 0;
                // 全库没有该大类的 skill 就不占位，免得侧边栏一堆 0
                if (!count && group !== g) return null;
                return h('div', {
                  key: g,
                  className: `ss-side-item ${group === g ? 'on' : ''}`,
                  onClick: () => setGroup(group === g ? '' : g),
                }, h('span', null, g), h('span', { className: 'ss-side-num' }, count));
              }))),

          h('div', null,
            h('div', { className: 'ss-toolbar' },
              h('div', { className: 'ss-search' },
                h('span', { className: 'ss-search-icon' }, '⌕'),
                h('input', {
                  className: 'ss-input',
                  placeholder: '搜索 skill 名称、描述、分类…',
                  value: query,
                  onChange: (e) => setQuery(e.target.value),
                  onKeyDown: (e) => { if (e.key === 'Enter') setAppliedQuery(query.trim()); },
                })),
              h('button', { className: 'ss-btn', onClick: () => setAppliedQuery(query.trim()) }, '搜索'),
              query ? h('button', { className: 'ss-btn sm', onClick: () => { setQuery(''); setAppliedQuery(''); } }, '清空') : null),

            h('div', { className: 'ss-tags' },
              (boot?.tags || []).map((t) => h('button', {
                key: t,
                className: `ss-tag ${tag === t ? 'on' : ''}`,
                onClick: () => setTag(tag === t ? '' : t),
              }, t))),

            activeFilters.length
              ? h('div', { className: 'ss-active-filters' },
                activeFilters.map((f) => h('span', { key: f.key, className: 'ss-chip' },
                  f.label,
                  h('button', { onClick: f.clear, title: '移除该筛选', 'aria-label': `移除 ${f.label}` }, '✕'))),
                h('button', { className: 'ss-btn sm', onClick: () => { setQuery(''); setAppliedQuery(''); setSource(''); setGroup(''); setTag(''); setOnlyFavorites(false); } }, '全部清除'))
              : null,

            h('div', { className: 'ss-muted', style: { marginBottom: '10px' } },
              onlyFavorites ? `我的收藏：${total} 个` : `找到 ${total} 个 skill${total > results.length ? `，已显示 ${results.length} 个` : ''}`),

            results.length
              ? h('div', { className: 'ss-grid' },
                results.map((s) => h(SkillCard, {
                  key: s.id,
                  skill: s,
                  source: sourceOfKey(s.source),
                  favorited: favSet.has(s.id),
                  note: notes[s.id],
                  onOpen: (sk) => openDetail(sk),
                  onToggleFav: toggleFav,
                  onCopy: copy,
                  onVisit: (sk) => window.open(sk.url, '_blank', 'noopener'),
                })))
              : h('div', { className: 'ss-empty' },
                h('h3', null, onlyFavorites ? '还没有收藏任何 skill' : '没有匹配的 skill'),
                h('p', null, onlyFavorites
                  ? '在卡片上点 ☆ 就能收藏，收藏只存在你的本机。'
                  : '试试减少筛选条件，或换一个关键词。'),
                activeFilters.length
                  ? h('button', { className: 'ss-btn', style: { marginTop: '12px' }, onClick: () => { setQuery(''); setAppliedQuery(''); setSource(''); setGroup(''); setTag(''); setOnlyFavorites(false); } }, '清除全部筛选')
                  : null),

            results.length < total
              ? h('div', { className: 'ss-more' },
                h('button', { className: 'ss-btn', onClick: loadMore, disabled: loadingMore },
                  loadingMore ? h('span', null, h('i', { className: 'ss-spinner' }), ' 加载中') : `加载更多（还有 ${total - results.length} 个）`))
              : null)),

        detail ? h(DetailPanel, {
          skill: detail,
          source: sourceOfKey(detail.source),
          favorited: favSet.has(detail.id),
          note: notes[detail.id],
          similar,
          installState: installs[detail.id],
          onInstall: installSkill,
          onClose: () => { ++detailRequest.current; setDetail(null); },
          onToggleFav: toggleFav,
          onOpen: (s) => openDetail(s),
          onSaveNote: saveNote,
          onDeleteNote: deleteNote,
          onCopy: copy,
        }) : null));
    }

    return {
      inject: ['slots', 'layout'],
      apply(ctx) {
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'agent-skill-store',
          order: 27,
          label: 'Skill 商店',
        }, Icon));
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'agent-skill-store' }, Store));
      },
    };
  },
});
