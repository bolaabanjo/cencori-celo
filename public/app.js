const $ = (sel) => document.querySelector(sel);

const statusGrid = $("#status-grid");
const runList = $("#run-list");
const taskInput = $("#task-input");
const btnRun = $("#btn-run");
const outputWrap = $("#output-wrap");
const outputMeta = $("#output-meta");
const outputBody = $("#output-body");
const modelTag = $("#model-tag");
const tierTag = $("#tier-tag");
const runHint = $("#run-hint");
const btnConnect = $("#btn-connect");
const btnSubscribe = $("#btn-subscribe");
const proBadge = $("#pro-badge");
const footerSubscribe = $("#footer-subscribe");

let defaultTask = "";
let status = null;
let walletAddress = null;
let subscription = { subscribed: false, tier: "free" };

function sanitize(str) {
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/on\w+\s*=\s*[^\s>]+/gi, "")
    .trim();
}

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
  return `<span class="tag tag-${variant}">${sanitize(text)}</span>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderStatus(s) {
  status = s;
  const c = s.cencori;
  const pricing = s.pricing || {};
  const freeTier = pricing.free || {};
  const proTier = pricing.pro || {};

  modelTag.textContent = subscription.subscribed ? (proTier.model || "Pro") : (freeTier.model || "Standard");
  tierTag.textContent = subscription.subscribed ? "Pro" : "Free";
  tierTag.className = `tag tag-${subscription.subscribed ? "green" : "yellow"}`;

  statusGrid.innerHTML = `
    <div class="status-row">
      <span class="status-label">Cencori</span>
      <span class="status-value">${c.ready ? "Connected" : "Missing API key"}</span>
      ${c.ready ? tag("live", "green") : tag("offline", "red")}
    </div>
    <div class="status-row">
      <span class="status-label">Tier</span>
      <span class="status-value">${subscription.subscribed ? "Pro" : "Free"}</span>
      ${subscription.subscribed ? tag("active", "green") : tag("free", "yellow")}
    </div>
    <div class="status-row">
      <span class="status-label">Wallet</span>
      <span class="status-value">${walletAddress ? `${walletAddress.slice(0, 10)}…${walletAddress.slice(-6)}` : "Not connected"}</span>
      ${walletAddress ? tag("connected", "green") : tag("disconnected", "red")}
    </div>
  `;

  btnConnect.textContent = walletAddress ? "Disconnect" : "Connect Wallet";
  btnRun.disabled = !c.ready;

  const showSubscribe = walletAddress && !subscription.subscribed;
  btnSubscribe.classList.toggle("hidden", !showSubscribe);
  proBadge.classList.toggle("hidden", !subscription.subscribed);
}

async function loadStatus() {
  renderStatus(await api("/api/status"));
}

function showResult(result) {
  outputWrap.classList.remove("hidden");
  outputWrap.classList.add("reveal");

  const chips = [
    `<span class="meta-chip">${escapeHtml(result.externalRunId)}</span>`,
    `<span class="meta-chip">${tag(result.tier || "free", result.tier === "pro" ? "green" : "yellow")}</span>`,
    result.simulated ? tag("simulated", "yellow") : tag("live", "green"),
  ];

  outputMeta.innerHTML = chips.join("");

  const content = result.content || "";
  const blocks = parseStructuredContent(content);
  outputBody.innerHTML = renderBlocks(blocks);
}

function parseStructuredContent(text) {
  const blocks = [];
  const lines = text.split("\n");
  let currentList = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^## (.+)$/.test(trimmed)) {
      if (currentList) { blocks.push({ type: "list", items: currentList }); currentList = null; }
      blocks.push({ type: "heading", text: trimmed.replace(/^## /, "") });
    } else if (/^### (.+)$/.test(trimmed)) {
      if (currentList) { blocks.push({ type: "list", items: currentList }); currentList = null; }
      blocks.push({ type: "subheading", text: trimmed.replace(/^### /, "") });
    } else if (/^\d+\.\s/.test(trimmed)) {
      if (!currentList) currentList = [];
      currentList.push(trimmed.replace(/^\d+\.\s*/, ""));
    } else if (/^[-*]\s/.test(trimmed)) {
      if (!currentList) currentList = [];
      currentList.push(trimmed.replace(/^[-*]\s*/, ""));
    } else if (trimmed.startsWith("|")) {
      if (currentList) { blocks.push({ type: "list", items: currentList }); currentList = null; }
      const cells = trimmed.split("|").filter(Boolean).map((c) => c.trim());
      if (cells.length >= 2 && cells.every((c) => /^[-]+$/.test(c))) continue;
      blocks.push({ type: "table", cells });
    } else if (trimmed) {
      if (currentList) { blocks.push({ type: "list", items: currentList }); currentList = null; }
      blocks.push({ type: "text", text: trimmed });
    } else {
      if (currentList) { blocks.push({ type: "list", items: currentList }); currentList = null; }
    }
  }
  if (currentList) blocks.push({ type: "list", items: currentList });
  return blocks.length ? blocks : [{ type: "text", text }];
}

function renderBlocks(blocks) {
  return blocks.map((block) => {
    switch (block.type) {
      case "heading":
        return `<h2>${escapeHtml(block.text)}</h2>`;
      case "subheading":
        return `<h3>${escapeHtml(block.text)}</h3>`;
      case "text":
        return `<p>${escapeHtml(block.text)}</p>`;
      case "list":
        return `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
      case "table":
        return `<div class="table-card"><table><tr>${block.cells.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr></table></div>`;
      default:
        return "";
    }
  }).join("");
}

