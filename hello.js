(function () {
  const LIVE_API   = "https://api.andrewzc.net";
  const LOCAL_API  = "http://localhost:3000";
  const CHAT_PATH  = "/chat/hello";
  const chatEl     = document.getElementById("chat");

  let history = [];
  let waiting = false;
  let apiBase = LIVE_API; // resolved after probe

  // If on localhost, probe the local server; use it if reachable, else fall back to live.
  const apiReady = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? fetch(`${LOCAL_API}/healthz`, { mode: "no-cors", signal: AbortSignal.timeout(1000) })
        .then(() => { apiBase = LOCAL_API; })
        .catch(() => { /* local server not up, stay on live */ })
    : Promise.resolve();

  // ---- DOM helpers ----

  function addMessage(text, role) {
    const div = document.createElement("div");
    div.className = `chat-message chat-${role}`;
    div.textContent = text;
    chatEl.appendChild(div);
    return div;
  }

  function addImages(images, list) {
    if (!images || !images.length) return;
    const shown = images.slice(0, 3);
    const cls   = shown.length === 1 ? "single" : shown.length === 2 ? "double" : "triple";
    const grid  = document.createElement("div");
    grid.className = `images ${cls} chat-images`;
    for (const filename of shown) {
      const tn  = `https://images.andrewzc.net/${list}/tn/${filename}`;
      const url = `https://images.andrewzc.net/${list}/${filename}`;
      const a   = document.createElement("a");
      a.href    = url;
      a.target  = "_blank";
      const img = document.createElement("img");
      img.src   = tn;
      img.alt   = filename;
      a.appendChild(img);
      grid.appendChild(a);
    }
    chatEl.appendChild(grid);
  }

  function addThinking() {
    const div = document.createElement("div");
    div.className = "chat-message chat-bot chat-thinking";
    div.textContent = "…";
    chatEl.appendChild(div);
    return div;
  }

  function scrollToBottom() {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  // ---- Input bar ----

  const bar   = document.createElement("div");
  bar.className = "chat-input-bar";
  const input = document.createElement("input");
  input.type        = "text";
  input.placeholder = "Ask me anything…";
  input.className   = "chat-input";
  const button = document.createElement("button");
  button.textContent = "→";
  button.className   = "chat-send";
  bar.appendChild(input);
  bar.appendChild(button);

  // Insert bar after the chat div
  chatEl.parentNode.insertBefore(bar, chatEl.nextSibling);

  input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
  button.addEventListener("click", submit);

  // ---- Chat logic ----

  async function submit() {
    const text = input.value.trim();
    if (!text || waiting) return;
    input.value = "";
    send(text);
  }

  async function send(text, isGreeting = false) {
    waiting = true;
    input.disabled  = true;
    button.disabled = true;

    if (!isGreeting) {
      addMessage(text, "user");
      scrollToBottom();
    }

    const thinking = addThinking();
    scrollToBottom();

    try {
      const res = await fetch(`${apiBase}${CHAT_PATH}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ history, message: text }),
      });

      thinking.remove();

      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();

      // Strip any markdown image/link syntax the bot might have included
      const reply = (data.reply || "")
        .replace(/!?\[.*?\]\(https?:\/\/images\.andrewzc\.net[^)]*\)/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();

      addMessage(reply, "bot");
      if (data.images && data.images.length) addImages(data.images, data.list);
      scrollToBottom();

      // Update history — store plain text only
      if (!isGreeting) history.push({ role: "user", content: text });
      history.push({ role: "assistant", content: reply });

    } catch (err) {
      thinking.remove();
      addMessage("Sorry, something went wrong. Try again?", "bot");
      scrollToBottom();
      console.error(err);
    }

    waiting         = false;
    input.disabled  = false;
    button.disabled = false;
    input.focus();
  }

  // ---- Styles ----

  const style = document.createElement("style");
  style.textContent = `
    .chat-message {
      font: 24pt Avenir;
      margin: 16px 0;
      max-width: 800px;
      line-height: 1.4;
    }

    .chat-user {
      color: black;
    }

    .chat-bot {
      color: #999;
    }

    .chat-thinking {
      opacity: 0.4;
    }

    .chat-images {
      margin-top: 8px;
      margin-bottom: 8px;
    }

    .chat-images img {
      object-fit: cover;
    }

    .chat-input-bar {
      margin-top: 20px;
      margin-bottom: 20px;
    }

    .chat-input {
      font: 24pt Avenir;
      color: #999;
      border: none;
      border-bottom: 1px solid #ccc;
      background: none;
      outline: none;
      -webkit-appearance: none;
      appearance: none;
      padding: 0;
      width: 700px;
    }

    .chat-send {
      font: 24pt Avenir;
      color: black;
      border: none;
      background: none;
      cursor: pointer;
      padding: 0;
      margin-left: 16px;
    }

    .chat-send:disabled {
      opacity: 0.3;
      cursor: default;
    }

    @media (prefers-color-scheme: dark) {
      .chat-user {
        color: white;
      }
      .chat-input {
        color: #666;
        border-bottom-color: #333;
      }
      .chat-send {
        color: white;
      }
    }
  `;
  document.head.appendChild(style);

  // ---- Boot: greeting ----
  // Wait for the API probe before sending the greeting so we know which server to use.

  apiReady.then(() => send("Hi!", true));
  input.focus();

})();
