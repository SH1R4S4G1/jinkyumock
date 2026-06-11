const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 4173);
const PUBLIC_DIR = path.join(__dirname, "public");

const USERS = {
  U0001: {
    password: "legacy123",
    name: "山田 一郎",
    department: "総務部 人事課",
    role: "標準担当者",
    permissions: ["view", "edit_personnel", "edit_payroll", "edit_org", "run_batch"]
  },
  U0002: {
    password: "viewonly",
    name: "佐藤 花子",
    department: "監査室",
    role: "参照専用",
    permissions: ["view"]
  },
  U0099: {
    password: "supervisor",
    name: "管理 太郎",
    department: "情報システム部",
    role: "システム管理者",
    permissions: ["view", "edit_personnel", "edit_payroll", "edit_org", "run_batch", "reset_demo"]
  }
};

const seedData = {
  employees: [
    {
      id: "100123",
      name: "山田 一郎",
      nameKana: "ヤマダ イチロウ",
      gender: "男",
      birthDate: "1978-04-12",
      hireDate: "2000-04-01",
      orgId: "ORG-110",
      title: "主任",
      employmentType: "正職員",
      status: "在職",
      phone: "03-5555-0101",
      email: "ichiro.yamada@example.local",
      address: "東京都千代田区丸の内1-1",
      notes: "給与検証用の標準職員"
    },
    {
      id: "100124",
      name: "佐藤 花子",
      nameKana: "サトウ ハナコ",
      gender: "女",
      birthDate: "1986-09-03",
      hireDate: "2012-04-01",
      orgId: "ORG-120",
      title: "係長",
      employmentType: "正職員",
      status: "在職",
      phone: "03-5555-0102",
      email: "hanako.sato@example.local",
      address: "東京都新宿区西新宿2-8",
      notes: ""
    },
    {
      id: "100125",
      name: "鈴木 健",
      nameKana: "スズキ ケン",
      gender: "男",
      birthDate: "1992-01-21",
      hireDate: "2018-10-01",
      orgId: "ORG-210",
      title: "主事",
      employmentType: "正職員",
      status: "休職",
      phone: "06-5555-0201",
      email: "ken.suzuki@example.local",
      address: "大阪府大阪市北区梅田3-1",
      notes: "2026年7月復職予定"
    },
    {
      id: "200031",
      name: "高橋 美咲",
      nameKana: "タカハシ ミサキ",
      gender: "女",
      birthDate: "1998-11-15",
      hireDate: "2023-04-01",
      orgId: "ORG-111",
      title: "担当",
      employmentType: "契約職員",
      status: "在職",
      phone: "03-5555-0103",
      email: "misaki.takahashi@example.local",
      address: "埼玉県さいたま市大宮区桜木町1-7",
      notes: "契約更新: 2027年3月"
    },
    {
      id: "300007",
      name: "伊藤 守",
      nameKana: "イトウ マモル",
      gender: "男",
      birthDate: "1964-06-30",
      hireDate: "1987-04-01",
      orgId: "ORG-900",
      title: "嘱託",
      employmentType: "再任用",
      status: "在職",
      phone: "03-5555-0999",
      email: "mamoru.ito@example.local",
      address: "東京都品川区大崎1-11",
      notes: ""
    }
  ],
  payroll: {
    "100123": {
      grade: "8級",
      step: "25号俸",
      baseSalary: 287200,
      bankName: "東都銀行",
      bankBranch: "本店営業部",
      accountType: "普通",
      accountNumber: "1234567",
      insurance: true,
      pension: true,
      incomeTax: true,
      residenceTax: true
    },
    "100124": {
      grade: "7級",
      step: "18号俸",
      baseSalary: 265400,
      bankName: "みらい銀行",
      bankBranch: "新宿支店",
      accountType: "普通",
      accountNumber: "2345678",
      insurance: true,
      pension: true,
      incomeTax: true,
      residenceTax: true
    },
    "100125": {
      grade: "4級",
      step: "12号俸",
      baseSalary: 228900,
      bankName: "なにわ銀行",
      bankBranch: "梅田支店",
      accountType: "普通",
      accountNumber: "3456789",
      insurance: false,
      pension: false,
      incomeTax: false,
      residenceTax: false
    },
    "200031": {
      grade: "契約A",
      step: "3号",
      baseSalary: 214000,
      bankName: "東都銀行",
      bankBranch: "大宮支店",
      accountType: "普通",
      accountNumber: "4567890",
      insurance: true,
      pension: true,
      incomeTax: true,
      residenceTax: true
    },
    "300007": {
      grade: "再任用",
      step: "2号",
      baseSalary: 198500,
      bankName: "東都銀行",
      bankBranch: "大崎支店",
      accountType: "普通",
      accountNumber: "5678901",
      insurance: true,
      pension: true,
      incomeTax: true,
      residenceTax: true
    }
  },
  allowances: {
    "100123": { dependent: 12000, housing: 28000, commute: 6500, overtime: 26340, special: 5000 },
    "100124": { dependent: 6000, housing: 18000, commute: 8400, overtime: 18500, special: 0 },
    "100125": { dependent: 0, housing: 24000, commute: 12000, overtime: 0, special: 0 },
    "200031": { dependent: 0, housing: 20000, commute: 7200, overtime: 14300, special: 3000 },
    "300007": { dependent: 0, housing: 0, commute: 4800, overtime: 0, special: 12000 }
  },
  organizations: [
    { id: "ORG-100", name: "総務部", shortName: "総務", parentId: "", manager: "中村 部長", active: true },
    { id: "ORG-110", name: "総務部 人事課", shortName: "人事", parentId: "ORG-100", manager: "小林 課長", active: true },
    { id: "ORG-111", name: "総務部 人事課 人事係", shortName: "人事係", parentId: "ORG-110", manager: "佐々木 係長", active: true },
    { id: "ORG-120", name: "総務部 給与課", shortName: "給与", parentId: "ORG-100", manager: "松本 課長", active: true },
    { id: "ORG-200", name: "西日本事業部", shortName: "西日本", parentId: "", manager: "吉田 部長", active: true },
    { id: "ORG-210", name: "西日本事業部 大阪支店", shortName: "大阪", parentId: "ORG-200", manager: "井上 支店長", active: true },
    { id: "ORG-900", name: "監査室", shortName: "監査", parentId: "", manager: "清水 室長", active: true }
  ],
  paymentRuns: [
    { period: "2026-06", status: "計算済", employeeCount: 5, grossTotal: 1696540, executedAt: "2026-06-10 18:12" },
    { period: "2026-05", status: "振込済", employeeCount: 5, grossTotal: 1689200, executedAt: "2026-05-20 17:45" },
    { period: "2026-04", status: "振込済", employeeCount: 5, grossTotal: 1678500, executedAt: "2026-04-18 17:32" }
  ],
  audit: [
    {
      id: "AUD-0001",
      time: "2026-06-10 18:12:04",
      userId: "U0001",
      userName: "山田 一郎",
      action: "給与計算実行",
      target: "2026-06",
      risk: "normal",
      detail: "5件の給与を計算"
    }
  ]
};

