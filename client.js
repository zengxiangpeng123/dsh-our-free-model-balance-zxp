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

    const CHIP_STYLE = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      height: '22px',
      padding: '0 8px',
      borderRadius: '11px',
      border: '1px solid currentColor',
      opacity: 0.75,
      fontSize: '11px',
      lineHeight: 1,
      whiteSpace: 'nowrap',
      background: 'transparent',
      color: 'inherit',
      cursor: 'pointer',
      font: 'inherit',
    };

    /**
     * The chip. It asks the host once, on mount, which channel this session's
     * model belongs to — that answer is the only thing that decides whether a
     * chip exists at all. It never asks for a balance; that is the click in the
     * next task.
     */
    function Chip(props) {
      const [phase, setPhase] = React.useState('asking');
      const [channelId, setChannelId] = React.useState(null);
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

      if (phase === 'asking' || phase === 'hidden') return null;

      return h('button', {
        type: 'button',
        className: 'ofm-balance-chip',
        style: CHIP_STYLE,
        title: channelId,
        'data-channel': channelId,
      }, '⛁ —');
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left',
          id: 'ofm-balance',
          order: 40,
        }, props => h(Boundary, null, h(Chip, props))));
      },
    };
  },
});
