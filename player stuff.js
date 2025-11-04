trackPlayerEvents(player, media, metaOrFn = {}) {
  // Tear down any prior session first
  if (this._playerSession?.active) {
    this.playerSessionEnd("load_new_url");
  }

  // Resolve meta later if a function was passed
  const initialMeta = (typeof metaOrFn === "function") ? {} : (metaOrFn || {});
  const resolveLater = (typeof metaOrFn === "function");

  // Minimal session state (keep it simple + robust)
  this._playerSession = {
    active: true,
    sent: false,
    url: () => media.currentSrc || initialMeta.src || initialMeta.url || "",
    meta: { ...initialMeta },     // will be enriched below if metaOrFn is a function
    startedAt: Date.now(),
    lastPlayStart: null,          // timestamp when we entered "playing"
    watchedMs: 0,                 // accumulated while actually playing
    lastTime: 0,                  // last known media time (for raw logs)
  };

  // If a metaForLoad(url) function was provided, resolve it now (async or sync)
  if (resolveLater) {
    (async () => {
      const ctx = { url: this._playerSession.url(), player, media };
      const resolved = await resolveMeta(metaOrFn, ctx);
      // Merge into live session meta so subsequent logs include it
      if (this._playerSession?.active) {
        this._playerSession.meta = { ...this._playerSession.meta, ...resolved };
      }
    })();
  }

  // Also backfill duration once metadata is available
  const onLoadedMeta = () => {
    if (!this._playerSession?.active) return;
    const d = media.duration;
    if (Number.isFinite(d) && d > 0 && this._playerSession.meta.durationSec == null) {
      this._playerSession.meta.durationSec = Math.round(d);
    }
    media.removeEventListener("loadedmetadata", onLoadedMeta);
  };
  media.addEventListener("loadedmetadata", onLoadedMeta, { once: true, passive: true });

  // ——— Helpers ———
  const enterPlaying = () => {
    if (!this._playerSession?.active) return;
    if (this._playerSession.lastPlayStart == null) {
      this._playerSession.lastPlayStart = Date.now();
    }
    if (this.config.player.raw) {
      this.logEvent("player_state", {
        state: "playing",
        current_time: media.currentTime || 0,
        src: this._playerSession.url(),
        ...snakeMeta(this._playerSession.meta),
      });
    }
  };

  const leavePlaying = (state) => {
    if (!this._playerSession?.active) return;
    if (this._playerSession.lastPlayStart != null) {
      this._playerSession.watchedMs += Date.now() - this._playerSession.lastPlayStart;
      this._playerSession.lastPlayStart = null;
    }
    if (this.config.player.raw && state) {
      this.logEvent("player_state", {
        state,
        current_time: media.currentTime || 0,
        src: this._playerSession.url(),
        ...snakeMeta(this._playerSession.meta),
      });
    }
  };

  const onPlaying = () => enterPlaying();
  const onPause = () => leavePlaying("pause");
  const onWaiting = () => leavePlaying("waiting");
  const onStalled = () => leavePlaying("stalled");
  const onSeeking = () => {
    // Don’t count seek time as watching
    leavePlaying("seeking");
    if (this.config.player.raw) {
      this.logEvent("player_seek", {
        current_time: media.currentTime || 0,
        src: this._playerSession.url(),
        ...snakeMeta(this._playerSession.meta),
      });
    }
  };
  const onSeeked = () => {
    if (this.config.player.raw) {
      this.logEvent("player_seeked", {
        current_time: media.currentTime || 0,
        src: this._playerSession.url(),
        ...snakeMeta(this._playerSession.meta),
      });
    }
  };
  const onEnded = () => {
    leavePlaying("ended");
    this.playerSessionEnd("ended");
  };

  // ——— Wire media events ———
  media.addEventListener("playing", onPlaying);
  media.addEventListener("pause", onPause);
  media.addEventListener("waiting", onWaiting);
  media.addEventListener("stalled", onStalled);
  media.addEventListener("seeking", onSeeking);
  media.addEventListener("seeked", onSeeked);
  media.addEventListener("ended", onEnded);

  // ——— Shaka lifecycle hooks, if present ———
  // Close current session on new loads/unloads; a new call to trackPlayerEvents
  // will begin the next session (your current pattern).
  try {
    player.addEventListener("loading", () => {
      this.playerSessionEnd("load_new_url");
    });
  } catch (_) {}

  try {
    player.addEventListener("unloading", () => {
      this.playerSessionEnd("unload");
    });
  } catch (_) {}

  // Stash a detach to clean up listeners if you need to manually stop tracking
  this._playerSession.detach = () => {
    media.removeEventListener("playing", onPlaying);
    media.removeEventListener("pause", onPause);
    media.removeEventListener("waiting", onWaiting);
    media.removeEventListener("stalled", onStalled);
    media.removeEventListener("seeking", onSeeking);
    media.removeEventListener("seeked", onSeeked);
    media.removeEventListener("ended", onEnded);
    media.removeEventListener("loadedmetadata", onLoadedMeta);
  };

  // If the media is already playing when we attach:
  if (!media.paused && !media.ended) enterPlaying();
}

