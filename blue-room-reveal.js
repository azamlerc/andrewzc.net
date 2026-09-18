// Cosmetic playback of committed text. No provider calls or transcript edits.
(function (root) {
  function createReveal({ schedule = setTimeout, cancel = clearTimeout } = {}) {
    let finish = null;
    return {
      skip() { finish?.(); },
      play(text, write, { wordsPerMinute = 240 } = {}) {
        finish?.();
        if (!wordsPerMinute) { write(text); return Promise.resolve(); }
        // Preserve all whitespace and avoid slicing emoji/surrogate pairs.
        const chunks = text.match(/\S+\s*|\s+/gu) || [];
        return new Promise(resolve => {
          let index = 0, visible = '', timer;
          const done = () => { cancel(timer); write(text); finish = null; resolve(); };
          finish = done;
          const tick = () => {
            if (index >= chunks.length) { done(); return; }
            visible += chunks[index++]; write(visible);
            timer = schedule(tick, 60000 / wordsPerMinute);
          };
          tick();
        });
      },
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createReveal };
  else root.BlueRoomReveal = { createReveal };
})(globalThis);
