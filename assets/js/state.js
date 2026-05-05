/* TRAQIO — Global reactive state bus
 * Pub/sub event emitter + BroadcastChannel for cross-tab/window sync.
 *
 * Usage:
 *   Traqio.state.on("store:change", ({ collection }) => refresh());
 *   Traqio.state.emit("store:change", { collection: "applications" });
 *   Traqio.state.off("store:change", handler);
 *   Traqio.state.broadcast("store:change", {});  // other tabs only, no local fire
 */
(function () {
  const _listeners = Object.create(null);
  let _channel = null;

  try { _channel = new BroadcastChannel("traqio-v1"); } catch {}

  function on(event, fn) {
    const arr = (_listeners[event] ||= []);
    if (!arr.includes(fn)) arr.push(fn); // deduplicate
  }

  function off(event, fn) {
    if (!_listeners[event]) return;
    _listeners[event] = _listeners[event].filter(f => f !== fn);
  }

  function _fire(event, data) {
    (_listeners[event] || []).slice().forEach(fn => {
      try { fn(data); } catch (err) { console.error("[state]", event, err); }
    });
  }

  function emit(event, data) {
    _fire(event, data);
    if (_channel) {
      try { _channel.postMessage({ event, data, _ts: Date.now() }); } catch {}
    }
  }

  // Post to other tabs only — does NOT fire local listeners.
  // Use this for data mutations so local explicit render() runs once, not twice.
  function broadcast(event, data) {
    if (_channel) {
      try { _channel.postMessage({ event, data, _ts: Date.now() }); } catch {}
    }
  }

  // Receive events from other tabs/windows
  if (_channel) {
    _channel.addEventListener("message", ({ data: msg }) => {
      if (msg?.event) _fire(msg.event, msg.data);
    });
  }

  window.Traqio = window.Traqio || {};
  window.Traqio.state = { on, off, emit, broadcast };
})();
