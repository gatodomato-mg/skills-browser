const VIEW_LABEL = {
  "all-time": "mais baixadas de todos os tempos",
  trending: "em alta nas últimas 24h",
  hot: "bombando agora"
};

const els = {
  tabs: [...document.querySelectorAll(".tab")],
  rows: document.getElementById("rows"),
  empty: document.getElementById("empty"),
  emptyTitle: document.getElementById("empty-title"),
  emptyText: document.getElementById("empty-text"),
  loadMore: document.getElementById("load-more"),
  loadMoreLabel: document.getElementById("load-more-label"),
  listContext: document.getElementById("list-context"),
  searchMode: document.getElementById("search-mode"),
  search: document.getElementById("search"),
  refresh: document.getElementById("refresh"),
  statInstalls: document.getElementById("stat-installs"),
  statSkills: document.getElementById("stat-skills"),
  statInstalled: document.getElementById("stat-installed"),
  installedCount: document.getElementById("installed-count"),
  openInstalled: document.getElementById("open-installed"),
  scrim: document.getElementById("scrim"),
  panel: document.getElementById("panel"),
  panelEyebrow: document.getElementById("panel-eyebrow"),
  panelTitle: document.getElementById("panel-title"),
  panelSource: document.getElementById("panel-source"),
  panelCmd: document.getElementById("panel-cmd"),
  panelStatus: document.getElementById("panel-status"),
  panelLog: document.getElementById("panel-log"),
  panelLink: document.getElementById("panel-link"),
  panelDone: document.getElementById("panel-done"),
  panelClose: document.getElementById("panel-close"),
  copyCmd: document.getElementById("copy-cmd"),
  installedPanel: document.getElementById("installed-panel"),
  installedClose: document.getElementById("installed-close"),
  installedSubtitle: document.getElementById("installed-subtitle"),
  installedList: document.getElementById("installed-list"),
  installedRefresh: document.getElementById("installed-refresh"),
  toasts: document.getElementById("toasts")
};

const state = {
  view: "all-time",
  leaderboard: { skills: [], page: 0, total: 0, hasMore: false },
  search: null,
  searchQuery: "",
  installed: new Set(),
  installedList: [],
  installedLoaded: false,
  meta: { totalSkills: null, allTimeTotal: null },
  loading: false,
  viewSeq: 0,
  searchSeq: 0,
  streamSeq: 0
};

let activePanel = null;
let searchTimer = null;
let logBuffer = "";

const descCache = new Map();
const descPending = new Map();
let descObserver = null;
let descFlushTimer = null;
let descBusy = false;

const fullNumber = new Intl.NumberFormat("pt-BR");

/* ---------- helpers ---------- */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

function compact(value) {
  const n = Number(value) || 0;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(".", ",")} bi`;
  if (n >= 10_000_000) return `${Math.round(n / 1_000_000)} mi`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (n >= 100_000) return `${Math.round(n / 1_000)} mil`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".", ",")} mil`;
  return String(n);
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

