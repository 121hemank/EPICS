export function formatDateTime(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString();
}

export function getCustomerStatus(latestReviewDate) {
  if (!latestReviewDate) return "Inactive";
  const diff = (new Date() - new Date(latestReviewDate)) / (1000 * 60 * 60 * 24);
  return diff <= 30 ? "Active" : "Inactive";
}

export function sentimentToScore(sentiment) {
  if (!sentiment) return 3;
  const s = sentiment.toLowerCase();
  if (s === "negative") return 1;
  if (s === "neutral") return 3;
  if (s === "positive") return 5;
  return 3;
}

export function scoreToSentiment(score) {
  if (score <= 2) return "Negative";
  if (score <= 4) return "Neutral";
  return "Positive";
}

export function getPriorityBadge(priority) {
  const value = (priority || "Medium").toLowerCase();
  return { text: priority || "Medium", className: `priority-badge priority-${value}` };
}

export function getStageBadgeClass(stage) {
  const value = (stage || "Prospecting").toLowerCase();
  return `stage-badge stage-${value}`;
}

export function getStatusBadgeClass(status) {
  const normalized = (status || "Open").toLowerCase().replace(/\s+/g, "-");
  return `lead-status-badge status-${normalized}`;
}

export function getVendorStatusBadgeClass(status) {
  const normalized = (status || "Active").toLowerCase();
  return `vendor-status-badge ${normalized === "active" ? "vendor-active" : "vendor-inactive"}`;
}

export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  const clean = rows.filter(r => r.some(c => c.trim() !== ""));
  if (!clean.length) return [];

  const headers = clean[0].map(h => h.trim().toLowerCase());
  return clean.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (r[i] || "").trim(); });
    return obj;
  });
}

export const ASPECTS = [
  { key: "delivery", label: "Timeliness", keywords: ["deliver", "shipping", "ship", "on time", "late", "arrived", "delivery", "dispatch", "schedule"] },
  { key: "pricing", label: "Pricing", keywords: ["price", "pricing", "cost", "expensive", "cheap", "value", "affordable", "fee"] },
  { key: "accuracy", label: "Item Accuracy", keywords: ["accurate", "incorrect", "wrong item", "as described", "matched", "mismatch", "description", "exactly what"] },
  { key: "support", label: "Customer Support", keywords: ["support", "service", "responsive", "response", "helpful", "courteous", "assist"] },
  { key: "quality", label: "Product Quality", keywords: ["quality", "durable", "well made", "broken", "defective", "flawless", "poor quality", "craftsmanship", "material"] },
  { key: "communication", label: "Communication", keywords: ["communication", "update", "informed", "replied", "follow up", "follow-up", "message", "proactive"] }
];

export function analyzeAspects(reviews) {
  return ASPECTS.map(a => {
    const matched = (reviews || []).filter(r =>
      a.keywords.some(k => (r.customer_review || "").toLowerCase().includes(k))
    );
    const avg = matched.length
      ? matched.reduce((s, r) => s + Number(r.rating || 0), 0) / matched.length
      : 0;
    return {
      key: a.key,
      label: a.label,
      score: Number(avg.toFixed(2)),
      count: matched.length,
      pct: avg ? Math.round((avg / 5) * 100) : 0
    };
  });
}

export function extractTopics(text) {
  const lower = (text || "").toLowerCase();
  return ASPECTS.filter(a => a.keywords.some(k => lower.includes(k))).map(a => a.label);
}

export function suggestAction(sentiment, score) {
  if (sentiment === "Positive") {
    return "Recognize and reinforce this strength; consider requesting a testimonial or case study.";
  }
  if (sentiment === "Negative") {
    return "Follow up with the customer directly to resolve the concern and prevent churn.";
  }
  if (score >= 3) {
    return "Monitor closely; address any mixed feedback before it escalates.";
  }
  return "Review feedback details and outline a concrete improvement plan.";
}

// ---- RBAC Permissions ----
export const ROLE_LABELS = {
  admin: "Admin",
  manager: "Manager",
  analyst: "Analyst",
  viewer: "Vendor Viewer",
  employee: "Employee"
};

export const ROLE_CLASSES = {
  admin: "status-won",
  manager: "status-contacted",
  analyst: "status-follow-up",
  viewer: "status-open",
  employee: "status-on-hold"
};

const PERMISSION_DEFS = [
  { key: "settings.app", label: "App settings (backend URL, display name)" },
  { key: "settings.weights", label: "Scoring weights" },
  { key: "settings.rules", label: "Scoring preset rules & thresholds" },
  { key: "settings.integrations", label: "API keys & integrations" },
  { key: "members.manage", label: "Invite / remove team members" },
  { key: "leads.manage", label: "Manage leads" },
  { key: "vendors.manage", label: "Manage vendors" },
  { key: "reviews.analyze", label: "Run AI review analysis" },
  { key: "audit.view", label: "View audit trail" },
  { key: "data.export", label: "Export data (CSV)" }
];

const PERMISSIONS = {
  admin: PERMISSION_DEFS.map(p => p.key),
  manager: ["settings.weights", "settings.rules", "leads.manage", "vendors.manage", "reviews.analyze", "audit.view", "data.export"],
  analyst: ["reviews.analyze", "audit.view", "data.export"],
  employee: ["reviews.analyze", "audit.view", "data.export"],
  viewer: ["audit.view", "data.export"]
};

export function can(role, permission) {
  const perms = PERMISSIONS[role] || PERMISSIONS.viewer;
  return perms.includes(permission);
}

export function getPermissionDefs() {
  return PERMISSION_DEFS.map(p => ({
    ...p,
    roles: Object.keys(PERMISSIONS).filter(r => PERMISSIONS[r].includes(p.key))
  }));
}
