let allVendorsCache = [];

async function loadVendors() {
  const { data, error } = await supabaseClient
    .from("vendors")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading vendors:", error);
    return [];
  }

  return data || [];
}

async function updateVendor(vendorId, payload) {
  const { error } = await supabaseClient
    .from("vendors")
    .update(payload)
    .eq("id", vendorId);

  if (error) throw error;
}

async function deleteVendor(vendorId) {
  const { error } = await supabaseClient
    .from("vendors")
    .delete()
    .eq("id", vendorId);

  if (error) throw error;
}

function formatVendorDate(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString();
}

function getVendorStatusBadge(status) {
  const normalized = (status || "Active").toLowerCase();
  return `<span class="vendor-status-badge ${normalized === "active" ? "vendor-active" : "vendor-inactive"}">${status || "Active"}</span>`;
}

function renderVendorCards(vendors) {
  const totalEl = document.getElementById("vendorsTotalCard");
  const activeEl = document.getElementById("vendorsActiveCard");
  const inactiveEl = document.getElementById("vendorsInactiveCard");

  if (!totalEl || !activeEl || !inactiveEl) return;

  totalEl.textContent = vendors.length;
  activeEl.textContent = vendors.filter(v => (v.onboarding_status || "").toLowerCase() === "active").length;
  inactiveEl.textContent = vendors.filter(v => (v.onboarding_status || "").toLowerCase() === "inactive").length;
}

