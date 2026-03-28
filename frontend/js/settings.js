const DEFAULT_SETTINGS = {
  backendUrl: "http://127.0.0.1:8000",
  theme: "light",
  sentimentWeight: 50,
  ratingWeight: 50
};

function getStoredSettings() {
  const raw = localStorage.getItem("epics_crm_settings");
  if (!raw) return { ...DEFAULT_SETTINGS };

  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (error) {
    console.error("Error reading settings:", error);
    return { ...DEFAULT_SETTINGS };
  }
}

function saveStoredSettings(settings) {
  localStorage.setItem("epics_crm_settings", JSON.stringify(settings));
}

function applyTheme(theme) {
  if (theme === "dark") {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }
}

function renderSettingsSummary(settings) {
  const box = document.getElementById("settingsSummaryBox");
  if (!box) return;

  box.innerHTML = `
    <strong>Backend URL:</strong> ${settings.backendUrl}<br>
    <strong>Theme:</strong> ${settings.theme}<br>
    <strong>AI Sentiment Weight:</strong> ${settings.sentimentWeight}%<br>
    <strong>Customer Rating Weight:</strong> ${settings.ratingWeight}%
  `;
}

function loadSettingsIntoForm() {
  const settings = getStoredSettings();

  const backendUrlInput = document.getElementById("backendUrlSetting");
  const darkModeInput = document.getElementById("darkModeSetting");
  const sentimentWeightInput = document.getElementById("sentimentWeightSetting");
  const ratingWeightInput = document.getElementById("ratingWeightSetting");

  if (backendUrlInput) backendUrlInput.value = settings.backendUrl;
  if (darkModeInput) darkModeInput.value = settings.theme;
  if (sentimentWeightInput) sentimentWeightInput.value = settings.sentimentWeight;
  if (ratingWeightInput) ratingWeightInput.value = settings.ratingWeight;

  applyTheme(settings.theme);
  renderSettingsSummary(settings);
}

function initAppSettingsForm() {
  const form = document.getElementById("appSettingsForm");
  if (!form) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const settings = getStoredSettings();

    settings.backendUrl = document.getElementById("backendUrlSetting").value.trim();
    settings.theme = document.getElementById("darkModeSetting").value;

    saveStoredSettings(settings);
    applyTheme(settings.theme);
    renderSettingsSummary(settings);

    if (typeof showToast === "function") {
      showToast("Application settings saved.", "success");
    }
  });
}

function initScoringSettingsForm() {
  const form = document.getElementById("scoringSettingsForm");
  if (!form) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const sentimentWeight = Number(document.getElementById("sentimentWeightSetting").value);
    const ratingWeight = Number(document.getElementById("ratingWeightSetting").value);
    const validationBox = document.getElementById("weightValidationMessage");

    if (sentimentWeight + ratingWeight !== 100) {
      if (validationBox) {
        validationBox.textContent = "Error: Sentiment weight + Rating weight must equal 100.";
      }

      if (typeof showToast === "function") {
        showToast("Weights must total 100.", "error");
      }
      return;
    }

    const settings = getStoredSettings();
    settings.sentimentWeight = sentimentWeight;
    settings.ratingWeight = ratingWeight;

    saveStoredSettings(settings);

    if (validationBox) {
      validationBox.textContent = "Scoring weights saved successfully.";
    }

    renderSettingsSummary(settings);

    if (typeof showToast === "function") {
      showToast("Scoring settings saved.", "success");
    }
  });
}

function getAppSettings() {
  return getStoredSettings();
}

document.addEventListener("DOMContentLoaded", () => {
  loadSettingsIntoForm();
  initAppSettingsForm();
  initScoringSettingsForm();
});

window.getAppSettings = getAppSettings;
window.loadSettingsIntoForm = loadSettingsIntoForm;