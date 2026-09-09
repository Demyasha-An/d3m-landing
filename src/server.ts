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
  remnawaveApiUrl: string | null;
  remnawaveApiToken: string | null;
  promoWord: PromoEgg;
  promoLogo: PromoEgg;
}

interface PublicNode {
  name: string;
  countryCode: string;
  status: boolean;
  usersOnline: number;
}

interface NodesStatus {
  allActive: boolean;
  totalNodes: number;
  activeNodes: number;
  recommendedNode: { host: string; usersOnline: number } | null;
  source: "remnawave" | "none";
  nodes: PublicNode[];
}

// In-memory cache so every page view doesn't hammer the panel.
const NODES_CACHE_TTL_MS = 30_000;
let nodesCache: { at: number; data: NodesStatus } | null = null;

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

/**
 * Fetch node status from the Remnawave panel.
 * GET {REMNAWAVE_API_URL}/api/nodes + /api/hosts with a panel API token
 * (server-side only, token needs `nodes:list` and `hosts:list` scopes).
 * Returns null if not configured or fetch fails.
 */
async function fetchFromRemnawave(): Promise<NodesStatus | null> {
  if (!config.remnawaveApiUrl || !config.remnawaveApiToken) return null;
  try {
    const base = config.remnawaveApiUrl.trim().replace(/\/+$/, "");
    const headers = {
      Authorization: `Bearer ${config.remnawaveApiToken}`,
      "Content-Type": "application/json",
    };
    const [nodesRes, hostsRes] = await Promise.all([
      fetch(`${base}/api/nodes`, { headers, signal: AbortSignal.timeout(8000) }),
      fetch(`${base}/api/hosts`, { headers, signal: AbortSignal.timeout(8000) }),
    ]);
    if (!nodesRes.ok) throw new Error(`Remnawave nodes returned ${nodesRes.status}`);
    if (!hostsRes.ok) throw new Error(`Remnawave hosts returned ${hostsRes.status}`);
    const nodesPayload = (await nodesRes.json()) as { response?: unknown };
    const hostsPayload = (await hostsRes.json()) as { response?: unknown };
    const rawNodes = Array.isArray(nodesPayload?.response)
      ? (nodesPayload.response as Record<string, unknown>[])
      : [];
    const rawHosts = Array.isArray(hostsPayload?.response)
      ? (hostsPayload.response as Record<string, unknown>[])
      : [];
    const parsed = rawNodes.map((node) => {
      const status = node["isConnected"] === true && node["isDisabled"] !== true;
      return {
        uuid: typeof node["uuid"] === "string" ? node["uuid"] : "",
        name: typeof node["name"] === "string" ? node["name"] : "Unknown",
        countryCode: typeof node["countryCode"] === "string" ? node["countryCode"] : "",
        status,
        usersOnline: typeof node["usersOnline"] === "number" ? node["usersOnline"] : 0,
      };
    });
    const hosts = rawHosts
      .map((host) => ({
        address: typeof host["address"] === "string" ? host["address"] : "",
        viewPosition: typeof host["viewPosition"] === "number" ? host["viewPosition"] : 0,
        hidden: host["isDisabled"] === true || host["isHidden"] === true,
        nodes: Array.isArray(host["nodes"])
          ? (host["nodes"] as unknown[]).filter((u): u is string => typeof u === "string")
          : [],
      }))
      .filter((host) => host.address !== "" && !host.hidden)
      .sort((a, b) => a.viewPosition - b.viewPosition);
    const nodes: PublicNode[] = parsed.map(({ name, countryCode, status, usersOnline }) => ({
      name,
      countryCode,
      status,
      usersOnline,
    }));
    const totalNodes = nodes.length;
    const activeNodes = parsed.filter((n) => n.status).length;
    const allActive = totalNodes > 0 && activeNodes === totalNodes;
    // Least-loaded active node (fewest users online) — no latency probing.
    const least = parsed
      .filter((n) => n.status)
      .sort((a, b) => a.usersOnline - b.usersOnline)[0] ?? null;
    // Free host = first visible host attached to that node; fallback: node name.
    const host =
      (least && hosts.find((h) => least.uuid !== "" && h.nodes.includes(least.uuid))?.address) ||
      least?.name ||
      null;
    const recommendedNode =
      host && least ? { host, usersOnline: least.usersOnline } : null;
    return { allActive, totalNodes, activeNodes, recommendedNode, source: "remnawave", nodes };
  } catch (error) {
    console.error("[d3mvpn] Remnawave fetch failed:", error);
    return null;
  }
}

const emptyStatus: NodesStatus = {
  allActive: false,
  totalNodes: 0,
  activeNodes: 0,
  recommendedNode: null,
  source: "none",
  nodes: [],
};

app.get("/api/nodes-status", async (_req, res) => {
  if (nodesCache && Date.now() - nodesCache.at < NODES_CACHE_TTL_MS) {
    return res.json(nodesCache.data);
  }
  const status = (await fetchFromRemnawave()) ?? emptyStatus;
  nodesCache = { at: Date.now(), data: status };
  res.json(status);
});

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(config.port, config.host, () => {
  console.log(`[d3mvpn] Landing running at http://${config.host}:${config.port}`);
  console.log(`[d3mvpn] Public domain: ${config.siteDomain}`);
});
