let vendorScoreChartInstance = null;
let sentimentDistributionChartInstance = null;
let dashboardVendorLineChartInstance = null;
let dashboardLeadStageChartInstance = null;

let allCustomersCache = [];


async function loadVendorScores() {
  const { data, error } = await supabaseClient
    .from("vendor_scores")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error loading vendor scores:", error);
    return [];
  }

  return data || [];
}

async function loadApprovedVendors() {
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

async function loadDashboardLeads() {
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

async function loadReviewHistory() {
  const { data, error } = await supabaseClient
    .from("vendor_reviews")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error loading review history:", error);
    return [];
  }

  return data || [];
}

async function loadAllVendorReviews() {
  const { data, error } = await supabaseClient
    .from("vendor_reviews")
    .select("*");

  if (error) {
    console.error("Error loading all vendor reviews:", error);
    return [];
  }

  return data || [];
}

async function loadCustomers() {
  const { data, error } = await supabaseClient
    .from("customers")
    .select("*")
    .order("latest_review_date", { ascending: false });

  if (error) {
    console.error("Error loading customers:", error);
    return [];
  }

  return data || [];
}

async function loadVendorReviewsByName(vendorName) {
  const { data, error } = await supabaseClient
    .from("vendor_reviews")
    .select("*")
    .ilike("vendor_name", vendorName)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading vendor reviews:", error);
    return [];
  }

  return data || [];
}

async function loadVendorScoreByName(vendorName) {
  const { data, error } = await supabaseClient
    .from("vendor_scores")
    .select("*")
    .ilike("vendor_name", vendorName);

  if (error) {
    console.error("Error loading vendor score:", error);
    return null;
  }

  return data && data.length ? data[0] : null;
}

function formatDateTime(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString();
}

function renderVendorDashboardCards(vendorScores, approvedVendors = []) {
  const totalVendorsEl = document.getElementById("totalVendorsCard");
  const totalReviewsEl = document.getElementById("totalReviewsCard");
  const avgVendorScoreEl = document.getElementById("averageVendorScoreCard");
  const activeVendorsEl = document.getElementById("activeVendorsCard");

  if (!totalVendorsEl || !totalReviewsEl || !avgVendorScoreEl || !activeVendorsEl) return;

  const totalVendors = approvedVendors.length;
  const totalReviews = vendorScores.reduce((sum, v) => sum + Number(v.total_reviews || 0), 0);
  const avgVendorScore =
    vendorScores.length > 0
      ? vendorScores.reduce((sum, v) => sum + Number(v.vendor_score || 0), 0) / vendorScores.length
      : 0;

  const activeVendors = approvedVendors.filter(
    v => (v.onboarding_status || "").toLowerCase() === "active"
  ).length;

  totalVendorsEl.textContent = totalVendors;
  totalReviewsEl.textContent = totalReviews;
  avgVendorScoreEl.textContent = avgVendorScore.toFixed(2);
  activeVendorsEl.textContent = activeVendors;
}

function renderLeadDashboardCards(leads) {
  const totalLeadsEl = document.getElementById("totalLeadsDashboardCard");
  const wonLeadsEl = document.getElementById("wonLeadsDashboardCard");
  const lostLeadsEl = document.getElementById("lostLeadsDashboardCard");
  const highPriorityLeadsEl = document.getElementById("highPriorityLeadsDashboardCard");

  if (!totalLeadsEl || !wonLeadsEl || !lostLeadsEl || !highPriorityLeadsEl) return;

  totalLeadsEl.textContent = leads.length;
  wonLeadsEl.textContent = leads.filter(l => (l.status || "").toLowerCase() === "won").length;
  lostLeadsEl.textContent = leads.filter(l => (l.status || "").toLowerCase() === "lost").length;
  highPriorityLeadsEl.textContent = leads.filter(l => (l.priority || "").toLowerCase() === "high").length;
}

