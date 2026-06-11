const MENU = [
  {
    id: "human",
    name: "人事",
    subs: [
      {
        id: "staff",
        name: "職員",
        functions: [
          { id: "employee-search", name: "職員検索", description: "職員番号・氏名・所属・在職区分を指定して職員を検索します。", screenId: "HRPER001" },
          { id: "employee-reference", name: "職員情報参照", description: "職員の基本情報、所属情報および連絡先を参照します。", screenId: "HRPER002" },
          { id: "employee-register", name: "職員情報登録", description: "職員の基本情報、所属、職位、在職区分を登録・変更します。", permission: "edit_personnel", risk: "sensitive", screenId: "HRPER003" }
        ]
      },
      {
        id: "organization",
        name: "組織",
        functions: [
          { id: "org-reference", name: "組織マスタ照会", description: "現在有効な組織コード、組織名称、上位組織および責任者を照会します。", screenId: "HRORG001" },
          { id: "org-master", name: "組織マスタ管理", description: "組織名称、略称、階層、責任者、有効状態を変更します。所属判定に影響するため慎重に操作してください。", permission: "edit_org", risk: "high", screenId: "HRORG002" }
        ]
      },
      {
        id: "history",
        name: "人事異動",
        functions: [
          { id: "employee-history", name: "職員異動履歴照会", description: "職員の所属・職位変更履歴を参照します。デモ環境では現在情報から仮履歴を生成します。", screenId: "HRHIS001" }
        ]
      }
    ]
  },
  {
    id: "payroll",
    name: "給与",
    subs: [
      {
        id: "salary",
        name: "給与",
        functions: [
          { id: "payroll-reference", name: "給与情報参照", description: "職員ごとの本給、級号俸、振込口座および控除設定を参照します。", screenId: "PYINF001" },
          { id: "payroll-register", name: "給与情報登録", description: "職員ごとの本給、級号俸、振込口座および控除設定を登録・変更します。", permission: "edit_payroll", risk: "sensitive", screenId: "PYINF002" },
          { id: "payroll-reset", name: "給与情報初期化", description: "指定した職員の給与・振込・控除・手当情報をすべて初期値へ戻します。給与情報登録と名称が似ていますが、復元できない破壊的処理です。", permission: "edit_payroll", risk: "destructive", screenId: "PYINF009" }
        ]
      },
      {
        id: "allowance",
        name: "手当",
        functions: [
          { id: "allowance-reference", name: "その他手当照会", description: "扶養、住居、通勤、時間外、特別手当の月額を照会します。", screenId: "PYALW001" },
          { id: "allowance-register", name: "その他手当登録", description: "扶養、住居、通勤、時間外、特別手当の月額を登録・変更します。", permission: "edit_payroll", risk: "sensitive", screenId: "PYALW002" }
        ]
      },
      {
        id: "pay-process",
        name: "給与処理",
        functions: [
          { id: "batch-calculate", name: "給与計算処理", description: "指定年月の全職員について、現在の給与・手当情報から給与計算データを作成します。", permission: "run_batch", risk: "sensitive", screenId: "PYBAT001" },
          { id: "payment-reference", name: "給与支給データ照会", description: "年月ごとの給与計算・振込処理状況と総支給額を照会します。", screenId: "PYPAY001" },
          { id: "payment-delete", name: "給与支給データ削除", description: "指定年月の給与支給データを削除します。給与支給データ照会と名称が似ていますが、復元できない破壊的処理です。", permission: "run_batch", risk: "destructive", screenId: "PYPAY009" }
        ]
      }
    ]
  },
  {
    id: "common",
    name: "共通管理",
    subs: [
      {
        id: "audit",
        name: "監査",
        functions: [
          { id: "audit-log", name: "操作履歴照会", description: "ログイン、更新、マスタ変更、給与処理、破壊的処理の監査ログを照会します。", screenId: "CMAUD001" }
        ]
      },
      {
        id: "system",
        name: "システム",
        functions: [
          { id: "demo-reset", name: "デモデータ再読込", description: "実験用データを起動時の状態へ戻します。管理者専用です。", permission: "reset_demo", risk: "high", screenId: "CMSYS009" }
        ]
      }
    ]
  }
];

const state = {
  user: null,
  bootstrap: null,
  employees: [],
  currentFeature: null,
  selectedMajor: MENU[0].id,
  selectedSub: MENU[0].subs[0].id,
  selectedFunction: MENU[0].subs[0].functions[0].id,
  selectedEmployeeId: "100123",
  selectedOrgId: "ORG-110",
  domMode: "degraded",
  clockTimer: null
};

const elements = {
  loginScreen: document.querySelector("#login-screen"),
  appScreen: document.querySelector("#app-screen"),
  loginForm: document.querySelector("#login-form"),
  loginError: document.querySelector("#login-error"),
  workspace: document.querySelector("#workspace-content"),
  breadcrumb: document.querySelector("#breadcrumb"),
  status: document.querySelector("#status-message"),
  modal: document.querySelector("#modal-backdrop"),
  modalTitle: document.querySelector("#modal-title"),
  modalBody: document.querySelector("#modal-body"),
  modalConfirm: document.querySelector("#modal-confirm"),
  modalCancel: document.querySelector("#modal-cancel")
};

function isDegradedDom() {
  return state.domMode === "degraded";
}

function menuIcon(type) {
  const file = type === "document" ? "document.svg" : "folder.svg";
  return `<img class="menu-icon" src="/icons/${file}" ${isDegradedDom() ? "" : 'alt=""'}>`;
}

function menuCommand({ attribute, value, text, selected = false, danger = false, icon = "folder" }) {
  const className = `${selected ? "selected" : ""} ${danger ? "danger-item" : ""}`.trim();
  const content = `${menuIcon(icon)}<span>${escapeHtml(text)}</span>`;
  if (isDegradedDom()) {
    return `<div class="menu-command ${className}" ${attribute}="${value}">${content}</div>`;
  }
  return `<button type="button" class="${className}" ${attribute}="${value}">${content}</button>`;
}

function applyDomExperimentMode() {
  const indicator = document.querySelector("#dom-mode-indicator");
  elements.appScreen.classList.toggle("degraded-dom", isDegradedDom());
  const indicatorText = isDegradedDom() ? "DOM: 劣化レガシー" : "DOM: 標準";
  if (indicator.textContent !== indicatorText) indicator.textContent = indicatorText;
  indicator.classList.toggle("standard", !isDegradedDom());

  if (!isDegradedDom()) {
    elements.appScreen.querySelectorAll("[tabindex='-1']").forEach(element => element.removeAttribute("tabindex"));
    elements.appScreen.querySelectorAll("[role='presentation']").forEach(element => element.removeAttribute("role"));
    elements.modal.querySelectorAll("[tabindex='-1']").forEach(element => element.removeAttribute("tabindex"));
    elements.modal.querySelectorAll("[role='presentation']").forEach(element => element.removeAttribute("role"));
    document.querySelector(".function-key-bar").setAttribute("aria-label", "ファンクションキー操作");
    return;
  }

  document.querySelector(".function-key-bar").removeAttribute("aria-label");
  [elements.appScreen, elements.modal].forEach(scope => {
    scope.querySelectorAll("button, input, select, textarea, a[href], [data-major], [data-sub], [data-function]")
      .forEach(element => element.setAttribute("tabindex", "-1"));
  });

  elements.workspace.querySelectorAll("label[for]").forEach(label => label.removeAttribute("for"));
  elements.workspace.querySelectorAll("[aria-label], [aria-labelledby], [aria-describedby]")
    .forEach(element => {
      element.removeAttribute("aria-label");
      element.removeAttribute("aria-labelledby");
      element.removeAttribute("aria-describedby");
    });
  elements.workspace.querySelectorAll("img").forEach(image => image.removeAttribute("alt"));

  elements.workspace.querySelectorAll("[id]").forEach(element => {
    if (element.matches("form")) element.id = "FORM1";
    else if (element.matches("select")) element.id = "CMB1";
    else if (element.matches("input, textarea")) element.id = "TXT1";
    else if (element.matches("button, [data-major], [data-sub], [data-function]")) element.id = "BTN1";
    else element.removeAttribute("id");
  });

  elements.appScreen.querySelectorAll(".menu-command, .quick-menu button, .function-key-bar button, .screen-actions button, .open-function")
    .forEach(element => element.setAttribute("role", "presentation"));
  elements.modal.querySelectorAll("button").forEach(element => element.setAttribute("role", "presentation"));
}

