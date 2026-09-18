/* Blue Room observer UI. Only stored messages are rendered; briefs are fetched
   on demand and never submitted in creation or advance requests. */
(async function () {
  const $ = id => document.getElementById(id);
  const providers = { claude: 'Claude', openai: 'ChatGPT' };
  let api = 'https://api.andrewzc.net';
  let session = null;
  let loading = true;
  let operation = 0;
  let dialogRequest = 0;
  const rendered = new Set();
  const seenSpeakers = new Set();
  const playback = BlueRoomReveal.createReveal();
  let revealing = false;
  // Pause between one message finishing and the next appearing.
  const MESSAGE_GAP_MS = 2000;
  const settle = ms => new Promise(resolve => setTimeout(resolve, ms));
  // One fixed pace. Someone who has asked their system not to animate things
  // still gets the text immediately.
  const READING_WPM = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 960;
  $('show-now').addEventListener('click', () => playback.skip());
  async function pause() {
    const settled = loop.pause();
    playback.skip();
    await settled;
  }

  async function request(path, options = {}) {
    const response = await fetch(`${api}/blue-room${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    if (!response.ok) {
      const messages = {
        not_found: 'This conversation could not be found.',
        casting_failed: 'One character could not be created. Please try again.',
        not_failed: 'This conversation has already been retried. Open it again to refresh.',
      };
      // The server puts a normalized code in `cause` so a failure is
      // actionable. It is a fixed vocabulary from our own code, never an SDK
      // string, so it is safe to show — and a failure the observer cannot
      // describe is a failure nobody can fix. The first live casting failure
      // was diagnosed only by guessing, because this was being discarded.
      const detail = typeof data.cause === 'string' && /^[a-z0-9_]{1,40}$/.test(data.cause)
        ? ` (${data.cause})`
        : '';
      const text = messages[data.error] || `The request failed (${response.status}). Your saved messages are safe.`;
      throw new Error(text + detail);
    }
    return data;
  }
  function notice(text = '') { $('notice').textContent = text; }
  function controls() {
    $('casting-fields').disabled = loading || loop.settling;
    const control = $('run-control');
    control.disabled = loading || (loop.settling && !loop.running) || (session?.status === 'completed' && !loop.running);
    control.textContent = loop.running ? 'Pause' : loop.settling ? 'Finishing message…' : session?.status === 'failed' ? 'Retry failed message' : session?.status === 'completed' ? 'Complete' : 'Resume';
    if (session) {
      const count = session.completedMessages;
      const suffix = session.status === 'completed' ? 'Complete' : session.status === 'failed' ? `Stopped · ${session.failure?.code || 'generation failed'}` : loop.running ? 'In conversation…' : loop.settling ? 'Finishing the current message…' : 'Paused';
      $('progress').textContent = `${count} of ${session.totalMessages} turns · ${revealing ? 'Reading…' : suffix}`;
    }
  }
  const loop = BlueRoomLoop.createLoop({ request, onUpdate: render, onError: error => notice(error.message), onState: controls });

  function resetTranscript() {
    rendered.clear(); seenSpeakers.clear(); $('transcript').replaceChildren();
  }
  async function render(snapshot) {
    if (session?.id !== snapshot.session.id) resetTranscript();
    session = snapshot.session;
    $('session-panel').hidden = false;
    $('session-title').textContent = `${session.emoji || '🌀'} ${session.title || 'Conversation'}`;
    for (const message of [...(snapshot.messages || [])].sort((a, b) => a.turnIndex - b.turnIndex)) {
      if (rendered.has(message.turnIndex)) continue;
      rendered.add(message.turnIndex);
      const participant = session.participants[message.speaker];
      const sameNames = session.participants.claude.name === session.participants.openai.name;
      const showProvider = sameNames || !seenSpeakers.has(message.speaker);
      seenSpeakers.add(message.speaker);
      const article = document.createElement('article');
      article.className = `message message-${message.speaker}`;
      const name = document.createElement('button');
      name.type = 'button'; name.className = 'speaker';
      name.textContent = `${participant.name || providers[message.speaker]}${showProvider ? ` (${providers[message.speaker]})` : ''}`;
      name.setAttribute('aria-haspopup', 'dialog');
      name.addEventListener('click', () => reveal(message.speaker));
      const meta = document.createElement('span'); meta.className = 'message-meta';
      meta.textContent = `Person ${participant.roleIndex} · Turn ${message.turnIndex + 1}`;
      const text = document.createElement('p'); text.className = 'message-text';
      const animate = loop.running && !document.hidden;
      article.setAttribute('aria-busy', 'true');
      article.append(name, meta, text); $('transcript').append(article);
      revealing = animate;
      $('show-now').hidden = !animate;
      controls();
      await playback.play(message.text, visible => {
        const follow = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 180;
        text.textContent = visible;
        if (follow && loop.running) text.scrollIntoView({ block: 'nearest' });
      }, { wordsPerMinute: animate ? READING_WPM : 0 });
      article.setAttribute('aria-busy', 'false');
      revealing = false;
      $('show-now').hidden = true;
      // Beat between messages, so one doesn't land on top of the last. Only
      // when we actually animated: with Instant, or a hidden tab, or a
      // backfilled transcript there is no cadence to protect and the pause
      // would just be dead time. The next message is already being generated
      // during the reveal, so this gap is usually the only wait left.
      if (animate && loop.running) await settle(MESSAGE_GAP_MS);
    }
    controls();
  }
  async function reveal(speaker) {
    const version = ++dialogRequest;
    const id = session.id;
    $('persona-title').textContent = session.participants[speaker].name;
    $('persona-brief').textContent = 'Loading private self-portrait…';
    if (!$('persona-dialog').open) $('persona-dialog').showModal();
    try {
      const { persona } = await request(`/sessions/${encodeURIComponent(id)}/personas/${speaker}`);
      if (version === dialogRequest) $('persona-brief').textContent = persona.brief;
    } catch (error) {
      if (version === dialogRequest) $('persona-brief').textContent = error.message;
    }
  }
  function setUrl(id) {
    const url = new URL(location.href); url.searchParams.set('sessionId', id);
    history.pushState({}, '', url);
  }
  async function refreshHistory() {
    try {
      const { sessions } = await request('/sessions?limit=50');
      $('sessions').replaceChildren();
      $('history-notice').textContent = sessions.length ? '' : 'No conversations yet. Set the first scene above.';
      for (const item of sessions) {
        const li = document.createElement('li'); const link = document.createElement('a');
        const url = new URL(location.href); url.searchParams.set('sessionId', item.id); link.href = url.href;
        link.append(document.createTextNode(`${item.emoji || '🌀'} ${item.title}`));
        const meta = document.createElement('small');
        meta.textContent = `${new Date(item.createdAt).toLocaleDateString()} · ${item.status} · ${item.completedMessages}/${item.totalMessages} messages`;
        link.append(meta);
        link.addEventListener('click', event => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          if (!loading) openSession(item.id, true);
        });
        li.append(link); $('sessions').append(li);
      }
    } catch (error) { $('history-notice').textContent = `History unavailable. ${error.message}`; }
  }
  async function openSession(id, push = false) {
    const version = ++operation;
    loading = true; notice('Opening saved conversation…'); controls();
    await pause();
    try {
      const snapshot = await request(`/sessions/${encodeURIComponent(id)}`);
      if (version !== operation) return;
      await render(snapshot); if (push) setUrl(id);
      notice(snapshot.session.status === 'completed' ? '' : 'Saved conversation loaded. Resume when you’re ready.');
    } catch (error) { if (version === operation) notice(error.message); }
    finally { if (version === operation) { loading = false; controls(); } }
  }
  $('casting-form').addEventListener('submit', async event => {
    event.preventDefault(); if (loading || loop.settling) return;
    const contextPrompt = $('scenario').value.trim(); if (!contextPrompt) return;
    const version = ++operation;
    loading = true; controls(); notice('Casting two characters… Each is choosing a name and a private personality. This can take a moment.');
    try {
      const person1 = Math.random() < 0.5 ? 'claude' : 'openai';
      const snapshot = await request('/sessions', { method: 'POST', body: JSON.stringify({ contextPrompt, person1 }) });
      if (version !== operation) { await refreshHistory(); return; }
      await render(snapshot); setUrl(snapshot.session.id); notice();
      loading = false; controls();
      await loop.start(session.id); await refreshHistory();
    } catch (error) { if (version === operation) notice(error.message); }
    finally { if (version === operation) { loading = false; controls(); } }
  });
  $('run-control').addEventListener('click', async () => {
    if (loading) return;
    if (loop.running) { await pause(); await refreshHistory(); return; }
    if (loop.settling || !session) return;
    const version = ++operation;
    const id = session.id;
    loading = true; controls(); notice();
    try {
      // Read first: another observer may have finished or retried this session.
      const snapshot = await request(`/sessions/${encodeURIComponent(id)}`);
      if (version !== operation) return;
      await render(snapshot);
      if (session.status === 'failed') {
        const result = await request(`/sessions/${encodeURIComponent(session.id)}/retry`, { method: 'POST' });
        if (version !== operation) return;
        session = result.session;
      }
      loading = false; controls();
      if (session.status !== 'completed') await loop.start(session.id);
      await refreshHistory();
    } catch (error) { if (version === operation) notice(error.message); }
    finally { if (version === operation) { loading = false; controls(); } }
  });
  // Stop when the page is actually going away — navigating off, closing, or
  // entering the back/forward cache — so no request is left dangling.
  window.addEventListener('pagehide', () => { void pause(); });
  // Backgrounding the tab deliberately does NOT pause. Andrew asked for the
  // conversation to keep running while he does something else, 2026-09-18.
  // It costs money unattended, which is presumably why it paused before, but
  // that is his call to make and a 40-message run is well under a dollar.
  // The loop is driven by awaited fetches rather than timers, so a hidden tab
  // keeps advancing at full speed; only the cosmetic reveal is suppressed
  // while hidden (see `animate` above), which is what we want anyway.
  window.addEventListener('popstate', async () => {
    const id = new URLSearchParams(location.search).get('sessionId');
    if (id) await openSession(id);
    else {
      const version = ++operation;
      loading = true; controls(); await pause();
      if (version !== operation) return;
      session = null; resetTranscript(); $('session-panel').hidden = true;
      loading = false; notice(); controls();
    }
  });
  // Always the deployed API, including from a local page — Andrew's call on
  // 2026-09-18, matching the rest of the site. He rarely runs the backend
  // locally and deploying is quick. This page does make paid calls, but never
  // without a click: casting is a form submit and a saved session opens
  // paused, so there is nothing here that spends money on load.
  loading = false; controls();
  await refreshHistory();
  const initial = new URLSearchParams(location.search).get('sessionId');
  if (initial) await openSession(initial);
})();