function renderVendorsTable(vendors) {
  const tableBody = document.getElementById("vendorsTableBody");
  if (!tableBody) return;

  renderVendorCards(vendors);

  if (!vendors.length) {
    tableBody.innerHTML = `<tr><td colspan="7">No approved vendors available yet.</td></tr>`;
    return;
  }

  tableBody.innerHTML = vendors.map(vendor => `
    <tr>
      <td>${vendor.vendor_name}</td>
      <td>${vendor.contact_person || "-"}</td>
      <td>${vendor.contact_email || "-"}</td>
      <td>${vendor.contact_phone || "-"}</td>
      <td>${getVendorStatusBadge(vendor.onboarding_status)}</td>
      <td>${formatVendorDate(vendor.created_at)}</td>
      <td>
        <div class="lead-actions">
          <button class="action-btn edit-btn" onclick="openVendorEditModal(${vendor.id})">Edit</button>
          <button class="action-btn won-btn" onclick="setVendorStatus(${vendor.id}, 'Active')">Activate</button>
          <button class="action-btn lost-btn" onclick="setVendorStatus(${vendor.id}, 'Inactive')">Deactivate</button>
          <button class="action-btn delete-btn" onclick="removeVendor(${vendor.id})">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function populateAnalyticsVendorDropdown(vendors) {
  const analyticsSelect = document.getElementById("vendorName");
  if (analyticsSelect) {
    const currentAnalyticsValue = analyticsSelect.value;

    analyticsSelect.innerHTML =
      `<option value="">Select approved vendor</option>` +
      vendors.map(vendor => `
        <option value="${vendor.vendor_name}">${vendor.vendor_name}</option>
      `).join("");

    if (currentAnalyticsValue && vendors.some(v => v.vendor_name === currentAnalyticsValue)) {
      analyticsSelect.value = currentAnalyticsValue;
    }
  }

  const dashboardSelect = document.getElementById("vendorSearchInput");
  if (dashboardSelect) {
    const currentDashboardValue = dashboardSelect.value;

    dashboardSelect.innerHTML =
      `<option value="">Select vendor to view details</option>` +
      vendors.map(vendor => `
        <option value="${vendor.vendor_name}">${vendor.vendor_name}</option>
      `).join("");

    if (currentDashboardValue && vendors.some(v => v.vendor_name === currentDashboardValue)) {
      dashboardSelect.value = currentDashboardValue;
    }
  }
}

async function refreshVendorsPage() {
  const freshVendors = await loadVendors();
  allVendorsCache = Array.isArray(freshVendors) ? freshVendors : [];
  renderVendorsTable(allVendorsCache);
  populateAnalyticsVendorDropdown(allVendorsCache);
}

function searchVendors() {
  const input = document.getElementById("vendorTableSearch");
  if (!input) return;

  const query = input.value.trim().toLowerCase();

  const filtered = allVendorsCache.filter(vendor =>
    (vendor.vendor_name || "").toLowerCase().includes(query) ||
    (vendor.contact_person || "").toLowerCase().includes(query) ||
    (vendor.contact_email || "").toLowerCase().includes(query)
  );

  renderVendorsTable(filtered);
}

function openVendorEditModal(vendorId) {
  const vendor = allVendorsCache.find(item => Number(item.id) === Number(vendorId));
  if (!vendor) return;

  document.getElementById("editVendorId").value = vendor.id;
  document.getElementById("editVendorName").value = vendor.vendor_name || "";
  document.getElementById("editVendorContactPerson").value = vendor.contact_person || "";
  document.getElementById("editVendorEmail").value = vendor.contact_email || "";
  document.getElementById("editVendorPhone").value = vendor.contact_phone || "";
  document.getElementById("editVendorStatus").value = vendor.onboarding_status || "Active";

  document.getElementById("vendorEditModal").style.display = "flex";
}

function closeVendorEditModal() {
  const modal = document.getElementById("vendorEditModal");
  if (modal) modal.style.display = "none";
}

async function setVendorStatus(vendorId, status) {
  try {
    await updateVendor(vendorId, { onboarding_status: status });
    await refreshVendorsPage();
    if (typeof showToast === "function") {
      showToast(`Vendor marked as ${status}.`, "success");
    }
  } catch (error) {
    console.error(error);
    if (typeof showToast === "function") {
      showToast("Failed to update vendor status.", "error");
    }
  }
}

async function removeVendor(vendorId) {
  const vendor = allVendorsCache.find(v => Number(v.id) === Number(vendorId));
  if (!vendor) return;

  const confirmed = window.confirm(
    `Delete this vendor?\n\nThis will also remove its reviews and scores.`
  );
  if (!confirmed) return;

  try {
    // delete vendor scores first
    const { error: scoreError } = await supabaseClient
      .from("vendor_scores")
      .delete()
      .eq("vendor_name", vendor.vendor_name);

    if (scoreError) throw scoreError;

    // delete vendor reviews
    const { error: reviewError } = await supabaseClient
      .from("vendor_reviews")
      .delete()
      .eq("vendor_name", vendor.vendor_name);

    if (reviewError) throw reviewError;

    // remove vendor link from customers
    const { error: customerError } = await supabaseClient
      .from("customers")
      .update({ vendor_name: null })
      .eq("vendor_name", vendor.vendor_name);

    if (customerError) throw customerError;

    // delete vendor itself
    await deleteVendor(vendorId);

    await refreshVendorsPage();

    if (typeof refreshAllCRMData === "function") {
      await refreshAllCRMData();
    }

    if (typeof showToast === "function") {
      showToast("Vendor and related analytics deleted successfully.", "success");
    }
  } catch (error) {
    console.error(error);
    if (typeof showToast === "function") {
      showToast("Failed to delete vendor.", "error");
    }
  }
}

function downloadVendorsCSV() {
  if (!allVendorsCache || !allVendorsCache.length) {
    alert("No vendor data available to download.");
    return;
  }

  const headers = [
    "Vendor Name",
    "Contact Person",
    "Email",
    "Phone",
    "Status",
    "Created At"
  ];

  const csvContent = [
    headers.join(","),
    ...allVendorsCache.map(vendor =>
      [
        `"${vendor.vendor_name || ""}"`,
        `"${vendor.contact_person || ""}"`,
        `"${vendor.contact_email || ""}"`,
        `"${vendor.contact_phone || ""}"`,
        `"${vendor.onboarding_status || ""}"`,
        `"${formatVendorDate(vendor.created_at)}"`
      ].join(",")
    )
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "vendors_report.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function initVendorEditForm() {
  const form = document.getElementById("editVendorForm");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const vendorId = document.getElementById("editVendorId").value;

    const payload = {
      vendor_name: document.getElementById("editVendorName").value.trim(),
      contact_person: document.getElementById("editVendorContactPerson").value.trim(),
      contact_email: document.getElementById("editVendorEmail").value.trim(),
      contact_phone: document.getElementById("editVendorPhone").value.trim(),
      onboarding_status: document.getElementById("editVendorStatus").value
    };

    try {
      await updateVendor(vendorId, payload);
      closeVendorEditModal();
      await refreshVendorsPage();
      if (typeof showToast === "function") {
        showToast("Vendor updated successfully.", "success");
      }
    } catch (error) {
      console.error(error);
      if (typeof showToast === "function") {
        showToast("Failed to update vendor.", "error");
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await refreshVendorsPage();
  initVendorEditForm();
});

window.searchVendors = searchVendors;
window.refreshVendorsPage = refreshVendorsPage;
window.openVendorEditModal = openVendorEditModal;
window.closeVendorEditModal = closeVendorEditModal;
window.setVendorStatus = setVendorStatus;
window.removeVendor = removeVendor;
window.downloadVendorsCSV = downloadVendorsCSV;