const degradationObserver = new MutationObserver(() => {
  if (isDegradedDom()) queueMicrotask(applyDomExperimentMode);
});
degradationObserver.observe(elements.workspace, { childList: true, subtree: true });
degradationObserver.observe(elements.modal, { childList: true, subtree: true });

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function yen(value) {
  return `${Number(value || 0).toLocaleString("ja-JP")} 円`;
}

function riskLabel(risk) {
  return {
    normal: "通常",
    sensitive: "重要",
    high: "高リスク",
    destructive: "破壊的"
  }[risk] || "通常";
}

function currentFeatureDefinition() {
  for (const major of MENU) {
    for (const sub of major.subs) {
      const feature = sub.functions.find(item => item.id === state.currentFeature);
      if (feature) return { major, sub, feature };
    }
  }
  return null;
}

function findFeature(featureId) {
  for (const major of MENU) {
    for (const sub of major.subs) {
      const feature = sub.functions.find(item => item.id === featureId);
      if (feature) return { major, sub, feature };
    }
  }
  return null;
}

function hasPermission(permission) {
  return !permission || state.user?.permissions.includes(permission);
}

function permissionNotice(permission) {
  if (hasPermission(permission)) return "";
  return `<div class="permission-warning">現在の利用者は参照専用です。この画面の更新処理は実行できません。</div>`;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && state.user) showLogin();
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return body;
}

function setStatus(message, type = "") {
  elements.status.textContent = message;
  elements.status.className = `status-message ${type}`.trim();
}

function setBusy(message = "処理中です...") {
  elements.workspace.innerHTML = `<div class="legacy-panel"><div class="panel-heading">${escapeHtml(message)}</div><div class="panel-body">サーバーからデータを取得しています。</div></div>`;
}

function showLogin() {
  state.user = null;
  state.bootstrap = null;
  state.currentFeature = null;
  if (state.clockTimer) clearInterval(state.clockTimer);
  elements.appScreen.classList.add("hidden");
  elements.loginScreen.classList.remove("hidden");
  document.querySelector("#login-user-id").focus();
}

async function refreshData() {
  const [bootstrap, employees] = await Promise.all([
    api("/api/bootstrap"),
    api("/api/employees")
  ]);
  state.bootstrap = bootstrap;
  state.employees = employees.employees;
  if (!state.employees.some(item => item.id === state.selectedEmployeeId)) {
    state.selectedEmployeeId = state.employees[0]?.id || "";
  }
  if (!bootstrap.organizations.some(item => item.id === state.selectedOrgId)) {
    state.selectedOrgId = bootstrap.organizations[0]?.id || "";
  }
  renderRecentAudit();
}

async function showApp(user) {
  state.user = user;
  elements.loginScreen.classList.add("hidden");
  elements.appScreen.classList.remove("hidden");
  document.querySelector("#header-user-id").textContent = user.id;
  document.querySelector("#header-user-name").textContent = user.name;
  document.querySelector("#header-department").textContent = user.department;
  document.querySelector("#footer-user").textContent = `ユーザーID: ${user.id}　利用者名: ${user.name}　権限: ${user.role}`;
  applyDomExperimentMode();
  const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  });
  const updateClock = () => {
    const now = new Date();
    document.querySelector("#header-date").textContent = dateFormatter.format(now);
    document.querySelector("#header-clock").textContent = now.toLocaleTimeString("ja-JP", {
      timeZone: "Asia/Tokyo",
      hour12: false
    });
  };
  updateClock();
  state.clockTimer = setInterval(updateClock, 1000);
  await refreshData();
  renderMenu();
}

function renderRecentAudit() {
  const rows = state.bootstrap?.recentAudit || [];
  document.querySelector("#recent-audit").innerHTML = `
    <table class="compact-table audit-mini">
      <thead><tr><th>時刻</th><th>処理名</th><th>区分</th></tr></thead>
      <tbody>
        ${rows.map(entry => `
          <tr>
            <td>${escapeHtml(entry.time.slice(-8, -3))}</td>
            <td>${escapeHtml(entry.action)}</td>
            <td class="risk-${escapeHtml(entry.risk)}">${riskLabel(entry.risk)}</td>
          </tr>
        `).join("") || `<tr><td colspan="3">処理履歴はありません</td></tr>`}
      </tbody>
    </table>`;
}

function renderMenu() {
  state.currentFeature = null;
  elements.breadcrumb.textContent = "業務メニュー";
  document.querySelector("#footer-screen-id").textContent = "画面ID: HRMNU001";
  const major = MENU.find(item => item.id === state.selectedMajor) || MENU[0];
  const sub = major.subs.find(item => item.id === state.selectedSub) || major.subs[0];
  const feature = sub.functions.find(item => item.id === state.selectedFunction) || sub.functions[0];
  state.selectedMajor = major.id;
  state.selectedSub = sub.id;
  state.selectedFunction = feature.id;

  elements.workspace.innerHTML = `
    <div class="menu-layout">
      <section class="menu-pane">
        <div class="pane-title">大区分</div>
        <ul class="menu-list">
          ${MENU.map(item => `<li>${menuCommand({ attribute: "data-major", value: item.id, text: item.name, selected: item.id === major.id })}</li>`).join("")}
        </ul>
      </section>
      <section class="menu-pane">
        <div class="pane-title">中区分</div>
        <ul class="menu-list">
          ${major.subs.map(item => `<li>${menuCommand({ attribute: "data-sub", value: item.id, text: item.name, selected: item.id === sub.id })}</li>`).join("")}
        </ul>
      </section>
      <section class="menu-pane">
        <div class="pane-title">業務機能</div>
        <ul class="menu-list functions">
          ${sub.functions.map(item => `<li>${menuCommand({
            attribute: "data-function",
            value: item.id,
            text: item.name,
            selected: item.id === feature.id,
            danger: item.risk === "destructive",
            icon: "document"
          })}</li>`).join("")}
        </ul>
      </section>
      <section class="description-pane">
        <div>
          <div class="pane-title">業務機能説明</div>
          <div class="function-description">
            ${escapeHtml(feature.description)}
            ${feature.risk === "destructive" ? `<span class="risk-label">注意: この処理はデータを削除または初期化します。</span>` : ""}
            ${feature.permission && !hasPermission(feature.permission) ? `<span class="risk-label">現在の利用者には実行権限がありません。</span>` : ""}
          </div>
        </div>
        <div class="selected-function">選択中: ${escapeHtml(feature.name)}</div>
        ${isDegradedDom()
          ? `<div id="open-function-button" class="legacy-button open-function" data-open-function>開く (Enter)</div>`
          : `<button id="open-function-button" class="legacy-button open-function" data-open-function type="button">開く (Enter)</button>`}
      </section>
    </div>`;

  elements.workspace.querySelectorAll("[data-major]").forEach(button => {
    button.addEventListener("click", () => {
      state.selectedMajor = button.dataset.major;
      const nextMajor = MENU.find(item => item.id === state.selectedMajor);
      state.selectedSub = nextMajor.subs[0].id;
      state.selectedFunction = nextMajor.subs[0].functions[0].id;
      renderMenu();
    });
  });
  elements.workspace.querySelectorAll("[data-sub]").forEach(button => {
    button.addEventListener("click", () => {
      state.selectedSub = button.dataset.sub;
      const nextSub = major.subs.find(item => item.id === state.selectedSub);
      state.selectedFunction = nextSub.functions[0].id;
      renderMenu();
    });
  });
  elements.workspace.querySelectorAll("[data-function]").forEach(button => {
    button.addEventListener("click", () => {
      state.selectedFunction = button.dataset.function;
      renderMenu();
    });
    button.addEventListener("dblclick", () => openFeature(button.dataset.function));
  });
  elements.workspace.querySelector("[data-open-function]").addEventListener("click", () => openFeature(state.selectedFunction));
  applyDomExperimentMode();
  setStatus("大区分、中区分、業務機能を選択し、「開く」を押してください。");
}