async function fetchJSON(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Erro ${response.status}`);
  }
  return data;
}

function isInstalled(skill) {
  return state.installed.has(skill.skillId) || state.installed.has(skill.name);
}

function skillsInView() {
  return state.search ? state.search.skills : state.leaderboard.skills;
}

function skillById(id) {
  return skillsInView().find((skill) => skill.id === id) || null;
}

function sparkline(values) {
  if (!Array.isArray(values) || values.length < 2) {
    return '<span class="mono-dash">—</span>';
  }

  const width = 96;
  const height = 26;
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values
    .map((value, index) => {
      const x = pad + (index * (width - pad * 2)) / (values.length - 1);
      const y = height - pad - ((value - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Tendência das últimas 8 semanas"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}

function trendCell(skill) {
  if (state.view === "hot" && !state.search) {
    const change = Number(skill.change) || 0;
    const sign = change > 0 ? "+" : "";
    return `<span class="delta ${change === 0 ? "flat" : ""}">${sign}${fullNumber.format(change)}<span class="delta-unit">/h</span></span>`;
  }
  return sparkline(skill.weeklyInstalls);
}

function rowHtml(skill, rank) {
  const official = skill.isOfficial ? '<span class="tag official">oficial</span>' : "";
  const installed = isInstalled(skill);
  const description = descCache.get(skill.id);
  const action = installed
    ? '<span class="row-installed" title="Instalada globalmente">instalada</span>'
    : `<button class="install-btn" type="button" data-install="${esc(skill.id)}" aria-label="Instalar ${esc(skill.name)}">Instalar</button>`;

  return `
    <article class="row" data-skill="${esc(skill.id)}">
      <div class="rank">${rank}</div>
      <div class="skill">
        <div class="name">
          <span class="name-text" title="${esc(skill.name)}">${esc(skill.name)}</span>
          ${official}
        </div>
        <a class="source" href="${esc(skill.url)}" target="_blank" rel="noreferrer noopener" title="Abrir no skills.sh">${esc(skill.source)} ↗</a>
        <p class="desc" data-desc="${esc(skill.id)}"${description ? ` title="${esc(description)}"` : ""}>${esc(description || "")}</p>
      </div>
      <div class="spark">${trendCell(skill)}</div>
      <div class="installs">
        <strong>${compact(skill.installs)}</strong>
        <span>instalações</span>
      </div>
      <div class="row-action">${action}</div>
    </article>`;
}

function skeletonRow() {
  return `
    <article class="row skeleton" aria-hidden="true">
      <div class="sk rank"></div>
      <div><div class="sk title"></div><div class="sk sub"></div><div class="sk desc"></div></div>
      <div class="sk spark"></div>
      <div class="sk installs"></div>
      <div class="sk action"></div>
    </article>`;
}

/* ---------- rendering ---------- */

function render() {
  const list = skillsInView();
  const searching = Boolean(state.search);

  els.rows.innerHTML = list.map((skill, index) => rowHtml(skill, index + 1)).join("");
  els.empty.hidden = list.length > 0;

  if (!list.length) {
    if (searching) {
      els.emptyTitle.textContent = "Nenhuma skill encontrada";
      els.emptyText.textContent = `Nada para “${state.search.query}”. Tente outro termo ou repositório.`;
    } else {
      els.emptyTitle.textContent = "Ranking vazio";
      els.emptyText.textContent = "Tente atualizar os dados.";
    }
  }

  const showLoadMore = !searching && state.leaderboard.hasMore && list.length > 0;
  els.loadMore.hidden = !showLoadMore;
  els.loadMore.disabled = state.loading;
  els.loadMoreLabel.textContent = `${list.length} de ${fullNumber.format(state.leaderboard.total)}`;

  updateContext();
  observeDescriptions();
}

function updateContext() {
  if (state.search) {
    const type = state.search.searchType === "semantic" ? "semântica" : "aproximada";
    const count = state.search.skills.length;
    els.listContext.textContent = "Resultados da busca";
    els.searchMode.hidden = false;
    els.searchMode.innerHTML = `<b>“${esc(state.search.query)}”</b> · ${plural(count, "resultado", "resultados")} · busca ${type} · ordenado por relevância`;
    return;
  }

  els.searchMode.hidden = true;
  const total = state.leaderboard.total;
  const count = state.leaderboard.skills.length;
  els.listContext.textContent = total
    ? `Top ${count} de ${fullNumber.format(total)} skills · ${VIEW_LABEL[state.view]}`
    : "Carregando ranking…";
}

function showSkeleton() {
  els.rows.innerHTML = Array.from({ length: 7 }, skeletonRow).join("");
  els.empty.hidden = true;
  els.loadMore.hidden = true;
  els.listContext.textContent = "Carregando ranking…";
  els.searchMode.hidden = true;
}

function showEmpty(title, text) {
  els.rows.innerHTML = "";
  els.empty.hidden = false;
  els.emptyTitle.textContent = title;
  els.emptyText.textContent = text;
  els.loadMore.hidden = true;
}

/* ---------- descriptions ---------- */

function queueDescription(row) {
  const id = row.dataset.skill;
  if (!id || descCache.has(id)) return;

  const skill = skillById(id);
  if (skill) {
    descPending.set(id, { source: skill.source, skillId: skill.skillId });
  }
}

function scheduleDescFlush(delay = 120) {
  window.clearTimeout(descFlushTimer);
  descFlushTimer = window.setTimeout(flushDescriptions, delay);
}

function observeDescriptions() {
  if (descObserver) {
    descObserver.disconnect();
    descObserver = null;
  }

  const rows = [...els.rows.querySelectorAll(".row[data-skill]")];
  if (!rows.length) return;

  if (!("IntersectionObserver" in window)) {
    rows.forEach(queueDescription);
    if (descPending.size) scheduleDescFlush(150);
    return;
  }

  descObserver = new IntersectionObserver(
    (entries) => {
      let queued = false;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        queueDescription(entry.target);
        descObserver.unobserve(entry.target);
        queued = true;
      }
      if (queued) scheduleDescFlush();
    },
    { rootMargin: "650px 0px" }
  );

  for (const row of rows) {
    if (!descCache.has(row.dataset.skill)) descObserver.observe(row);
  }
}

function applyDescriptions(descriptions) {
  const nodes = els.rows.querySelectorAll(".desc[data-desc]");

  let matched = 0;
  for (const node of nodes) {
    const id = node.dataset.desc;
    if (!(id in descriptions)) continue;

    matched++;
    const description = descriptions[id];
    descCache.set(id, description);

    if (description) {
      node.textContent = description;
      node.title = description;
    } else {
      node.textContent = "";
      node.removeAttribute("title");
    }
  }
}

async function flushDescriptions() {
  if (descBusy) {
    scheduleDescFlush(250);
    return;
  }
  if (!descPending.size) return;

  descBusy = true;
  const batch = [...descPending.entries()].slice(0, 30);
  for (const [id] of batch) descPending.delete(id);

  try {
    const data = await fetchJSON("/api/descriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ skills: batch.map(([, ref]) => ref) })
    });
    applyDescriptions(data.descriptions || {});
  } catch {
    // Descriptions are cosmetic; the row still shows the rest of the data.
  } finally {
    descBusy = false;
    if (descPending.size) scheduleDescFlush(150);
  }
}

function updateInstalledUI() {
  const count = state.installedList.length;
  els.installedCount.textContent = state.installedLoaded ? String(count) : "–";
  els.statInstalled.textContent = state.installedLoaded ? fullNumber.format(count) : "—";
  els.installedSubtitle.textContent = state.installedLoaded
    ? `${plural(count, "skill instalada", "skills instaladas")} no escopo global`
    : "Carregando…";
  renderInstalledList();
}

function renderInstalledList() {
  if (!state.installedLoaded) {
    els.installedList.innerHTML = '<div class="inst-empty">Lendo a pasta global de skills…</div>';
    return;
  }

  if (!state.installedList.length) {
    els.installedList.innerHTML =
      '<div class="inst-empty"><strong>Nenhuma skill instalada</strong>Instale uma skill do ranking para vê-la aqui.</div>';
    return;
  }

  const sorted = [...state.installedList].sort((a, b) => a.name.localeCompare(b.name));
  els.installedList.innerHTML = sorted
    .map((skill) => {
      const agents = skill.agents?.length ?? 0;
      return `
        <div class="inst-row">
          <div class="inst-main">
            <strong title="${esc(skill.name)}">${esc(skill.name)}</strong>
            <span title="${esc(skill.source || "origem não rastreada")}">${esc(skill.source || "origem não rastreada")}</span>
          </div>
          <div class="inst-agents" title="${esc((skill.agents || []).join(", "))}">${plural(agents, "agente", "agentes")}</div>
          <button class="remove-btn" type="button" data-remove="${esc(skill.name)}">Remover</button>
        </div>`;
    })
    .join("");
}

/* ---------- data ---------- */

async function loadMeta() {
  try {
    const meta = await fetchJSON("/api/meta");
    state.meta = meta;
    if (meta.allTimeTotal) els.statInstalls.textContent = fullNumber.format(meta.allTimeTotal);
    if (meta.totalSkills) els.statSkills.textContent = fullNumber.format(meta.totalSkills);
  } catch {
    // Stats are decorative; the leaderboard still works.
  }
}

async function loadInstalled(refresh = false) {
  try {
    const data = await fetchJSON(`/api/installed${refresh ? "?refresh=1" : ""}`);
    state.installedList = Array.isArray(data.skills) ? data.skills : [];
    state.installed = new Set(state.installedList.map((skill) => skill.name));
    state.installedLoaded = true;
    updateInstalledUI();
    if (state.leaderboard.skills.length || state.search) render();
  } catch (error) {
    state.installedLoaded = true;
    updateInstalledUI();
    toast(`Não foi possível listar as skills instaladas: ${error.message}`, "error");
  }
}

async function loadView(view) {
  state.view = view;
  state.search = null;
  state.searchQuery = "";
  els.search.value = "";

  els.tabs.forEach((tab) => {
    const active = tab.dataset.view === view;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });

  const seq = ++state.viewSeq;
  state.loading = true;
  state.leaderboard = { skills: [], page: 0, total: 0, hasMore: false };
  showSkeleton();

  try {
    const data = await fetchJSON(`/api/leaderboard?view=${encodeURIComponent(view)}&page=0`);
    if (seq !== state.viewSeq) return;

    state.loading = false;
    state.leaderboard = {
      skills: data.skills,
      page: data.page,
      total: data.total,
      hasMore: data.hasMore
    };
    render();
  } catch (error) {
    if (seq !== state.viewSeq) return;
    state.loading = false;
    state.leaderboard = { skills: [], page: 0, total: 0, hasMore: false };
    els.listContext.textContent = "Não foi possível carregar o ranking";
    showEmpty("Não foi possível carregar o ranking", error.message);
    toast(`Falha ao carregar: ${error.message}`, "error");
  }
}

async function loadMore() {
  if (state.loading || state.search || !state.leaderboard.hasMore) return;

  state.loading = true;
  els.loadMore.disabled = true;
  const seq = state.viewSeq;
  const nextPage = state.leaderboard.page + 1;

  try {
    const data = await fetchJSON(`/api/leaderboard?view=${encodeURIComponent(state.view)}&page=${nextPage}`);
    if (seq !== state.viewSeq) return;

    state.leaderboard.skills.push(...data.skills);
    state.leaderboard.page = data.page;
    state.leaderboard.total = data.total;
    state.leaderboard.hasMore = data.hasMore;
    state.loading = false;
    render();
  } catch (error) {
    if (seq !== state.viewSeq) return;
    state.loading = false;
    els.loadMore.disabled = false;
    toast(`Falha ao carregar mais: ${error.message}`, "error");
  }
}

async function runSearch(query) {
  const seq = ++state.searchSeq;

  try {
    const data = await fetchJSON(`/api/search?q=${encodeURIComponent(query)}&limit=100`);
    if (seq !== state.searchSeq || state.searchQuery !== query) return;

    state.search = data;
    render();
  } catch (error) {
    if (seq !== state.searchSeq || state.searchQuery !== query) return;

    state.search = { query, searchType: "unknown", skills: [] };
    showEmpty("Falha na busca", error.message);
    toast(`Busca falhou: ${error.message}`, "error");
  }
}

/* ---------- side panels ---------- */

function openSide(panel) {
  if (activePanel && activePanel !== panel) {
    activePanel.classList.remove("open");
    activePanel.setAttribute("aria-hidden", "true");
  }

  activePanel = panel;
  els.scrim.hidden = false;
  document.body.classList.add("no-scroll");

  requestAnimationFrame(() => {
    els.scrim.classList.add("show");
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
  });
}

function closeSide() {
  if (activePanel) {
    activePanel.classList.remove("open");
    activePanel.setAttribute("aria-hidden", "true");
  }
  activePanel = null;
  els.scrim.classList.remove("show");
  document.body.classList.remove("no-scroll");

  window.setTimeout(() => {
    if (!els.scrim.classList.contains("show")) els.scrim.hidden = true;
  }, 300);
}

function appendLog(text) {
  logBuffer += text;
  if (logBuffer.length > 120_000) logBuffer = logBuffer.slice(-120_000);
  els.panelLog.textContent = logBuffer;
  els.panelLog.scrollTop = els.panelLog.scrollHeight;
}

function setStatus(kind, text) {
  const icon =
    kind === "running"
      ? '<span class="spinner" aria-hidden="true"></span>'
      : kind === "ok"
        ? '<span class="ok" aria-hidden="true">✓</span>'
        : '<span class="fail" aria-hidden="true">✕</span>';
  els.panelStatus.innerHTML = `${icon}<span>${esc(text)}</span>`;
}

async function consumeStream(response, onText) {
  if (!response.body) return "error";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const tailSize = 64;
  let pending = "";
  let exit = null;

  const handle = (final) => {
    let chunk;
    if (final) {
      chunk = pending;
      pending = "";
    } else {
      if (pending.length <= tailSize) return;
      chunk = pending.slice(0, pending.length - tailSize);
      pending = pending.slice(pending.length - tailSize);
    }

    const marker = chunk.match(/\[\[exit:([^\]]*)\]\]/);
    if (marker) {
      exit = marker[1];
      chunk = chunk.replace(marker[0], "");
    }
    if (chunk) onText(chunk);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    handle(false);
  }

  pending += decoder.decode();
  handle(true);

  return exit ?? "0";
}

async function runCommand({ eyebrow, title, source, command, link, endpoint, payload, successText, onSuccess }) {
  const token = ++state.streamSeq;

  openSide(els.panel);
  els.panelEyebrow.textContent = eyebrow;
  els.panelTitle.textContent = title;
  els.panelSource.textContent = source || "";
  els.panelCmd.textContent = command;
  els.panelLink.style.display = link ? "" : "none";
  els.panelLink.href = link || "https://skills.sh";
  els.panelLog.textContent = "";
  els.panelDone.disabled = true;
  logBuffer = "";
  setStatus("running", "Executando…");
  appendLog(`$ ${command}\n\n`);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || `Erro ${response.status}`);
    }

    const exit = await consumeStream(response, (text) => {
      if (token === state.streamSeq) appendLog(text);
    });

    if (token !== state.streamSeq) return;

    if (exit === "0") {
      setStatus("ok", "Concluído com sucesso");
      els.panelDone.disabled = false;
      toast(successText, "success");
      if (onSuccess) onSuccess();
      await loadInstalled(true);
    } else if (exit === "error") {
      setStatus("fail", "Falha ao executar o comando");
      els.panelDone.disabled = false;
    } else {
      setStatus("fail", `O processo terminou com código ${exit}`);
      els.panelDone.disabled = false;
      toast("A instalação não terminou como esperado. Veja o log.", "error");
    }
  } catch (error) {
    if (token !== state.streamSeq) return;
    appendLog(`\n[erro] ${error.message}\n`);
    setStatus("fail", error.message);
    els.panelDone.disabled = false;
    toast(`Falha: ${error.message}`, "error");
  }
}

function openInstall(skill) {
  const isWellKnown = skill.sourceType === "well-known";
  const spec = isWellKnown ? `https://${skill.source}/` : `${skill.source}@${skill.skillId}`;
  const command = `npx skills add ${spec}${isWellKnown ? ` --skill ${skill.skillId}` : ""} -g -y`;

  runCommand({
    eyebrow: "Instalação global",
    title: skill.name,
    source: skill.source,
    command,
    link: skill.url,
    endpoint: "/api/install",
    payload: { source: skill.source, skillId: skill.skillId, sourceType: skill.sourceType },
    successText: `${skill.name} instalada globalmente`,
    onSuccess: () => {
      state.installed.add(skill.skillId);
      state.installed.add(skill.name);
      render();
    }
  });
}

