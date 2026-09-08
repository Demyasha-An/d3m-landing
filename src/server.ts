import path from "path";
import express from "express";
import dotenv from "dotenv";

dotenv.config();

interface PromoEgg {
  code: string;
  text: string;
}

interface RuntimeConfig {
  host: string;
  port: number;
  siteDomain: string;
  dashboardUrl: string;
  telegramBotUrl: string;
  minPrice: string;
  currency: string;
  xrayCheckerUrl: string | null;
  remnawaveApiUrl: string | null;
  remnawaveApiToken: string | null;
  promoWord: PromoEgg;
  promoLogo: PromoEgg;
}

interface XrayNode {
  name: string;
  status: boolean;
  latencyMs: number;
}

interface NodesStatus {
  allActive: boolean;
  totalNodes: number;
  activeNodes: number;
  fastestNode: { name: string; latencyMs: number } | null;
  source: "xray-checker" | "remnawave" | "none";
}

/**
 * Runtime configuration, fully driven by environment variables (.env).
 */
const config: RuntimeConfig = {
  host: process.env.HOST ?? "0.0.0.0",
  port: Number(process.env.PORT ?? 3000),
  siteDomain: process.env.SITE_DOMAIN ?? "d3mvpn.local",
  dashboardUrl: process.env.DASHBOARD_URL ?? "https://cabinet.d3mvpn.local",
  telegramBotUrl: process.env.TELEGRAM_BOT_URL ?? "https://t.me/d3mvpn_bot",
  minPrice: process.env.MIN_PRICE ?? "80",
  currency: process.env.CURRENCY ?? "₽",
  xrayCheckerUrl: process.env.XRAY_CHECKER_URL ?? null,
  remnawaveApiUrl: process.env.REMNAWAVE_API_URL ?? null,
  remnawaveApiToken: process.env.REMNAWAVE_API_TOKEN ?? null,
  promoWord: {
    code: process.env.PROMO_WORD_CODE ?? "",
    text: process.env.PROMO_WORD_TEXT ?? "",
  },
  promoLogo: {
    code: process.env.PROMO_LOGO_CODE ?? "",
    text: process.env.PROMO_LOGO_TEXT ?? "",
  },
};

const app = express();

app.get("/config.js", (_req, res) => {
  const publicConfig = {
    dashboardUrl: config.dashboardUrl,
    telegramBotUrl: config.telegramBotUrl,
    minPrice: config.minPrice,
    currency: config.currency,
    promoWord: config.promoWord,
    promoLogo: config.promoLogo,
  };
  res.type("application/javascript");
  res.send(`window.__D3MVPN_CONFIG__ = ${JSON.stringify(publicConfig)};`);
});

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

function parseXrayMetrics(metricsText: string): { nodes: XrayNode[] } {
  const nodes = new Map<string, XrayNode>();
  const statusRe = /xray_proxy_status\{.*?name="([^"]*)".*?\}\s+(\d+)/g;
  const latencyRe = /xray_proxy_latency_ms\{.*?name="([^"]*)".*?\}\s+(\d+)/g;

  for (const m of metricsText.matchAll(statusRe)) {
    const name = m[1];
    const status = m[2] === "1";
    const existing = nodes.get(name) ?? { name, status: false, latencyMs: 0 };
    existing.status = status;
    nodes.set(name, existing);
  }
  for (const m of metricsText.matchAll(latencyRe)) {
    const name = m[1];
    const latencyMs = parseInt(m[2], 10);
    const existing = nodes.get(name) ?? { name, status: false, latencyMs: 0 };
    existing.latencyMs = latencyMs;
    nodes.set(name, existing);
  }
  return { nodes: [...nodes.values()] };
}

async function fetchFromXrayChecker(): Promise<NodesStatus | null> {
  if (!config.xrayCheckerUrl) return null;
  try {
    const response = await fetch(`${config.xrayCheckerUrl}/metrics`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Xray Checker returned ${response.status}`);
    const text = await response.text();
    const { nodes } = parseXrayMetrics(text);
    if (nodes.length === 0) return null;

    const activeNodes = nodes.filter((n) => n.status);
    const allActive = activeNodes.length === nodes.length;

    let fastestNode: NodesStatus["fastestNode"] = null;
    if (activeNodes.length > 0) {
      const fastest = activeNodes.reduce((best, cur) => {
        if (cur.latencyMs > 0 && cur.latencyMs < (best.latencyMs || Infinity)) return cur;
        return best;
      });
      if (fastest.latencyMs > 0) {
        fastestNode = { name: fastest.name, latencyMs: fastest.latencyMs };
      }
    }
    return { allActive, totalNodes: nodes.length, activeNodes: activeNodes.length, fastestNode, source: "xray-checker" };
  } catch (error) {
    console.error("[d3mvpn] Xray Checker fetch failed:", error);
    return null;
  }
}

async function fetchFromRemnawave(): Promise<NodesStatus | null> {
  if (!config.remnawaveApiUrl || !config.remnawaveApiToken) return null;
  try {
    const nodesUrl = `${config.remnawaveApiUrl}/api/nodes`;
    const response = await fetch(nodesUrl, {
      headers: {
        Authorization: `Bearer ${config.remnawaveApiToken}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Remnawave API returned ${response.status}`);
    const payload = await response.json();
    const wrapped = payload as { response?: unknown };
    const nodes = Array.isArray(wrapped?.response) ? (wrapped.response as any[]) : [];
    const totalNodes = nodes.length;
    const activeNodes = nodes.filter((node) => node.isConnected === true && node.isDisabled !== true).length;
    const allActive = totalNodes > 0 && activeNodes === totalNodes;
    return { allActive, totalNodes, activeNodes, fastestNode: null, source: "remnawave" };
  } catch (error) {
    console.error("[d3mvpn] Remnawave fallback failed:", error);
    return null;
  }
}

app.get("/api/nodes-status", async (_req, res) => {
  const xrayStatus = await fetchFromXrayChecker();
  if (xrayStatus) return res.json(xrayStatus);

  const remnawaveStatus = await fetchFromRemnawave();
  if (remnawaveStatus) return res.json(remnawaveStatus);

  res.json({ allActive: false, totalNodes: 0, activeNodes: 0, fastestNode: null, source: "none" });
});

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(config.port, config.host, () => {
  console.log(`[d3mvpn] Landing running at http://${config.host}:${config.port}`);
  console.log(`[d3mvpn] Public domain: ${config.siteDomain}`);
});