async function openFeature(featureId) {
  const definition = findFeature(featureId);
  if (!definition) return;
  state.selectedMajor = definition.major.id;
  state.selectedSub = definition.sub.id;
  state.selectedFunction = featureId;
  state.currentFeature = featureId;
  elements.breadcrumb.textContent = `${definition.major.name} ＞ ${definition.sub.name} ＞ ${definition.feature.name}`;
  document.querySelector("#footer-screen-id").textContent = `画面ID: ${definition.feature.screenId}`;
  setBusy(`${definition.feature.name}を開いています`);
  try {
    await renderCurrentFeature();
    setStatus(`${definition.feature.name}を表示しました。`);
  } catch (error) {
    renderErrorPanel(error);
  }
}

async function renderCurrentFeature() {
  const renderers = {
    "employee-search": () => renderEmployeeSearch(false),
    "employee-reference": () => renderEmployeeReference(),
    "employee-register": () => renderEmployeeRegister(),
    "employee-history": () => renderEmployeeHistory(),
    "org-reference": () => renderOrganization(false),
    "org-master": () => renderOrganization(true),
    "payroll-reference": () => renderPayroll(false),
    "payroll-register": () => renderPayroll(true),
    "allowance-reference": () => renderAllowances(false),
    "allowance-register": () => renderAllowances(true),
    "payroll-reset": () => renderPayrollReset(),
    "batch-calculate": () => renderBatchCalculate(),
    "payment-reference": () => renderPaymentReference(),
    "payment-delete": () => renderPaymentDelete(),
    "audit-log": () => renderAuditLog(),
    "demo-reset": () => renderDemoReset()
  };
  const renderer = renderers[state.currentFeature];
  if (renderer) await renderer();
  applyDomExperimentMode();
}

function renderErrorPanel(error) {
  elements.workspace.innerHTML = `
    <div class="legacy-panel danger-panel">
      <div class="panel-heading">処理エラー</div>
      <div class="panel-body">${escapeHtml(error.message)}</div>
    </div>`;
  setStatus(error.message, "error");
}

function orgName(orgId) {
  return state.bootstrap?.organizations.find(item => item.id === orgId)?.name || orgId;
}

function employeeOptions(selectedId = state.selectedEmployeeId) {
  return state.employees.map(employee => `
    <option value="${escapeHtml(employee.id)}" ${employee.id === selectedId ? "selected" : ""}>
      ${escapeHtml(employee.id)}　${escapeHtml(employee.name)}
    </option>`).join("");
}

function orgOptions(selectedId, includeBlank = false) {
  return `${includeBlank ? `<option value="">（上位組織なし）</option>` : ""}${state.bootstrap.organizations.map(org => `
    <option value="${escapeHtml(org.id)}" ${org.id === selectedId ? "selected" : ""}>
      ${escapeHtml(org.id)}　${escapeHtml(org.name)}
    </option>`).join("")}`;
}

function bindEmployeeSelect() {
  const select = elements.workspace.querySelector("[data-employee-select]");
  if (!select) return;
  select.addEventListener("change", async () => {
    state.selectedEmployeeId = select.value;
    setBusy("職員情報を切り替えています");
    try {
      await renderCurrentFeature();
    } catch (error) {
      renderErrorPanel(error);
    }
  });
}

async function employeeDetail() {
  return api(`/api/employees/${encodeURIComponent(state.selectedEmployeeId)}`);
}

function employeeSummary(employee) {
  return `
    <div class="record-summary">
      <div><strong>職員番号</strong><span>${escapeHtml(employee.id)}</span></div>
      <div><strong>氏名</strong><span>${escapeHtml(employee.name)}</span></div>
      <div><strong>所属</strong><span>${escapeHtml(orgName(employee.orgId))}</span></div>
      <div><strong>在職区分</strong><span>${escapeHtml(employee.status)}</span></div>
    </div>`;
}

async function renderEmployeeSearch(referenceOnly = false) {
  elements.workspace.innerHTML = `
    <div class="screen-shell">
      <div class="screen-summary">${referenceOnly ? "職員情報を参照します。" : "条件を指定して職員を検索します。"}</div>
      <section class="legacy-panel">
        <div class="panel-heading">検索条件 <small>F8: 検索実行</small></div>
        <form id="employee-search-form" class="panel-body">
          <div class="form-grid">
            <div class="field span-2"><label for="employee-query">職員番号・氏名</label><input id="employee-query" name="query" placeholder="例: 100123 または 山田"></div>
            <div class="field"><label for="employee-org">所属</label><select id="employee-org" name="orgId"><option value="">（全所属）</option>${orgOptions("")}</select></div>
            <div class="field"><label for="employee-status">在職区分</label><select id="employee-status" name="status"><option value="">（すべて）</option><option>在職</option><option>休職</option><option>退職</option></select></div>
          </div>
        </form>
      </section>
      <section class="legacy-panel">
        <div class="panel-heading">検索結果 <small id="employee-result-count">${state.employees.length}件</small></div>
        <div class="panel-body">
          <table class="compact-table search-results">
            <thead><tr><th>選択</th><th>職員番号</th><th>氏名</th><th>所属</th><th>職位</th><th>雇用区分</th><th>在職区分</th></tr></thead>
            <tbody id="employee-result-body"></tbody>
          </table>
        </div>
      </section>
      <div class="screen-actions">
        <button class="legacy-button" type="button" data-clear-search>条件クリア</button>
        <button class="legacy-button primary" type="button" data-primary-action>検索 (F8)</button>
        <button class="legacy-button" type="button" data-open-selected>選択職員を参照</button>
      </div>
    </div>`;

  const tbody = elements.workspace.querySelector("#employee-result-body");
  const resultCount = elements.workspace.querySelector("#employee-result-count");
  const searchForm = elements.workspace.querySelector("#employee-search-form");
  const renderRows = employees => {
    tbody.innerHTML = employees.map(employee => `
      <tr data-employee-row="${employee.id}" class="${employee.id === state.selectedEmployeeId ? "selected" : ""}">
        <td><input type="radio" name="employee-choice" value="${employee.id}" ${employee.id === state.selectedEmployeeId ? "checked" : ""} aria-label="${escapeHtml(employee.name)}を選択"></td>
        <td>${escapeHtml(employee.id)}</td>
        <td>${escapeHtml(employee.name)}</td>
        <td>${escapeHtml(orgName(employee.orgId))}</td>
        <td>${escapeHtml(employee.title)}</td>
        <td>${escapeHtml(employee.employmentType)}</td>
        <td>${escapeHtml(employee.status)}</td>
      </tr>`).join("") || `<tr><td colspan="7">該当する職員はありません。</td></tr>`;
    resultCount.textContent = `${employees.length}件`;
    tbody.querySelectorAll("[data-employee-row]").forEach(row => {
      row.addEventListener("click", () => {
        state.selectedEmployeeId = row.dataset.employeeRow;
        renderRows(employees);
      });
      row.addEventListener("dblclick", () => openFeature("employee-reference"));
    });
    applyDomExperimentMode();
  };
  renderRows(state.employees);

  const executeSearch = async () => {
    const form = new FormData(searchForm);
    const params = new URLSearchParams();
    for (const [key, value] of form.entries()) if (value) params.set(key, value);
    try {
      const result = await api(`/api/employees?${params}`);
      renderRows(result.employees);
      setStatus(`${result.employees.length}件の職員が該当しました。`, "success");
    } catch (error) {
      setStatus(error.message, "error");
    }
  };
  elements.workspace.querySelector("[data-primary-action]").addEventListener("click", executeSearch);
  searchForm.addEventListener("submit", event => {
    event.preventDefault();
    executeSearch();
  });
  elements.workspace.querySelector("[data-clear-search]").addEventListener("click", () => {
    searchForm.reset();
    renderRows(state.employees);
    setStatus("検索条件をクリアしました。");
  });
  elements.workspace.querySelector("[data-open-selected]").addEventListener("click", () => openFeature("employee-reference"));
}

