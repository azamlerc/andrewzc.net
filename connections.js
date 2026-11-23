(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const api = "https://api.andrewzc.net";
  const names = { openai: "ChatGPT", claude: "Claude" };
  const outcomes = { correct: "Correct", one_away: "One away", incorrect: "Incorrect" };
  const lifecycle = { creating: "Creating puzzle", validating: "Reviewing puzzle", paused: "Paused", failed: "Stopped", won: "Won", lost: "Lost", ended: "Ended" };
  const ending = { solved: "Puzzle solved", mistakes: "Out of mistakes", director: "Game ended by the director", budget: "Game reached its turn limit", inactivity: "Game ended after several turns without a guess" };
  const errors = {
    controller_required: "This tab has read-only access to the game.",
    rate_limited: "The game service is at its request limit. Try again later.",
    not_found: "This game could not be found.",
    puzzle_rejected: "The Author could not produce a puzzle that passed review.",
    version_changed: "This game was paused on an older version. Start a new game to play again.",
    malformed_output: "A model returned an unusable turn. You can retry.",
    missing_api_key: "A model provider is unavailable.",
    refusal: "A model declined this turn. You can retry.",
    output_budget: "A model reached its response limit. You can retry.",
    provider_timeout: "The model took too long to respond. You can retry.",
    provider_unavailable: "A model provider could not complete this turn. You can retry.",
    budget: "Puzzle creation reached its call limit.",
  };

  const malformedStages = {
    authoring: "The Author returned a puzzle in an unexpected format.",
    cold_review: "The blind solver returned its review in an unexpected format.",
    quality_review: "The puzzle reviewer returned a verdict in an unexpected format.",
    author_turn: "The Author returned a turn in an unexpected format.",
    player_turn: "The Player returned a turn in an unexpected format.",
  };

  const credentialsKey = (id) => `connections:controller:${id}`;
  const pendingKey = "connections:pending-launch";
  const tileTapMs = 1000;
  const finalTileTapMs = 220;
  const selectionHoldMs = 280;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const defaultEmoji = "🧩";
  const gamePath = (id) => `/games/${encodeURIComponent(id)}`;
  const recent = (value) => value.events.findLast((event) => event.type === "guess_resolved");
  const pairing = (value) => `${names[value.author.provider]} as Author, ${names[value.player.provider]} as Player`;
  const author = "openai";
  let snapshot = null;
  let controlToken = null;
  let running = false;
  let updating = false;
  let driver = null;
  let runVersion = 0;
  let navigation = 0;
  let historyCursor = null;
  let loadingHistory = false;
  let lastEvent = 0;
  let boardKey = "";
  let replay = null;

  function element(tag, text, className) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text) item.textContent = text;
    return item;
  }

  function notice(message = "") {
    $("notice").hidden = !message;
    $("notice").textContent = message;
  }

  async function request(path, { body, token } = {}) {
    const url = `${api}/connections${path}`;
    let response;
    try {
      response = await fetch(url, {
        ...(body && { method: "POST", body: JSON.stringify(body) }),
        headers: {
          ...(body && { "Content-Type": "application/json" }),
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
    } catch {
      throw new Error(`Could not reach the Connections API at ${api}. Check the browser’s Network panel.`);
    }
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error(`Expected JSON from ${response.url || url} (HTTP ${response.status}).`);
    }
    const data = await response.json();
    if (!response.ok) throw new Error(errors[data.error] || `The Connections API returned HTTP ${response.status}.`);
    return data;
  }

  function setUrl(id) {
    const url = new URL(location.href);
    if (id) url.searchParams.set("gameId", id);
    else url.searchParams.delete("gameId");
    history.pushState(null, "", url);
  }

  function gameLink(row) {
    const url = new URL(location.href);
    url.searchParams.set("gameId", row.id);
    const link = element("a");
    link.href = url.href;
    const icon = element("span", row.emoji || defaultEmoji);
    icon.setAttribute("aria-hidden", "true");
    link.append(icon, document.createTextNode(` ${row.title || lifecycle[row.status] || "Game in progress"}`));
    link.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      setUrl(row.id);
      void openGame(row.id);
    });
    const item = element("li");
    item.append(link);
    return item;
  }

  async function loadHistory(reset = false) {
    if (loadingHistory && !reset) return;
    const view = navigation;
    loadingHistory = true;
    $("more").disabled = true;
    if (reset) {
      historyCursor = null;
      $("games").replaceChildren();
      $("history-note").textContent = "Loading games…";
    }
    try {
      const { games, next } = await request(`/games${historyCursor ? `?before=${encodeURIComponent(historyCursor)}` : ""}`);
      if (view !== navigation) return;
      $("games").append(...games.map(gameLink));
      historyCursor = next;
      $("more").hidden = !next;
      $("history-note").textContent = $("games").children.length ? "" : "No saved games yet.";
    } catch (error) {
      if (view === navigation) $("history-note").textContent = error.message;
    } finally {
      if (view === navigation) {
        loadingHistory = false;
        $("more").disabled = false;
      }
    }
  }

  function setTitle(title = "Connections", emoji = defaultEmoji) {
    $("game-emoji").textContent = emoji;
    $("game-title").textContent = title;
    document.title = title;
  }

  function showLobby() {
    navigation++;
    running = false;
    replay = null;
    snapshot = null;
    controlToken = null;
    $("game").hidden = true;
    $("game-actions").hidden = true;
    $("lobby-actions").hidden = false;
    $("lobby").hidden = false;
    setTitle();
    notice();
    void loadHistory(true);
  }

  function openPanel() {
    replay = null;
    boardKey = "";
    lastEvent = 0;
    $("chat").replaceChildren();
    $("game-actions").hidden = false;
    $("lobby-actions").hidden = true;
    $("lobby").hidden = true;
    $("game").hidden = false;
  }

  async function openGame(id) {
    const view = ++navigation;
    running = false;
    snapshot = null;
    controlToken = null;
    $("game-actions").hidden = false;
    $("lobby-actions").hidden = true;
    $("lobby").hidden = true;
    $("game").hidden = true;
    setTitle();
    updateControls();
    notice("Opening game…");
    try {
      const { game } = await request(gamePath(id));
      if (view !== navigation) return;
      controlToken = sessionStorage.getItem(credentialsKey(id));
      openPanel();
      notice();
      render(game);
    } catch (error) {
      if (view === navigation) notice(error.message);
    }
  }

  function updateControls() {
    $("new-game").disabled = updating;
    if (!snapshot) {
      for (const id of ["run", "end", "replay", "again"]) $(id).hidden = true;
      return;
    }
    const terminal = ["won", "lost", "ended"].includes(snapshot.status);
    const active = running && !document.hidden;
    $("again").hidden = !terminal && (snapshot.canAdvance || ["paused", "failed"].includes(snapshot.status) && snapshot.activity !== "done");
    $("again").disabled = updating;
    $("run").hidden = Boolean(replay) || !controlToken || (!snapshot.canAdvance && !["paused", "failed"].includes(snapshot.status)) ||
      snapshot.activity === "done";
    $("run").disabled = updating;
    $("run").textContent = active ? "Pause" : snapshot.status === "failed" ? "Retry"
      : terminal ? "Finish conversation" : "Resume";
    $("end").hidden = !controlToken || terminal;
    $("end").disabled = updating;
    $("replay").hidden = !terminal || !snapshot.tiles.length || snapshot.activity === "retrospective" && running;
    $("replay").textContent = replay ? "Exit replay" : "Replay";
  }

  function tileTerms(ids, words) { return ids.map((id) => words.get(id)).join(", "); }

  function selectTile(tile) {
    tile.classList.add("selected");
    tile.setAttribute("aria-label", `${tile.textContent}, selected by Player`);
  }

  async function playGuess(tiles, finalGroup) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const [index, tile] of tiles.entries()) {
      if (index && !reduceMotion) await sleep(finalGroup ? finalTileTapMs : tileTapMs);
      if (!tile.isConnected) return;
      selectTile(tile);
    }
    await sleep(selectionHoldMs);
  }

  function renderBoard(game, solution, words, animateGuess) {
    const selected = new Set(game.pendingGuess?.tileIds);
    const pendingTiles = new Map();
    const rows = solution ? [...game.solved, ...solution.groups.filter((row) => !game.solved.some(({ color }) => row.color === color))] : game.solved;
    const solvedIds = new Set(rows.flatMap((row) => row.tileIds));
    const key = JSON.stringify([game.status, game.tiles, game.solved, game.pendingGuess, game.mistakes, game.hintCount, solution]);
    if (key === boardKey) return;
    boardKey = key;
    $("statistics").hidden = game.tiles.length === 0;
    $("board-placeholder").hidden = game.tiles.length > 0 || ["ended", "failed"].includes(game.status);
    $("solved").replaceChildren(...rows.map((row) => {
      const item = element("div", null, `group ${row.color}`);
      item.append(element("strong", row.title), element("span", tileTerms(row.tileIds, words)));
      item.setAttribute("aria-label", `${row.color} category, ${row.title}: ${tileTerms(row.tileIds, words)}`);
      return item;
    }));
    $("tiles").replaceChildren(...game.tiles.filter(({ id }) => !solvedIds.has(id)).map(({ id, text }) => {
      const tile = element("li", text, "tile");
      const wordLength = Math.max(...text.split(/[\s-]+/u).map((word) => [...word].length), 4);
      tile.style.setProperty("--word-length", Math.min(wordLength, 12));
      if (selected.has(id)) {
        if (animateGuess) pendingTiles.set(id, tile);
        else selectTile(tile);
      }
      return tile;
    }));
    $("mistakes").replaceChildren(...Array.from({ length: 4 }, (_, i) => element("i", null, i < game.mistakes ? "remaining" : "")));
    $("mistake-number").textContent = `${game.mistakes} of 4`;
    $("hints").textContent = game.hintCount > 0 ? `${game.hintCount} ${game.hintCount === 1 ? "hint" : "hints"}` : "";
    $("solution").hidden = !solution;
    $("explanations").replaceChildren();
    if (solution) {
      for (const row of solution.groups) {
        const item = element("section", null, "explanation");
        item.append(element("h4", row.title), element("p", row.rule));
        const list = element("ul");
        for (const { id, explanation } of row.members) {
          const member = element("li");
          member.append(element("strong", words.get(id)), document.createTextNode(` — ${explanation}`));
          list.append(member);
        }
        item.append(list);
        $("explanations").append(item);
      }
      const decoy = element("section", null, "explanation");
      decoy.append(element("h4", `Decoy · ${solution.decoy.title}`),
        element("p", tileTerms(solution.decoy.tileIds, words)), element("p", solution.decoy.explanation));
      $("explanations").append(decoy);
    }
    if (pendingTiles.size) return game.pendingGuess.tileIds.map((id) => pendingTiles.get(id)).filter(Boolean);
  }

  function transcript(event, game, words) {
    const { type } = event;
    if (["chat", "hint", "retrospective"].includes(type)) {
      const row = element("article");
      row.dataset.role = event.role;
      const who = event.role === "author" ? "Author" : "Player";
      const note = type === "hint" ? " · Hint" : type === "retrospective" ? " · After the game" : "";
      row.append(element("p", `${who} · ${names[game[event.role].provider]}${note}`, "speaker"),
        element("p", event.text, "speech"));
      return row;
    }
    if (type === "guess_previewed") return element("p", `Player selected ${tileTerms(event.tileIds, words)}`, "event");
    if (type === "guess_resolved") {
      const outcome = event.automatic ? "Final group completed" : outcomes[event.outcome];
      return element("p", event.group ? `${outcome} · ${event.group.title}` : `${outcome} · ${event.mistakes} remaining`, "event");
    }
    if (type === "hint_requested") return element("p", event.topic ? `Player requested a hint about ${event.topic}` : "Player requested a hint", "event");
    if (type === "outcome") return element("p", ending[event.reason] || "Game over", "event");
    return null;
  }

  function render(game, { playback = false, animateGuess = false } = {}) {
    if (!playback) snapshot = game;
    const words = new Map(game.tiles.map(({ id, text }) => [id, text]));
    const solution = game.events.find(({ type }) => type === "solution_revealed");
    const title = playback ? solution?.title : game.title;
    const emoji = playback ? solution?.emoji : game.emoji ?? solution?.emoji;
    setTitle(title || undefined, title && emoji || undefined);
    const preview = renderBoard(game, solution, words, animateGuess);

    const phase = playback && game.status === "playing" ? "Replay" :
      lifecycle[game.status] || (game.pendingGuess ? "Guess preview" : running ? "Taking turns" : "Ready to resume");
    const caption = game.status === "creating" ? `${phase} · ${pairing(game)}` : phase;
    if ($("phase").textContent !== caption) $("phase").textContent = caption;
    const stageMessage = game.failure === "malformed_output" && malformedStages[game.failureStage];
    const reviewTimedOut = game.failure === "provider_timeout" &&
      ["authoring", "cold_review", "quality_review"].includes(game.failureStage);
    const failureMessage = stageMessage ? `${stageMessage} You can retry.`
      : reviewTimedOut ? "Board setup timed out. You can retry." : errors[game.failure];
    const move = game.pendingGuess ? `Player selected ${tileTerms(game.pendingGuess.tileIds, words)}.` :
      failureMessage || outcomes[recent(game)?.outcome] || "";
    if ($("move").textContent !== move) $("move").textContent = move;

    const chat = $("chat");
    for (const event of game.events) {
      if (event.seq <= lastEvent) continue;
      lastEvent = event.seq;
      const row = transcript(event, game, words);
      if (row) chat.prepend(row);
    }
    chat.hidden = chat.children.length === 0;
    updateControls();
    if (preview) return playGuess(preview, game.solved.length === 3);
  }

  async function launch() {
    if (updating) return;
    const view = navigation;
    updating = true;
    updateControls();
    notice("Starting game…");
    try {
      let pending = JSON.parse(sessionStorage.getItem(pendingKey) || "null");
      if (!pending || pending.author !== author) {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        pending = { author, creation: crypto.randomUUID(), token: Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("") };
        sessionStorage.setItem(pendingKey, JSON.stringify(pending));
      }
      const { game } = await request("/games", {
        body: { author: pending.author, creation: pending.creation }, token: pending.token,
      });
      sessionStorage.setItem(credentialsKey(game.id), pending.token);
      sessionStorage.removeItem(pendingKey);
      if (view !== navigation) return;
      navigation++;
      running = false;
      controlToken = pending.token;
      setUrl(game.id);
      openPanel();
      notice();
      render(game);
      start();
    } catch (error) {
      if (view === navigation) notice(error.message);
    } finally {
      updating = false;
      updateControls();
    }
  }

  function start() {
    if (!snapshot?.canAdvance || !controlToken || running || document.hidden) return;
    const view = navigation;
    const id = snapshot.id;
    const token = controlToken;
    const version = ++runVersion;
    const current = () => view === navigation && version === runVersion;
    running = true;
    updateControls();
    const previous = driver;
    driver = (async () => {
      if (previous) await previous;
      let busy = 0;
      while (current() && running && snapshot.canAdvance && !document.hidden) {
        if (snapshot.pendingGuess && snapshot.status === "playing") {
          const remaining = snapshot.pendingGuess.resolveAfter - Date.now();
          if (remaining > 0) await sleep(Math.min(remaining, 700));
          if (!current() || !running || document.hidden) break;
        }
        const { game, reason } = await request(`${gamePath(id)}/advance`, { body: { revision: snapshot.revision }, token });
        if (!current()) break;
        if (!replay && game.revision >= snapshot.revision) {
          await render(game, { animateGuess: running });
          if (!current()) break;
        }
        if (reason === "rate_limited") throw new Error(errors.rate_limited);
        if (!running || !snapshot.canAdvance) break;
        if (reason === "busy" || reason === "preview") {
          if (++busy >= 30) throw new Error("The next turn is still busy. Resume to try again.");
          await sleep(reason === "preview" ? 200 : Math.min(200 * busy, 1500));
        } else {
          busy = 0;
          if (!game.pendingGuess) await sleep(260);
        }
      }
    })().catch((error) => {
      if (current() && running) notice(error.message);
    }).finally(() => {
      if (current()) {
        running = false;
        if (!replay) render(snapshot);
      }
    });
  }

  async function command(commandName) {
    if (updating || !snapshot || !controlToken) return;
    const view = navigation;
    const token = controlToken;
    updating = true;
    running = false;
    runVersion++;
    updateControls();
    notice();
    try {
      let { game } = await request(gamePath(snapshot.id));
      for (let attempt = 0; attempt < 3 && view === navigation; attempt++) {
        if (["won", "lost", "ended"].includes(game.status)) break;
        if (commandName === "resume" && !["paused", "failed"].includes(game.status)) break;
        if (commandName === "pause" && game.status === "paused") break;
        const result = await request(`${gamePath(game.id)}/control`, { body: { command: commandName, revision: game.revision }, token });
        game = result.game;
        if (result.reason !== "stale" || ["won", "lost", "ended"].includes(game.status)) break;
      }
      if (view !== navigation) return;
      render(game);
      if (commandName !== "pause") start();
      else if (game.status !== "paused" && !["won", "lost", "ended", "failed"].includes(game.status)) notice("The game settled during pause. Try pausing again if needed.");
    } catch (error) {
      if (view === navigation) notice(error.message);
    } finally {
      updating = false;
      updateControls();
    }
  }

  function resetReplayView() {
    lastEvent = 0;
    boardKey = "";
    $("chat").replaceChildren();
  }

  async function playReplay() {
    if (replay) {
      replay = null;
      resetReplayView();
      render(snapshot);
      return;
    }
    const saved = snapshot;
    if (!saved) return;
    const playback = {};
    replay = playback;
    resetReplayView();
    const game = { ...saved, title: null, status: "playing", tiles: [], solved: [], mistakes: 4, hintCount: 0, pendingGuess: null, events: [] };
    for (const event of saved.events) {
      if (replay !== playback) return;
      game.events.push(event);
      if (event.type === "board_published") game.tiles = event.tiles;
      if (event.type === "guess_previewed") game.pendingGuess = { tileIds: event.tileIds };
      if (event.type === "guess_resolved") {
        game.pendingGuess = null;
        game.mistakes = event.mistakes;
        if (event.group) game.solved.push(event.group);
      }
      if (event.type === "hint") game.hintCount++;
      if (event.type === "outcome") {
        game.status = event.status;
        game.pendingGuess = null;
      }
      const isGuess = event.type === "guess_previewed";
      await render(game, { playback: true, animateGuess: isGuess });
      if (!isGuess && event.type !== "outcome") await sleep(600);
    }
    if (replay === playback) {
      replay = null;
      render(saved);
    }
  }

  $("new-game").addEventListener("click", () => void launch());
  $("again").addEventListener("click", () => void launch());
  $("more").addEventListener("click", () => void loadHistory());
  $("back").addEventListener("click", () => { setUrl(null); showLobby(); });
  $("run").addEventListener("click", () => void command(running ? "pause" : "resume"));
  $("end").addEventListener("click", () => void command("end"));
  $("replay").addEventListener("click", () => void playReplay());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      running = false;
      if (snapshot && !replay) updateControls();
    }
  });

  function fromUrl() {
    const id = new URLSearchParams(location.search).get("gameId");
    if (id) void openGame(id);
    else showLobby();
  }
  window.addEventListener("popstate", fromUrl);
  fromUrl();
})();
