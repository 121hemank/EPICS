let pipelineLeadsCache = [];

async function loadPipelineLeads() {
  const { data, error } = await supabaseClient
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading pipeline leads:", error);
    return [];
  }

  return data || [];
}

async function updatePipelineLead(leadId, payload) {
  const { error } = await supabaseClient
    .from("leads")
    .update(payload)
    .eq("id", leadId);

  if (error) throw error;
}

function getPipelinePriorityBadge(priority) {
  const value = (priority || "Medium").toLowerCase();
  return `<span class="priority-badge priority-${value}">${priority || "Medium"}</span>`;
}

function getPipelineStatusBadge(status) {
  const normalized = (status || "Open").toLowerCase().replace(/\s+/g, "-");
  return `<span class="lead-status-badge status-${normalized}">${status || "Open"}</span>`;
}

function getNextStage(stage) {
  const current = (stage || "").toLowerCase();

  if (current === "prospecting") return "Negotiation";
  if (current === "negotiation") return "Closing";
  if (current === "closing") return "Closing";

  return "Prospecting";
}

function getPreviousStage(stage) {
  const current = (stage || "").toLowerCase();

  if (current === "closing") return "Negotiation";
  if (current === "negotiation") return "Prospecting";
  if (current === "prospecting") return "Prospecting";

  return "Prospecting";
}

function openPipelineLeadModal(leadId) {
  const lead = pipelineLeadsCache.find(item => Number(item.id) === Number(leadId));
  if (!lead) return;

  const modal = document.getElementById("pipelineLeadModal");
  const content = document.getElementById("pipelineLeadModalContent");

  if (!modal || !content) return;

  content.innerHTML = `
    <strong>Vendor:</strong> ${lead.vendor_name}<br>
    <strong>Contact Person:</strong> ${lead.contact_person || "-"}<br>
    <strong>Email:</strong> ${lead.contact_email || "-"}<br>
    <strong>Phone:</strong> ${lead.contact_phone || "-"}<br>
    <strong>Stage:</strong> ${lead.stage || "-"}<br>
    <strong>Priority:</strong> ${lead.priority || "-"}<br>
    <strong>Status:</strong> ${lead.status || "-"}<br>
    <strong>Notes:</strong> ${lead.notes || "-"}<br>
    <strong>Created At:</strong> ${lead.created_at ? new Date(lead.created_at).toLocaleString() : "-"}
  `;

  modal.style.display = "flex";
}

function closePipelineLeadModal() {
  const modal = document.getElementById("pipelineLeadModal");
  if (modal) modal.style.display = "none";
}

function createPipelineCard(lead) {
  const stage = (lead.stage || "Prospecting").toLowerCase();
  const status = (lead.status || "Open").toLowerCase();

  const canMoveBack = stage !== "prospecting" && status !== "won" && status !== "lost";
  const canMoveNext = stage !== "closing" && status !== "won" && status !== "lost";
  const canMarkWon = status !== "won";
  const canMarkLost = status !== "lost";

  return `
    <div class="pipeline-card" onclick="openPipelineLeadModal(${lead.id})">
      <h4>${lead.vendor_name}</h4>
      <p><strong>Contact:</strong> ${lead.contact_person || "-"}</p>
      <p><strong>Email:</strong> ${lead.contact_email || "-"}</p>
      <p><strong>Phone:</strong> ${lead.contact_phone || "-"}</p>

      <div class="card-badges">
        ${getPipelinePriorityBadge(lead.priority)}
        ${getPipelineStatusBadge(lead.status)}
      </div>

      <div class="lead-actions" style="margin-top: 12px;" onclick="event.stopPropagation()">
        ${canMoveBack ? `<button class="action-btn edit-btn" onclick="moveLeadBackward(${lead.id}, '${lead.stage}')">Back</button>` : ""}
        ${canMoveNext ? `<button class="action-btn won-btn" onclick="moveLeadForward(${lead.id}, '${lead.stage}')">Next</button>` : ""}
        ${canMarkWon ? `<button class="action-btn won-btn" onclick="markLeadWon(${lead.id})">Won</button>` : ""}
        ${canMarkLost ? `<button class="action-btn lost-btn" onclick="markLeadLost(${lead.id})">Lost</button>` : ""}
      </div>
    </div>
  `;
}

function renderPipelineColumn(columnId, leads, countId) {
  const column = document.getElementById(columnId);
  const count = document.getElementById(countId);

  if (!column || !count) return;

  count.textContent = leads.length;

  if (!leads.length) {
    column.innerHTML = `<p class="pipeline-empty">No leads in this stage.</p>`;
    return;
  }

  column.innerHTML = leads.map(createPipelineCard).join("");
}

function renderPipelineSummary(leads) {
  const totalEl = document.getElementById("pipelineTotalCard");
  const wonEl = document.getElementById("pipelineWonCard");
  const highPriorityEl = document.getElementById("pipelineHighPriorityCard");

  if (!totalEl || !wonEl || !highPriorityEl) return;

  totalEl.textContent = leads.length;
  wonEl.textContent = leads.filter(l => (l.status || "").toLowerCase() === "won").length;
  highPriorityEl.textContent = leads.filter(l => (l.priority || "").toLowerCase() === "high").length;
}