function cloneSeed() {
  return structuredClone(seedData);
}

function createStore() {
  return {
    state: cloneSeed(),
    sessions: new Map(),
    auditSequence: 2
  };
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders
  });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new HttpError(413, "送信データが大きすぎます。"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new HttpError(400, "JSON形式が正しくありません。"));
      }
    });
    req.on("error", reject);
  });
}

function getCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map(value => value.trim())
      .filter(Boolean)
      .map(value => {
        const index = value.indexOf("=");
        return [value.slice(0, index), decodeURIComponent(value.slice(index + 1))];
      })
  );
}

function publicUser(id) {
  const user = USERS[id];
  if (!user) return null;
  return {
    id,
    name: user.name,
    department: user.department,
    role: user.role,
    permissions: user.permissions
  };
}

function requireSession(req, store) {
  const sessionId = getCookies(req).legacy_session;
  const userId = sessionId && store.sessions.get(sessionId);
  if (!userId) throw new HttpError(401, "セッションが無効です。再度ログインしてください。");
  return publicUser(userId);
}

function requirePermission(user, permission) {
  if (!user.permissions.includes(permission)) {
    throw new HttpError(403, `権限がありません（必要権限: ${permission}）。`);
  }
}

function addAudit(store, user, action, target, risk, detail, before = null, after = null) {
  const id = `AUD-${String(store.auditSequence++).padStart(4, "0")}`;
  const entry = {
    id,
    time: new Date().toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).replaceAll("/", "-"),
    userId: user.id,
    userName: user.name,
    action,
    target,
    risk,
    detail,
    before,
    after
  };
  store.state.audit.unshift(entry);
  return entry;
}

