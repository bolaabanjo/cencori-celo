const $ = (sel) => document.querySelector(sel);

const statusGrid = $("#status-grid");
const runList = $("#run-list");
const taskInput = $("#task-input");
const btnRun = $("#btn-run");
const btnDeploy = $("#btn-deploy");
const outputWrap = $("#output-wrap");
const outputMeta = $("#output-meta");
const outputBody = $("#output-body");
const modelTag = $("#model-tag");
const runHint = $("#run-hint");
const faucetLink = $("#faucet-link");

let defaultTask = "";
let status = null;

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function tag(text, variant = "blue") {
  return `<span class="tag tag-${variant}">${text}</span>`;
}

function renderStatus(s) {
  status = s;
  const c = s.cencori;
  const celo = s.celo;
  const w = celo.wallet;

  modelTag.textContent = c.model;
  faucetLink.href = celo.faucetUrl;

  const walletLine = w?.error
    ? "RPC unreachable"
    : w
      ? `${w.address.slice(0, 10)}…${w.address.slice(-6)}`
      : "Not configured";

  const balanceLine = w?.error
    ? w.error
    : w
      ? w.funded
        ? `${(Number(w.balanceWei) / 1e18).toFixed(4)} CELO`
        : "0 CELO — fund wallet"
      : "—";

  const contractLine = celo.contract
    ? `${celo.contract.slice(0, 10)}…${celo.contract.slice(-4)}`
    : "Not deployed";

  statusGrid.innerHTML = `
    <div class="status-row">
      <span class="status-label">Cencori</span>
      <span class="status-value">${c.ready ? "Connected" : "Missing API key"}</span>
      ${c.ready ? tag("live", "green") : tag("offline", "red")}
    </div>
    <div class="status-row">
      <span class="status-label">Model</span>
      <span class="status-value">${c.model}</span>
    </div>
    <div class="status-row">
      <span class="status-label">Wallet</span>
      <span class="status-value" title="${w?.address || ""}">${walletLine}</span>
      ${w?.error ? tag("RPC error", "red") : w?.funded ? tag("funded", "green") : tag("needs CELO", "yellow")}
    </div>
    <div class="status-row">
      <span class="status-label">Balance</span>
      <span class="status-value">${balanceLine}</span>
    </div>
    <div class="status-row">
      <span class="status-label">Receipt contract</span>
      <span class="status-value" title="${celo.contract || ""}">${contractLine}</span>
      ${celo.contract ? tag("deployed", "green") : tag("pending", "yellow")}
    </div>
    <div class="status-row">
      <span class="status-label">Receipt budget</span>
      <span class="status-value">${s.payment.maxSpendUsd} USD cap · ${s.payment.amount} ${s.payment.token} metadata</span>
    </div>
  `;

  btnDeploy.disabled = Boolean(w?.error) || !w?.funded || Boolean(celo.contract);
  btnRun.disabled = !c.ready;
}

async function loadStatus() {
  renderStatus(await api("/api/status"));
}

async function loadRuns() {
  const { runs } = await api("/api/runs");
  if (!runs.length) {
    runList.innerHTML = `<li class="muted">No runs yet</li>`;
    return;
  }

  runList.innerHTML = runs
    .map(
      (r, i) => `
    <li>
      <button type="button" class="run-item" data-id="${r.id}" style="animation-delay:${i * 60}ms">
        <div class="run-item-id">${r.id}</div>
        <div class="run-item-task">${escapeHtml(r.taskPreview || "Agent run")}</div>
      </button>
    </li>`
    )
    .join("");

  runList.querySelectorAll(".run-item").forEach((el) => {
    el.addEventListener("click", () => loadRunDetail(el.dataset.id));
  });
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatOutput(text) {
  return escapeHtml(text)
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^\d+\. \*\*(.+?)\*\*:? (.+)$/gm, "<p><strong>$1</strong> $2</p>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function showResult(result) {
  outputWrap.classList.remove("hidden");
  outputWrap.classList.add("reveal");

  const chips = [
    `<span class="meta-chip">${result.externalRunId}</span>`,
    `<span class="meta-chip" title="${result.receiptHash}">hash ${result.receiptHash.slice(0, 14)}…</span>`,
    result.onchain.recorded
      ? tag("onchain", "green")
      : tag("local only", "yellow"),
  ];

  if (result.onchain.explorerUrl) {
    chips.push(
      `<span class="meta-chip"><a href="${result.onchain.explorerUrl}" target="_blank" rel="noopener">View tx</a></span>`
    );
  }

  if (result.simulated) chips.push(tag("simulated", "yellow"));

  outputMeta.innerHTML = chips.join("");
  outputBody.innerHTML = formatOutput(result.content);
}

async function loadRunDetail(id) {
  runList.querySelectorAll(".run-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.id === id);
  });

  const { run } = await api(`/api/runs/${id}`);
  showResult({
    externalRunId: run.run?.external_run_id || id,
    receiptHash: run.receipt_hash,
    content: run.run?.output_preview || "",
    onchain: {
      recorded: run.onchain_recorded === true,
      explorerUrl: run.onchain_tx_hash
        ? `${status?.celo?.explorer || "https://celo-sepolia.blockscout.com"}/tx/${run.onchain_tx_hash}`
        : null,
    },
    simulated: run.controls?.cencori_response_simulated,
  });
}

btnRun.addEventListener("click", async () => {
  btnRun.disabled = true;
  runHint.innerHTML = '<span class="spinner"></span> Running agent…';

  try {
    const task = taskInput.value.trim() || defaultTask;
    const result = await api("/api/run", {
      method: "POST",
      body: JSON.stringify({ task }),
    });
    showResult(result);
    runHint.textContent = "Done";
    await loadRuns();
    await loadStatus();
  } catch (err) {
    runHint.textContent = err.message;
  } finally {
    btnRun.disabled = !status?.cencori?.ready;
  }
});

btnDeploy.addEventListener("click", async () => {
  btnDeploy.disabled = true;
  btnDeploy.textContent = "Deploying…";
  try {
    await api("/api/deploy", { method: "POST" });
    await loadStatus();
  } catch (err) {
    alert(err.message);
  } finally {
    btnDeploy.textContent = "Deploy receipt contract";
    await loadStatus();
  }
});

async function loadDefaultTask() {
  const config = await api("/api/config");
  defaultTask = config.task || "";
  if (!taskInput.value && defaultTask) taskInput.value = defaultTask;
}

async function init() {
  await loadDefaultTask();
  await loadStatus();
  await loadRuns();

  const first = runList.querySelector(".run-item");
  if (first) loadRunDetail(first.dataset.id);
}

init();