function renderPipelineBoard(leads) {
  const prospecting = leads.filter(
    l => (l.stage || "").toLowerCase() === "prospecting" && (l.status || "").toLowerCase() !== "won" && (l.status || "").toLowerCase() !== "lost"
  );

  const negotiation = leads.filter(
    l => (l.stage || "").toLowerCase() === "negotiation" && (l.status || "").toLowerCase() !== "won" && (l.status || "").toLowerCase() !== "lost"
  );

  const closing = leads.filter(
    l => (l.stage || "").toLowerCase() === "closing" && (l.status || "").toLowerCase() !== "won" && (l.status || "").toLowerCase() !== "lost"
  );

  const won = leads.filter(
    l => (l.status || "").toLowerCase() === "won"
  );

  const lost = leads.filter(
    l => (l.status || "").toLowerCase() === "lost"
  );

  renderPipelineSummary(leads);
  renderPipelineColumn("prospectingColumn", prospecting, "prospectingCount");
  renderPipelineColumn("negotiationColumn", negotiation, "negotiationCount");
  renderPipelineColumn("closingColumn", closing, "closingCount");
  renderPipelineColumn("wonColumn", won, "wonCount");
  renderPipelineColumn("lostColumn", lost, "lostCount");
}

function applyPipelineFilters() {
  const searchInput = document.getElementById("pipelineSearch");
  const priorityFilter = document.getElementById("pipelinePriorityFilter");
  const statusFilter = document.getElementById("pipelineStatusFilter");

  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const priority = priorityFilter ? priorityFilter.value : "";
  const status = statusFilter ? statusFilter.value : "";

  const filtered = pipelineLeadsCache.filter(lead => {
    const matchesSearch =
      (lead.vendor_name || "").toLowerCase().includes(query) ||
      (lead.contact_person || "").toLowerCase().includes(query) ||
      (lead.contact_email || "").toLowerCase().includes(query);

    const matchesPriority = !priority || lead.priority === priority;
    const matchesStatus = !status || lead.status === status;

    return matchesSearch && matchesPriority && matchesStatus;
  });

  renderPipelineBoard(filtered);
}

async function moveLeadForward(leadId, currentStage) {
  try {
    const nextStage = getNextStage(currentStage);
    await updatePipelineLead(leadId, {
      stage: nextStage
    });

    await refreshPipelinePage();
    if (typeof refreshLeadsPage === "function") {
      await refreshLeadsPage();
    }
    if (typeof showToast === "function") {
      showToast(`Lead moved to ${nextStage}.`, "success");
    }
  } catch (error) {
    console.error(error);
    if (typeof showToast === "function") {
      showToast("Failed to move lead.", "error");
    }
  }
}

async function moveLeadBackward(leadId, currentStage) {
  try {
    const previousStage = getPreviousStage(currentStage);
    await updatePipelineLead(leadId, {
      stage: previousStage
    });

    await refreshPipelinePage();
    if (typeof refreshLeadsPage === "function") {
      await refreshLeadsPage();
    }
    if (typeof showToast === "function") {
      showToast(`Lead moved back to ${previousStage}.`, "success");
    }
  } catch (error) {
    console.error(error);
    if (typeof showToast === "function") {
      showToast("Failed to move lead.", "error");
    }
  }
}

async function markLeadWon(leadId) {
  try {
    await updatePipelineLead(leadId, {
      status: "Won",
      stage: "Closing"
    });

    await refreshPipelinePage();
    if (typeof refreshLeadsPage === "function") {
      await refreshLeadsPage();
    }
    if (typeof showToast === "function") {
      showToast("Lead marked as Won.", "success");
    }
  } catch (error) {
    console.error(error);
    if (typeof showToast === "function") {
      showToast("Failed to mark lead as Won.", "error");
    }
  }
}

async function markLeadLost(leadId) {
  try {
    await updatePipelineLead(leadId, {
      status: "Lost"
    });

    await refreshPipelinePage();
    if (typeof refreshLeadsPage === "function") {
      await refreshLeadsPage();
    }
    if (typeof showToast === "function") {
      showToast("Lead marked as Lost.", "success");
    }
  } catch (error) {
    console.error(error);
    if (typeof showToast === "function") {
      showToast("Failed to mark lead as Lost.", "error");
    }
  }
}

async function refreshPipelinePage() {
  const freshLeads = await loadPipelineLeads();
  pipelineLeadsCache = Array.isArray(freshLeads) ? freshLeads : [];
  renderPipelineBoard(pipelineLeadsCache);
}

document.addEventListener("DOMContentLoaded", async () => {
  await refreshPipelinePage();
});

window.refreshPipelinePage = refreshPipelinePage;
window.moveLeadForward = moveLeadForward;
window.moveLeadBackward = moveLeadBackward;
window.markLeadWon = markLeadWon;
window.markLeadLost = markLeadLost;
window.applyPipelineFilters = applyPipelineFilters;
window.openPipelineLeadModal = openPipelineLeadModal;
window.closePipelineLeadModal = closePipelineLeadModal;