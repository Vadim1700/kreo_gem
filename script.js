(() => {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const STORE_KEY = "abuzok-signals-v2";
  const managerOverlay = $("#signalManagerOverlay");
  const generalSettingsOverlay = $("#generalSettingsOverlay");
  const progressOverlay = $("#progressOverlay");
  const generateBtn = $("#generateBtn");

  const resources = [
    { key: "gold", name: "Золото", icon: "🟨", image: "images/gold.png", default: 5 },
    { key: "copper", name: "Медь", icon: "🟠", image: "images/copper.png", default: 8 },
    { key: "diamond", name: "Алмаз", icon: "💎", image: "images/diamond.png", default: 3 },
    { key: "emerald", name: "Изумруд", icon: "🟩", image: "images/emerald.png", default: 2 },
    { key: "crafting", name: "Верстак", icon: "🧰", image: "images/crafting.png", default: 1 },
    { key: "tnt", name: "ТНТ", icon: "🧨", image: "images/tnt.png", default: 1 }
  ];
  const tools = {
    wood: { name: "Деревянная", image: "images/pickaxe-wood.png" },
    stone: { name: "Каменная", image: "images/pickaxe-stone.png" },
    iron: { name: "Железная", image: "images/pickaxe-iron.png" },
    diamond: { name: "Алмазная", image: "images/pickaxe-diamond.png" }
  };
  const defaultSignals = [{
    id: "default", name: "Основной сигнал", priority: 1, pickaxe: "random",
    quantities: { gold: 5, copper: 8, diamond: 3, emerald: 2, crafting: 1, tnt: 1 }
  }];
  let signals = defaultSignals;
  let activeId = "default";
  let editingId = null;
  let generationTimer = null;
  let generationRun = 0;
  let online = 78;

  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (Array.isArray(saved)) signals = saved;
  } catch (_) {}
  if (!signals.length) signals = defaultSignals;
  signals.forEach((signal, index) => { if (!Number.isFinite(Number(signal.priority))) signal.priority = index + 1; });
  signals.sort((a, b) => Number(a.priority) - Number(b.priority));
  if (!signals.some(s => s.id === activeId)) activeId = signals[0]?.id || null;

  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
  const persist = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(signals)); } catch (_) {}
  };
  function openOverlay(el) {
    el.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeOverlay(el) {
    el.classList.remove("open");
    if (!$(".overlay.open")) document.body.style.overflow = "";
  }
  function cancelGeneration() {
    generationRun += 1;
    if (generationTimer) clearInterval(generationTimer);
    generationTimer = null;
    generateBtn.disabled = false;
  }

  function summary(signal) {
    const blockCount = resources.filter(r => Number(signal.quantities?.[r.key] || 0) > 0).length;
    const tool = signal.pickaxe === "none" ? "без кирки"
      : signal.pickaxe === "random" ? "случайная кирка"
      : `${tools[signal.pickaxe]?.name || "Кирка"} кирка`;
    return `${tool} · ${blockCount} типов блоков`;
  }
  function renderList() {
    const list = $("#signalList");
    if (!signals.length) {
      list.innerHTML = '<p class="muted-note">Пока нет сигналов. Нажми «Добавить сигнал», чтобы создать первый.</p>';
    } else {
      signals.sort((a, b) => Number(a.priority || 999) - Number(b.priority || 999));
      list.innerHTML = signals.map((s, index) => `
        <div class="signal-row ${s.id === activeId ? "selected" : ""}">
          <div class="signal-main" role="button" tabindex="0" data-select="${escapeHtml(s.id)}">
            <div class="signal-name">${index + 1}. ${escapeHtml(s.name)}${s.id === activeId ? " · выбран" : ""}</div>
            <div class="signal-summary">Приоритет ${index + 1} · ${escapeHtml(summary(s))}</div>
          </div>
          <label class="priority-inline">Приоритет<select data-priority="${escapeHtml(s.id)}" aria-label="Приоритет сигнала ${escapeHtml(s.name)}">${signals.map((_, n) => `<option value="${n + 1}" ${n === index ? "selected" : ""}>${n + 1}</option>`).join("")}</select></label>
          <div class="signal-actions">
            <button class="mini-btn" type="button" data-edit="${escapeHtml(s.id)}" aria-label="Редактировать ${escapeHtml(s.name)}">✎</button>
            <button class="mini-btn danger" type="button" data-delete="${escapeHtml(s.id)}" aria-label="Удалить ${escapeHtml(s.name)}">×</button>
          </div>
        </div>`).join("");
    }
    list.querySelectorAll("[data-priority]").forEach(el => el.addEventListener("change", () => {
      const from = signals.findIndex(s => s.id === el.dataset.priority);
      const to = Math.max(0, Math.min(signals.length - 1, Number(el.value) - 1));
      if (from < 0 || from === to) return;
      const moved = signals.splice(from, 1)[0]; signals.splice(to, 0, moved);
      signals.forEach((signal, index) => signal.priority = index + 1); persist(); renderList();
    }));
    list.querySelectorAll("[data-select]").forEach(el => {
      const select = () => { activeId = el.dataset.select; renderList(); updateProfileCount(); };
      el.addEventListener("click", select);
      el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); } });
    });
    list.querySelectorAll("[data-edit]").forEach(el => el.addEventListener("click", () => beginEdit(el.dataset.edit)));
    list.querySelectorAll("[data-delete]").forEach(el => el.addEventListener("click", () => {
      const signal = signals.find(s => s.id === el.dataset.delete);
      if (!signal || !window.confirm(`Удалить сигнал «${signal.name}»?`)) return;
      signals = signals.filter(s => s.id !== signal.id);
      if (activeId === signal.id) activeId = signals[0]?.id || null;
      if (editingId === signal.id) resetEditor();
      persist(); renderList(); updateProfileCount();
    }));
  }

  function buildQuantityFields() {
    $("#quantityFields").innerHTML = resources.map(r => `
      <div class="resource-editor">
        <label class="field-label" for="qty-${r.key}">${r.icon} ${r.name}</label>
        <input class="number-field" id="qty-${r.key}" type="number" min="0" max="999" step="1" value="${r.default}">
      </div>`).join("");
  }
  function resetEditor() {
    editingId = null;
    $("#signalEditor").hidden = true;
    $("#signalName").value = "Мой сигнал";
    $("#pickaxeSelect").value = "random";
    $("#signalPriority").value = String(Math.min(10, signals.length + 1));
    resources.forEach(r => { $("#qty-" + r.key).value = r.default; });
  }
  function beginEdit(id = null) {
    editingId = id;
    const signal = signals.find(s => s.id === id);
    $("#signalEditor").hidden = false;
    $("#editorTitle").textContent = signal ? "Редактировать сигнал" : "Новый сигнал";
    $("#saveSignalBtn").textContent = signal ? "Сохранить изменения" : "Сохранить сигнал";
    $("#signalName").value = signal?.name || `Сигнал ${signals.length + 1}`;
    $("#pickaxeSelect").value = signal?.pickaxe || "random";
    $("#signalPriority").value = String(signal?.priority || signals.length + 1);
    resources.forEach(r => { $("#qty-" + r.key).value = signal?.quantities?.[r.key] ?? r.default; });
    $("#signalEditor").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function updateProfileCount() {
    const signal = signals.find(s => s.id === activeId);
    const count = signal ? (signal.pickaxe !== "none" ? 1 : 0) +
      resources.filter(r => Number(signal.quantities?.[r.key] || 0) > 0).length : 0;
    const ending = count === 1 ? "модуль" : count >= 2 && count <= 4 ? "модуля" : "модулей";
    $("#profileCount").textContent = `${count} ${ending}`;
  }

  buildQuantityFields();
  $("#openManager").addEventListener("click", () => { renderList(); openOverlay(managerOverlay); });
  $("#openSettings").addEventListener("click", () => openOverlay(generalSettingsOverlay));
  $("#saveGeneralSettings").addEventListener("click", () => {
    const prefs = { animation: $("#settingAnimation").checked, online: $("#settingOnline").checked };
    try { localStorage.setItem("abuzok-general-settings", JSON.stringify(prefs)); } catch (_) {}
    $("#onlineCount").parentElement.style.display = prefs.online ? "flex" : "none";
    document.documentElement.classList.toggle("no-generation-animation", !prefs.animation);
    closeOverlay(generalSettingsOverlay);
  });
  try { const prefs = JSON.parse(localStorage.getItem("abuzok-general-settings") || "{}"); if (typeof prefs.animation === "boolean") { $("#settingAnimation").checked = prefs.animation; document.documentElement.classList.toggle("no-generation-animation", !prefs.animation); } if (typeof prefs.online === "boolean") { $("#settingOnline").checked = prefs.online; $("#onlineCount").parentElement.style.display = prefs.online ? "flex" : "none"; } } catch (_) {}
  $("#newSignalBtn").addEventListener("click", () => beginEdit());
  $("#cancelEditBtn").addEventListener("click", resetEditor);
  $("#saveSignalBtn").addEventListener("click", () => {
    const name = $("#signalName").value.trim();
    if (!name) { $("#signalName").focus(); return; }
    const quantities = {};
    resources.forEach(r => {
      quantities[r.key] = Math.max(0, Math.min(999, Math.floor(Number($("#qty-" + r.key).value) || 0)));
    });
    const priority = Math.max(1, Math.min(signals.length + (editingId ? 0 : 1), Math.floor(Number($("#signalPriority").value) || signals.length + 1)));
    const record = {
      id: editingId || `signal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name, priority, pickaxe: $("#pickaxeSelect").value, quantities
    };
    if (editingId) signals = signals.map(s => s.id === editingId ? record : s);
    else signals.push(record);
    activeId = record.id;
    const currentIndex = signals.findIndex(s => s.id === record.id);
    const targetIndex = Math.max(0, Math.min(signals.length - 1, priority - 1));
    if (currentIndex >= 0 && currentIndex !== targetIndex) {
      const moved = signals.splice(currentIndex, 1)[0];
      signals.splice(targetIndex, 0, moved);
    }
    signals.forEach((signal, index) => signal.priority = index + 1);
    persist(); resetEditor(); renderList(); updateProfileCount();
  });

  $$("[data-close]").forEach(button => button.addEventListener("click", () => {
    const overlay = $("#" + button.dataset.close);
    closeOverlay(overlay);
    if (overlay === progressOverlay) cancelGeneration();
  }));
  [managerOverlay, generalSettingsOverlay, progressOverlay].forEach(overlay => overlay.addEventListener("click", event => {
    if (event.target === overlay) {
      closeOverlay(overlay);
      if (overlay === progressOverlay) cancelGeneration();
    }
  }));
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (progressOverlay.classList.contains("open")) {
      closeOverlay(progressOverlay); cancelGeneration();
    } else if (managerOverlay.classList.contains("open")) closeOverlay(managerOverlay);
    else if (generalSettingsOverlay.classList.contains("open")) closeOverlay(generalSettingsOverlay);
  });

  window.setInterval(() => {
    online = Math.max(50, Math.min(100, online + randomInt(-5, 5)));
    $("#onlineCount").textContent = String(online);
  }, 3600);

  function createSignal() {
    const signal = signals.find(s => s.id === activeId);
    if (!signal) return [];
    const items = [];
    if (signal.pickaxe !== "none") {
      const key = signal.pickaxe === "random" ? Object.keys(tools)[randomInt(0, 3)] : signal.pickaxe;
      if (tools[key]) items.push({ name: "Тип кирки", value: tools[key].name, icon: "⛏️", image: tools[key].image, wide: true });
    }
    resources.forEach(r => {
      const amount = Math.max(0, Math.floor(Number(signal.quantities?.[r.key]) || 0));
      if (amount > 0) items.push({ name: r.name, value: `${amount} шт.`, icon: r.icon, image: r.image, wide: r.key === "crafting" || r.key === "tnt" });
    });
    return items;
  }

  const stages = [
    { at: 0, title: "Подключение к системе", sub: "Подготавливаем генератор…", status: "Инициализация" },
    { at: 25, title: "Синхронизация узла", sub: "Загружаем выбранный сигнал…", status: "Подключение к узлу" },
    { at: 52, title: "Анализ параметров", sub: "Проверяем заданное количество блоков…", status: "Анализ данных" },
    { at: 78, title: "Формирование сигнала", sub: "Финальная сборка результата…", status: "Сборка сигнала" }
  ];
  function setStage(percent) {
    let index = 0;
    stages.forEach((stage, i) => { if (percent >= stage.at) index = i; });
    const stage = stages[index];
    $("#progressTitle").textContent = stage.title;
    $("#progressSub").textContent = stage.sub;
    $("#progressStatus").textContent = stage.status;
    $("#progressFill").style.width = `${percent}%`;
    $("#progressPercent").textContent = `${percent}%`;
    $$("#logList li").forEach((item, i) => {
      item.classList.toggle("done", i < index);
      item.classList.toggle("active", i === index);
      $(".log-dot", item).textContent = i < index ? "✓" : String(i + 1);
    });
  }
  function renderResult(items) {
    $("#loadingView").hidden = true;
    const view = $("#resultView");
    view.hidden = false;
    const time = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    const signal = signals.find(s => s.id === activeId);
    let markup = `<div class="result-top"><span class="result-badge"><span class="dot"></span> СИГНАЛ СФОРМИРОВАН</span><span class="result-time">${time}</span></div>
      <h2 class="result-heading">${escapeHtml(signal?.name || "Сигнал готов")}</h2>
      <p class="result-sub">Состав сформирован по сохранённым параметрам</p>`;
    if (!items.length) markup += '<p class="result-sub">В этом сигнале нет блоков. Открой меню слева сверху и отредактируй его.</p>';
    else {
      markup += '<div class="result-items">';
      items.forEach(item => {
        const icon = item.image ? `<img src="${item.image}" alt="" onerror="this.remove()">` : item.icon;
        markup += `<div class="result-item ${item.wide ? "wide" : ""}"><div class="result-icon">${icon}</div><div><div class="result-label">${escapeHtml(item.name)}</div><div class="result-value">${escapeHtml(item.value)}</div></div></div>`;
      });
      markup += "</div>";
    }
    markup += `<div class="result-actions"><button class="primary-btn" id="againBtn" type="button">↻ Сгенерировать ещё</button><button class="secondary-btn" id="doneBtn" type="button">Готово</button></div>
      <p class="disclaimer">Локальная демонстрационная генерация. Подключения к игровому серверу нет.</p>`;
    view.innerHTML = markup;
    $("#againBtn").addEventListener("click", startGeneration);
    $("#doneBtn").addEventListener("click", () => closeOverlay(progressOverlay));
  }
  function startGeneration() {
    if (!signals.some(s => s.id === activeId)) {
      renderList(); openOverlay(managerOverlay);
      window.alert("Сначала создай или выбери сигнал в меню.");
      return;
    }
    cancelGeneration();
    const thisRun = generationRun;
    generateBtn.disabled = true;
    $("#loadingView").hidden = false;
    $("#resultView").hidden = true;
    $("#resultView").innerHTML = "";
    setStage(0); openOverlay(progressOverlay);
    const start = Date.now(), duration = 2300;
    generationTimer = window.setInterval(() => {
      if (thisRun !== generationRun) return;
      const percent = Math.min(100, Math.floor((Date.now() - start) / duration * 100));
      setStage(percent);
      if (percent >= 100) {
        clearInterval(generationTimer); generationTimer = null;
        const runAtFinish = generationRun;
        window.setTimeout(() => {
          if (runAtFinish !== generationRun || !progressOverlay.classList.contains("open")) return;
          renderResult(createSignal()); generateBtn.disabled = false;
        }, 250);
      }
    }, 70);
  }
  generateBtn.addEventListener("click", startGeneration);
  renderList();
  updateProfileCount();
})();