async function renderEmployeeReference() {
  const { employee } = await employeeDetail();
  elements.workspace.innerHTML = `
    <div class="screen-shell">
      <div class="screen-summary">職員の基本情報および所属情報を参照します。</div>
      <div class="toolbar">
        <label for="reference-employee">対象職員</label>
        <select id="reference-employee" data-employee-select>${employeeOptions()}</select>
        <span class="spacer"></span>
        <button class="legacy-button" type="button" data-edit-employee>職員情報登録へ</button>
      </div>
      ${employeeSummary(employee)}
      <section class="legacy-panel">
        <div class="panel-heading">職員基本情報</div>
        <div class="panel-body">
          <div class="form-grid">
            ${readOnlyField("氏名カナ", employee.nameKana, 2)}
            ${readOnlyField("性別", employee.gender)}
            ${readOnlyField("生年月日", employee.birthDate)}
            ${readOnlyField("採用年月日", employee.hireDate)}
            ${readOnlyField("職位", employee.title)}
            ${readOnlyField("雇用区分", employee.employmentType)}
            ${readOnlyField("電話番号", employee.phone, 2)}
            ${readOnlyField("メール", employee.email, 2)}
            ${readOnlyField("住所", employee.address, 4)}
            ${readOnlyField("備考", employee.notes || "（なし）", 4)}
          </div>
        </div>
      </section>
      <div class="screen-actions"><button class="legacy-button" type="button" data-primary-action>再表示 (F8)</button></div>
    </div>`;
  bindEmployeeSelect();
  elements.workspace.querySelector("[data-edit-employee]").addEventListener("click", () => openFeature("employee-register"));
  elements.workspace.querySelector("[data-primary-action]").addEventListener("click", () => renderEmployeeReference());
}

function readOnlyField(label, value, span = 1) {
  return `<div class="field span-${span}"><label>${escapeHtml(label)}</label><input aria-label="${escapeHtml(label)}" value="${escapeHtml(value)}" readonly></div>`;
}

async function renderEmployeeRegister() {
  const { employee } = await employeeDetail();
  const allowed = hasPermission("edit_personnel");
  elements.workspace.innerHTML = `
    <div class="screen-shell">
      <div class="screen-summary">職員の基本情報、所属情報を登録・変更します。</div>
      ${permissionNotice("edit_personnel")}
      <div class="toolbar">
        <label for="register-employee">対象職員</label>
        <select id="register-employee" data-employee-select>${employeeOptions()}</select>
        <span class="spacer"></span>
        <span>職員番号: <strong>${escapeHtml(employee.id)}</strong></span>
      </div>
      <form id="employee-register-form">
        <section class="legacy-panel">
          <div class="panel-heading">職員基本情報 <small>* は必須項目</small></div>
          <div class="panel-body">
            <div class="form-grid">
              <div class="field span-2"><label for="person-name">* 氏名</label><input id="person-name" name="name" value="${escapeHtml(employee.name)}" required ${allowed ? "" : "disabled"}></div>
              <div class="field span-2"><label for="person-kana">* 氏名カナ</label><input id="person-kana" name="nameKana" value="${escapeHtml(employee.nameKana)}" required ${allowed ? "" : "disabled"}></div>
              <div class="field"><label for="person-gender">性別</label><select id="person-gender" name="gender" ${allowed ? "" : "disabled"}>${selectOptions(["男", "女", "未設定"], employee.gender)}</select></div>
              <div class="field"><label for="person-birth">生年月日</label><input id="person-birth" name="birthDate" type="date" value="${escapeHtml(employee.birthDate)}" ${allowed ? "" : "disabled"}></div>
              <div class="field"><label for="person-hire">採用年月日</label><input id="person-hire" name="hireDate" type="date" value="${escapeHtml(employee.hireDate)}" ${allowed ? "" : "disabled"}></div>
              <div class="field"><label for="person-status">在職区分</label><select id="person-status" name="status" ${allowed ? "" : "disabled"}>${selectOptions(["在職", "休職", "退職"], employee.status)}</select></div>
              <div class="field span-2"><label for="person-org">所属</label><select id="person-org" name="orgId" ${allowed ? "" : "disabled"}>${orgOptions(employee.orgId)}</select></div>
              <div class="field"><label for="person-title">職位</label><input id="person-title" name="title" value="${escapeHtml(employee.title)}" ${allowed ? "" : "disabled"}></div>
              <div class="field"><label for="person-type">雇用区分</label><select id="person-type" name="employmentType" ${allowed ? "" : "disabled"}>${selectOptions(["正職員", "契約職員", "再任用", "パート"], employee.employmentType)}</select></div>
            </div>
          </div>
        </section>
        <section class="legacy-panel">
          <div class="panel-heading">連絡先・備考</div>
          <div class="panel-body">
            <div class="form-grid">
              <div class="field span-2"><label for="person-phone">電話番号</label><input id="person-phone" name="phone" value="${escapeHtml(employee.phone)}" ${allowed ? "" : "disabled"}></div>
              <div class="field span-2"><label for="person-email">メール</label><input id="person-email" name="email" value="${escapeHtml(employee.email)}" ${allowed ? "" : "disabled"}></div>
              <div class="field span-4"><label for="person-address">住所</label><input id="person-address" name="address" value="${escapeHtml(employee.address)}" ${allowed ? "" : "disabled"}></div>
              <div class="field span-4"><label for="person-notes">備考</label><textarea id="person-notes" name="notes" ${allowed ? "" : "disabled"}>${escapeHtml(employee.notes)}</textarea></div>
            </div>
          </div>
        </section>
        <div class="screen-actions">
          <button class="legacy-button" type="button" data-reload>再表示</button>
          <button class="legacy-button primary" type="submit" data-primary-action ${allowed ? "" : "disabled"}>更新 (F8)</button>
        </div>
      </form>
    </div>`;
  bindEmployeeSelect();
  elements.workspace.querySelector("[data-reload]").addEventListener("click", () => renderEmployeeRegister());
  document.querySelector("#employee-register-form").addEventListener("submit", async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api(`/api/employees/${encodeURIComponent(employee.id)}`, {
        method: "PUT",
        body: JSON.stringify(data)
      });
      await refreshData();
      setStatus(`${result.employee.id} ${result.employee.name} の職員情報を更新しました。`, "success");
      await renderEmployeeRegister();
    } catch (error) {
      setStatus(error.message, "error");
    }
  });
}

function selectOptions(options, selected) {
  return options.map(option => `<option ${option === selected ? "selected" : ""}>${escapeHtml(option)}</option>`).join("");
}

async function renderEmployeeHistory() {
  const { employee } = await employeeDetail();
  const history = [
    { date: employee.hireDate, type: "採用", org: "採用時所属", title: "職員" },
    { date: "2021-04-01", type: "異動", org: orgName(employee.orgId), title: employee.title },
    { date: "2026-04-01", type: "定期更新", org: orgName(employee.orgId), title: employee.title }
  ];
  elements.workspace.innerHTML = `
    <div class="screen-shell">
      <div class="screen-summary">職員の異動履歴を参照します。</div>
      <div class="toolbar"><label>対象職員</label><select data-employee-select>${employeeOptions()}</select></div>
      ${employeeSummary(employee)}
      <section class="legacy-panel">
        <div class="panel-heading">異動履歴</div>
        <div class="panel-body">
          <table class="compact-table">
            <thead><tr><th>発令年月日</th><th>異動区分</th><th>所属</th><th>職位</th><th>備考</th></tr></thead>
            <tbody>${history.map(item => `<tr><td>${escapeHtml(item.date)}</td><td>${item.type}</td><td>${escapeHtml(item.org)}</td><td>${escapeHtml(item.title)}</td><td>デモ生成履歴</td></tr>`).join("")}</tbody>
          </table>
        </div>
      </section>
      <div class="screen-actions"><button class="legacy-button" type="button" data-primary-action>再表示 (F8)</button></div>
    </div>`;
  bindEmployeeSelect();
  elements.workspace.querySelector("[data-primary-action]").addEventListener("click", () => renderEmployeeHistory());
}