function employeeOr404(store, employeeId) {
  const employee = store.state.employees.find(item => item.id === employeeId);
  if (!employee) throw new HttpError(404, "指定された職員が見つかりません。");
  return employee;
}

function organizationOr404(store, orgId) {
  const organization = store.state.organizations.find(item => item.id === orgId);
  if (!organization) throw new HttpError(404, "指定された組織が見つかりません。");
  return organization;
}

function parseRoute(urlPath, prefix) {
  if (!urlPath.startsWith(prefix)) return null;
  return decodeURIComponent(urlPath.slice(prefix.length));
}

function calculateGross(store, employeeId) {
  const payroll = store.state.payroll[employeeId];
  const allowances = store.state.allowances[employeeId];
  return Number(payroll?.baseSalary || 0) +
    Object.values(allowances || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

async function handleApi(req, res, store, url) {
  if (req.method === "POST" && url.pathname === "/api/login") {
    const { userId = "", password = "" } = await readJson(req);
    const normalizedId = String(userId).trim().toUpperCase();
    if (!USERS[normalizedId] || USERS[normalizedId].password !== password) {
      throw new HttpError(401, "利用者IDまたはパスワードが違います。");
    }
    const sessionId = crypto.randomBytes(24).toString("hex");
    store.sessions.set(sessionId, normalizedId);
    addAudit(store, publicUser(normalizedId), "ログイン", normalizedId, "normal", "ログイン成功");
    return json(res, 200, { user: publicUser(normalizedId) }, {
      "Set-Cookie": `legacy_session=${sessionId}; HttpOnly; SameSite=Lax; Path=/`
    });
  }

  if (req.method === "POST" && url.pathname === "/api/logout") {
    const sessionId = getCookies(req).legacy_session;
    if (sessionId) store.sessions.delete(sessionId);
    return json(res, 200, { ok: true }, {
      "Set-Cookie": "legacy_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
    });
  }

  const user = requireSession(req, store);

  if (req.method === "GET" && url.pathname === "/api/session") {
    return json(res, 200, { user });
  }

  if (req.method === "GET" && url.pathname === "/api/bootstrap") {
    return json(res, 200, {
      user,
      organizations: store.state.organizations,
      paymentRuns: store.state.paymentRuns,
      recentAudit: store.state.audit.slice(0, 5),
      employeeCount: store.state.employees.length
    });
  }

  if (req.method === "GET" && url.pathname === "/api/employees") {
    const query = String(url.searchParams.get("query") || "").trim().toLowerCase();
    const status = String(url.searchParams.get("status") || "");
    const orgId = String(url.searchParams.get("orgId") || "");
    const employees = store.state.employees.filter(employee => {
      const matchesQuery = !query || [employee.id, employee.name, employee.nameKana]
        .some(value => String(value).toLowerCase().includes(query));
      return matchesQuery && (!status || employee.status === status) && (!orgId || employee.orgId === orgId);
    });
    return json(res, 200, { employees });
  }

  const employeeId = parseRoute(url.pathname, "/api/employees/");
  if (req.method === "GET" && employeeId) {
    const employee = employeeOr404(store, employeeId);
    return json(res, 200, {
      employee,
      payroll: store.state.payroll[employeeId],
      allowances: store.state.allowances[employeeId],
      paymentRuns: store.state.paymentRuns.map(run => ({
        ...run,
        gross: run.period === "2026-06" ? calculateGross(store, employeeId) : null
      }))
    });
  }

  if (req.method === "PUT" && employeeId) {
    requirePermission(user, "edit_personnel");
    const employee = employeeOr404(store, employeeId);
    const body = await readJson(req);
    const before = structuredClone(employee);
    const allowed = [
      "name", "nameKana", "gender", "birthDate", "hireDate", "orgId", "title",
      "employmentType", "status", "phone", "email", "address", "notes"
    ];
    for (const field of allowed) {
      if (Object.hasOwn(body, field)) employee[field] = body[field];
    }
    organizationOr404(store, employee.orgId);
    addAudit(store, user, "職員情報更新", employeeId, "normal", `${employee.name}の基本情報を更新`, before, employee);
    return json(res, 200, { employee });
  }

  const payrollId = parseRoute(url.pathname, "/api/payroll/");
  if (req.method === "PUT" && payrollId) {
    requirePermission(user, "edit_payroll");
    employeeOr404(store, payrollId);
    const body = await readJson(req);
    const before = structuredClone(store.state.payroll[payrollId] || {});
    const next = { ...before };
    const textFields = ["grade", "step", "bankName", "bankBranch", "accountType", "accountNumber"];
    const booleanFields = ["insurance", "pension", "incomeTax", "residenceTax"];
    for (const field of textFields) {
      if (Object.hasOwn(body, field)) next[field] = String(body[field]);
    }
    if (Object.hasOwn(body, "baseSalary")) {
      const amount = Number(body.baseSalary);
      if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000) {
        throw new HttpError(400, "本給月額の値が不正です。");
      }
      next.baseSalary = Math.round(amount);
    }
    for (const field of booleanFields) {
      if (Object.hasOwn(body, field)) next[field] = Boolean(body[field]);
    }
    store.state.payroll[payrollId] = next;
    addAudit(store, user, "給与情報更新", payrollId, "sensitive", "給与・振込・控除情報を更新", before, next);
    return json(res, 200, { payroll: next });
  }

  const allowanceId = parseRoute(url.pathname, "/api/allowances/");
  if (req.method === "PUT" && allowanceId) {
    requirePermission(user, "edit_payroll");
    employeeOr404(store, allowanceId);
    const body = await readJson(req);
    const before = structuredClone(store.state.allowances[allowanceId] || {});
    const next = {};
    for (const field of ["dependent", "housing", "commute", "overtime", "special"]) {
      const amount = Number(body[field] || 0);
      if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) {
        throw new HttpError(400, `${field}の値が不正です。`);
      }
      next[field] = Math.round(amount);
    }
    store.state.allowances[allowanceId] = next;
    addAudit(store, user, "その他手当更新", allowanceId, "sensitive", "5種類の手当情報を更新", before, next);
    return json(res, 200, { allowances: next });
  }

  if (req.method === "GET" && url.pathname === "/api/organizations") {
    return json(res, 200, { organizations: store.state.organizations });
  }

  const orgId = parseRoute(url.pathname, "/api/organizations/");
  if (req.method === "PUT" && orgId) {
    requirePermission(user, "edit_org");
    const organization = organizationOr404(store, orgId);
    const body = await readJson(req);
    const before = structuredClone(organization);
    for (const field of ["name", "shortName", "parentId", "manager"]) {
      if (Object.hasOwn(body, field)) organization[field] = String(body[field]);
    }
    if (Object.hasOwn(body, "active")) organization.active = Boolean(body.active);
    if (!organization.name.trim()) throw new HttpError(400, "組織名称は必須です。");
    if (organization.parentId === orgId) throw new HttpError(400, "自組織を上位組織には指定できません。");
    if (organization.parentId) organizationOr404(store, organization.parentId);
    addAudit(store, user, "組織マスタ更新", orgId, "high", `${before.name}を${organization.name}へ更新`, before, organization);
    return json(res, 200, { organization });
  }

  if (req.method === "POST" && url.pathname === "/api/batch/calculate") {
    requirePermission(user, "run_batch");
    const body = await readJson(req);
    const period = String(body.period || "");
    if (!/^\d{4}-\d{2}$/.test(period)) throw new HttpError(400, "対象年月が不正です。");
    const grossTotal = store.state.employees.reduce((sum, employee) => sum + calculateGross(store, employee.id), 0);
    const existing = store.state.paymentRuns.find(run => run.period === period);
    const run = {
      period,
      status: "計算済",
      employeeCount: store.state.employees.length,
      grossTotal,
      executedAt: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false }).replaceAll("/", "-")
    };
    if (existing) Object.assign(existing, run);
    else store.state.paymentRuns.unshift(run);
    addAudit(store, user, "給与計算実行", period, "sensitive", `${run.employeeCount}件、総支給額${grossTotal}円`);
    return json(res, 200, { run });
  }

  if (req.method === "POST" && url.pathname === "/api/danger/payroll-reset") {
    requirePermission(user, "edit_payroll");
    const body = await readJson(req);
    if (body.confirmation !== "RESET") throw new HttpError(400, "確認文字列 RESET を入力してください。");
    const employee = employeeOr404(store, String(body.employeeId || ""));
    const before = {
      payroll: structuredClone(store.state.payroll[employee.id]),
      allowances: structuredClone(store.state.allowances[employee.id])
    };
    store.state.payroll[employee.id] = {
      grade: "", step: "", baseSalary: 0, bankName: "", bankBranch: "",
      accountType: "普通", accountNumber: "", insurance: false, pension: false,
      incomeTax: false, residenceTax: false
    };
    store.state.allowances[employee.id] = {
      dependent: 0, housing: 0, commute: 0, overtime: 0, special: 0
    };
    addAudit(store, user, "給与情報初期化", employee.id, "destructive", `${employee.name}の給与・手当を初期化`, before, {
      payroll: store.state.payroll[employee.id],
      allowances: store.state.allowances[employee.id]
    });
    return json(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/danger/payment-delete") {
    requirePermission(user, "run_batch");
    const body = await readJson(req);
    if (body.confirmation !== "DELETE") throw new HttpError(400, "確認文字列 DELETE を入力してください。");
    const period = String(body.period || "");
    const index = store.state.paymentRuns.findIndex(run => run.period === period);
    if (index < 0) throw new HttpError(404, "指定年月の支給データはありません。");
    const [deleted] = store.state.paymentRuns.splice(index, 1);
    addAudit(store, user, "給与支給データ削除", period, "destructive", `${period}の支給データを削除`, deleted, null);
    return json(res, 200, { deleted });
  }

  if (req.method === "GET" && url.pathname === "/api/audit") {
    const risk = String(url.searchParams.get("risk") || "");
    const entries = risk ? store.state.audit.filter(entry => entry.risk === risk) : store.state.audit;
    return json(res, 200, { audit: entries.slice(0, 200) });
  }

  if (req.method === "POST" && url.pathname === "/api/demo/reset") {
    requirePermission(user, "reset_demo");
    const body = await readJson(req);
    if (body.confirmation !== "RELOAD") throw new HttpError(400, "確認文字列 RELOAD を入力してください。");
    store.state = cloneSeed();
    store.auditSequence = 2;
    addAudit(store, user, "デモデータ再読込", "SYSTEM", "high", "全データを初期状態へ復元");
    return json(res, 200, { ok: true });
  }

  throw new HttpError(404, "APIが見つかりません。");
}

function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR)) throw new HttpError(403, "アクセスできません。");
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new HttpError(404, "ファイルが見つかりません。");
  }
  const extension = path.extname(filePath).toLowerCase();
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".ico": "image/x-icon"
  }[extension] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": mime,
    "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=60"
  });
  fs.createReadStream(filePath).pipe(res);
}

function createHandler(store = createStore()) {
  return async function handler(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    try {
      if (url.pathname.startsWith("/api/")) {
        await handleApi(req, res, store, url);
      } else {
        serveStatic(req, res, url);
      }
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) console.error(error);
      json(res, status, { error: error.message || "内部エラーが発生しました。" });
    }
  };
}

function startServer(port = PORT) {
  const store = createStore();
  const server = http.createServer(createHandler(store));
  return new Promise(resolve => {
    server.listen(port, "127.0.0.1", () => {
      console.log(`Legacy HR/Payroll Agent Lab: http://127.0.0.1:${port}`);
      resolve({ server, store });
    });
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { createHandler, createStore, startServer, USERS };
