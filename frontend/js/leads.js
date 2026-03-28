let allLeadsCache = [];

function showLeadToast(message, type = "info") {
  if (typeof showToast === "function") {
    showToast(message, type);
  } else {
    alert(message);
  }
}

async function saveLead(payload) {
  const { error } = await supabaseClient
    .from("leads")
    .insert([payload]);

  if (error) throw error;
}

async function loadLeads() {
  const { data, error } = await supabaseClient
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading leads:", error);
    return [];
  }

  return data || [];
}

async function updateLead(leadId, payload) {
  const { error } = await supabaseClient
    .from("leads")
    .update(payload)
    .eq("id", leadId);

  if (error) throw error;
}

async function upsertVendorFromLead(lead) {
  const { data: existing, error: fetchError } = await supabaseClient
    .from("vendors")
    .select("*")
    .eq("vendor_name", lead.vendor_name)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (!existing) {
    const { error: insertError } = await supabaseClient
      .from("vendors")
      .insert([{
        vendor_name: lead.vendor_name,
        contact_person: lead.contact_person,
        contact_email: lead.contact_email,
        contact_phone: lead.contact_phone,
        onboarding_status: "Active",
        source_lead_id: lead.id
      }]);

    if (insertError) throw insertError;
  } else {
    const { error: updateError } = await supabaseClient
      .from("vendors")
      .update({
        contact_person: lead.contact_person,
        contact_email: lead.contact_email,
        contact_phone: lead.contact_phone,
        onboarding_status: "Active",
        source_lead_id: lead.id
      })
      .eq("vendor_name", lead.vendor_name);

    if (updateError) throw updateError;
  }
}

function formatLeadDate(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString();
}

function getPriorityBadge(priority) {
  const value = (priority || "Medium").toLowerCase();
  return `<span class="priority-badge priority-${value}">${priority || "Medium"}</span>`;
}

function getStageBadge(stage) {
  const value = (stage || "Prospecting").toLowerCase();
  return `<span class="stage-badge stage-${value}">${stage || "Prospecting"}</span>`;
}

function getStatusBadge(status) {
  const normalized = (status || "Open").toLowerCase().replace(/\s+/g, "-");
  return `<span class="lead-status-badge status-${normalized}">${status || "Open"}</span>`;
}

function renderLeadSummaryCards(leads) {
  const totalLeadsCard = document.getElementById("totalLeadsCard");
  const openLeadsCard = document.getElementById("openLeadsCard");
  const highPriorityLeadsCard = document.getElementById("highPriorityLeadsCard");

  if (!totalLeadsCard || !openLeadsCard || !highPriorityLeadsCard) return;

  totalLeadsCard.textContent = leads.length;
  openLeadsCard.textContent = leads.filter(l => (l.status || "").toLowerCase() === "open").length;
  highPriorityLeadsCard.textContent = leads.filter(l => (l.priority || "").toLowerCase() === "high").length;
}

async function deleteVendorByLead(lead) {
  if (!lead || !lead.vendor_name) return;

  const { error } = await supabaseClient
    .from("vendors")
    .delete()
    .eq("vendor_name", lead.vendor_name);

  if (error) throw error;
}

async function deleteLeadById(leadId) {
  const { error } = await supabaseClient
    .from("leads")
    .delete()
    .eq("id", leadId);

  if (error) throw error;
}

async function deleteVendorByLead(lead) {
  if (!lead || !lead.vendor_name) return;

  const { error } = await supabaseClient
    .from("vendors")
    .delete()
    .eq("vendor_name", lead.vendor_name);

  if (error) {
    console.error("Vendor delete error:", error);
    throw error;
  }
}

async function deleteLeadById(leadId) {
  const { error } = await supabaseClient
    .from("leads")
    .delete()
    .eq("id", leadId);

  if (error) {
    console.error("Lead delete error:", error);
    throw error;
  }
}

async function deleteLeadCompletely(leadId) {
  const lead = allLeadsCache.find(item => Number(item.id) === Number(leadId));
  if (!lead) return;

  const confirmed = window.confirm(
    `Delete this lead and its linked vendor from Supabase?\n\nVendor: ${lead.vendor_name}`
  );

  if (!confirmed) return;

  try {
    // delete vendor first
    await deleteVendorByLead(lead);

    // then delete lead
    await deleteLeadById(leadId);

    // reload frontend tables from Supabase
    await refreshLeadsPage();

    if (typeof refreshVendorsPage === "function") {
      await refreshVendorsPage();
    }

    if (typeof refreshAllCRMData === "function") {
      await refreshAllCRMData();
    }

    showLeadToast("Lead and vendor deleted successfully.", "success");
  } catch (error) {
    console.error(error);
    showLeadToast(`Delete failed: ${error.message}`, "error");
  }
}

