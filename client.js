window.__ModuleLoader__.load({
  id: 'dsh-our-free-model-balance-zxp',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /**
     * Render-error boundary. An occupant that throws takes the composer down
     * with it, so nothing this plugin draws is allowed to escape upward.
     */
    class Boundary extends React.Component {
      constructor(props) { super(props); this.state = { err: '' }; }
      static getDerivedStateFromError(error) { return { err: String((error && error.message) || error) }; }
      render() {
        if (this.state.err !== '') return null;
        return this.props.children;
      }
    }

    // Resolved against the page base rather than an origin-absolute path: the
    // harness can be mounted under a reverse-proxy sub-path, where a leading
    // slash drops the prefix and the request misses the app entirely.
    const ENDPOINT = (() => {
      try { return new URL('api/our-free-model-balance-zxp', document.baseURI).pathname; }
      catch { return '/api/our-free-model-balance-zxp'; }
    })();

    const STYLE_ID = 'ofm-balance-styles';

    /**
     * A readout, not a dashboard.
     *
     * Only channels this person is actually signed into appear, so the panel is
     * what they own rather than what exists. Within it, exactly one colour is
     * allowed to alarm: a filled red tag says a channel is used up, and it is
     * the only saturated thing on the surface. Everything with fuel stays quiet,
     * the figure set large and tabular so the column compares down the page, and
     * the current channel — the one the composer's model belongs to — is the
     * only row wearing its vendor's colour.
     *
     * Deliberately absent: per-row cards, gradient decoration, ALL-CAPS tracked
     * labels, dotted meta strings, a rule under every row.
     */
    const CSS = `
      .ofm-balance-wrap { position: relative; display: inline-flex; }

      .ofm-balance-chip {
        display: inline-flex; align-items: center; gap: 6px;
        height: 22px; padding: 0 9px 0 8px; border-radius: 11px;
        border: 1px solid var(--dsw-alias-border-l2, rgba(128, 132, 140, .38));
        background: transparent; color: inherit; font: inherit; font-size: 11px;
        line-height: 1; white-space: nowrap; cursor: pointer; opacity: .82;
        transition: opacity .12s ease-out;
      }
      .ofm-balance-chip:hover { opacity: 1; }
      .ofm-balance-chip:focus-visible {
        outline: 2px solid var(--ofm-focus, #4C7DFF); outline-offset: 2px;
      }
      .ofm-balance-mark {
        width: 6px; height: 6px; border-radius: 2px; flex: 0 0 auto;
        background: var(--ofm-mark, #8A8F98);
      }
      .ofm-balance-chip-figure { font-variant-numeric: tabular-nums; font-weight: 600; }
      .ofm-balance-chip-unit { opacity: .6; }
      .ofm-balance-chip[data-spent="true"] { border-color: rgba(217, 45, 51, .55); }

      /* The one alarm in the whole surface: a filled tag, so its contrast is
         guaranteed on any theme instead of depending on a red text colour that
         only works on light backgrounds. */
      .ofm-balance-tag {
        flex: 0 0 auto; font-size: 11px; font-weight: 700; line-height: 1;
        padding: 3px 6px; border-radius: 5px;
        background: #D92D33; color: #FFFFFF;
      }
      .ofm-balance-chip .ofm-balance-tag { font-size: 10px; padding: 2px 5px; }

      .ofm-balance-panel {
        position: absolute; bottom: calc(100% + 8px); left: 0; z-index: 40;
        box-sizing: border-box; width: 300px;
        max-width: min(300px, calc(100vw - 28px));
        border-radius: 12px; overflow: hidden;
        border: 1px solid var(--dsw-alias-border-l2, rgba(128, 132, 140, .34));
        background: var(--dsw-alias-bg-layer-1, Canvas);
        color: var(--dsw-alias-label-primary, CanvasText);
        box-shadow: 0 12px 28px -10px rgba(0, 0, 0, .30), 0 2px 6px rgba(0, 0, 0, .10);
        font-size: 12px; text-align: left;
      }

      .ofm-balance-head {
        display: flex; align-items: center; gap: 8px;
        padding: 9px 8px 8px 13px;
        border-bottom: 1px solid var(--ofm-hair, rgba(128, 132, 140, .20));
      }
      .ofm-balance-title { flex: 1; min-width: 0; font-size: 11.5px; }
      .ofm-balance-stamp {
        flex: 0 0 auto; font-size: 10px; opacity: .5;
        font-variant-numeric: tabular-nums;
      }
      .ofm-balance-stamp[data-stale="true"] { opacity: .32; }
      .ofm-balance-refresh {
        flex: 0 0 auto; width: 20px; height: 20px; padding: 0;
        display: inline-flex; align-items: center; justify-content: center;
        border: none; border-radius: 6px; background: transparent;
        color: inherit; cursor: pointer; font-size: 13px; line-height: 1; opacity: .7;
      }
      .ofm-balance-refresh:hover { opacity: 1; background: rgba(128, 132, 140, .14); }
      .ofm-balance-refresh:focus-visible {
        outline: 2px solid var(--ofm-focus, #4C7DFF); outline-offset: 1px;
      }
      .ofm-balance-refresh[data-busy="true"] {
        opacity: 1; animation: ofm-balance-spin .9s linear infinite;
      }
      @keyframes ofm-balance-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) {
        .ofm-balance-refresh[data-busy="true"] { animation: none; opacity: .45; }
      }

      .ofm-balance-note {
        padding: 7px 13px 8px; font-size: 10.5px; line-height: 1.5; opacity: .7;
      }

      .ofm-balance-list { padding: 5px 0 4px; }
      .ofm-balance-row {
        display: flex; align-items: baseline; gap: 8px;
        padding: 5px 13px 5px 0;
      }
      .ofm-balance-row:hover { background: rgba(128, 132, 140, .09); }
      .ofm-balance-spine {
        flex: 0 0 3px; width: 3px; height: 15px; border-radius: 0 2px 2px 0;
        align-self: center; background: var(--ofm-row-mark, #8A8F98); opacity: 0;
      }
      .ofm-balance-spine[data-on="true"] { opacity: 1; }
      .ofm-balance-name {
        flex: 1 1 auto; min-width: 0; overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap;
        font-size: 11.5px; opacity: .92;
      }
      .ofm-balance-unit { flex: 0 0 auto; font-size: 10px; opacity: .5; }
      .ofm-balance-figure {
        flex: 0 0 auto; font-size: 15px; font-weight: 600;
        font-variant-numeric: tabular-nums; letter-spacing: -.01em;
      }
      .ofm-balance-row[data-current="true"] .ofm-balance-figure { color: var(--ofm-row-mark); }
      .ofm-balance-quiet {
        flex: 0 0 auto; font-size: 11px; opacity: .45;
        font-variant-numeric: tabular-nums;
      }

      /* Used up: a red wash, a red leading edge, and the tag standing where the
         figure would be. The name keeps normal contrast so it stays legible. */
      .ofm-balance-row[data-spent="true"] {
        background: rgba(217, 45, 51, .10);
        background: color-mix(in srgb, #D92D33 10%, transparent);
        box-shadow: inset 3px 0 0 0 #D92D33;
      }
      .ofm-balance-row[data-spent="true"]:hover {
        background: rgba(217, 45, 51, .16);
        background: color-mix(in srgb, #D92D33 16%, transparent);
      }
      .ofm-balance-spent-word { flex: 0 0 auto; font-size: 11px; font-weight: 700; opacity: .8; }

      .ofm-balance-emptywrap { padding: 14px 13px 16px; }
      .ofm-balance-emptyline { font-size: 11.5px; }
      .ofm-balance-emptyhint { margin-top: 4px; font-size: 10px; opacity: .5; line-height: 1.5; }

      .ofm-balance-foot { padding: 8px 13px 10px; font-size: 10px; opacity: .55; }
      .ofm-balance-foot-spent { opacity: .55; }
    `;

    // Visible copy lives in dictionaries, not inline in the component.
    const NS = 'our-free-model-balance-zxp';

    // The ten channel ids, mirrored from the host table. A model whose provider
    // is not in this set has no channel balance and gets no chip at all.
    const CHANNEL_IDS = new Set([
      'lobsterai', 'qoder', 'qodercn', 'trae', 'cline',
      'loomy', 'raccoon', 'minimax', 'zcode', 'gemini',
    ]);

    /**
     * Mirrors `DEFAULT_SETTINGS` in `src/settings.js`. Only used until the first
     * snapshot arrives, so the chip can paint something before the host answers;
     * the host remains the single source of truth for these values.
     */
    const DEFAULT_CLIENT_SETTINGS = Object.freeze({
      autoRefreshSec: 60,
      showTimestamp: true,
      showUnits: true,
      showSpine: true,
      showFooter: true,
      showSignedOut: false,
      redWhenSpent: true,
      chipStyle: 'number',
      hiddenChannels: [],
    });

    const DICT = {
      zh: {
        'panel.title': '渠道余额',
        'panel.refresh': '重新查询余额',
        'panel.stamp': '上次更新：{time}',
        'panel.loading': '查询中…',
        'panel.none': '暂无数据',
        'state.spent': '用尽',
        'state.empty': '未登录',
        'state.unknown': '未返回',
        'state.failed': '查询失败',
        'row.ok': '{name} 剩余{unit} {amount}',
        'row.spent': '{name} 已用尽',
        'row.empty': '{name} 未登录',
        'row.failed': '{name} 查询失败：{reason}',
        'row.unknown': '{name} 未返回余额{reason}',
        'foot.funded': '{count} 个可用',
        'foot.spent': '{count} 个用尽',
        'foot.failed': '{count} 个未取到',
        'foot.join': '，',
        'empty.none': '没有已登录的渠道',
        'empty.hint': '登录 Our Free Model 的渠道后出现在这里',
        'note.stale': '下面的数字来自上一次成功查询，可能已经不准（{reason}）',
      },
      en: {
        'panel.title': 'Channel balances',
        'panel.refresh': 'Query balances again',
        'panel.stamp': 'Updated {time}',
        'panel.loading': 'Querying…',
        'panel.none': 'No data',
        'state.spent': 'Used up',
        'state.empty': 'Not signed in',
        'state.unknown': 'No reply',
        'state.failed': 'Query failed',
        'row.ok': '{name} has {amount} {unit} left',
        'row.spent': '{name} is used up',
        'row.empty': '{name} is not signed in',
        'row.failed': '{name}: query failed — {reason}',
        'row.unknown': '{name}: no balance returned{reason}',
        'foot.funded': '{count} available',
        'foot.spent': '{count} used up',
        'foot.failed': '{count} not read',
        'foot.join': ', ',
        'empty.none': 'No channel is signed in',
        'empty.hint': 'Sign in to a channel in Our Free Model and it appears here',
        'note.stale': 'These numbers come from the last successful query and may be out of date ({reason})',
      },
    };

    /** Substitute {name} placeholders; the dictionaries are flat. */
    function makeTranslator(dict) {
      return (key, values) => {
        const template = dict[key] ?? key;
        if (values === undefined) return template;
        return template.replace(/\{(\w+)\}/g, (whole, name) => (name in values ? String(values[name]) : whole));
      };
    }

    function injectStyles() {
      if (typeof document === 'undefined') return () => {};
      const previous = document.querySelector(`style[data-ofm-balance]`);
      if (previous) previous.remove();
      const tag = document.createElement('style');
      tag.setAttribute('data-ofm-balance', STYLE_ID);
      tag.textContent = CSS;
      document.head.appendChild(tag);
      return () => tag.remove();
    }

    /** Used up is the one status allowed to shout. */
    function isSpent(row) {
      return row.state === 'ok' && row.value === 0;
    }

    /** Signed in and carrying fuel. */
    function hasFuel(row) {
      return row.state === 'ok' && row.value !== 0;
    }

    /** One sentence naming the row and what its number means; also the tooltip. */
    function rowSentence(row, t) {
      const base = { name: row.name, unit: row.unitShort, amount: row.amount };
      if (row.state === 'ok') return row.value === 0 ? t('row.spent', base) : t('row.ok', base);
      if (row.state === 'empty') return t('row.empty', base);
      if (row.state === 'unknown') {
        return t('row.unknown', { ...base, reason: row.reason ? `（${row.reason}）` : '' });
      }
      return t('row.failed', { ...base, reason: row.reason || t('state.failed') });
    }

    /** The one-line summary over the rows actually shown. */
    function summaryText(visible, t) {
      const funded = visible.filter(hasFuel).length;
      const spent = visible.filter(isSpent).length;
      const failed = visible.length - funded - spent;
      const parts = [];
      if (funded > 0) parts.push(t('foot.funded', { count: funded }));
      if (spent > 0) parts.push(t('foot.spent', { count: spent }));
      if (failed > 0) parts.push(t('foot.failed', { count: failed }));
      return parts.join(t('foot.join'));
    }

    /** The wall clock of the last successful poll. */
    function clockText(at) {
      if (typeof at !== 'number' || at <= 0) return '';
      const date = new Date(at);
      const pad = value => String(value).padStart(2, '0');
      return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    /** One request, one JSON answer; failures are reported as null, never thrown. */
    async function request(path, init) {
      try {
        const response = await fetch(`${ENDPOINT}${path}`, init);
        if (!response.ok) return null;
        return await response.json();
      } catch {
        return null;
      }
    }

    const readSnapshot = signal => request('/snapshot', { signal });
    const watchNow = () => request('/watch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const refreshNow = () => request('/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });

    /**
     * Read the session's current model selection from the projection the
     * composer's own model seat reads.
     *
     * The selection is NOT `agent.options` (captured at agent creation) and not
     * `agentDefaultModel` (the default for new sessions). `selectModel` appends
     * a `model/selection` event, projected to the `modelSelection` key, whose
     * `next` awaits the next request and whose `lastUsed` is the previous one.
     */
    function readSelection(projection) {
      if (projection === undefined || projection === null) return null;
      const selection = projection.next ?? projection.lastUsed;
      if (selection === undefined || selection === null) return null;
      return typeof selection.provider === 'string' && selection.provider !== '' ? selection : null;
    }

    function Chip(props) {
      const [open, setOpen] = React.useState(false);
      const [snapshot, setSnapshot] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const t = props.t;
      const wrapRef = React.useRef(null);

      const useProjection = props.useProjection;
      const projection = typeof useProjection === 'function' ? useProjection('modelSelection') : undefined;
      const selection = readSelection(projection);
      const provider = selection === null ? null : selection.provider;
      const channelId = provider !== null && props.channelIds.has(provider) ? provider : null;

      const settings = (snapshot !== null && snapshot.settings !== undefined && snapshot.settings !== null)
        ? snapshot.settings
        : props.defaultSettings;
      const autoRefreshSec = typeof settings.autoRefreshSec === 'number' ? settings.autoRefreshSec : 60;

      // Report presence and take whatever the host already has. The heartbeat
      // exists for exactly one reason: the host stops polling when nobody is
      // watching. It never fetches balances itself.
      const beat = React.useCallback(async () => {
        const next = await watchNow();
        if (next !== null) setSnapshot(next);
      }, []);

      React.useEffect(() => {
        if (channelId === null) return undefined;
        let alive = true;
        let timer = null;
        const arm = () => {
          const seconds = Math.min(60, autoRefreshSec > 0 ? autoRefreshSec : 60);
          timer = setTimeout(() => {
            if (document.visibilityState === 'hidden') return;
            void beat().then(() => { if (alive) arm(); });
          }, Math.max(5, seconds) * 1000);
        };
        const onVisible = () => { if (document.visibilityState === 'visible') void beat(); };
        document.addEventListener('visibilitychange', onVisible);
        void beat().then(() => { if (alive) arm(); });
        return () => {
          alive = false;
          if (timer !== null) clearTimeout(timer);
          document.removeEventListener('visibilitychange', onVisible);
        };
      }, [channelId, autoRefreshSec, beat]);

      // While the host is mid-round, re-read the snapshot every two seconds.
      // These are local reads of a cache — they cost the upstream nothing.
      React.useEffect(() => {
        if (snapshot === null || snapshot.poller === undefined || snapshot.poller.state !== 'polling') return undefined;
        const controller = new AbortController();
        const timer = setTimeout(() => {
          void readSnapshot(controller.signal).then(next => { if (next !== null) setSnapshot(next); });
        }, 2000);
        return () => { controller.abort(); clearTimeout(timer); };
      }, [snapshot]);

      React.useEffect(() => {
        if (!open || typeof document === 'undefined') return undefined;
        const onPointerDown = event => {
          const root = wrapRef.current;
          if (root !== null && root.contains && !root.contains(event.target)) setOpen(false);
        };
        const onKeyDown = event => { if (event.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
          document.removeEventListener('mousedown', onPointerDown);
          document.removeEventListener('keydown', onKeyDown);
        };
      }, [open]);

      if (channelId === null) return null;

      const rows = snapshot === null ? [] : (snapshot.channels ?? []);
      const byId = rows.find(row => row.id === channelId);
      const spending = byId !== undefined && isSpent(byId);
      const errorNote = (snapshot !== null && snapshot.poller !== undefined && typeof snapshot.poller.error === 'string')
        ? snapshot.poller.error
        : '';

      // The panel is an inventory: a channel with no account is not part of it
      // unless the user asked to see those too. A channel that IS signed in but
      // unreadable still appears — hiding it would make it look vanished.
      const hidden = Array.isArray(settings.hiddenChannels) ? settings.hiddenChannels : [];
      const visible = rows.filter(row => !hidden.includes(row.id) && (row.loggedIn === true || settings.showSignedOut === true));

      const chipFigure = byId === undefined
        ? '—'
        : spending
          ? t('state.spent')
          : hasFuel(byId)
            ? `${byId.amount}${byId.partial ? '+?' : ''}`
            : (byId.state === 'empty' ? t('state.empty') : byId.state === 'unknown' ? t('state.unknown') : t('state.failed'));
      const chipUnit = (byId !== undefined && hasFuel(byId) && settings.showUnits !== false) ? byId.unitShort : '';
      const chipMark = byId === undefined ? '#8A8F98' : (spending ? '#D92D33' : byId.accent);
      const stamp = snapshot === null ? '' : clockText(snapshot.at);

      let body;
      if (snapshot === null) {
        body = h('div', { className: 'ofm-balance-emptywrap' },
          h('div', { className: 'ofm-balance-emptyline' }, t('panel.loading')));
      } else if (visible.length === 0) {
        body = h('div', { className: 'ofm-balance-emptywrap' },
          h('div', { className: 'ofm-balance-emptyline' }, rows.length === 0 ? t('panel.none') : t('empty.none')),
          h('div', { className: 'ofm-balance-emptyhint' }, t('empty.hint')));
      } else {
        body = h('div', { className: 'ofm-balance-list' }, visible.map(row => {
          const spent = isSpent(row);
          const current = row.id === channelId && !spent;
          const showFigure = hasFuel(row);
          const word = row.state === 'unknown' ? t('state.unknown') : t('state.failed');
          const unit = (showFigure && settings.showUnits !== false)
            ? h('span', { className: 'ofm-balance-unit' }, row.unitShort)
            : null;
          let tail;
          if (spent) {
            tail = settings.redWhenSpent === false
              ? h('span', { className: 'ofm-balance-spent-word' }, t('state.spent'))
              : h('span', { className: 'ofm-balance-tag' }, t('state.spent'));
          } else if (showFigure) {
            tail = h('span', { className: 'ofm-balance-figure' }, `${row.amount}${row.partial ? '+?' : ''}`);
          } else {
            tail = h('span', { className: 'ofm-balance-quiet' }, word);
          }
          return h('div', {
            key: row.id,
            className: 'ofm-balance-row',
            'data-current': current ? 'true' : 'false',
            'data-spent': spent && settings.redWhenSpent !== false ? 'true' : 'false',
            style: { '--ofm-row-mark': row.accent },
            title: rowSentence(row, t),
          },
          h('span', {
            className: 'ofm-balance-spine',
            'data-on': current && settings.showSpine !== false ? 'true' : 'false',
          }),
          h('span', { className: 'ofm-balance-name' }, row.name),
          unit,
          tail);
        }));
      }

      const note = snapshot !== null && snapshot.stale === true
        ? h('div', { className: 'ofm-balance-note' }, t('note.stale', { reason: errorNote === '' ? t('state.failed') : errorNote }))
        : (errorNote === '' || visible.length === 0 ? null : h('div', { className: 'ofm-balance-note' }, errorNote));

      const panel = h('div', {
        className: 'ofm-balance-panel',
        role: 'dialog',
        'aria-label': t('panel.title'),
      },
      h('div', { className: 'ofm-balance-head' },
        h('span', { className: 'ofm-balance-title' }, t('panel.title')),
        (stamp === '' || settings.showTimestamp === false) ? null : h('span', {
          className: 'ofm-balance-stamp',
          'data-stale': snapshot !== null && snapshot.stale === true ? 'true' : 'false',
          title: t('panel.stamp', { time: stamp }),
        }, stamp),
        h('button', {
          type: 'button',
          className: 'ofm-balance-refresh',
          title: t('panel.refresh'),
          'aria-label': t('panel.refresh'),
          'data-busy': busy ? 'true' : 'false',
          onClick: async () => {
            if (busy) return;
            setBusy(true);
            try {
              const next = await refreshNow();
              if (next !== null) setSnapshot(next);
            } finally {
              setBusy(false);
            }
          },
        }, '↻')),
      note,
      body,
      (visible.length === 0 || settings.showFooter === false)
        ? null
        : h('div', { className: 'ofm-balance-foot' }, summaryText(visible, t)));

      return h('span', { className: 'ofm-balance-wrap', ref: wrapRef },
        h('button', {
          type: 'button',
          className: 'ofm-balance-chip',
          title: byId === undefined ? '' : rowSentence(byId, t),
          'data-channel': channelId,
          'data-spent': spending && settings.redWhenSpent !== false ? 'true' : 'false',
          'aria-expanded': open ? 'true' : 'false',
          style: { '--ofm-mark': chipMark },
          onClick: () => setOpen(previous => !previous),
        },
        h('span', { className: 'ofm-balance-mark' }),
        settings.chipStyle === 'dot' ? null : h('span', { className: 'ofm-balance-chip-figure' }, chipFigure),
        chipUnit === '' ? null : h('span', { className: 'ofm-balance-chip-unit' }, chipUnit)),
        open ? panel : null);
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const disposeStyles = ctx.effect(injectStyles, 'our-free-model-balance-zxp: styles');

        let t = makeTranslator(DICT.zh);
        const builtin = makeTranslator(DICT.zh);
        try {
          const viaGet = typeof ctx.get === 'function' ? ctx.get('locale') : undefined;
          const locale = (viaGet !== undefined && viaGet !== null) ? viaGet : ctx.locale;
          if (locale && typeof locale.bind === 'function' && typeof locale.register === 'function') {
            ctx.effect(() => {
              try {
                return locale.register(NS, { zh: DICT.zh, en: DICT.en });
              } catch {
                try { return locale.register(NS, 'zh', DICT.zh); } catch { return undefined; }
              }
            }, 'our-free-model-balance-zxp: dictionaries');
            const bound = locale.bind(NS);
            t = (key, values) => {
              const translated = bound(key, values);
              return translated === key ? builtin(key, values) : translated;
            };
          }
        } catch { /* keep the built-in dictionary */ }

        ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left',
          id: 'our-free-model-balance-zxp',
          order: 40,
        }, props => h(Boundary, null, h(Chip, {
          ...props,
          t,
          channelIds: CHANNEL_IDS,
          defaultSettings: DEFAULT_CLIENT_SETTINGS,
        }))));
        return disposeStyles;
      },
    };
  },
});
