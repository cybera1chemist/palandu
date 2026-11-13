import { clearUserCookie, getCurrentUser, renderAvatar } from "./auth.js";
import { loadAnnouncements, renderAnnouncementList } from "./announcements.js";
import { initializeWorkspace } from "./workspace.js";

const mainContent = document.querySelector(".main-content");
const homeView = document.querySelector("#home-view");
const announcementsView = document.querySelector("#announcements-view");
const workspaceView = document.querySelector("#workspace-view");
const profileView = document.querySelector("#profile-view");
const placeholderView = document.querySelector("#placeholder-view");
const placeholderTitle = document.querySelector("#placeholder-title");
const topbarAvatar = document.querySelector("#user-avatar");
const profileAvatar = document.querySelector("#profile-avatar");
const navItems = document.querySelectorAll(".nav-item[data-section]");

function renderSection(section) {
  navItems.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.section === section);
  });
  homeView.hidden = section !== "主页";
  announcementsView.hidden = section !== "公告";
  workspaceView.hidden = section !== "空间";
  profileView.hidden = section !== "我";
  placeholderView.hidden = section !== "消息";
  if (!placeholderView.hidden) {
    placeholderTitle.textContent = section;
  }
}

function navigateToAnnouncement(id) {
  renderSection("公告");
  requestAnimationFrame(() => {
    const target = Array.from(document.querySelectorAll("[data-announcement-id]"))
      .find((item) => item.dataset.announcementId === id);
    if (!target) return;
    target.scrollIntoView({ block: "start", behavior: "smooth" });
    target.focus({ preventScroll: true });
    target.classList.add("is-targeted");
    window.setTimeout(() => target.classList.remove("is-targeted"), 1800);
  });
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

    try {
      let navigateToWorkspaceItem = () => false;
      navigateToWorkspaceItem = await initializeWorkspace(
        currentUser.directory,
        document.querySelector("#workspace-breadcrumbs"),
        document.querySelector("#workspace-items"),
        document.querySelector("#recent-files"),
        (id) => {
          renderSection("空间");
          navigateToWorkspaceItem(id);
        }
      );
    } catch (error) {
      const workspaceError = document.createElement("p");
      workspaceError.className = "page-error";
      workspaceError.setAttribute("role", "alert");
      workspaceError.textContent = error.message;
      document.querySelector("#workspace-items").replaceChildren(workspaceError);
    }

    try {
      const announcements = await loadAnnouncements(currentUser.profile);
      renderAnnouncementList(
        document.querySelector("#recent-announcements"),
        announcements,
        { preview: true, onSelect: navigateToAnnouncement }
      );
      renderAnnouncementList(
        document.querySelector("#announcement-list"),
        announcements
      );
    } catch (error) {
      const message = document.createElement("li");
      message.className = "page-error";
      message.setAttribute("role", "alert");
      message.textContent = error.message;
      document.querySelector("#recent-announcements").replaceChildren(message.cloneNode(true));
      document.querySelector("#announcement-list").replaceChildren(message);
    }
  }
} catch (error) {
  const errorMessage = document.createElement("p");
  errorMessage.className = "page-error";
  errorMessage.setAttribute("role", "alert");
  errorMessage.textContent = error.message;
  mainContent.replaceChildren(errorMessage);
}