async function checkSubscription() {
  if (!walletAddress) {
    subscription = { subscribed: false, tier: "free" };
    return;
  }
  try {
    const result = await api(`/api/subscription/status?wallet=${encodeURIComponent(walletAddress)}`);
    subscription = result;
  } catch {
    subscription = { subscribed: false, tier: "free" };
  }
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
      <button type="button" class="run-item" data-id="${escapeHtml(r.id)}" style="animation-delay:${i * 60}ms">
        <div class="run-item-id">${escapeHtml(r.id)}</div>
        <div class="run-item-task">${escapeHtml(r.taskPreview || "Agent run")}</div>
      </button>
    </li>`
    )
    .join("");

  runList.querySelectorAll(".run-item").forEach((el) => {
    el.addEventListener("click", () => loadRunDetail(el.dataset.id));
  });
}

async function loadRunDetail(id) {
  runList.querySelectorAll(".run-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.id === id);
  });
  const { run } = await api(`/api/runs/${encodeURIComponent(id)}`);
  showResult({
    externalRunId: run.run?.external_run_id || id,
    content: run.run?.output_preview || "",
    tier: run.tier || "free",
    simulated: run.controls?.cencori_response_simulated,
  });
}

async function connectWallet() {
  if (walletAddress) {
    walletAddress = null;
    subscription = { subscribed: false, tier: "free" };
    await loadStatus();
    return;
  }
  if (typeof window.ethereum === "undefined") {
    runHint.textContent = "Install MetaMask to connect a wallet";
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    walletAddress = accounts[0];
    await checkSubscription();
    await loadStatus();
  } catch (err) {
    runHint.textContent = err.message;
  }
}

async function subscribePro() {
  if (!walletAddress) {
    runHint.textContent = "Connect a wallet first";
    return;
  }
  if (typeof window.ethereum === "undefined") {
    runHint.textContent = "MetaMask is required";
    return;
  }
  try {
    const { BrowserProvider, Contract, parseUnits } = await import("https://cdn.jsdelivr.net/npm/ethers@6/+esm");

    const statusData = status;
    const subConfig = statusData?.subscription || {};
    const contractAddress = subConfig.contractAddress;

    if (!contractAddress) {
      runHint.textContent = "Subscription not available";
      return;
    }

    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const tokenAddress = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1";
    const priceWei = parseUnits("5", 18);

    const tokenAbi = [
      "function approve(address spender, uint256 amount) returns (bool)",
    ];
    const token = new Contract(tokenAddress, tokenAbi, signer);
    const txApprove = await token.approve(contractAddress, priceWei);
    await txApprove.wait();

    const subAbi = [
      "function subscribe()",
    ];
    const contract = new Contract(contractAddress, subAbi, signer);
    const txSub = await contract.subscribe();
    await txSub.wait();

    await api("/api/subscribe", {
      method: "POST",
      body: JSON.stringify({ wallet: walletAddress }),
    });

    subscription = { subscribed: true, tier: "pro" };
    await loadStatus();
    runHint.textContent = "Subscribed to Pro!";
  } catch (err) {
    runHint.textContent = err.message;
  }
}

btnConnect.addEventListener("click", connectWallet);

btnSubscribe.addEventListener("click", subscribePro);
footerSubscribe.addEventListener("click", () => {
  if (walletAddress && !subscription.subscribed) subscribePro();
  else if (!walletAddress) connectWallet();
});

btnRun.addEventListener("click", async () => {
  btnRun.disabled = true;
  runHint.innerHTML = '<span class="spinner"></span> Running agent…';

  try {
    const raw = taskInput.value.trim() || defaultTask;
    const task = sanitize(raw);
    const body = { task };
    if (walletAddress) body.wallet = walletAddress;
    const result = await api("/api/run", { method: "POST", body: JSON.stringify(body) });
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