function renderVendorScoreTable(vendors) {
  const tableBody = document.getElementById("vendorScoreTableBody");
  if (!tableBody) return;

  if (!vendors.length) {
    tableBody.innerHTML = `<tr><td colspan="7">No vendor data available yet.</td></tr>`;
    return;
  }

  tableBody.innerHTML = vendors.map(vendor => `
    <tr>
      <td>${vendor.vendor_name}</td>
      <td>${vendor.total_reviews}</td>
      <td>${Number(vendor.avg_rating).toFixed(2)}</td>
      <td>${vendor.positive_reviews}</td>
      <td>${vendor.neutral_reviews}</td>
      <td>${vendor.negative_reviews}</td>
      <td>${Number(vendor.vendor_score).toFixed(2)}</td>
    </tr>
  `).join("");
}

function renderReviewHistory(reviews) {
  const tableBody = document.getElementById("reviewHistoryTableBody");
  if (!tableBody) return;

  if (!reviews.length) {
    tableBody.innerHTML = `<tr><td colspan="8">No review history available yet.</td></tr>`;
    return;
  }

  tableBody.innerHTML = reviews.map(review => `
    <tr>
      <td>${review.customer_name}</td>
      <td>${review.vendor_name}</td>
      <td>${review.rating}</td>
      <td>${review.bertweet_prediction || "-"}</td>
      <td>${review.roberta_prediction || "-"}</td>
      <td>${review.final_sentiment || "-"}</td>
      <td>${review.final_score ? Number(review.final_score).toFixed(2) : "-"}</td>
      <td>${formatDateTime(review.created_at)}</td>
    </tr>
  `).join("");
}

function renderVendorDetailsSummary(vendorScore, vendorName) {
  const summaryBox = document.getElementById("vendorDetailsSummary");
  if (!summaryBox) return;

  if (!vendorName) {
    summaryBox.textContent = "Select a vendor to view score summary and reviews.";
    return;
  }

  if (!vendorScore) {
    summaryBox.textContent = `No score summary found for vendor: ${vendorName}`;
    return;
  }

  summaryBox.innerHTML = `
    <strong>Vendor:</strong> ${vendorScore.vendor_name}<br>
    <strong>Total Reviews:</strong> ${vendorScore.total_reviews}<br>
    <strong>Average Rating:</strong> ${Number(vendorScore.avg_rating).toFixed(2)}<br>
    <strong>Positive:</strong> ${vendorScore.positive_reviews} |
    <strong>Neutral:</strong> ${vendorScore.neutral_reviews} |
    <strong>Negative:</strong> ${vendorScore.negative_reviews}<br>
    <strong>Vendor Score:</strong> ${Number(vendorScore.vendor_score).toFixed(2)}
  `;
}

function renderVendorDetailsReviews(reviews) {
  const tableBody = document.getElementById("vendorDetailsReviewTableBody");
  if (!tableBody) return;

  if (!reviews.length) {
    tableBody.innerHTML = `<tr><td colspan="8">No reviews found for this vendor.</td></tr>`;
    return;
  }

  tableBody.innerHTML = reviews.map(review => `
    <tr>
      <td>${review.customer_name}</td>
      <td>${review.rating}</td>
      <td>${review.customer_review}</td>
      <td>${review.bertweet_prediction || "-"}</td>
      <td>${review.roberta_prediction || "-"}</td>
      <td>${review.final_sentiment || "-"}</td>
      <td>${review.final_score ? Number(review.final_score).toFixed(2) : "-"}</td>
      <td>${formatDateTime(review.created_at)}</td>
    </tr>
  `).join("");
}

