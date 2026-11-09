import { clearUserCookie, getCurrentUser, renderAvatar } from "./auth.js";

const mainContent = document.querySelector(".main-content");
const homeView = document.querySelector("#home-view");
const profileView = document.querySelector("#profile-view");
const placeholderView = document.querySelector("#placeholder-view");
const sectionTitle = document.querySelector("#section-title");
const topbarAvatar = document.querySelector("#user-avatar");
const profileAvatar = document.querySelector("#profile-avatar");
const navItems = document.querySelectorAll(".nav-item[data-section]");

function renderSection(section) {
  navItems.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.section === section);
  });
  homeView.hidden = section !== "主页";
  profileView.hidden = section !== "我";
  placeholderView.hidden = section === "主页" || section === "我";
  if (!placeholderView.hidden) {
    sectionTitle.textContent = section;
  }
}

function renderProfile(directory, profile) {
  document.querySelector("#welcome-nickname").textContent = profile.nickname;
  document.querySelector("#profile-nickname").textContent = profile.nickname;
  renderAvatar(topbarAvatar, directory, profile.nickname);
  renderAvatar(profileAvatar, directory, profile.nickname);

  for (const field of ["id", "gender", "age", "department", "level"]) {
    document.querySelector(`#profile-${field}`).textContent = String(
      profile[field] ?? "未设置"
    );
  }

  const passwordElement = document.querySelector("#profile-password");
  const passwordToggle = document.querySelector("#password-toggle");
  const eyeSlash = document.querySelector("#password-eye-slash");
  let passwordVisible = false;

  function updatePasswordVisibility() {
    passwordVisible = !passwordVisible;
    passwordElement.textContent = passwordVisible
      ? profile.password
      : "*".repeat(profile.password.length);
    passwordToggle.setAttribute("aria-pressed", String(passwordVisible));
    passwordToggle.setAttribute("aria-label", passwordVisible ? "隐藏密码" : "显示密码");
    passwordToggle.title = passwordVisible ? "隐藏密码" : "显示密码";
    eyeSlash.hidden = passwordVisible;
  }

  passwordElement.textContent = "*".repeat(profile.password.length);
  passwordToggle.addEventListener("click", updatePasswordVisibility);
}

document.querySelectorAll("[data-open-section]").forEach((button) => {
  button.addEventListener("click", () => renderSection(button.dataset.openSection));
});

document.querySelector("#logout-button").addEventListener("click", () => {
  clearUserCookie();
  window.location.replace("./login.html");
});

try {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    window.location.replace("./login.html");
  } else {
    renderProfile(currentUser.directory, currentUser.profile);
    renderSection("主页");
    navItems.forEach((item) => {
      item.addEventListener("click", () => renderSection(item.dataset.section));
    });
  }
} catch (error) {
  const errorMessage = document.createElement("p");
  errorMessage.className = "page-error";
  errorMessage.setAttribute("role", "alert");
  errorMessage.textContent = error.message;
  mainContent.replaceChildren(errorMessage);
}
