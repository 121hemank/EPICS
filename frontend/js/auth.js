async function signUpUser(email, password) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password
  });

  if (error) throw error;
  return data;
}

async function loginUser(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data;
}

async function logoutUser() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
}

async function getCurrentUser() {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error) throw error;
  return data.user;
}

async function requireAuth() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      window.location.href = "login.html";
      return null;
    }
    return user;
  } catch (error) {
    console.error(error);
    window.location.href = "login.html";
    return null;
  }
}

async function redirectIfLoggedIn() {
  try {
    const user = await getCurrentUser();
    if (user) {
      window.location.href = "index.html";
    }
  } catch (error) {
    console.error(error);
  }
}

function showAuthMessage(elementId, message) {
  const box = document.getElementById(elementId);
  if (box) {
    box.textContent = message;
  }
}

function initLoginForm() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    try {
      showAuthMessage("loginMessage", "Logging in...");
      await loginUser(email, password);
      showAuthMessage("loginMessage", "Login successful. Redirecting...");
      window.location.href = "index.html";
    } catch (error) {
      console.error(error);
      showAuthMessage("loginMessage", `Error: ${error.message}`);
    }
  });
}

function initSignupForm() {
  const form = document.getElementById("signupForm");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;

    try {
      showAuthMessage("signupMessage", "Creating account...");
      await signUpUser(email, password);
      showAuthMessage("signupMessage", "Signup successful. Redirecting to login...");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1000);
    } catch (error) {
      console.error(error);
      showAuthMessage("signupMessage", `Error: ${error.message}`);
    }
  });
}

function initAuthPageGuards() {
  const isLoginPage = window.location.pathname.toLowerCase().includes("login.html");
  const isSignupPage = window.location.pathname.toLowerCase().includes("signup.html");

  if (isLoginPage || isSignupPage) {
    redirectIfLoggedIn();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initAuthPageGuards();
  initLoginForm();
  initSignupForm();
});

window.requireAuth = requireAuth;
window.logoutUser = logoutUser;
window.getCurrentUser = getCurrentUser;