function renderLeadsTable(leads) {
  const tableBody = document.getElementById("leadsTableBody");
  if (!tableBody) return;

  renderLeadSummaryCards(leads);

  if (!leads.length) {
    tableBody.innerHTML = `<tr><td colspan="9">No leads available yet.</td></tr>`;
    return;
  }

  tableBody.innerHTML = leads.map(lead => `
    <tr>
      <td>${lead.vendor_name}</td>
      <td>${lead.contact_person}</td>
      <td>${lead.contact_email || "-"}</td>
      <td>${lead.contact_phone || "-"}</td>
      <td>${getStageBadge(lead.stage)}</td>
      <td>${getPriorityBadge(lead.priority)}</td>
      <td>${getStatusBadge(lead.status)}</td>
      <td>${formatLeadDate(lead.created_at)}</td>
      <td>
  <div class="lead-actions">
    <button class="action-btn edit-btn" onclick="openLeadEditModal(${lead.id})">Edit</button>
    <button class="action-btn won-btn" onclick="convertLeadToVendor(${lead.id})">Convert</button>
    <button class="action-btn lost-btn" onclick="quickUpdateLeadStatus(${lead.id}, 'Lost')">Lost</button>
    <button class="action-btn delete-btn" onclick="archiveLead(${lead.id})">Archive</button>
    <button class="action-btn delete-btn" onclick="deleteLeadCompletely(${lead.id})">Delete</button>
  </div>
</td>
    </tr>
  `).join("");
}

async function refreshLeadsPage() {
  const freshLeads = await loadLeads();
  allLeadsCache = Array.isArray(freshLeads) ? freshLeads : [];
  renderLeadsTable(allLeadsCache);
}

function applyLeadFilters() {
  const searchInput = document.getElementById("leadSearch");
  const stageFilter = document.getElementById("leadStageFilter");
  const priorityFilter = document.getElementById("leadPriorityFilter");
  const statusFilter = document.getElementById("leadStatusFilter");

  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const stage = stageFilter ? stageFilter.value : "";
  const priority = priorityFilter ? priorityFilter.value : "";
  const status = statusFilter ? statusFilter.value : "";

  const filtered = allLeadsCache.filter(lead => {
    const matchesSearch =
      (lead.vendor_name || "").toLowerCase().includes(query) ||
      (lead.contact_person || "").toLowerCase().includes(query) ||
      (lead.contact_email || "").toLowerCase().includes(query);

    const matchesStage = !stage || lead.stage === stage;
    const matchesPriority = !priority || lead.priority === priority;
    const matchesStatus = !status || lead.status === status;

    return matchesSearch && matchesStage && matchesPriority && matchesStatus;
  });

  renderLeadsTable(filtered);
}

function searchLeads() {
  applyLeadFilters();
}

function openLeadEditModal(leadId) {
  const lead = allLeadsCache.find(item => Number(item.id) === Number(leadId));
  if (!lead) return;

  document.getElementById("editLeadId").value = lead.id;
  document.getElementById("editLeadVendorName").value = lead.vendor_name || "";
  document.getElementById("editLeadContactPerson").value = lead.contact_person || "";
  document.getElementById("editLeadContactEmail").value = lead.contact_email || "";
  document.getElementById("editLeadContactPhone").value = lead.contact_phone || "";
  document.getElementById("editLeadStage").value = lead.stage || "Prospecting";
  document.getElementById("editLeadPriority").value = lead.priority || "Medium";
  document.getElementById("editLeadStatus").value = lead.status || "Open";
  document.getElementById("editLeadNotes").value = lead.notes || "";

  document.getElementById("leadEditModal").style.display = "flex";
}

function closeLeadEditModal() {
  const modal = document.getElementById("leadEditModal");
  if (modal) modal.style.display = "none";
}

async function quickUpdateLeadStatus(leadId, status) {
  try {
    await updateLead(leadId, { status });
    await refreshLeadsPage();
    showLeadToast(`Lead marked as ${status}.`, "success");
  } catch (error) {
    console.error(error);
    showLeadToast("Failed to update lead status.", "error");
  }
}

async function convertLeadToVendor(leadId) {
  const lead = allLeadsCache.find(item => Number(item.id) === Number(leadId));
  if (!lead) return;

  try {
    await upsertVendorFromLead(lead);
    await updateLead(leadId, { status: "Won", stage: "Closing" });
    await refreshLeadsPage();
    showLeadToast("Lead converted to active vendor.", "success");
  } catch (error) {
    console.error(error);
    showLeadToast("Failed to convert lead.", "error");
  }
}

