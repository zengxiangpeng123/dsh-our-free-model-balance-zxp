window.__ModuleLoader__.load({
  id: 'dsh-ofm-balance',
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
      try { return new URL('api/ofm-balance', document.baseURI).pathname; }
      catch { return '/api/ofm-balance'; }
    })();

    const STYLE_ID = 'ofm-balance-styles';
    const CSS = `
      .ofm-balance-wrap { position: relative; display: inline-flex; }
      .ofm-balance-chip {
        display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px;
        border-radius: 11px; border: 1px solid currentColor; opacity: .75; font-size: 11px;
        line-height: 1; white-space: nowrap; background: transparent; color: inherit;
        cursor: pointer; font: inherit;
      }
      .ofm-balance-chip:hover { opacity: 1; }
      .ofm-balance-panel {
        position: absolute; bottom: calc(100% + 6px); left: 0; z-index: 40;
        min-width: 260px; max-width: 360px; padding: 8px 10px; border-radius: 10px;
        border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35));
        background: var(--dsw-alias-bg-layer-1, Canvas);
        color: var(--dsw-alias-label-primary, CanvasText);
        box-shadow: 0 8px 24px rgba(0,0,0,.18); font-size: 12px;
      }
      .ofm-balance-head {
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
        padding-bottom: 6px; margin-bottom: 4px;
        border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.25));
        font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; opacity: .6;
      }
      .ofm-balance-refresh {
        border: none; background: transparent; color: inherit; cursor: pointer;
        font-size: 13px; line-height: 1; opacity: .8; padding: 0 2px;
      }
      .ofm-balance-row {
        display: flex; align-items: baseline; gap: 8px; padding: 3px 6px; border-radius: 6px;
      }
      .ofm-balance-row[data-current="true"] { background: rgba(90,120,230,.16); font-weight: 600; }
      .ofm-balance-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ofm-balance-value { flex-shrink: 0; font-variant-numeric: tabular-nums; }
      .ofm-balance-muted { opacity: .55; font-weight: 400; }
    `;

    // Visible copy lives in dictionaries, not inline in the component. The
    // balance state words are deliberately the same ones OFM's own channel page
    // uses, so both surfaces describe an account the same way.
    const NS = 'ofm-balance';

    // The ten channel ids, mirrored from the host table. A model whose provider
    // is not in this set has no channel balance and gets no chip at all, which
    // is why a New API model must not show one.
    const CHANNEL_IDS = new Set([
      'lobsterai', 'qoder', 'qodercn', 'trae', 'cline',
      'loomy', 'raccoon', 'minimax', 'zcode', 'gemini',
    ]);    const DICT = {
      zh: {
        'chip.title': '渠道 {channel}',
        'panel.title': '各渠道余额',
        'panel.refresh': '刷新余额',
        'panel.loading': '余额查询中…',
        'panel.none': '暂无数据',
        'state.spent': '已用尽',
        'state.empty': '未登录',
        'state.unknown': '未返回余额数据',
        'state.failed': '余额查询失败：{reason}',
        'state.failed.short': '未知原因',
      },
      en: {
        'chip.title': 'Channel {channel}',
        'panel.title': 'Channel balances',
        'panel.refresh': 'Refresh balances',
        'panel.loading': 'Querying balances…',
        'panel.none': 'No data',
        'state.spent': 'Used up',
        'state.empty': 'Not signed in',
        'state.unknown': 'No balance returned',
        'state.failed': 'Balance query failed: {reason}',
        'state.failed.short': 'unknown reason',
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

    /** The right-hand text for one normalized row. */
    function valueText(row, t) {
      if (row.state === 'ok') {
        if (row.value === 0) return t('state.spent');
        return `${row.unitLabel} ${row.value}${row.partial ? '+?' : ''}`;
      }
      if (row.state === 'empty') return t('state.empty');
      if (row.state === 'unknown') {
        // Carry the reason: "no balance returned" alone leaves the reader with
        // nothing to act on, and the reason distinguishes a missing sign-in
        // from a failed query.
        return row.reason ? `${t('state.unknown')}（${row.reason}）` : t('state.unknown');
      }
      return t('state.failed', { reason: row.reason || t('state.failed.short') });
    }

    /** The display name of a channel, falling back to its id before any rows exist. */
    function channelName(rows, channelId) {
      const row = rows.find(candidate => candidate.id === channelId);
      return row === undefined ? channelId : row.name;
    }

    /** The chip's own text once a balance is known for the current channel. */
    function chipText(rows, channelId, t) {
      const row = rows.find(candidate => candidate.id === channelId);
      if (row === undefined || row.state !== 'ok') return '—';
      if (row.value === 0) return t('state.spent');
      return `${row.value}${row.partial ? '+?' : ''}`;
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
      // The channel table is static for the life of the package, so ask the
      // host for it once and keep it: a panel opened ten times must not fetch
      // it ten times.
      if (channelsRef.current === null) {
        channelsRef.current = await fetch(`${ENDPOINT}?sessionId=${encodeURIComponent(String(sessionId))}`, { signal })
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
      const sessionId = props.sessionId;
      const t = props.t;

      // Reactive, not a one-shot: switching the model re-renders this chip, so
      // its visibility and its channel follow the composer without a reload.
      // A shell whose props lack the hook simply never shows the chip.
      const useProjection = props.useProjection;
      const projection = typeof useProjection === 'function' ? useProjection('modelSelection') : undefined;
      const selection = readSelection(projection);
      const provider = selection === null ? null : selection.provider;
      // A model whose provider is not one of the free channels has no balance
      // to show; that includes every New API model, so no chip appears.
      const channelId = provider !== null && props.channelIds.has(provider) ? provider : null;

      // Only a click ever asks for a balance; the channel table is static, so
      // the host answers it once per session and the browser caches it.
      const channelsRef = React.useRef(null);

      const load = React.useCallback(async () => {
        setBusy(true);
        const controller = new AbortController();
        try {
          const next = await loadRows(props.readConnection, sessionId, controller.signal, channelsRef);
          setRows(next);
        } catch {
          setRows([]);
        } finally {
          setBusy(false);
        }
      }, [props.readConnection, sessionId]);

      // Opening shows whatever was fetched last; it never refetches. The
      // refresh button is the only way to ask again, which is what "manual
      // refresh only" means for a panel that is opened repeatedly.
      const toggle = React.useCallback(() => { setOpen(previous => !previous); }, []);

      // First open fetches; later opens reuse the stored rows.
      const fetchedOnce = React.useRef(false);
      React.useEffect(() => {
        if (open && !fetchedOnce.current) {
          fetchedOnce.current = true;
          load();
        }
      }, [open, load]);

      // Figures fetched for one channel must not be presented as another's:
      // switching the model invalidates the cache and drops the panel, so the
      // next open fetches for the channel actually in use.
      React.useEffect(() => {
        fetchedOnce.current = false;
        setRows([]);
        setOpen(false);
      }, [channelId]);

      if (channelId === null) return null;

      const body = rows.length === 0
        ? h('div', { className: 'ofm-balance-row' },
          h('span', { className: 'ofm-balance-muted' }, busy ? t('panel.loading') : t('panel.none')))
        : rows.map(row => h('div', {
          key: row.id,
          className: 'ofm-balance-row',
          'data-current': row.id === channelId ? 'true' : 'false',
        },
        h('span', { className: 'ofm-balance-name' }, row.name),
        h('span', {
          className: row.state === 'ok' ? 'ofm-balance-value' : 'ofm-balance-value ofm-balance-muted',
        }, valueText(row, t))));

      const panel = h('div', { className: 'ofm-balance-panel' },
        h('div', { className: 'ofm-balance-head' },
          h('span', null, t('panel.title')),
          h('button', {
            type: 'button',
            className: 'ofm-balance-refresh',
            title: t('panel.refresh'),
            disabled: busy,
            onClick: load,
          }, '↻')),
        body);

      return h('span', { className: 'ofm-balance-wrap' },
        h('button', {
          type: 'button',
          className: 'ofm-balance-chip',
          title: t('chip.title', { channel: channelName(rows, channelId) }),
          'data-channel': channelId,
          'aria-expanded': open ? 'true' : 'false',
          onClick: toggle,
        }, `⛁ ${rows.length === 0 ? (busy ? '…' : '—') : chipText(rows, channelId, t)}`),
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
          id: 'ofm-balance',
          order: 40,
        }, props => h(Boundary, null, h(Chip, { ...props, readConnection, t, channelIds: CHANNEL_IDS }))));
        return disposeStyles;
      },
    };
  },
});