function renderVendorScoreChart(vendors) {
  const canvas = document.getElementById("vendorScoreChart");
  if (!canvas) return;

  if (vendorScoreChartInstance) {
    vendorScoreChartInstance.destroy();
    vendorScoreChartInstance = null;
  }

  const topVendors = [...vendors]
    .sort((a, b) => Number(b.vendor_score) - Number(a.vendor_score))
    .slice(0, 6);

  if (!topVendors.length) {
    return;
  }

  vendorScoreChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels: topVendors.map(v => v.vendor_name),
      datasets: [
        {
          label: "Vendor Score",
          data: topVendors.map(v => Number(v.vendor_score || 0)),
          borderWidth: 1,
          backgroundColor: [
            "#2563eb",
            "#22c55e",
            "#f59e0b",
            "#7c3aed",
            "#ef4444",
            "#06b6d4"
          ]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        y: {
          beginAtZero: true,
          min: 0,
          max: 5
        }
      }
    }
  });
}

function renderDashboardVendorLineChart(vendorScores) {
  const canvas = document.getElementById("lineChart");
  if (!canvas) return;

  if (dashboardVendorLineChartInstance) {
    dashboardVendorLineChartInstance.destroy();
    dashboardVendorLineChartInstance = null;
  }

  const topVendors = [...vendorScores]
    .sort((a, b) => Number(b.vendor_score) - Number(a.vendor_score))
    .slice(0, 6);

  if (!topVendors.length) {
    return;
  }

  dashboardVendorLineChartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels: topVendors.map(v => v.vendor_name),
      datasets: [
        {
          label: "Vendor Score",
          data: topVendors.map(v => Number(v.vendor_score || 0)),
          borderWidth: 3,
          tension: 0.35,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: true
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          min: 0,
          max: 5
        }
      }
    }
  });
}
function renderDashboardLeadStageChart(leads) {
  const canvas = document.getElementById("donutChart");
  if (!canvas) return;

  if (dashboardLeadStageChartInstance) {
    dashboardLeadStageChartInstance.destroy();
    dashboardLeadStageChartInstance = null;
  }

  const stageCounts = {
    prospecting: 0,
    negotiation: 0,
    closing: 0,
    won: 0,
    lost: 0
  };

  leads.forEach((lead) => {
    const stage = (lead.stage || "").toLowerCase();
    const status = (lead.status || "").toLowerCase();

    if (status === "won") {
      stageCounts.won += 1;
    } else if (status === "lost") {
      stageCounts.lost += 1;
    } else if (stage === "prospecting") {
      stageCounts.prospecting += 1;
    } else if (stage === "negotiation") {
      stageCounts.negotiation += 1;
    } else if (stage === "closing") {
      stageCounts.closing += 1;
    }
  });

  const values = [
    stageCounts.prospecting,
    stageCounts.negotiation,
    stageCounts.closing,
    stageCounts.won,
    stageCounts.lost
  ];

  if (values.every(v => v === 0)) {
    return;
  }

  dashboardLeadStageChartInstance = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Prospecting", "Negotiation", "Closing", "Won", "Lost"],
      datasets: [
        {
          data: values,
          backgroundColor: [
            "#2563eb",
            "#22c55e",
            "#f59e0b",
            "#10b981",
            "#ef4444"
          ],
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: true,
          position: "top"
        }
      }
    }
  });
}

function renderSentimentDistributionChart(reviews) {
  const canvas = document.getElementById("sentimentDistributionChart");
  if (!canvas) return;

  if (sentimentDistributionChartInstance) {
    sentimentDistributionChartInstance.destroy();
    sentimentDistributionChartInstance = null;
  }

  const positive = reviews.filter(r => r.final_sentiment === "Positive").length;
  const neutral = reviews.filter(r => r.final_sentiment === "Neutral").length;
  const negative = reviews.filter(r => r.final_sentiment === "Negative").length;

  if (positive === 0 && neutral === 0 && negative === 0) return;

  sentimentDistributionChartInstance = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Positive", "Neutral", "Negative"],
      datasets: [{
        data: [positive, neutral, negative],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false
    }
  });
}