// inside class SenzaAnalytics
playerSessionEnd(reason = "unknown") {
  const s = this._playerSession;
  if (!s?.active) return;

  // finalize "playing" window
  if (s.lastPlayStart != null) {
    s.watchedMs += Date.now() - s.lastPlayStart;
    s.lastPlayStart = null;
  }

  // Raw: final edge event for debugging
  if (this.config.player.raw) {
    this.logEvent("player_state", {
      state: "closing",
      reason,
      current_time: (typeof document !== "undefined" && this._safeMediaTime()) || 0,
      src: s.url(),
      ...snakeMeta(this._playerSession.meta),
    });
  }

  // Summary: one clean message per stream
  if (this.config.player.summary && !s.sent) {
    this.sendPlayerSummary(reason);
  }

  // cleanup
  s.sent = true;
  s.active = false;
  try { s.detach?.(); } catch (_) {}
}

_safeMediaTime() {
  // best-effort current time probe for raw logs
  // (if you need, you can pass media into session; keeping minimal here)
  return 0;
}

// inside class SenzaAnalytics
sendPlayerSummary(reason) {
  const s = this._playerSession;
  if (!s) return;

  // Derive duration and watch ratio if available
  const mediaDurationSec =
    (s.meta?.durationSec != null ? s.meta.durationSec : null); // optionally inject from caller
  const watchedMs = Math.max(0, Math.round(s.watchedMs));
  const watchedSec = Math.round(watchedMs / 1000);
  const payload = {
    src: s.url(),
    reason,                        // ended | unload | load_new_url | session_end | unknown
    started_at_ms: s.startedAt,    // epoch ms
    watched_ms: watchedMs,
    watched_sec: watchedSec,
    ...snakeMeta(this._playerSession.meta),
  };

  if (typeof mediaDurationSec === "number" && isFinite(mediaDurationSec) && mediaDurationSec > 0) {
    payload.duration_sec = Math.round(mediaDurationSec);
    payload.watch_ratio = Math.min(
      1,
      Math.round((watchedSec / mediaDurationSec) * 1000) / 1000
    );
  }

  this.logEvent("player_session_end", payload);
}

// in constructor
senza.lifecycle.addEventListener("userdisconnected", async () => {
  // first: close any active stream with a single summary
  this.playerSessionEnd("session_end");

  // then: keep your existing lifecycle summary flow
  await this.lifecycleSessionEnd();
});

// Helper: run metaForLoad safely (sync or async), always returns an object
async function resolveMeta(metaForLoad, ctx) {
  if (typeof metaForLoad !== 'function') return {};
  try {
    const maybe = metaForLoad(ctx);
    const meta = (maybe && typeof maybe.then === 'function') ? await maybe : maybe;
    return (meta && typeof meta === 'object') ? meta : {};
  } catch (e) {
    // swallow and continue; you could log to console in dev if desired
    return {};
  }
}

// outside the class, near camelToSnake()
function snakeMeta(meta = {}) {
  const out = {};
  for (const k of Object.keys(meta)) {
    out[camelToSnake(k)] = meta[k];
  }
  return out;
}