// chat.js — generic chat client
// Call initChat(config) from a bot-specific script to start a chat session.
//
// config = {
//   chatPath:    string,   // API route, e.g. "/chat/hello"
//   placeholder: string,   // Input placeholder text
//   greeting:    string,   // Message sent silently to boot the conversation
// }

(function () {

  const LIVE_API  = "https://api.andrewzc.net";
  const LOCAL_API = "http://localhost:3000";

  // ---- API base resolution ----

  let apiBase = LIVE_API;

  const apiReady = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? fetch(`${LOCAL_API}/healthz`, { mode: "no-cors", signal: AbortSignal.timeout(1000) })
        .then(() => { apiBase = LOCAL_API; })
        .catch(() => { /* stay on live */ })
    : Promise.resolve();

  // ---- Styles (injected once) ----

  const style = document.createElement("style");
  style.textContent = `
    .chat-message {
      font: 16pt Avenir;
      margin: 16px 0;
      max-width: 800px;
      line-height: 1.4;
    }
    .chat-user { color: black; }
    .chat-bot  { color: #999; }
    .chat-thinking { opacity: 0.4; }

    .chat-images { margin-top: 8px; margin-bottom: 8px; }
    .chat-images img { object-fit: cover; }

    .chat-input-bar { margin-top: 20px; margin-bottom: 20px; }
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
    .chat-send:disabled { opacity: 0.3; cursor: default; }

    /* Markdown rendering inside bot messages */
    .chat-bot p { margin: 0.4em 0; }
    .chat-bot p:first-child { margin-top: 0; }
    .chat-bot p:last-child  { margin-bottom: 0; }
    .chat-bot h1, .chat-bot h2, .chat-bot h3 {
      font: 700 16pt Avenir;
      margin: 0.8em 0 0.3em;
      color: #999;
    }
    .chat-bot ul, .chat-bot ol { margin: 0.4em 0; padding-left: 1.4em; }
    .chat-bot li { margin: 0.2em 0; }
    .chat-bot code {
      font-family: monospace;
      font-size: 0.85em;
      background: rgba(128,128,128,0.12);
      padding: 0.1em 0.3em;
      border-radius: 3px;
    }
    .chat-bot pre {
      background: rgba(128,128,128,0.1);
      border-radius: 6px;
      padding: 0.8em 1em;
      overflow-x: auto;
      margin: 0.6em 0;
    }
    .chat-bot pre code { background: none; padding: 0; font-size: 0.8em; }
    .chat-bot table { border-collapse: collapse; margin: 0.6em 0; font-size: 0.85em; }
    .chat-bot th, .chat-bot td { border: 1px solid #ccc; padding: 0.3em 0.7em; text-align: left; }
    .chat-bot th { font-weight: 500; }
    .chat-bot strong { font-weight: 500; color: #888; }
    .chat-bot hr { border: none; border-top: 1px solid #eee; margin: 0.8em 0; }

    @media (prefers-color-scheme: dark) {
      .chat-user { color: white; }
      .chat-input { color: #666; border-bottom-color: #333; }
      .chat-send  { color: white; }
      .chat-bot code { background: rgba(255,255,255,0.1); }
      .chat-bot pre  { background: rgba(255,255,255,0.08); }
      .chat-bot th, .chat-bot td { border-color: #444; }
      .chat-bot hr   { border-top-color: #333; }
      .chat-bot strong { color: #aaa; }
      .chat-bot h1, .chat-bot h2, .chat-bot h3 { color: #777; }
    }
  `;
  document.head.appendChild(style);

  // ---- Public init ----

  window.initChat = function (config) {
    const chatPath   = config.chatPath   || "/chat/hello";
    const placeholder = config.placeholder || "Ask me anything…";
    const greeting   = config.greeting   || "Hi!";

    const chatEl = document.getElementById("chat");
    let history  = [];
    let waiting  = false;

    // ---- DOM helpers ----

    function addMessage(text, role) {
      const div = document.createElement("div");
      div.className = `chat-message chat-${role}`;
      if (role === "bot" && typeof marked !== "undefined") {
        div.innerHTML = marked.parse(text);
      } else {
        div.textContent = text;
      }
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
        a.href = url; a.target = "_blank";
        const img = document.createElement("img");
        img.src = tn; img.alt = filename;
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

    const bar    = document.createElement("div");
    bar.className = "chat-input-bar";
    const input  = document.createElement("input");
    input.type        = "text";
    input.placeholder = placeholder;
    input.className   = "chat-input";
    const button = document.createElement("button");
    button.textContent = "→";
    button.className   = "chat-send";
    bar.appendChild(input);
    bar.appendChild(button);
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
        const res = await fetch(`${apiBase}${chatPath}`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ history, message: text }),
        });

        thinking.remove();
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const data = await res.json();

        const reply = (data.reply || "")
          .replace(/!?\[.*?\]\(https?:\/\/images\.andrewzc\.net[^)]*\)/g, "")
          .replace(/ {2,}/g, " ")  // collapse extra spaces only, not newlines
          .trim();

        addMessage(reply, "bot");
        if (data.images && data.images.length) addImages(data.images, data.list);
        scrollToBottom();

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

    // ---- Boot ----

    apiReady.then(() => send(greeting, true));
    input.focus();
  };

})();