function getCustomerStatus(latestReviewDate) {
  if (!latestReviewDate) return "Inactive";

  const latest = new Date(latestReviewDate);
  const now = new Date();
  const diffInDays = (now - latest) / (1000 * 60 * 60 * 24);

  return diffInDays <= 30 ? "Active" : "Inactive";
}

function renderCustomersTable(customers) {
  const tableBody = document.getElementById("customersTableBody");
  const totalCustomersStat = document.getElementById("totalCustomersStat");
  const activeCustomersStat = document.getElementById("activeCustomersStat");
  const inactiveCustomersStat = document.getElementById("inactiveCustomersStat");

  if (!tableBody) return;

  const customersWithStatus = customers.map(customer => ({
    ...customer,
    computedStatus: getCustomerStatus(customer.latest_review_date)
  }));

  if (totalCustomersStat) totalCustomersStat.textContent = customersWithStatus.length;
  if (activeCustomersStat) activeCustomersStat.textContent = customersWithStatus.filter(c => c.computedStatus === "Active").length;
  if (inactiveCustomersStat) inactiveCustomersStat.textContent = customersWithStatus.filter(c => c.computedStatus === "Inactive").length;

  if (!customersWithStatus.length) {
    tableBody.innerHTML = `<tr><td colspan="6">No customer data available yet.</td></tr>`;
    return;
  }

  tableBody.innerHTML = customersWithStatus.map(customer => `
    <tr>
      <td>${customer.customer_name}</td>
      <td>${customer.vendor_name || "-"}</td>
      <td>${customer.total_reviews}</td>
      <td>${Number(customer.avg_rating).toFixed(2)}</td>
      <td>
        <span class="status ${customer.computedStatus.toLowerCase() === "active" ? "active-status" : "inactive-status"}">
          ${customer.computedStatus}
        </span>
      </td>
      <td>${formatDateTime(customer.latest_review_date)}</td>
    </tr>
  `).join("");
}

function renderTopVendorsTable(vendors) {
  const tableBody = document.getElementById("topVendorsTableBody");
  if (!tableBody) return;

  if (!vendors.length) {
    tableBody.innerHTML = `<tr><td colspan="4">No vendor performance data available yet.</td></tr>`;
    return;
  }

  const sortedVendors = [...vendors]
    .sort((a, b) => Number(b.vendor_score) - Number(a.vendor_score))
    .slice(0, 5);

  tableBody.innerHTML = sortedVendors.map(vendor => `
    <tr>
      <td>${vendor.vendor_name}</td>
      <td>${Number(vendor.vendor_score).toFixed(2)}</td>
      <td>${vendor.total_reviews}</td>
      <td>${Number(vendor.avg_rating).toFixed(2)}</td>
    </tr>
  `).join("");
}

function searchCustomer() {
  const searchInput = document.getElementById("customerSearch");
  if (!searchInput) return;

  const query = searchInput.value.trim().toLowerCase();

  const filtered = allCustomersCache.filter(customer =>
    (customer.customer_name || "").toLowerCase().includes(query) ||
    (customer.vendor_name || "").toLowerCase().includes(query)
  );

  renderCustomersTable(filtered);
}

async function searchVendorDetails() {
  const input = document.getElementById("vendorSearchInput");
  if (!input) return;

  const vendorName = input.value.trim();
  if (!vendorName) {
    renderVendorDetailsSummary(null, "");
    renderVendorDetailsReviews([]);
    return;
  }

  const approvedVendors = typeof allVendorsCache !== "undefined" ? allVendorsCache : [];
  const isApproved = approvedVendors.some(
    v => (v.vendor_name || "").trim().toLowerCase() === vendorName.toLowerCase()
  );

  if (!isApproved) {
    renderVendorDetailsSummary(null, vendorName);
    renderVendorDetailsReviews([]);
    return;
  }

  const vendorScore = await loadVendorScoreByName(vendorName);
  const reviews = await loadVendorReviewsByName(vendorName);

  renderVendorDetailsSummary(vendorScore, vendorName);
  renderVendorDetailsReviews(reviews);
}