function openRemove(skill) {
  runCommand({
    eyebrow: "Remoção global",
    title: skill.name,
    source: skill.source || "origem não rastreada",
    command: `npx skills remove ${skill.name} -g -y`,
    link: null,
    endpoint: "/api/remove",
    payload: { name: skill.name },
    successText: `${skill.name} removida`,
    onSuccess: () => {
      state.installed.delete(skill.name);
      render();
    }
  });
}

/* ---------- toasts ---------- */

function toast(message, kind = "success") {
  const element = document.createElement("div");
  element.className = `toast ${kind}`;
  element.textContent = message;
  els.toasts.appendChild(element);

  window.setTimeout(() => {
    element.classList.add("leaving");
    window.setTimeout(() => element.remove(), 240);
  }, 4200);
}

/* ---------- events ---------- */

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.dataset.view === state.view && !state.search) return;
    loadView(tab.dataset.view);
  });
});

els.search.addEventListener("input", () => {
  const query = els.search.value.trim();
  state.searchQuery = query;
  window.clearTimeout(searchTimer);

  if (query.length < 2) {
    state.search = null;
    els.searchMode.hidden = true;
    if (state.loading && !state.leaderboard.skills.length) {
      showSkeleton();
    } else {
      render();
    }
    return;
  }

  els.searchMode.hidden = false;
  els.searchMode.textContent = `buscando “${query}”…`;
  searchTimer = window.setTimeout(() => runSearch(query), 320);
});

