export async function runCencoriAgent({
  apiKey,
  baseUrl,
  agentId,
  model,
  task,
  externalRunId,
  systemPrompt = "You are a concise production agent. Respond with clear structure and practical detail.",
}) {
  if (!apiKey || apiKey === "csk_...") {
    return {
      simulated: true,
      requestId: `sim_${Date.now()}`,
      content:
        "Simulated Cencori response: Celo gives agents stablecoin payments, identity, reputation, and low-cost settlement. Cencori gives those agents routing, traces, approvals, budgets, and security.",
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        estimated_cost_usd: "0.00",
      },
    };
  }

  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  let response;
  try {
    response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(agentId ? { "X-Agent-ID": agentId } : {}),
      "X-Cencori-Trace-ID": externalRunId,
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: task,
        },
      ],
      metadata: {
        demo: "cencori-celo-agent-starter",
        external_run_id: externalRunId,
      },
    }),
    });
  } catch (err) {
    const hint =
      err.cause?.code === "ECONNREFUSED" || err.message?.includes("fetch failed")
        ? `Cannot reach Cencori at ${baseUrl} (connection refused). Check network/VPN/firewall or try again later.`
        : `Cencori request failed: ${err.message}`;
    throw new Error(hint);
  }

  const requestId =
    response.headers.get("x-request-id") ||
    response.headers.get("x-cencori-request-id") ||
    `req_${Date.now()}`;

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Cencori request failed (${response.status}): ${body.slice(0, 500)}`);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content || "";
  const usage = json?.usage || {};

  return {
    simulated: false,
    requestId,
    content,
    usage: {
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      total_tokens: usage.total_tokens || 0,
      estimated_cost_usd: String(json?.cost_usd || "0.00"),
    },
  };
}