async function refreshVendorDashboard() {
  const vendorScores = await loadVendorScores();
  const approvedVendors = await loadApprovedVendors();

  const approvedVendorNames = approvedVendors.map(v => v.vendor_name);

  const filteredVendorScores = vendorScores.filter(v =>
    approvedVendorNames.includes(v.vendor_name)
  );

  renderVendorDashboardCards(filteredVendorScores, approvedVendors);
  renderVendorScoreTable(filteredVendorScores);
  renderDashboardVendorLineChart(filteredVendorScores);
}

async function refreshDashboardLeadCards() {
  const leads = await loadDashboardLeads();
  renderLeadDashboardCards(leads);
  renderDashboardLeadStageChart(leads);
}

async function refreshReviewHistory() {
  const reviews = await loadReviewHistory();
  renderReviewHistory(reviews);
}

async function refreshPerformanceCharts() {
  const allReviews = await loadAllVendorReviews();
  renderSentimentDistributionChart(allReviews);
}

async function refreshCustomersPage() {
  allCustomersCache = await loadCustomers();
  renderCustomersTable(allCustomersCache);
}

async function refreshPerformancePageData() {
  const vendorScores = await loadVendorScores();
  const approvedVendors = await loadApprovedVendors();
  const allReviews = await loadAllVendorReviews();

  const approvedVendorNames = approvedVendors.map(v => v.vendor_name);

  const filteredVendorScores = vendorScores.filter(v =>
    approvedVendorNames.includes(v.vendor_name)
  );

  renderVendorScoreChart(filteredVendorScores);
  renderTopVendorsTable(filteredVendorScores);
  renderSentimentDistributionChart(allReviews);
}

async function refreshAllCRMData() {
  await refreshCustomersPage();
  await refreshVendorDashboard();
  await refreshDashboardLeadCards();
  await refreshReviewHistory();
  await refreshPerformanceCharts();
}

let vendorSearchInitialized = false;

function initVendorSearch() {
  if (vendorSearchInitialized) return;

  const searchBtn = document.getElementById("vendorSearchBtn");
  const searchInput = document.getElementById("vendorSearchInput");

  if (searchBtn) {
    searchBtn.addEventListener("click", searchVendorDetails);
  }

  if (searchInput) {
    searchInput.addEventListener("change", searchVendorDetails);
  }

  vendorSearchInitialized = true;
}

function downloadCustomersCSV() {
  if (!allCustomersCache || !allCustomersCache.length) {
    alert("No customer data available to download.");
    return;
  }

  const rows = allCustomersCache.map(customer => {
    const status = getCustomerStatus(customer.latest_review_date);
    return {
      customer_name: customer.customer_name,
      vendor_name: customer.vendor_name || "",
      total_reviews: customer.total_reviews,
      avg_rating: Number(customer.avg_rating).toFixed(2),
      status,
      latest_review_date: formatDateTime(customer.latest_review_date)
    };
  });

  const headers = [
    "Customer Name",
    "Vendor Name",
    "Total Reviews",
    "Average Rating",
    "Status",
    "Latest Review Date"
  ];

  const csvContent = [
    headers.join(","),
    ...rows.map(row =>
      [
        `"${row.customer_name}"`,
        `"${row.vendor_name}"`,
        row.total_reviews,
        row.avg_rating,
        row.status,
        `"${row.latest_review_date}"`
      ].join(",")
    )
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "customers_report.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function initDashboardPage() {
  initVendorSearch();
}

window.searchCustomer = searchCustomer;
window.searchVendorDetails = searchVendorDetails;
window.refreshAllCRMData = refreshAllCRMData;
window.downloadCustomersCSV = downloadCustomersCSV;
window.initDashboardPage = initDashboardPage;