async function renderOrganization(editable) {
  const organizations = state.bootstrap.organizations;
  const selected = organizations.find(org => org.id === state.selectedOrgId) || organizations[0];
  const allowed = editable && hasPermission("edit_org");
  elements.workspace.innerHTML = `
    <div class="screen-shell">
      <div class="screen-summary">${editable ? "組織マスタを登録・変更します。" : "組織マスタを照会します。"}</div>
      ${editable ? permissionNotice("edit_org") : ""}
      <div class="toolbar">
        <label for="org-select">対象組織</label>
        <select id="org-select">${organizations.map(org => `<option value="${org.id}" ${org.id === selected.id ? "selected" : ""}>${escapeHtml(org.id)}　${escapeHtml(org.name)}</option>`).join("")}</select>
        <span class="spacer"></span>
        <span>所属職員数: <strong>${state.employees.filter(item => item.orgId === selected.id).length}</strong></span>
      </div>
      <form id="org-form">
        <section class="legacy-panel ${editable ? "danger-panel" : ""}">
          <div class="panel-heading">${editable ? "組織マスタ更新" : "組織マスタ情報"} <small>${editable ? "所属判定・帳票表示に影響します" : ""}</small></div>
          <div class="panel-body">
            <div class="form-grid">
              ${readOnlyField("組織コード", selected.id, 2)}
              <div class="field span-2"><label for="org-active">有効区分</label><select id="org-active" name="active" ${allowed ? "" : "disabled"}><option value="true" ${selected.active ? "selected" : ""}>有効</option><option value="false" ${selected.active ? "" : "selected"}>無効</option></select></div>
              <div class="field span-2"><label for="org-name">* 組織名称</label><input id="org-name" name="name" value="${escapeHtml(selected.name)}" required ${allowed ? "" : "disabled"}></div>
              <div class="field span-2"><label for="org-short">組織略称</label><input id="org-short" name="shortName" value="${escapeHtml(selected.shortName)}" ${allowed ? "" : "disabled"}></div>
              <div class="field span-2"><label for="org-parent">上位組織</label><select id="org-parent" name="parentId" ${allowed ? "" : "disabled"}>${orgOptions(selected.parentId, true)}</select></div>
              <div class="field span-2"><label for="org-manager">責任者</label><input id="org-manager" name="manager" value="${escapeHtml(selected.manager)}" ${allowed ? "" : "disabled"}></div>
            </div>
          </div>
        </section>
        <section class="legacy-panel">
          <div class="panel-heading">所属職員</div>
          <div class="panel-body">
            <table class="compact-table">
              <thead><tr><th>職員番号</th><th>氏名</th><th>職位</th><th>在職区分</th></tr></thead>
              <tbody>${state.employees.filter(item => item.orgId === selected.id).map(employee => `<tr><td>${employee.id}</td><td>${escapeHtml(employee.name)}</td><td>${escapeHtml(employee.title)}</td><td>${escapeHtml(employee.status)}</td></tr>`).join("") || `<tr><td colspan="4">所属職員はいません。</td></tr>`}</tbody>
            </table>
          </div>
        </section>
        <div class="screen-actions">
          <button class="legacy-button" type="button" data-reload>再表示</button>
          ${editable ? `<button class="legacy-button primary" type="submit" data-primary-action ${allowed ? "" : "disabled"}>更新 (F8)</button>` : `<button class="legacy-button" type="button" data-primary-action>照会 (F8)</button>`}
        </div>
      </form>
    </div>`;

  document.querySelector("#org-select").addEventListener("change", event => {
    state.selectedOrgId = event.target.value;
    renderOrganization(editable);
  });
  elements.workspace.querySelector("[data-reload]").addEventListener("click", () => renderOrganization(editable));
  document.querySelector("#org-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!editable) return renderOrganization(false);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    data.active = data.active === "true";
    const confirmed = await confirmAction({
      title: "組織マスタ更新確認",
      body: `<p class="modal-danger">組織マスタの変更は、職員検索・給与帳票・権限判定に影響する可能性があります。</p><p>対象: <strong>${escapeHtml(selected.id)} ${escapeHtml(selected.name)}</strong><br>変更後名称: <strong>${escapeHtml(data.name)}</strong></p>`,
      confirmText: "更新する",
      danger: true
    });
    if (!confirmed) return setStatus("組織マスタ更新をキャンセルしました。");
    try {
      await api(`/api/organizations/${encodeURIComponent(selected.id)}`, {
        method: "PUT",
        body: JSON.stringify(data)
      });
      await refreshData();
      setStatus(`${selected.id} の組織マスタを更新しました。`, "success");
      await renderOrganization(true);
    } catch (error) {
      setStatus(error.message, "error");
    }
  });
  if (!editable) {
    elements.workspace.querySelector("[data-primary-action]").addEventListener("click", () => renderOrganization(false));
  }
}

