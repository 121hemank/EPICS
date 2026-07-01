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
  if (score == null || isNaN(score)) return 'Unknown';
  if (score >= 0.6) return 'Positive';
  if (score >= 0.4) return 'Neutral';
  return 'Negative';
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
