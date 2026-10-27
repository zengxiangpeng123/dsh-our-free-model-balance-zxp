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
    function valueText(row) {
      if (row.state === 'ok') {
        if (row.value === 0) return '已用尽';
        return `${row.unitLabel} ${row.value}${row.partial ? '+' : ''}`;
      }
      if (row.state === 'empty') return '未登录';
      if (row.state === 'unknown') return '未返回余额数据';
      return `余额查询失败：${row.reason || '未知原因'}`;
    }

    /** The chip's own text once a balance is known for the current channel. */
    function chipText(rows, channelId) {
      const row = rows.find(candidate => candidate.id === channelId);
      if (row === undefined || row.state !== 'ok') return '—';
      if (row.value === 0) return '已用尽';
      return `${row.value}${row.partial ? '+?' : ''}`;
    }

    /**
     * Ask the pack for every channel's balances, then let the host turn the
     * replies into rows. The pack's RPC is reached through the shell's
     * `connection` service — read opportunistically, exactly as OFM's own
     * channel page does it, because a shell without that service must still
     * render this panel rather than stall the plugin forever.
     */
    async function loadRows(readConnection, sessionId, signal) {
      const connection = readConnection();
      const rpc = connection && connection.rpc ? connection.rpc : undefined;
      const channels = await fetch(`${ENDPOINT}?sessionId=${encodeURIComponent(String(sessionId))}`, { signal })
        .then(response => (response.ok ? response.json() : null))
        .then(payload => (payload && Array.isArray(payload.channels) ? payload.channels : []))
        .catch(() => []);

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

    function Chip(props) {
      const [phase, setPhase] = React.useState('asking');
      const [channelId, setChannelId] = React.useState(null);
      const [open, setOpen] = React.useState(false);
      const [rows, setRows] = React.useState([]);
      const [busy, setBusy] = React.useState(false);
      const sessionId = props.sessionId;

      React.useEffect(() => {
        let alive = true;
        const controller = new AbortController();
        fetch(`${ENDPOINT}?sessionId=${encodeURIComponent(String(sessionId))}`, { signal: controller.signal })
          .then(response => (response.ok ? response.json() : null))
          .then(payload => {
            if (!alive) return;
            const id = payload && payload.current ? payload.current.channelId : null;
            setChannelId(id ?? null);
            setPhase(id === null || id === undefined ? 'hidden' : 'shown');
          })
          .catch(() => { if (alive) setPhase('hidden'); });
        return () => { alive = false; controller.abort(); };
      }, [sessionId]);

      // Only a click ever asks for a balance. No timer, no polling, no
      // background refresh: opening and the refresh button are the whole
      // trigger surface.
      const load = React.useCallback(async () => {
        setBusy(true);
        const controller = new AbortController();
        try {
          const next = await loadRows(props.readConnection, sessionId, controller.signal);
          setRows(next);
        } catch {
          setRows([]);
        } finally {
          setBusy(false);
        }
      }, [props.readConnection, sessionId]);

      const toggle = React.useCallback(() => {
        setOpen(previous => {
          const next = !previous;
          if (next) load();
          return next;
        });
      }, [load]);

      if (phase !== 'shown') return null;

      const body = rows.length === 0
        ? h('div', { className: 'ofm-balance-row' },
          h('span', { className: 'ofm-balance-muted' }, busy ? '余额查询中…' : '暂无数据'))
        : rows.map(row => h('div', {
          key: row.id,
          className: 'ofm-balance-row',
          'data-current': row.id === channelId ? 'true' : 'false',
        },
        h('span', { className: 'ofm-balance-name' }, row.name),
        h('span', {
          className: row.state === 'ok' ? 'ofm-balance-value' : 'ofm-balance-value ofm-balance-muted',
        }, valueText(row))));

      const panel = h('div', { className: 'ofm-balance-panel' },
        h('div', { className: 'ofm-balance-head' },
          h('span', null, '各渠道余额'),
          h('button', {
            type: 'button',
            className: 'ofm-balance-refresh',
            title: '刷新余额',
            disabled: busy,
            onClick: load,
          }, '↻')),
        body);

      return h('span', { className: 'ofm-balance-wrap' },
        h('button', {
          type: 'button',
          className: 'ofm-balance-chip',
          title: `渠道 ${channelId}`,
          'data-channel': channelId,
          'aria-expanded': open ? 'true' : 'false',
          onClick: toggle,
        }, `⛁ ${rows.length === 0 ? (busy ? '…' : '—') : chipText(rows, channelId)}`),
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
        ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left',
          id: 'ofm-balance',
          order: 40,
        }, props => h(Boundary, null, h(Chip, { ...props, readConnection }))));
        return disposeStyles;
      },
    };
  },
});
