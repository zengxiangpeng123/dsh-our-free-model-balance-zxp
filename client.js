window.__ModuleLoader__.load({
  id: 'dsh-ofm-balance-zxp',
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
      try { return new URL('api/ofm-balance-zxp', document.baseURI).pathname; }
      catch { return '/api/ofm-balance-zxp'; }
    })();

    const STYLE_ID = 'ofm-balance-styles';

    /**
     * A readout, not a dashboard.
     *
     * The subject is ten free-tier channels with different units, watched by
     * one person who wants to know which tanks still have gas. So the panel is
     * a ledger: names left, figures right in tabular numerals so magnitudes
     * compare down the column, and one reserved spine slot that only the
     * channel the current model is actually using fills in. That spine — and
     * its echo in the chip — is the design's only loud element; everything
     * else stays quiet, and the host's own surface, border and text tokens do
     * the rest so the popover belongs to whatever theme it is dropped into.
     *
     * Deliberately absent: per-row cards, gradient decoration, ALL-CAPS
     * tracked labels, dotted meta strings, and a rule under every row.
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
      .ofm-balance-chip-figure { font-variant-numeric: tabular-nums; }
      .ofm-balance-chip-unit { opacity: .6; }

      .ofm-balance-panel {
        position: absolute; bottom: calc(100% + 8px); left: 0; z-index: 40;
        box-sizing: border-box; width: 292px;
        max-width: min(292px, calc(100vw - 28px));
        border-radius: 12px; overflow: hidden;
        border: 1px solid var(--dsw-alias-border-l2, rgba(128, 132, 140, .34));
        background: var(--dsw-alias-bg-layer-1, Canvas);
        color: var(--dsw-alias-label-primary, CanvasText);
        box-shadow: 0 12px 28px -10px rgba(0, 0, 0, .30), 0 2px 6px rgba(0, 0, 0, .10);
        font-size: 12px; text-align: left;
      }

      .ofm-balance-head {
        display: flex; align-items: center; gap: 8px;
        padding: 9px 8px 8px 12px;
        border-bottom: 1px solid var(--ofm-hair, rgba(128, 132, 140, .22));
      }
      .ofm-balance-title { flex: 1; min-width: 0; font-size: 11.5px; }
      .ofm-balance-stamp {
        flex: 0 0 auto; font-size: 10px; opacity: .55;
        font-variant-numeric: tabular-nums;
      }
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

      .ofm-balance-list { padding: 4px 0; }
      .ofm-balance-row {
        display: flex; align-items: center; gap: 7px;
        padding: 4px 12px 4px 0;
      }
      .ofm-balance-row:hover { background: rgba(128, 132, 140, .10); }
      .ofm-balance-row[data-current="true"] {
        background: rgba(128, 132, 140, .12);
        background: color-mix(in srgb, var(--ofm-row-mark, #4C7DFF) 13%, transparent);
      }
      .ofm-balance-spine {
        flex: 0 0 3px; width: 3px; height: 15px; border-radius: 0 2px 2px 0;
        background: var(--ofm-row-mark, #8A8F98); opacity: 0;
      }
      .ofm-balance-spine[data-on="true"] { opacity: 1; }
      .ofm-balance-name {
        flex: 1 1 auto; min-width: 0; overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap;
      }
      .ofm-balance-row[data-current="true"] .ofm-balance-name { font-weight: 600; }
      .ofm-balance-unit { flex: 0 0 auto; font-size: 10px; opacity: .5; }
      .ofm-balance-figure {
        flex: 0 0 auto; font-size: 12px; font-variant-numeric: tabular-nums;
      }
      .ofm-balance-quiet {
        flex: 0 0 auto; font-size: 11px; opacity: .48;
        font-variant-numeric: tabular-nums;
      }

      .ofm-balance-foot { padding: 7px 12px 9px; font-size: 10px; opacity: .6; }
    `;

    // Visible copy lives in dictionaries, not inline in the component.
    const NS = 'ofm-balance-zxp';

    // The ten channel ids, mirrored from the host table. A model whose provider
    // is not in this set has no channel balance and gets no chip at all, which
    // is why a New API model must not show one.
    const CHANNEL_IDS = new Set([
      'lobsterai', 'qoder', 'qodercn', 'trae', 'cline',
      'loomy', 'raccoon', 'minimax', 'zcode', 'gemini',
    ]);

    const DICT = {
      zh: {
        'panel.title': '渠道余额',
        'panel.refresh': '重新查询余额',
        'panel.stamp': '上次更新：{time}',
        'panel.loading': '查询中…',
        'panel.none': '暂无数据',
        'state.spent': '已用尽',
        'state.empty': '未登录',
        'state.unknown': '未返回',
        'state.failed': '查询失败',
        'row.ok': '{name} 剩余{unit} {amount}',
        'row.spent': '{name} 已用尽',
        'row.empty': '{name} 未登录',
        'row.failed': '{name} 查询失败：{reason}',
        'row.unknown': '{name} 未返回余额{reason}',
        'foot.some': '{count} 个渠道有余额',
        'foot.signedOut': '没有渠道登录',
        'foot.spent': '渠道都用尽了',
        'foot.unknown': '余额未返回',
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
        'foot.some': '{count} channels have a balance',
        'foot.signedOut': 'No channel is signed in',
        'foot.spent': 'Every channel is used up',
        'foot.unknown': 'No balance returned',
      },
    };

    /** Substitute {name} placeholders; the dictionaries are flat, so this is all we need. */
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

    /** The figure column for one row: a real number, or a state word. */
    function rowFigure(row, t) {
      if (row.state === 'ok') {
        if (row.value === 0) return { text: t('state.spent'), quiet: true };
        return { text: `${row.amount}${row.partial ? '+?' : ''}`, quiet: false };
      }
      if (row.state === 'empty') return { text: t('state.empty'), quiet: true };
      if (row.state === 'unknown') return { text: t('state.unknown'), quiet: true };
      return { text: t('state.failed'), quiet: true };
    }

    /** The unit suffix, shown only beside a real figure. */
    function rowUnit(row) {
      return row.state === 'ok' && row.value !== 0 ? row.unitShort : '';
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

    /** Everything the chip needs: its vendor mark, its figure, and its tooltip. */
    function chipParts(rows, channelId, t) {
      const row = rows.find(candidate => candidate.id === channelId);
      if (row === undefined) return { mark: '#8A8F98', figure: '—', unit: '', title: '' };
      if (row.state === 'ok' && row.value !== 0) {
        return {
          mark: row.accent,
          figure: `${row.amount}${row.partial ? '+?' : ''}`,
          unit: row.unitShort,
          title: rowSentence(row, t),
        };
      }
      return { mark: row.accent, figure: rowFigure(row, t).text, unit: '', title: rowSentence(row, t) };
    }

    function summaryText(rows, t) {
      if (rows.length === 0) return t('panel.none');
      // "Has a balance" means a signed-in channel with something left: a real
      // zero is signed in but empty, and counting it would overstate the haul.
      const funded = rows.filter(row => row.state === 'ok' && row.value !== 0).length;
      if (funded > 0) return t('foot.some', { count: funded });
      if (rows.every(row => row.state === 'empty')) return t('foot.signedOut');
      if (rows.every(row => row.state === 'ok')) return t('foot.spent');
      return t('foot.unknown');
    }

    /**
     * The wall clock of the last fetch. The panel is deliberately cached until
     * the user asks again, so how stale the numbers are is real information.
     */
    function clockText(date) {
      if (date === null) return '';
      const pad = value => String(value).padStart(2, '0');
      return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    /**
     * Ask the pack for every channel's balances, then let the host turn the
     * replies into rows. The pack's RPC is reached through the shell's
     * `connection` service — read opportunistically, exactly as OFM's own
     * channel page does it, because a shell without that service must still
     * render this panel rather than stall the plugin forever.
     */
    async function loadRows(readConnection, sessionId, signal, channelsRef) {
      const connection = readConnection();
      const rpc = connection && connection.rpc ? connection.rpc : undefined;
      // The channel table is static for the life of the package: ask once.
      if (channelsRef.current === null) {
        channelsRef.current = await fetch(`${ENDPOINT}`, { signal })
          .then(response => (response.ok ? response.json() : null))
          .then(payload => (payload && Array.isArray(payload.channels) ? payload.channels : []))
          .catch(() => []);
      }
      const channels = channelsRef.current;

      const raw = {};
      if (rpc === undefined || typeof rpc.call !== 'function') {
        for (const channel of channels) {
          raw[channel.id] = { ok: false, error: { code: 'no-connection', message: '当前界面不提供渠道连接' } };
        }
      } else {
        await Promise.all(channels.map(async channel => {
          try {
            raw[channel.id] = await rpc.call('/api', 'channel-pack', {
              method: 'credits.balances',
              payload: { provider: channel.id },
            }, signal);
          } catch (error) {
            raw[channel.id] = { ok: false, error: { code: 'rpc-failed', message: String((error && error.message) || error) } };
          }
        }));
      }

      const response = await fetch(`${ENDPOINT}/rows`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, raw }),
        signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      return Array.isArray(payload && payload.rows) ? payload.rows : [];
    }

    /**
     * Read the session's current model selection from the projection the
     * composer's own model seat reads.
     *
     * The selection is NOT `agent.options` — that is captured when the agent is
     * created and does not follow a later switch. `selectModel` appends a
     * `model/selection` event and the host projects it to the `modelSelection`
     * key, whose `next` is the choice awaiting the next request and whose
     * `lastUsed` is the previous one. `next ?? lastUsed` is therefore what the
     * composer is showing right now.
     */
    function readSelection(projection) {
      if (projection === undefined || projection === null) return null;
      const selection = projection.next ?? projection.lastUsed;
      if (selection === undefined || selection === null) return null;
      return typeof selection.provider === 'string' && selection.provider !== '' ? selection : null;
    }

    function Chip(props) {
      const [open, setOpen] = React.useState(false);
      const [rows, setRows] = React.useState([]);
      const [busy, setBusy] = React.useState(false);
      const [fetchedAt, setFetchedAt] = React.useState(null);
      const sessionId = props.sessionId;
      const t = props.t;
      const wrapRef = React.useRef(null);

      // Reactive, not a one-shot: switching the model re-renders this chip, so
      // its visibility and its channel follow the composer without a reload.
      const useProjection = props.useProjection;
      const projection = typeof useProjection === 'function' ? useProjection('modelSelection') : undefined;
      const selection = readSelection(projection);
      const provider = selection === null ? null : selection.provider;
      // A model whose provider is not one of the free channels has no balance
      // to show; that includes every New API model, so no chip appears.
      const channelId = provider !== null && props.channelIds.has(provider) ? provider : null;

      const channelsRef = React.useRef(null);

      const load = React.useCallback(async () => {
        setBusy(true);
        const controller = new AbortController();
        try {
          const next = await loadRows(props.readConnection, sessionId, controller.signal, channelsRef);
          setRows(next);
          setFetchedAt(new Date());
        } catch {
          setRows([]);
        } finally {
          setBusy(false);
        }
      }, [props.readConnection, sessionId]);

      const toggle = React.useCallback(() => { setOpen(previous => !previous); }, []);

      // One fetch per page life, then it stays put. The rows cover every
      // channel at once, so switching the model only re-reads this cache: the
      // rule is "show the numbers by yourself, but never ask again unless I
      // press refresh".
      const fetchedOnce = React.useRef(false);
      React.useEffect(() => {
        if (channelId !== null && fetchedOnce.current === false) {
          fetchedOnce.current = true;
          load();
        }
      }, [channelId, load]);

      // Clicking anywhere outside closes; Escape closes. Neither refetches,
      // and focus is not stolen, so typing continues uninterrupted.
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

      const chip = chipParts(rows, channelId, t);
      const stamp = clockText(fetchedAt);

      const body = rows.length === 0
        ? h('div', { className: 'ofm-balance-row' },
          h('span', { className: 'ofm-balance-name' }, busy ? t('panel.loading') : t('panel.none')))
        : rows.map(row => {
          const isCurrent = row.id === channelId;
          const figure = rowFigure(row, t);
          const unit = rowUnit(row);
          return h('div', {
            key: row.id,
            className: 'ofm-balance-row',
            'data-current': isCurrent ? 'true' : 'false',
            style: { '--ofm-row-mark': row.accent },
            title: rowSentence(row, t),
          },
          h('span', {
            className: 'ofm-balance-spine',
            'data-on': isCurrent ? 'true' : 'false',
          }),
          h('span', { className: 'ofm-balance-name' }, row.name),
          unit === '' ? null : h('span', { className: 'ofm-balance-unit' }, unit),
          h('span', {
            className: figure.quiet ? 'ofm-balance-quiet' : 'ofm-balance-figure',
          }, figure.text));
        });

      const panel = h('div', {
        className: 'ofm-balance-panel',
        role: 'dialog',
        'aria-label': t('panel.title'),
      },
      h('div', { className: 'ofm-balance-head' },
        h('span', { className: 'ofm-balance-title' }, t('panel.title')),
        stamp === '' ? null : h('span', {
          className: 'ofm-balance-stamp',
          title: t('panel.stamp', { time: stamp }),
        }, stamp),
        h('button', {
          type: 'button',
          className: 'ofm-balance-refresh',
          title: t('panel.refresh'),
          'aria-label': t('panel.refresh'),
          'data-busy': busy ? 'true' : 'false',
          // Never disabled: a disabled button shows no spin and reads as dead.
          onClick: () => { if (!busy) load(); },
        }, '↻')),
      h('div', { className: 'ofm-balance-list' }, body),
      h('div', { className: 'ofm-balance-foot' }, summaryText(rows, t)));

      return h('span', { className: 'ofm-balance-wrap', ref: wrapRef },
        h('button', {
          type: 'button',
          className: 'ofm-balance-chip',
          title: chip.title,
          'data-channel': channelId,
          'aria-expanded': open ? 'true' : 'false',
          style: { '--ofm-mark': chip.mark },
          onClick: toggle,
        },
        h('span', { className: 'ofm-balance-mark' }),
        h('span', { className: 'ofm-balance-chip-figure' }, busy && rows.length === 0 ? '…' : chip.figure),
        chip.unit === '' ? null : h('span', { className: 'ofm-balance-chip-unit' }, chip.unit)),
        open ? panel : null);
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const readConnection = () => {
          try {
            const viaGet = typeof ctx.get === 'function' ? ctx.get('connection') : undefined;
            if (viaGet !== undefined && viaGet !== null) return viaGet;
          } catch { /* fall through */ }
          try { return ctx.connection ?? null; } catch { return null; }
        };
        const disposeStyles = ctx.effect(injectStyles, 'ofm-balance: styles');

        // The locale service is read optionally rather than injected: a shell
        // without it must still draw the chip. Registration failure must not
        // degrade the panel to raw keys either — a namespace with no dictionary
        // makes `bind` echo the key back — so an unregistered namespace falls
        // through to the built-in Chinese dictionary below.
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
                // A shell shipping more built-in locales than this dictionary
                // covers; register just the active one rather than none.
                try { return locale.register(NS, 'zh', DICT.zh); } catch { return undefined; }
              }
            }, 'ofm-balance: dictionaries');
            const bound = locale.bind(NS);
            t = (key, values) => {
              const translated = bound(key, values);
              return translated === key ? builtin(key, values) : translated;
            };
          }
        } catch { /* keep the built-in dictionary */ }

        ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left',
          id: 'ofm-balance-zxp',
          order: 40,
        }, props => h(Boundary, null, h(Chip, { ...props, readConnection, t, channelIds: CHANNEL_IDS }))));
        return disposeStyles;
      },
    };
  },
});