els.rows.addEventListener("click", (event) => {
  const button = event.target.closest("[data-install]");
  if (!button) return;
  const skill = skillById(button.dataset.install);
  if (skill) openInstall(skill);
});

els.loadMore.addEventListener("click", loadMore);

els.openInstalled.addEventListener("click", () => {
  openSide(els.installedPanel);
  renderInstalledList();
  loadInstalled(true);
});

els.installedRefresh.addEventListener("click", () => {
  loadInstalled(true);
  toast("Lista de instaladas atualizada", "success");
});

els.installedList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;
  const name = button.dataset.remove;
  const skill = state.installedList.find((item) => item.name === name) || { name };
  openRemove(skill);
});

els.refresh.addEventListener("click", async () => {
  els.refresh.disabled = true;
  await Promise.allSettled([
    loadMeta(),
    loadInstalled(true),
    state.searchQuery.length >= 2 ? runSearch(state.searchQuery) : loadView(state.view)
  ]);
  els.refresh.disabled = false;
  toast("Dados atualizados", "success");
});

els.panelClose.addEventListener("click", closeSide);
els.installedClose.addEventListener("click", closeSide);
els.panelDone.addEventListener("click", closeSide);
els.scrim.addEventListener("click", closeSide);

els.copyCmd.addEventListener("click", async () => {
  const command = els.panelCmd.textContent || "";
  try {
    await navigator.clipboard.writeText(command);
    toast("Comando copiado", "success");
  } catch {
    toast("Não foi possível copiar o comando", "error");
  }
});

document.addEventListener("keydown", (event) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");

  if (event.key === "/" && !typing) {
    event.preventDefault();
    els.search.focus();
    return;
  }

  if (event.key === "Escape") {
    if (activePanel) {
      closeSide();
      return;
    }
    if (els.search.value) {
      els.search.value = "";
      state.searchQuery = "";
      state.search = null;
      els.searchMode.hidden = true;
      render();
    }
  }
});

/* ---------- boot ---------- */

loadMeta();
loadInstalled();
loadView("all-time");
