// Placeholder client half. The bundle declares a browser half, so `./client`
// must resolve from the moment the package is installed; Task 5 replaces this
// with the real chip. It deliberately registers nothing.
window.__ModuleLoader__.load({
  id: 'dsh-ofm-balance',
  factory() {
    return { inject: [], apply() {} };
  },
});