async function archiveLead(leadId) {
  const confirmArchive = window.confirm("Archive this lead?");
  if (!confirmArchive) return;

  try {
    await updateLead(leadId, { status: "On Hold" });
    await refreshLeadsPage();
    showLeadToast("Lead archived successfully.", "success");
  } catch (error) {
    console.error(error);
    showLeadToast("Failed to archive lead.", "error");
  }
}

function downloadLeadsCSV() {
  if (!allLeadsCache || !allLeadsCache.length) {
    alert("No lead data available to download.");
    return;
  }

  const headers = [
    "Vendor Name",
    "Contact Person",
    "Contact Email",
    "Contact Phone",
    "Stage",
    "Priority",
    "Status",
    "Created At"
  ];

  const csvContent = [
    headers.join(","),
    ...allLeadsCache.map(lead =>
      [
        `"${lead.vendor_name || ""}"`,
        `"${lead.contact_person || ""}"`,
        `"${lead.contact_email || ""}"`,
        `"${lead.contact_phone || ""}"`,
        `"${lead.stage || ""}"`,
        `"${lead.priority || ""}"`,
        `"${lead.status || ""}"`,
        `"${formatLeadDate(lead.created_at)}"`
      ].join(",")
    )
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "vendor_leads_report.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function initLeadForm() {
  const form = document.getElementById("leadForm");
  if (!form) return;

  const statusBox = document.getElementById("leadStatusBox");
  const submitBtn = document.getElementById("leadSubmitBtn");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const payload = {
      vendor_name: document.getElementById("leadVendorName").value.trim(),
      contact_person: document.getElementById("leadContactPerson").value.trim(),
      contact_email: document.getElementById("leadContactEmail").value.trim(),
      contact_phone: document.getElementById("leadContactPhone").value.trim(),
      stage: document.getElementById("leadStage").value,
      priority: document.getElementById("leadPriority").value,
      status: document.getElementById("leadStatus").value,
      notes: document.getElementById("leadNotes").value.trim()
    };

    if (!payload.vendor_name || !payload.contact_person) {
      statusBox.textContent = "Vendor name and contact person are required.";
      showLeadToast("Please fill required lead fields.", "error");
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving...";
      statusBox.textContent = "Saving vendor lead...";

      await saveLead(payload);
      await refreshLeadsPage();

      form.reset();
      document.getElementById("leadStage").value = "Prospecting";
      document.getElementById("leadPriority").value = "Medium";
      document.getElementById("leadStatus").value = "Open";

      statusBox.textContent = "Lead saved successfully.";
      showLeadToast("Lead added successfully.", "success");
    } catch (error) {
      console.error(error);
      statusBox.textContent = `Error: ${error.message}`;
      showLeadToast("Failed to save lead.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Save Lead";
    }
  });
}

function initEditLeadForm() {
  const form = document.getElementById("editLeadForm");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const leadId = document.getElementById("editLeadId").value;

    const payload = {
      vendor_name: document.getElementById("editLeadVendorName").value.trim(),
      contact_person: document.getElementById("editLeadContactPerson").value.trim(),
      contact_email: document.getElementById("editLeadContactEmail").value.trim(),
      contact_phone: document.getElementById("editLeadContactPhone").value.trim(),
      stage: document.getElementById("editLeadStage").value,
      priority: document.getElementById("editLeadPriority").value,
      status: document.getElementById("editLeadStatus").value,
      notes: document.getElementById("editLeadNotes").value.trim()
    };

    try {
      await updateLead(leadId, payload);
      closeLeadEditModal();
      await refreshLeadsPage();
      showLeadToast("Lead updated successfully.", "success");
    } catch (error) {
      console.error(error);
      showLeadToast("Failed to update lead.", "error");
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await refreshLeadsPage();
  initLeadForm();
  initEditLeadForm();
});

window.searchLeads = searchLeads;
window.applyLeadFilters = applyLeadFilters;
window.refreshLeadsPage = refreshLeadsPage;
window.openLeadEditModal = openLeadEditModal;
window.closeLeadEditModal = closeLeadEditModal;
window.quickUpdateLeadStatus = quickUpdateLeadStatus;
window.convertLeadToVendor = convertLeadToVendor;
window.archiveLead = archiveLead;
window.downloadLeadsCSV = downloadLeadsCSV;
window.deleteLeadCompletely = deleteLeadCompletely;