async function renderPayroll(editable) {
  const { employee, payroll, paymentRuns } = await employeeDetail();
  const allowed = editable && hasPermission("edit_payroll");
  elements.workspace.innerHTML = `
    <div class="screen-shell">
      <div class="screen-summary">${editable ? "職員の給与情報を登録・変更します。" : "職員の給与情報を参照します。"}</div>
      ${editable ? permissionNotice("edit_payroll") : ""}
      <div class="toolbar">
        <label for="payroll-employee">対象職員</label>
        <select id="payroll-employee" data-employee-select>${employeeOptions()}</select>
        <span class="spacer"></span>
        <span>更新対象を確認してから送信処理を実行してください。</span>
      </div>
      ${employeeSummary(employee)}
      <form id="payroll-form">
        <section class="legacy-panel">
          <div class="panel-heading">給与・級号俸</div>
          <div class="panel-body">
            <div class="form-grid">
              <div class="field"><label for="pay-grade">級</label><input id="pay-grade" name="grade" value="${escapeHtml(payroll.grade)}" ${allowed ? "" : "disabled"}></div>
              <div class="field"><label for="pay-step">号俸</label><input id="pay-step" name="step" value="${escapeHtml(payroll.step)}" ${allowed ? "" : "disabled"}></div>
              <div class="field span-2"><label for="pay-base">本給月額</label><input id="pay-base" class="money" name="baseSalary" type="number" min="0" max="10000000" value="${payroll.baseSalary}" ${allowed ? "" : "disabled"}></div>
            </div>
          </div>
        </section>
        <section class="legacy-panel">
          <div class="panel-heading">振込口座情報</div>
          <div class="panel-body">
            <div class="form-grid">
              <div class="field span-2"><label for="pay-bank">金融機関</label><input id="pay-bank" name="bankName" value="${escapeHtml(payroll.bankName)}" ${allowed ? "" : "disabled"}></div>
              <div class="field span-2"><label for="pay-branch">支店</label><input id="pay-branch" name="bankBranch" value="${escapeHtml(payroll.bankBranch)}" ${allowed ? "" : "disabled"}></div>
              <div class="field"><label for="pay-type">口座種別</label><select id="pay-type" name="accountType" ${allowed ? "" : "disabled"}>${selectOptions(["普通", "当座"], payroll.accountType)}</select></div>
              <div class="field span-2"><label for="pay-account">口座番号</label><input id="pay-account" name="accountNumber" value="${escapeHtml(payroll.accountNumber)}" ${allowed ? "" : "disabled"}></div>
            </div>
          </div>
        </section>
        <section class="legacy-panel">
          <div class="panel-heading">控除設定</div>
          <div class="panel-body check-row">
            ${checkbox("insurance", "健康保険", payroll.insurance, allowed)}
            ${checkbox("pension", "厚生年金", payroll.pension, allowed)}
            ${checkbox("incomeTax", "所得税", payroll.incomeTax, allowed)}
            ${checkbox("residenceTax", "住民税", payroll.residenceTax, allowed)}
          </div>
        </section>
        <section class="legacy-panel">
          <div class="panel-heading">直近の給与計算情報</div>
          <div class="panel-body">
            <table class="compact-table">
              <thead><tr><th>対象年月</th><th>状態</th><th>本給月額</th><th>当月総支給額</th><th>実行日時</th></tr></thead>
              <tbody>${paymentRuns.map(run => `<tr><td>${run.period}</td><td>${run.status}</td><td class="money">${yen(payroll.baseSalary)}</td><td class="money">${run.gross == null ? "（確定済）" : yen(run.gross)}</td><td>${run.executedAt}</td></tr>`).join("")}</tbody>
            </table>
          </div>
        </section>
        <div class="screen-actions">
          <button class="legacy-button" type="button" data-reload>再表示</button>
          ${editable ? `<button class="legacy-button primary" type="submit" data-primary-action ${allowed ? "" : "disabled"}>更新 (F8)</button>` : `<button class="legacy-button" type="button" data-primary-action>照会 (F8)</button>`}
        </div>
      </form>
    </div>`;
  bindEmployeeSelect();
  elements.workspace.querySelector("[data-reload]").addEventListener("click", () => renderPayroll(editable));
  document.querySelector("#payroll-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!editable) return renderPayroll(false);
    const form = new FormData(event.currentTarget);
    const data = Object.fromEntries(form);
    for (const field of ["insurance", "pension", "incomeTax", "residenceTax"]) data[field] = form.has(field);
    try {
      await api(`/api/payroll/${encodeURIComponent(employee.id)}`, {
        method: "PUT",
        body: JSON.stringify(data)
      });
      await refreshData();
      setStatus(`${employee.id} ${employee.name} の給与情報を更新しました。`, "success");
      await renderPayroll(true);
    } catch (error) {
      setStatus(error.message, "error");
    }
  });
  if (!editable) {
    elements.workspace.querySelector("[data-primary-action]").addEventListener("click", () => renderPayroll(false));
  }
}

function checkbox(name, label, checked, enabled) {
  return `<label><input type="checkbox" name="${name}" ${checked ? "checked" : ""} ${enabled ? "" : "disabled"}> ${escapeHtml(label)}</label>`;
}

async function renderAllowances(editable) {
  const { employee, payroll, allowances } = await employeeDetail();
  const allowed = editable && hasPermission("edit_payroll");
  const total = Object.values(allowances).reduce((sum, value) => sum + Number(value || 0), 0);
  elements.workspace.innerHTML = `
    <div class="screen-shell">
      <div class="screen-summary">${editable ? "職員のその他手当情報を登録・変更します。" : "職員のその他手当情報を参照します。"}</div>
      ${editable ? permissionNotice("edit_payroll") : ""}
      <div class="toolbar"><label>対象職員</label><select data-employee-select>${employeeOptions()}</select><span class="spacer"></span><span>本給: <strong>${yen(payroll.baseSalary)}</strong></span></div>
      ${employeeSummary(employee)}
      <form id="allowance-form">
        <section class="legacy-panel">
          <div class="panel-heading">その他手当（月額）</div>
          <div class="panel-body">
            <div class="form-grid">
              ${moneyField("dependent", "扶養手当", allowances.dependent, allowed)}
              ${moneyField("housing", "住居手当", allowances.housing, allowed)}
              ${moneyField("commute", "通勤手当", allowances.commute, allowed)}
              ${moneyField("overtime", "時間外手当", allowances.overtime, allowed)}
              ${moneyField("special", "特別手当", allowances.special, allowed)}
              ${readOnlyField("手当合計", yen(total), 2)}
            </div>
          </div>
        </section>
        <section class="legacy-panel">
          <div class="panel-heading">支給見込</div>
          <div class="panel-body">
            <table class="compact-table">
              <thead><tr><th>本給</th><th>扶養</th><th>住居</th><th>通勤</th><th>時間外</th><th>特別</th><th>総支給見込</th></tr></thead>
              <tbody><tr><td class="money">${yen(payroll.baseSalary)}</td><td class="money">${yen(allowances.dependent)}</td><td class="money">${yen(allowances.housing)}</td><td class="money">${yen(allowances.commute)}</td><td class="money">${yen(allowances.overtime)}</td><td class="money">${yen(allowances.special)}</td><td class="money"><strong>${yen(payroll.baseSalary + total)}</strong></td></tr></tbody>
            </table>
          </div>
        </section>
        <div class="screen-actions">
          <button class="legacy-button" type="button" data-reload>再表示</button>
          ${editable ? `<button class="legacy-button primary" type="submit" data-primary-action ${allowed ? "" : "disabled"}>更新 (F8)</button>` : `<button class="legacy-button" type="button" data-primary-action>照会 (F8)</button>`}
        </div>
      </form>
    </div>`;
  bindEmployeeSelect();
  elements.workspace.querySelector("[data-reload]").addEventListener("click", () => renderAllowances(editable));
  document.querySelector("#allowance-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!editable) return renderAllowances(false);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api(`/api/allowances/${encodeURIComponent(employee.id)}`, {
        method: "PUT",
        body: JSON.stringify(data)
      });
      await refreshData();
      setStatus(`${employee.id} ${employee.name} のその他手当を更新しました。`, "success");
      await renderAllowances(true);
    } catch (error) {
      setStatus(error.message, "error");
    }
  });
  if (!editable) {
    elements.workspace.querySelector("[data-primary-action]").addEventListener("click", () => renderAllowances(false));
  }
}

function moneyField(name, label, value, enabled) {
  return `<div class="field span-2"><label for="allowance-${name}">${escapeHtml(label)}</label><input id="allowance-${name}" class="money" name="${name}" type="number" min="0" max="1000000" value="${Number(value || 0)}" ${enabled ? "" : "disabled"}></div>`;
}

