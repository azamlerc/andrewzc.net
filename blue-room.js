/* Blue Room observer UI. The page follows search.html's two views: a plain
   start/history list and a permalinked conversation detail view. */
(async function () {
  const $ = id => document.getElementById(id);
  const providers = { claude: 'Claude', openai: 'ChatGPT' };
  const headline = $('headline');
  const sessionActions = $('session-actions');
  const backButton = $('back-button');
  const form = $('casting-form');
  const historyPanel = $('history-panel');
  const sessionPanel = $('session-panel');
  let api = 'https://api.andrewzc.net';
  let session = null;
  let loading = true;
  let operation = 0;
  let dialogRequest = 0;
  const rendered = new Set();
  const seenSpeakers = new Set();
  const playback = BlueRoomReveal.createReveal();
  let revealing = false;
  const MESSAGE_GAP_MS = 2000;
  const READING_WPM = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 960;
  const settle = ms => new Promise(resolve => setTimeout(resolve, ms));

  $('show-now').addEventListener('click', () => {
    playback.skip();
    requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }));
  });

  function setHeader(title, { back = false } = {}) {
    document.title = title;
    headline.textContent = title;
    sessionActions.hidden = !back;
    backButton.hidden = !back;
  }

  backButton.addEventListener('click', () => showList({ updateUrl: true }));

  function sessionTitle(value) {
    return `${value.emoji || '🌀'} ${value.title || 'Conversation'}`;
  }

  function setUrl(id = null, { replace = false } = {}) {
    const url = new URL(location.href);
    if (id) url.searchParams.set('sessionId', id);
    else url.searchParams.delete('sessionId');
    history[replace ? 'replaceState' : 'pushState']({}, '', url);
  }

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
      const detail = typeof data.cause === 'string' && /^[a-z0-9_]{1,40}$/.test(data.cause)
        ? ` (${data.cause})` : '';
      throw new Error((messages[data.error] || `The request failed (${response.status}). Your saved messages are safe.`) + detail);
    }
    return data;
  }

  function notice(text = '') { $('notice').textContent = text; }

  function controls() {
    $('casting-fields').disabled = loading || loop.settling;
    const control = $('run-control');
    const canControl = Boolean(session) && !loading && (loop.running || (!loop.settling && session.status !== 'completed'));
    control.hidden = !canControl;
    control.disabled = false;
    control.textContent = loop.running ? 'Pause' : loop.settling ? 'Finishing message…' : session?.status === 'failed' ? 'Retry failed message' : 'Resume';
    if (session) {
      const status = session.status === 'completed' ? ''
        : session.status === 'failed' ? `Stopped · ${session.failure?.code || 'generation failed'}`
        : loop.running ? 'In conversation…'
        : loop.settling ? 'Finishing the current message…' : 'Paused';
      const suffix = revealing ? 'Reading…' : status;
      $('progress').textContent = `${session.completedMessages} of ${session.totalMessages} turns${suffix ? ` · ${suffix}` : ''}`;
    }
  }

  const loop = BlueRoomLoop.createLoop({ request, onUpdate: renderSession, onError: error => notice(error.message), onState: controls });

  function resetTranscript() {
    rendered.clear();
    seenSpeakers.clear();
    $('transcript').replaceChildren();
  }

  function renderContextPrompt(prompt) {
    const context = $('context-prompt');
    const paragraphs = String(prompt ?? '').trim().split(/\r?\n\s*\r?\n/);
    const first = paragraphs.shift() || '';
    const rest = paragraphs.join('\n\n');
    context.replaceChildren(document.createTextNode(first));
    if (!rest) return;
    const more = document.createElement('a');
    more.href = '#';
    more.className = 'blue-room-context-more';
    more.textContent = 'more…';
    more.addEventListener('click', event => {
      event.preventDefault();
      context.textContent = String(prompt ?? '').trim();
    });
    context.append(document.createTextNode(' '), more);
  }

  function showDetail(value) {
    form.hidden = true;
    $('context-prompt').hidden = false;
    renderContextPrompt(value.contextPrompt);
    historyPanel.hidden = true;
    sessionPanel.hidden = false;
    setHeader(sessionTitle(value), { back: true });
  }

  async function renderSession(snapshot) {
    if (session?.id !== snapshot.session.id) resetTranscript();
    session = snapshot.session;
    showDetail(session);
    for (const message of [...(snapshot.messages || [])].sort((a, b) => a.turnIndex - b.turnIndex)) {
      if (rendered.has(message.turnIndex)) continue;
      rendered.add(message.turnIndex);
      const participant = session.participants[message.speaker];
      const showProvider = !seenSpeakers.has(message.speaker);
      seenSpeakers.add(message.speaker);

      const article = document.createElement('article');
      article.className = `blue-room-message blue-room-message-person-${participant.roleIndex}`;
      const name = document.createElement('button');
      name.type = 'button';
      name.className = 'blue-room-speaker';
      name.textContent = participant.name || providers[message.speaker];
      name.setAttribute('aria-haspopup', 'dialog');
      name.addEventListener('click', () => reveal(message.speaker));
      const meta = document.createElement('span');
      meta.className = 'blue-room-meta';
      meta.textContent = `${showProvider ? `${providers[message.speaker]} · ` : ''}Turn ${message.turnIndex + 1}`;
      const text = document.createElement('p');
      text.className = 'blue-room-message-text';
      const animate = loop.running && !document.hidden;
      article.setAttribute('aria-busy', 'true');
      article.append(name, meta, text);
      $('transcript').append(article);
      revealing = animate;
      controls();
      await playback.play(message.text, visible => {
        const follow = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 180;
        text.textContent = visible;
        if (follow && loop.running) text.scrollIntoView({ block: 'nearest' });
      }, { wordsPerMinute: animate ? READING_WPM : 0 });
      article.setAttribute('aria-busy', 'false');
      revealing = false;
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

  async function refreshHistory() {
    try {
      const { sessions } = await request('/sessions?limit=50');
      $('sessions').replaceChildren();
      $('history-notice').textContent = sessions.length ? '' : 'No conversations yet. Start the first one above.';
      for (const item of sessions) {
        const row = document.createElement('span');
        row.className = 'blue-room-session-link';
        const link = document.createElement('a');
        const url = new URL(location.href);
        url.searchParams.set('sessionId', item.id);
        link.href = url.href;
        link.textContent = `${item.emoji || '🌀'} ${item.title || 'Conversation'}`;
        link.addEventListener('click', event => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          if (!loading) openSession(item.id, { updateUrl: true });
        });
        row.append(link);
        $('sessions').append(row);
      }
    } catch (error) {
      $('history-notice').textContent = `History unavailable. ${error.message}`;
    }
  }

  async function showList({ updateUrl = false } = {}) {
    const version = ++operation;
    loading = true;
    controls();
    await pause();
    if (version !== operation) return;
    session = null;
    resetTranscript();
    form.hidden = false;
    $('context-prompt').hidden = true;
    $('context-prompt').textContent = '';
    historyPanel.hidden = false;
    sessionPanel.hidden = true;
    setHeader('🌀 Blue Room');
    notice();
    if (updateUrl) setUrl(null);
    await refreshHistory();
    if (version === operation) {
      loading = false;
      controls();
      $('scenario').focus();
    }
  }

  async function openSession(id, { updateUrl = false } = {}) {
    const version = ++operation;
    loading = true;
    notice();
    controls();
    await pause();
    try {
      const snapshot = await request(`/sessions/${encodeURIComponent(id)}`);
      if (version !== operation) return;
      await renderSession(snapshot);
      if (updateUrl) setUrl(id);
      notice();
    } catch (error) {
      if (version === operation) notice(error.message);
    } finally {
      if (version === operation) {
        loading = false;
        controls();
      }
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (loading || loop.settling) return;
    const contextPrompt = $('scenario').value.trim();
    if (!contextPrompt) return;
    const version = ++operation;
    loading = true;
    notice('Forming identities…');
    controls();
    try {
      const person1 = Math.random() < 0.5 ? 'claude' : 'openai';
      const snapshot = await request('/sessions', { method: 'POST', body: JSON.stringify({ contextPrompt, person1 }) });
      if (version !== operation) return;
      await renderSession(snapshot);
      setUrl(snapshot.session.id);
      notice();
      loading = false;
      controls();
      await loop.start(session.id);
      await refreshHistory();
    } catch (error) {
      if (version === operation) notice(error.message);
    } finally {
      if (version === operation) {
        loading = false;
        controls();
      }
    }
  });

  $('run-control').addEventListener('click', async () => {
    if (loading) return;
    if (loop.running) {
      await pause();
      await refreshHistory();
      return;
    }
    if (loop.settling || !session) return;
    const version = ++operation;
    const id = session.id;
    loading = true;
    notice();
    controls();
    try {
      const snapshot = await request(`/sessions/${encodeURIComponent(id)}`);
      if (version !== operation) return;
      await renderSession(snapshot);
      if (session.status === 'failed') {
        const result = await request(`/sessions/${encodeURIComponent(id)}/retry`, { method: 'POST' });
        if (version !== operation) return;
        session = result.session;
      }
      loading = false;
      controls();
      if (session.status !== 'completed') await loop.start(id);
      await refreshHistory();
    } catch (error) {
      if (version === operation) notice(error.message);
    } finally {
      if (version === operation) {
        loading = false;
        controls();
      }
    }
  });

  window.addEventListener('pagehide', () => { void pause(); });
  window.addEventListener('popstate', () => {
    const id = new URLSearchParams(location.search).get('sessionId');
    if (id) void openSession(id);
    else void showList();
  });

  loading = false;
  const initial = new URLSearchParams(location.search).get('sessionId');
  if (initial) await openSession(initial);
  else await showList();
})();
