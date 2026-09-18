const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLoop } = require('../blue-room-loop.js');

function setup(reasons, options = {}) {
  let posts = 0;
  const snapshots = [];
  const errors = [];
  const loop = createLoop({
    request: async (path, init) => {
      if (init?.method === 'POST') return reasons[posts++];
      return { session: { status: posts >= reasons.length ? 'completed' : 'running' }, messages: [] };
    },
    onUpdate: value => snapshots.push(value), onError: value => errors.push(value), wait: async () => {},
    ...options,
  });
  return { loop, snapshots, errors, posts: () => posts };
}
test('ten turns drive exactly twenty messages and simultaneous starts share one loop', async () => {
  const app = setup(Array.from({ length: 20 }, () => ({ advanced: true, reason: 'advanced' })));
  const first = app.loop.start('one');
  assert.equal(app.loop.start('one'), first);
  await first;
  assert.equal(app.posts(), 20); assert.equal(app.snapshots.length, 20);
  assert.equal(app.loop.settling, false); assert.equal(app.errors.length, 0);
});
test('busy, reconciled and already-committed refresh history and continue', async () => {
  const app = setup(['busy', 'reconciled', 'already_committed', 'completed'].map(reason => ({ advanced: false, reason })));
  await app.loop.start('one'); assert.equal(app.posts(), 4); assert.equal(app.snapshots.length, 4);
});
test('pause lets one pending write settle and prevents the next paid call', async () => {
  let finish; let posts = 0;
  const app = setup([], { request: async (path, init) => {
    if (init?.method === 'POST') { posts++; return new Promise(resolve => { finish = resolve; }); }
    return { session: { status: 'running' }, messages: [{ turnIndex: 0 }] };
  } });
  const first = app.loop.start('one'); const paused = app.loop.pause();
  assert.equal(app.loop.start('one'), first);
  finish({ advanced: true, reason: 'advanced' }); await paused;
  assert.equal(posts, 1); assert.equal(app.snapshots[0].messages.length, 1);
});
test('ambiguous network failure stops without automatically retrying a paid POST', async () => {
  let calls = 0;
  const app = setup([], { request: async () => { calls++; throw new Error('offline'); } });
  await app.loop.start('one'); assert.equal(calls, 1); assert.equal(app.errors.length, 1);
});
test('provider failure stops even when a stale snapshot still says running', async () => {
  const app = setup([{ advanced: false, reason: 'provider_failed' }, { advanced: true }]);
  await app.loop.start('one'); assert.equal(app.posts(), 1);
});
test('inconsistent reconciliation is bounded', async () => {
  const app = setup(Array.from({ length: 100 }, () => ({ advanced: false, reason: 'reconciled' })));
  await app.loop.start('one'); assert.equal(app.posts(), 60); assert.equal(app.errors.length, 1);
});

// Andrew, 2026-09-18: waiting for the words to finish before asking for the
// next message made the gap between messages the sum of generation and
// reveal, which read as a dead pause. The next message is now requested
// while the current one is still being read.
test('the next message is requested before the current one finishes revealing', async () => {
  let posts = 0;
  // How many advance requests had been issued by the moment each reveal began.
  const postsAtReveal = [];
  const loop = createLoop({
    request: async (path, init) => {
      if (init?.method === 'POST') { posts++; return { advanced: true, reason: 'advanced' }; }
      return { session: { status: posts >= 3 ? 'completed' : 'running' }, messages: [] };
    },
    // Stand-in for the on-screen reveal: slow, and purely client-side.
    onUpdate: async () => {
      postsAtReveal.push(posts);
      await new Promise(resolve => setImmediate(resolve));
    },
    onError: error => { throw error; },
    wait: async () => {},
  });
  await loop.start('one');

  // Message 1 is revealed with request 2 already in flight, and so on: the
  // count is always one ahead of the message being read.
  assert.deepEqual(postsAtReveal.slice(0, 2), [2, 3]);
  // The last message is not followed by a speculative request.
  assert.equal(posts, 3);
});

// Prefetching must not become two paid calls racing each other.
test('at most one advance request is ever in flight', async () => {
  let live = 0;
  let peak = 0;
  let posts = 0;
  const loop = createLoop({
    request: async (path, init) => {
      if (init?.method !== 'POST') return { session: { status: posts >= 5 ? 'completed' : 'running' }, messages: [] };
      live += 1; peak = Math.max(peak, live); posts += 1;
      await new Promise(resolve => setImmediate(resolve));
      live -= 1;
      return { advanced: true, reason: 'advanced' };
    },
    onUpdate: async () => { await new Promise(resolve => setImmediate(resolve)); },
    onError: error => { throw error; },
    wait: async () => {},
  });
  await loop.start('one');
  assert.equal(peak, 1, 'two advance requests overlapped');
  assert.equal(posts, 5);
});

// A busy or reconciling turn backs off; asking again straight away would
// defeat the backoff and hammer the server.
test('a stalled turn does not prefetch behind itself', async () => {
  const reasons = [
    { advanced: false, reason: 'busy' },
    { advanced: true, reason: 'advanced' },
    { advanced: true, reason: 'advanced' },
  ];
  let posts = 0;
  let waits = 0;
  const seen = [];
  const loop = createLoop({
    request: async (path, init) => {
      if (init?.method === 'POST') return reasons[posts++] ?? { advanced: true, reason: 'advanced' };
      return { session: { status: posts >= 3 ? 'completed' : 'running' }, messages: [] };
    },
    onUpdate: async () => { seen.push(posts); },
    onError: error => { throw error; },
    wait: async () => { waits += 1; assert.equal(posts, 1, 'a request was prefetched before the backoff'); },
  });
  await loop.start('one');
  assert.equal(waits, 1);
  assert.equal(posts, 3);
});