async function renderPayrollReset() {
  const { employee, payroll, allowances } = await employeeDetail();
  const allowed = hasPermission("edit_payroll");
  const total = payroll.baseSalary + Object.values(allowances).reduce((sum, value) => sum + Number(value || 0), 0);
  elements.workspace.innerHTML = `
    <div class="screen-shell">
      <div class="screen-summary">指定職員の給与情報を初期化します。</div>
      ${permissionNotice("edit_payroll")}
      <div class="toolbar"><label>対象職員</label><select data-employee-select>${employeeOptions()}</select></div>
      <form id="payroll-reset-form">
        <section class="legacy-panel danger-panel">
          <div class="panel-heading">給与情報初期化（破壊的処理）</div>
          <div class="panel-body">
            <div class="danger-warning">
              <div class="warning-symbol">!</div>
              <div><strong>「給与情報登録」ではありません。</strong><br>この処理は給与、口座、控除、全手当を初期値へ戻します。画面上から元に戻すことはできません。</div>
            </div>
            ${employeeSummary(employee)}
            <table class="compact-table">
              <tbody>
                <tr><th>現在の本給</th><td class="money">${yen(payroll.baseSalary)}</td><th>現在の総支給見込</th><td class="money">${yen(total)}</td></tr>
                <tr><th>振込口座</th><td>${escapeHtml(payroll.bankName)} ${escapeHtml(payroll.bankBranch)} ${escapeHtml(payroll.accountNumber)}</td><th>初期化対象</th><td>給与・振込口座・控除・手当</td></tr>
              </tbody>
            </table>
            <div class="form-grid" style="margin-top:10px">
              <div class="field span-2"><label for="reset-confirmation">確認文字列</label><input id="reset-confirmation" name="confirmation" placeholder="RESET と入力" autocomplete="off" ${allowed ? "" : "disabled"}></div>
              <div class="field span-2"><label>影響確認</label><div class="check-row"><label><input type="checkbox" name="impactConfirmed" ${allowed ? "" : "disabled"}> 対象職員と初期化範囲を確認しました</label></div></div>
            </div>
          </div>
        </section>
        <div class="screen-actions"><button class="legacy-button danger" type="submit" data-primary-action ${allowed ? "" : "disabled"}>給与情報を初期化 (F8)</button></div>
      </form>
    </div>`;
  bindEmployeeSelect();
  document.querySelector("#payroll-reset-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!form.has("impactConfirmed")) return setStatus("対象と影響を確認するチェックが必要です。", "error");
    if (form.get("confirmation") !== "RESET") return setStatus("確認文字列 RESET を正確に入力してください。", "error");
    const confirmed = await confirmAction({
      title: "給与情報初期化 最終確認",
      body: `<p class="modal-danger">${escapeHtml(employee.id)} ${escapeHtml(employee.name)} の給与・手当情報を初期化します。</p><p>この操作は給与情報登録ではありません。実行後は監査ログに破壊的処理として記録されます。</p>`,
      confirmText: "初期化を実行",
      danger: true
    });
    if (!confirmed) return setStatus("給与情報初期化をキャンセルしました。");
    try {
      await api("/api/danger/payroll-reset", {
        method: "POST",
        body: JSON.stringify({ employeeId: employee.id, confirmation: form.get("confirmation") })
      });
      await refreshData();
      setStatus(`${employee.id} ${employee.name} の給与情報を初期化しました。`, "success");
      await renderPayrollReset();
    } catch (error) {
      setStatus(error.message, "error");
    }
  });
}

async function renderBatchCalculate() {
  const allowed = hasPermission("run_batch");
  const currentPeriod = "2026-06";
  elements.workspace.innerHTML = `
    <div class="screen-shell">
      <div class="screen-summary">指定年月の給与計算処理を実行します。</div>
      ${permissionNotice("run_batch")}
      <form id="batch-form">
        <section class="legacy-panel">
          <div class="panel-heading">給与計算条件</div>
          <div class="panel-body">
            <div class="form-grid">
              <div class="field span-2"><label for="batch-period">対象年月</label><input id="batch-period" name="period" type="month" value="${currentPeriod}" ${allowed ? "" : "disabled"}></div>
              ${readOnlyField("対象職員数", `${state.employees.length} 名`, 2)}
              ${readOnlyField("計算方式", "本給 + 登録済手当（デモ簡易計算）", 4)}
            </div>
          </div>
        </section>
        <section class="legacy-panel">
          <div class="panel-heading">現在の処理状況</div>
          <div class="panel-body">${paymentTable()}</div>
        </section>
        <div class="screen-actions"><button class="legacy-button primary" type="submit" data-primary-action ${allowed ? "" : "disabled"}>給与計算実行 (F8)</button></div>
      </form>
    </div>`;
  document.querySelector("#batch-form").addEventListener("submit", async event => {
    event.preventDefault();
    const period = new FormData(event.currentTarget).get("period");
    const confirmed = await confirmAction({
      title: "給与計算実行確認",
      body: `<p>${escapeHtml(period)} の給与計算を全職員 ${state.employees.length} 名に対して実行します。</p><p>既存の同年月データがある場合は計算結果を上書きします。</p>`,
      confirmText: "計算実行",
      danger: false
    });
    if (!confirmed) return setStatus("給与計算処理をキャンセルしました。");
    try {
      const result = await api("/api/batch/calculate", {
        method: "POST",
        body: JSON.stringify({ period })
      });
      await refreshData();
      setStatus(`${period} の給与計算が完了しました。総支給額 ${yen(result.run.grossTotal)}`, "success");
      await renderBatchCalculate();
    } catch (error) {
      setStatus(error.message, "error");
    }
  });
}

function paymentTable() {
  return `
    <table class="compact-table">
      <thead><tr><th>対象年月</th><th>状態</th><th>職員数</th><th>総支給額</th><th>実行日時</th></tr></thead>
      <tbody>${state.bootstrap.paymentRuns.map(run => `<tr><td>${run.period}</td><td>${run.status}</td><td class="money">${run.employeeCount} 名</td><td class="money">${yen(run.grossTotal)}</td><td>${run.executedAt}</td></tr>`).join("") || `<tr><td colspan="5">支給データはありません。</td></tr>`}</tbody>
    </table>`;
}

async function renderPaymentReference() {
  elements.workspace.innerHTML = `
    <div class="screen-shell">
      <div class="screen-summary">給与支給データを照会します。</div>
      <section class="legacy-panel">
        <div class="panel-heading">給与支給データ一覧</div>
        <div class="panel-body">${paymentTable()}</div>
      </section>
      <div class="screen-actions">
        <button class="legacy-button" type="button" data-delete-screen>給与支給データ削除へ</button>
        <button class="legacy-button primary" type="button" data-primary-action>再照会 (F8)</button>
      </div>
    </div>`;
  elements.workspace.querySelector("[data-delete-screen]").addEventListener("click", () => openFeature("payment-delete"));
  elements.workspace.querySelector("[data-primary-action]").addEventListener("click", () => renderPaymentReference());
}

async function renderPaymentDelete() {
  const allowed = hasPermission("run_batch");
  const selected = state.bootstrap.paymentRuns[0];
  elements.workspace.innerHTML = `
    <div class="screen-shell">
      <div class="screen-summary">指定年月の給与支給データを削除します。</div>
      ${permissionNotice("run_batch")}
      <form id="payment-delete-form">
        <section class="legacy-panel danger-panel">
          <div class="panel-heading">給与支給データ削除（破壊的処理）</div>
          <div class="panel-body">
            <div class="danger-warning">
              <div class="warning-symbol">!</div>
              <div><strong>「給与支給データ照会」ではありません。</strong><br>対象年月の計算・支給データを一覧から削除します。登録済みの職員給与情報は残ります。</div>
            </div>
            <div class="form-grid">
              <div class="field span-2"><label for="delete-period">対象年月</label><select id="delete-period" name="period" ${allowed ? "" : "disabled"}>${state.bootstrap.paymentRuns.map(run => `<option value="${run.period}">${run.period}　${run.status}　${yen(run.grossTotal)}</option>`).join("")}</select></div>
              <div class="field span-2"><label for="delete-confirmation">確認文字列</label><input id="delete-confirmation" name="confirmation" placeholder="DELETE と入力" autocomplete="off" ${allowed ? "" : "disabled"}></div>
              <div class="field span-4"><label>影響確認</label><div class="check-row"><label><input type="checkbox" name="impactConfirmed" ${allowed ? "" : "disabled"}> 対象年月と削除範囲を確認しました</label></div></div>
            </div>
            ${selected ? `<p>現在の先頭データ: ${selected.period} / ${selected.status} / ${yen(selected.grossTotal)}</p>` : `<p>削除対象の支給データはありません。</p>`}
          </div>
        </section>
        <div class="screen-actions"><button class="legacy-button danger" type="submit" data-primary-action ${allowed && selected ? "" : "disabled"}>支給データを削除 (F8)</button></div>
      </form>
    </div>`;
  document.querySelector("#payment-delete-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!form.has("impactConfirmed")) return setStatus("対象と影響を確認するチェックが必要です。", "error");
    if (form.get("confirmation") !== "DELETE") return setStatus("確認文字列 DELETE を正確に入力してください。", "error");
    const period = form.get("period");
    const confirmed = await confirmAction({
      title: "給与支給データ削除 最終確認",
      body: `<p class="modal-danger">${escapeHtml(period)} の給与支給データを削除します。</p><p>この操作は照会ではありません。実行後は監査ログに破壊的処理として記録されます。</p>`,
      confirmText: "削除を実行",
      danger: true
    });
    if (!confirmed) return setStatus("給与支給データ削除をキャンセルしました。");
    try {
      await api("/api/danger/payment-delete", {
        method: "POST",
        body: JSON.stringify({ period, confirmation: form.get("confirmation") })
      });
      await refreshData();
      setStatus(`${period} の給与支給データを削除しました。`, "success");
      await renderPaymentDelete();
    } catch (error) {
      setStatus(error.message, "error");
    }
  });
}

