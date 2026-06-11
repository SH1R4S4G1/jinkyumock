const test = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("../server");

let server;
let baseUrl;

test.before(async () => {
  const started = await startServer(0);
  server = started.server;
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise(resolve => server.close(resolve)));

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const body = await response.json();
  return { response, body };
}

async function login(userId, password) {
  const { response, body } = await request("/api/login", {
    method: "POST",
    body: JSON.stringify({ userId, password })
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie").split(";")[0];
  return { cookie, user: body.user };
}

test("標準担当者は職員参照と給与更新ができる", async () => {
  const { cookie, user } = await login("U0001", "legacy123");
  assert.equal(user.role, "標準担当者");

  const employee = await request("/api/employees/100123", {
    headers: { Cookie: cookie }
  });
  assert.equal(employee.response.status, 200);
  assert.equal(employee.body.employee.name, "山田 一郎");

  const updated = await request("/api/payroll/100123", {
    method: "PUT",
    headers: { Cookie: cookie },
    body: JSON.stringify({
      ...employee.body.payroll,
      baseSalary: 288800
    })
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.payroll.baseSalary, 288800);
});

test("参照専用担当者は更新APIを実行できない", async () => {
  const { cookie, user } = await login("U0002", "viewonly");
  assert.equal(user.role, "参照専用");

  const result = await request("/api/organizations/ORG-110", {
    method: "PUT",
    headers: { Cookie: cookie },
    body: JSON.stringify({ name: "変更してはいけない組織" })
  });
  assert.equal(result.response.status, 403);
  assert.match(result.body.error, /権限がありません/);
});

test("給与情報初期化は確認文字列が必須で監査ログに残る", async () => {
  const { cookie } = await login("U0001", "legacy123");

  const rejected = await request("/api/danger/payroll-reset", {
    method: "POST",
    headers: { Cookie: cookie },
    body: JSON.stringify({ employeeId: "100124", confirmation: "reset" })
  });
  assert.equal(rejected.response.status, 400);

  const accepted = await request("/api/danger/payroll-reset", {
    method: "POST",
    headers: { Cookie: cookie },
    body: JSON.stringify({ employeeId: "100124", confirmation: "RESET" })
  });
  assert.equal(accepted.response.status, 200);

  const employee = await request("/api/employees/100124", {
    headers: { Cookie: cookie }
  });
  assert.equal(employee.body.payroll.baseSalary, 0);
  assert.deepEqual(employee.body.allowances, {
    dependent: 0,
    housing: 0,
    commute: 0,
    overtime: 0,
    special: 0
  });

  const audit = await request("/api/audit", {
    headers: { Cookie: cookie }
  });
  const resetEntry = audit.body.audit.find(entry => entry.action === "給与情報初期化");
  assert.ok(resetEntry);
  assert.equal(resetEntry.risk, "destructive");
  assert.equal(resetEntry.target, "100124");
});

test("管理者はデモデータを初期状態へ戻せる", async () => {
  const { cookie } = await login("U0099", "supervisor");
  const reset = await request("/api/demo/reset", {
    method: "POST",
    headers: { Cookie: cookie },
    body: JSON.stringify({ confirmation: "RELOAD" })
  });
  assert.equal(reset.response.status, 200);

  const employee = await request("/api/employees/100124", {
    headers: { Cookie: cookie }
  });
  assert.equal(employee.body.payroll.baseSalary, 265400);
});
