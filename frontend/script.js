function showSection(sectionId) {
  const sections = document.querySelectorAll(".section");
  const menuItems = document.querySelectorAll(".sidebar ul li");

  sections.forEach((section) => {
    section.classList.remove("active");
    section.style.display = "none";
  });

  menuItems.forEach((item) => item.classList.remove("active"));

  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.add("active");
    targetSection.style.display = "block";
  }

  const clickedMenuItem = Array.from(menuItems).find((item) => {
    const onclickValue = item.getAttribute("onclick");
    return onclickValue && onclickValue.includes(sectionId);
  });

  if (clickedMenuItem) {
    clickedMenuItem.classList.add("active");
  }

  requestAnimationFrame(() => {
    setTimeout(async () => {
      await refreshSectionData(sectionId);

      if (sectionId === "dashboard") {
        window.dispatchEvent(new Event("resize"));
      }

      if (sectionId === "performance") {
        window.dispatchEvent(new Event("resize"));
      }
    }, 80);
  });
}

async function refreshSectionData(sectionId) {
  try {
    if (sectionId === "dashboard") {
      if (typeof refreshAllCRMData === "function") {
        await refreshAllCRMData();
      }
    }

    if (sectionId === "customers") {
      if (typeof refreshCustomersPage === "function") {
        await refreshCustomersPage();
      }
    }

    if (sectionId === "analytics") {
      if (typeof refreshAllCRMData === "function") {
        await refreshAllCRMData();
      }
    }

    if (sectionId === "performance") {
      if (typeof refreshPerformancePageData === "function") {
        await refreshPerformancePageData();
      }
    }

    if (sectionId === "leads") {
      if (typeof refreshLeadsPage === "function") {
        await refreshLeadsPage();
      }
    }

    if (sectionId === "vendors") {
      if (typeof refreshVendorsPage === "function") {
        await refreshVendorsPage();
      }
    }

    if (sectionId === "pipeline") {
      if (typeof refreshPipelinePage === "function") {
        await refreshPipelinePage();
      }
    }

    if (sectionId === "settings") {
      if (typeof loadSettingsIntoForm === "function") {
        loadSettingsIntoForm();
      }
    }
  } catch (error) {
    console.error("Error refreshing section:", error);
  }
}

function toggleDark() {
  document.body.classList.toggle("dark");
}

function toggleSidebar() {
  const sidebar = document.querySelector(".sidebar");
  if (sidebar) {
    sidebar.classList.toggle("collapsed");
  }
}

function updateClock() {
  const clock = document.getElementById("liveClock");
  if (!clock) return;
  clock.innerText = new Date().toLocaleString();
}

async function handleLogout() {
  try {
    if (typeof logoutUser === "function") {
      await logoutUser();
    }
    window.location.href = "login.html";
  } catch (error) {
    console.error(error);
    alert("Logout failed");
  }
}

async function showLoggedInUser() {
  try {
    let displayName = "";
    let email = "";

    if (typeof getCurrentProfile === "function") {
      const profile = await getCurrentProfile();
      if (profile) {
        displayName = profile.full_name || "";
        email = profile.email || "";
      }
    }

    if (!displayName && typeof getCurrentUser === "function") {
      const user = await getCurrentUser();
      if (user) {
        email = user.email || "";
        displayName = user.email ? user.email.split("@")[0] : "User";
      }
    }

    const emailTarget = document.getElementById("loggedInUserEmail");
    if (emailTarget) {
      emailTarget.textContent = email;
    }

    const sidebarName = document.getElementById("sidebarUserName");
    if (sidebarName) {
      sidebarName.textContent = displayName || "User";
    }

    const avatarText = document.getElementById("profileAvatarText");
    if (avatarText) {
      const firstLetter = (displayName || "U").trim().charAt(0).toUpperCase();
      avatarText.textContent = firstLetter || "U";
    }
  } catch (error) {
    console.error(error);
  }
}

function handleGlobalSearch(event) {
  const query = event.target.value.trim().toLowerCase();

  if (event.key !== "Enter") return;
  if (!query) return;

  // vendors
  if (typeof allVendorsCache !== "undefined") {
    const matchedVendor = allVendorsCache.find(v =>
      (v.vendor_name || "").toLowerCase().includes(query)
    );

    if (matchedVendor) {
      showSection("vendors");
      const vendorSearch = document.getElementById("vendorTableSearch");
      if (vendorSearch) {
        vendorSearch.value = query;
        if (typeof searchVendors === "function") searchVendors();
      }
      return;
    }
  }

  // customers
  if (typeof allCustomersCache !== "undefined") {
    const matchedCustomer = allCustomersCache.find(c =>
      (c.customer_name || "").toLowerCase().includes(query) ||
      (c.vendor_name || "").toLowerCase().includes(query)
    );

    if (matchedCustomer) {
      showSection("customers");
      const customerSearch = document.getElementById("customerSearch");
      if (customerSearch) {
        customerSearch.value = query;
        if (typeof searchCustomer === "function") searchCustomer();
      }
      return;
    }
  }

  // leads
  if (typeof allLeadsCache !== "undefined") {
    const matchedLead = allLeadsCache.find(l =>
      (l.vendor_name || "").toLowerCase().includes(query) ||
      (l.contact_person || "").toLowerCase().includes(query)
    );

    if (matchedLead) {
      showSection("leads");
      const leadSearch = document.getElementById("leadSearch");
      if (leadSearch) {
        leadSearch.value = query;
        if (typeof searchLeads === "function") searchLeads();
      }
      return;
    }
  }

  alert("No matching vendor, customer, or lead found.");
}

let lineChartInstance = null;
let donutChartInstance = null;


document.addEventListener("DOMContentLoaded", async () => {
  if (typeof requireAuth === "function") {
    const user = await requireAuth();
    if (!user) return;
  }

  updateClock();
  setInterval(updateClock, 1000);

  const sections = document.querySelectorAll(".section");
  sections.forEach((section) => {
    section.classList.remove("active");
    section.style.display = "none";
  });

  const dashboardSection = document.getElementById("dashboard");
  if (dashboardSection) {
    dashboardSection.classList.add("active");
    dashboardSection.style.display = "block";
  }

  if (typeof initDashboardPage === "function") {
    initDashboardPage();
  }

  setTimeout(async () => {
    await refreshSectionData("dashboard");
    window.dispatchEvent(new Event("resize"));
    await showLoggedInUser();
  }, 100);
});

window.handleLogout = handleLogout;
window.handleGlobalSearch = handleGlobalSearch;