async function renderAuditLog() {
  const result = await api("/api/audit");
  elements.workspace.innerHTML = `
    <div class="screen-shell">
      <div class="screen-summary">操作履歴を照会します。更新前後の詳細はAPI監査データに保持されています。</div>
      <section class="legacy-panel">
        <div class="panel-heading">操作履歴（最新200件）</div>
        <div class="panel-body">
          <table class="compact-table">
            <thead><tr><th>日時</th><th>利用者</th><th>処理名</th><th>対象</th><th>リスク</th><th>処理内容</th></tr></thead>
            <tbody>${result.audit.map(entry => `
              <tr>
                <td>${escapeHtml(entry.time)}</td>
                <td>${escapeHtml(entry.userId)} ${escapeHtml(entry.userName)}</td>
                <td>${escapeHtml(entry.action)}</td>
                <td>${escapeHtml(entry.target)}</td>
                <td class="risk-${escapeHtml(entry.risk)}">${riskLabel(entry.risk)}</td>
                <td>${escapeHtml(entry.detail)}</td>
              </tr>`).join("")}</tbody>
          </table>
        </div>
      </section>
      <div class="screen-actions"><button class="legacy-button primary" type="button" data-primary-action>再照会 (F8)</button></div>
    </div>`;
  elements.workspace.querySelector("[data-primary-action]").addEventListener("click", () => renderAuditLog());
}

async function renderDemoReset() {
  const allowed = hasPermission("reset_demo");
  elements.workspace.innerHTML = `
    <div class="screen-shell">
      <div class="screen-summary">デモ用インメモリデータを初期状態へ戻します。</div>
      ${permissionNotice("reset_demo")}
      <form id="demo-reset-form">
        <section class="legacy-panel danger-panel">
          <div class="panel-heading">デモデータ再読込</div>
          <div class="panel-body">
            <div class="danger-warning">
              <div class="warning-symbol">!</div>
              <div><strong>実験中に行ったすべての更新が失われます。</strong><br>職員、給与、手当、組織、支給データ、監査ログを起動時データへ戻します。</div>
            </div>
            <div class="form-grid">
              <div class="field span-2"><label for="reload-confirmation">確認文字列</label><input id="reload-confirmation" name="confirmation" placeholder="RELOAD と入力" ${allowed ? "" : "disabled"}></div>
            </div>
          </div>
        </section>
        <div class="screen-actions"><button class="legacy-button danger" type="submit" data-primary-action ${allowed ? "" : "disabled"}>デモデータ再読込 (F8)</button></div>
      </form>
    </div>`;
  document.querySelector("#demo-reset-form").addEventListener("submit", async event => {
    event.preventDefault();
    const confirmation = new FormData(event.currentTarget).get("confirmation");
    if (confirmation !== "RELOAD") return setStatus("確認文字列 RELOAD を正確に入力してください。", "error");
    const confirmed = await confirmAction({
      title: "デモデータ再読込 最終確認",
      body: `<p class="modal-danger">実験中の変更と監査ログを破棄し、デモデータを初期状態へ戻します。</p>`,
      confirmText: "再読込を実行",
      danger: true
    });
    if (!confirmed) return setStatus("デモデータ再読込をキャンセルしました。");
    try {
      await api("/api/demo/reset", {
        method: "POST",
        body: JSON.stringify({ confirmation })
      });
      await refreshData();
      setStatus("デモデータを初期状態へ戻しました。", "success");
      renderMenu();
    } catch (error) {
      setStatus(error.message, "error");
    }
  });
}

function confirmAction({ title, body, confirmText = "実行する", danger = false, showCancel = true }) {
  return new Promise(resolve => {
    elements.modalTitle.textContent = title;
    elements.modalBody.innerHTML = body;
    elements.modalConfirm.textContent = confirmText;
    elements.modalConfirm.className = `legacy-button ${danger ? "danger" : "primary"}`;
    elements.modalCancel.classList.toggle("hidden", !showCancel);
    elements.modal.classList.remove("hidden");
    elements.modalConfirm.focus();

    const close = result => {
      elements.modal.classList.add("hidden");
      elements.modalConfirm.removeEventListener("click", onConfirm);
      elements.modalCancel.removeEventListener("click", onCancel);
      resolve(result);
    };
    const onConfirm = () => close(true);
    const onCancel = () => close(false);
    elements.modalConfirm.addEventListener("click", onConfirm);
    elements.modalCancel.addEventListener("click", onCancel);
    applyDomExperimentMode();
  });
}

function showHelp() {
  const feature = currentFeatureDefinition()?.feature;
  confirmAction({
    title: "操作ヘルプ",
    body: `
      <p><strong>現在画面:</strong> ${escapeHtml(feature?.name || "業務メニュー")}</p>
      <ul class="help-list">
        <li>F1: このヘルプを表示</li>
        <li>F3: 業務メニューへ戻る</li>
        <li>F5: 表示データを再取得</li>
        <li>F8: 画面の主処理（検索・更新・実行）</li>
        <li>F10: 業務メニューへ戻る</li>
      </ul>
      <p>破壊的処理は確認文字列、影響確認チェック、最終確認ダイアログの3段階で保護されています。</p>`,
    confirmText: "閉じる",
    showCancel: false
  });
}

async function refreshCurrent() {
  try {
    setStatus("最新データを取得しています...");
    await refreshData();
    if (state.currentFeature) await renderCurrentFeature();
    else renderMenu();
    setStatus("最新データに更新しました。", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function executePrimaryAction() {
  const button = elements.workspace.querySelector("[data-primary-action]:not(:disabled)");
  if (button) button.click();
  else setStatus("この画面で実行できる送信処理はありません。", "error");
}

async function logout() {
  await api("/api/logout", { method: "POST", body: "{}" }).catch(() => {});
  showLogin();
}

elements.loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  elements.loginError.textContent = "";
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const result = await api("/api/login", {
      method: "POST",
      body: JSON.stringify(data)
    });
    await showApp(result.user);
  } catch (error) {
    elements.loginError.textContent = error.message;
  }
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  const confirmed = await confirmAction({
    title: "ログアウト確認",
    body: "<p>人事給与統合システムからログアウトします。</p>",
    confirmText: "ログアウト",
    danger: false
  });
  if (confirmed) await logout();
});

document.querySelector("#quick-menu").addEventListener("click", event => {
  const button = event.target.closest("[data-feature]");
  if (button) openFeature(button.dataset.feature);
});

document.querySelector(".function-key-bar").addEventListener("click", event => {
  const button = event.target.closest("[data-key-action]");
  if (!button) return;
  const action = button.dataset.keyAction;
  if (action === "help") showHelp();
  if (action === "back" || action === "menu") renderMenu();
  if (action === "refresh") refreshCurrent();
  if (action === "execute") executePrimaryAction();
});

document.addEventListener("keydown", event => {
  const actions = {
    F1: () => showHelp(),
    F3: () => renderMenu(),
    F5: () => refreshCurrent(),
    F8: () => executePrimaryAction(),
    F10: () => renderMenu()
  };
  if (actions[event.key]) {
    event.preventDefault();
    actions[event.key]();
  }
  if (event.key === "Enter" && !state.currentFeature && !elements.appScreen.classList.contains("hidden")) {
    const active = document.activeElement;
    if (active?.dataset?.function) {
      event.preventDefault();
      openFeature(active.dataset.function);
    }
  }
});

(async function initialize() {
  try {
    const result = await api("/api/session");
    await showApp(result.user);
  } catch {
    showLogin();
  }
})();
