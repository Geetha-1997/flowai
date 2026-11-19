/* FlowAI frontend: vanilla JS, no build step. */
(() => {
  const $ = (id) => document.getElementById(id);
  const els = {
    main: $("main"), sidebar: $("sidebar"), backdrop: $("backdrop"),
    menuBtn: $("menuBtn"), newChat: $("newChat"), chatList: $("chatList"),
    status: $("status"), messages: $("messages"), thread: $("thread"),
    composer: $("composer"), input: $("input"),
    sendBtn: $("sendBtn"), stopBtn: $("stopBtn"),
  };

  const STORE_KEY = "flowai-v1";
  let state = load() || { chats: [], activeId: null };
  let abortController = null;

  /* ---------- persistence ---------- */
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch { return null; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }
  const activeChat = () => state.chats.find((c) => c.id === state.activeId);

  function newChat() {
    // Reuse an existing empty chat instead of piling up blank ones.
    const blank = state.chats.find((c) => !c.messages.length);
    if (blank) state.activeId = blank.id;
    else {
      const chat = { id: crypto.randomUUID(), title: "New chat", messages: [] };
      state.chats.unshift(chat);
      state.activeId = chat.id;
    }
    save(); renderAll(); closeSidebarOnMobile();
    els.input.focus();
  }

  /* ---------- markdown (small, safe renderer) ---------- */
  const escapeHtml = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function inline(text) {
    return escapeHtml(text)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  const splitRow = (line) =>
    line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

  function renderTable(rows) {
    const head = splitRow(rows[0]);
    const body = rows.slice(1).filter((r) => !/^[\s|:-]+$/.test(r)).map(splitRow);
    const th = head.map((c) => `<th>${inline(c)}</th>`).join("");
    const trs = body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("");
    return `<div class="table-wrap"><table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>`;
  }

  function renderMarkdown(src) {
    const out = [];
    src.split(/```/).forEach((part, i) => {
      if (i % 2 === 1) {                                   // fenced code block
        const nl = part.indexOf("\n");
        const code = nl === -1 ? part : part.slice(nl + 1);
        out.push(`<pre><button class="copy-btn" type="button">Copy</button><code>${escapeHtml(code.replace(/\n$/, ""))}</code></pre>`);
        return;
      }
      let list = null;
      let table = [];
      const flushList = () => { if (list) { out.push(`</${list}>`); list = null; } };
      const flushTable = () => { if (table.length) { out.push(renderTable(table)); table = []; } };
      part.split("\n").forEach((line) => {
        let m;
        if (/^\s*\|.*\|\s*$/.test(line)) { flushList(); table.push(line); return; }
        flushTable();
        if ((m = line.match(/^(#{1,3})\s+(.*)/))) {
          flushList(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
        } else if ((m = line.match(/^\s*[-*•]\s+(.*)/))) {
          if (list !== "ul") { flushList(); out.push("<ul>"); list = "ul"; }
          out.push(`<li>${inline(m[1])}</li>`);
        } else if ((m = line.match(/^\s*\d+\.\s+(.*)/))) {
          if (list !== "ol") { flushList(); out.push("<ol>"); list = "ol"; }
          out.push(`<li>${inline(m[1])}</li>`);
        } else if (line.trim() === "") {
          flushList();
        } else {
          flushList(); out.push(`<p>${inline(line)}</p>`);
        }
      });
      flushList(); flushTable();
    });
    return out.join("");
  }

  /* ---------- rendering ---------- */
  function renderChatList() {
    els.chatList.innerHTML = "";
    state.chats.forEach((chat) => {
      const item = document.createElement("div");
      item.className = "chat-item" + (chat.id === state.activeId ? " active" : "");
      const title = document.createElement("span");
      title.textContent = chat.title;
      const del = document.createElement("button");
      del.className = "del"; del.textContent = "×"; del.title = "Delete chat";
      del.onclick = (e) => { e.stopPropagation(); deleteChat(chat.id); };
      item.append(title, del);
      item.onclick = () => {
        if (abortController) return;
        state.activeId = chat.id; save(); renderAll(); closeSidebarOnMobile();
      };
      els.chatList.appendChild(item);
    });
  }

  function deleteChat(id) {
    if (abortController) return;
    state.chats = state.chats.filter((c) => c.id !== id);
    if (state.activeId === id) state.activeId = state.chats[0]?.id ?? null;
    if (!state.chats.length) return newChat();
    save(); renderAll();
  }

  function messageEl(role, text, { streaming = false } = {}) {
    const wrap = document.createElement("div");
    wrap.className = `msg ${role}` + (streaming ? " streaming" : "");
    if (role === "user") {
      const bubble = document.createElement("div");
      bubble.className = "bubble";
      bubble.textContent = text;
      wrap.appendChild(bubble);
      return { wrap, content: bubble };
    }
    const content = document.createElement("div");
    content.className = "content";
    content.innerHTML = renderMarkdown(text);
    wrap.appendChild(content);
    return { wrap, content };
  }

  function renderMessages() {
    const chat = activeChat();
    els.thread.innerHTML = "";
    const empty = !chat || !chat.messages.length;
    els.main.classList.toggle("is-empty", empty);
    if (empty) return;
    chat.messages.forEach((m) => els.thread.appendChild(messageEl(m.role, m.content).wrap));
    scrollToBottom();
  }

  function renderAll() { renderChatList(); renderMessages(); }
  function scrollToBottom() { els.messages.scrollTop = els.messages.scrollHeight; }

  function setStatus(text) { els.status.textContent = text; }

  function updateSendState() {
    els.sendBtn.disabled = !els.input.value.trim();
  }

  function setBusy(busy) {
    els.sendBtn.classList.toggle("hidden", busy);
    els.stopBtn.classList.toggle("hidden", !busy);
    if (!busy) els.input.focus();
  }

  /* ---------- chat ---------- */
  async function send(text) {
    const chat = activeChat();
    chat.messages.push({ role: "user", content: text });
    if (chat.messages.length === 1) chat.title = text.slice(0, 40);
    save(); renderChatList();

    els.main.classList.remove("is-empty");
    els.thread.appendChild(messageEl("user", text).wrap);
    const { wrap, content } = messageEl("assistant", "", { streaming: true });
    els.thread.appendChild(wrap);
    scrollToBottom();

    let reply = "";
    let failed = false;
    abortController = new AbortController();
    setBusy(true); setStatus("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.signal,
        body: JSON.stringify({ messages: chat.messages }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop();
        for (const ev of events) {
          if (!ev.startsWith("data: ")) continue;
          const data = JSON.parse(ev.slice(6));
          if (data.error) throw new Error(data.error);
          if (data.token) {
            reply += data.token;
            content.innerHTML = renderMarkdown(reply);
            scrollToBottom();
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        failed = true;
        wrap.classList.add("error");
        if (!reply) content.textContent = err.message;
        setStatus(err.message);
      }
    } finally {
      wrap.classList.remove("streaming");
      if (reply) chat.messages.push({ role: "assistant", content: reply });
      else {
        // Nothing came back: drop the dangling user message so history stays valid.
        if (chat.messages.at(-1)?.role === "user") chat.messages.pop();
        if (!failed) wrap.remove();
      }
      save();
      abortController = null;
      setBusy(false);
      updateSendState();
    }
  }

  /* ---------- events ---------- */
  els.composer.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = els.input.value.trim();
    if (!text || abortController) return;
    els.input.value = ""; autoGrow(); updateSendState();
    send(text);
  });
  els.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      els.composer.requestSubmit();
    }
  });
  function autoGrow() {
    els.input.style.height = "auto";
    els.input.style.height = Math.min(els.input.scrollHeight, 200) + "px";
  }
  els.input.addEventListener("input", () => { autoGrow(); updateSendState(); });
  els.stopBtn.addEventListener("click", () => abortController?.abort());
  els.newChat.addEventListener("click", () => { if (!abortController) newChat(); });

  const isMobile = () => window.matchMedia("(max-width: 760px)").matches;
  function closeSidebarOnMobile() { els.sidebar.classList.remove("open"); }
  els.menuBtn.addEventListener("click", () => {
    if (isMobile()) els.sidebar.classList.toggle("open");
    else els.sidebar.classList.toggle("collapsed");
  });
  els.backdrop.addEventListener("click", closeSidebarOnMobile);

  els.messages.addEventListener("click", (e) => {
    if (!e.target.classList.contains("copy-btn")) return;
    const code = e.target.parentElement.querySelector("code").textContent;
    navigator.clipboard.writeText(code).then(() => {
      e.target.textContent = "Copied";
      setTimeout(() => (e.target.textContent = "Copy"), 1200);
    });
  });

  /* ---------- init ---------- */
  async function init() {
    if (!activeChat()) {
      if (state.chats.length) state.activeId = state.chats[0].id;
      else newChat();
    }
    renderAll();
    els.input.focus();
    try {
      const health = await (await fetch("/api/health")).json();
      if (!health.api_key_configured) setStatus("GROQ_API_KEY missing. See README.");
    } catch {
      setStatus("Cannot reach backend");
    }
  }

  init();
})();
