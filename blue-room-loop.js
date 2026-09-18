// Browser-neutral, single-flight driver. Pausing never aborts a paid request:
// it lets that message finish, then stops before asking for another one.
(function (root) {
  function createLoop({ request, onUpdate, onError, onState = () => {}, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
    let wanted = false;
    let pending = null;
    let sessionId = null;
    const advance = () => request(`/sessions/${encodeURIComponent(sessionId)}/turn`, { method: 'POST' });

    async function drive() {
      let stalls = 0;
      // The next message, requested while the current one is still being
      // read on screen. Generation takes seconds and so does the reveal;
      // running them in sequence made the gap between messages the sum of
      // both. This is still single-flight — at most one advance POST is ever
      // outstanding — because a reveal is client-side only.
      let prefetch = null;
      try {
        while (wanted) {
          const result = await (prefetch ?? advance());
          prefetch = null;
          // Refresh the durable transcript too: a busy/reconciled response can
          // mean another tab stored messages this tab has never seen.
          const snapshot = await request(`/sessions/${encodeURIComponent(sessionId)}`);
          const finished = ['completed', 'failed'].includes(snapshot.session.status) ||
            ['completed', 'failed', 'provider_failed'].includes(result.reason);

          // Only prefetch behind a real message. After busy/reconciled we back
          // off instead, and asking again immediately would defeat that.
          if (wanted && !finished && result.advanced) prefetch = advance();

          await onUpdate(snapshot);
          if (finished) break;
          if (!result.advanced && !['busy', 'reconciled', 'already_committed'].includes(result.reason)) {
            throw new Error('The conversation paused after an unexpected server response.');
          }
          stalls = result.advanced ? 0 : stalls + 1;
          // Avoid an unbounded reconciliation loop against inconsistent state.
          if (stalls >= 60) throw new Error('This conversation is still busy. Try resuming in a moment.');
          if (wanted && !result.advanced) await wait(Math.min(1000 * stalls, 5000));
        }
      } catch (error) {
        // Never retry an ambiguous paid POST automatically. Resume first reads
        // the durable state, then lets the backend reconcile any in-flight turn.
        onError(error);
      } finally {
        // A prefetched message is already paid for, so let it land rather than
        // abandoning it: the server commits it either way, and resuming will
        // read it back from the durable transcript. Its failure is not shown
        // here — nothing is waiting on it, and resume surfaces the real state.
        if (prefetch) { try { await prefetch; } catch { /* settled on resume */ } }
        wanted = false;
        pending = null;
        onState();
      }
    }
    return {
      get running() { return wanted; },
      get settling() { return pending !== null; },
      start(id) {
        if (pending) return pending;
        sessionId = id;
        wanted = true;
        pending = drive();
        onState();
        return pending;
      },
      async pause() { wanted = false; onState(); await pending; },
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createLoop };
  else root.BlueRoomLoop = { createLoop };
})(globalThis);
