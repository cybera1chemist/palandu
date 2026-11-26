import { clearUserCookie, getCurrentUser, renderAvatar } from "./auth.js";

const navigationTemplateUrl = new URL("../components/navigation.html", import.meta.url);
const sections = ["主页", "公告", "空间", "消息", "我"];

function createSiteUrl(path) {
  return new URL(`../../${path}`, import.meta.url);
}

export async function initializeNavigation({
  currentUser,
  activeSection,
  includeSidebar = true,
} = {}) {
  const topbarMount = document.querySelector("#site-topbar");
  const sidebarMount = includeSidebar ? document.querySelector("#site-sidebar") : null;
  if (!topbarMount || (includeSidebar && !sidebarMount)) {
    throw new Error("页面缺少导航组件挂载位置。");
  }

  const response = await fetch(navigationTemplateUrl);
  if (!response.ok) {
    throw new Error(`无法加载导航组件（HTTP ${response.status}）。`);
  }

  const template = document.createElement("template");
  template.innerHTML = await response.text();
  const header = template.content.querySelector(".topbar");
  const sidebar = template.content.querySelector(".sidebar");
  if (!header || !sidebar) {
    throw new Error("导航组件模板格式无效。");
  }

  header.querySelector("[data-home-link]").href = createSiteUrl("index.html").href;
  header.querySelector("[data-logo]").src = new URL("../images/Logo.png", import.meta.url).href;
  header.querySelectorAll("[data-icon]").forEach((icon) => {
    const name = icon.dataset.icon;
    icon.setAttribute("href", new URL(`../icons/${name}.svg#icon-${name}`, import.meta.url).href);
  });
  topbarMount.replaceWith(header);
  if (includeSidebar) {
    sidebarMount.replaceWith(sidebar);
  }

  const user = currentUser ?? await getCurrentUser();
  if (user) {
    renderAvatar(header.querySelector("#user-avatar"), user.directory, user.profile.nickname);
  }

  if (!includeSidebar) return;

  const navItems = sidebar.querySelectorAll(".nav-item[data-section]");
  function setActiveSection(section) {
    navItems.forEach((item) => {
      item.classList.toggle("is-active", item.dataset.section === section);
    });
  }

  setActiveSection(sections.includes(activeSection) ? activeSection : "");
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const { section } = item.dataset;
      setActiveSection(section);
      if (document.querySelector("#home-view")) {
        document.dispatchEvent(new CustomEvent("palandu:navigate", { detail: { section } }));
      } else {
        const url = createSiteUrl("index.html");
        url.searchParams.set("section", section);
        window.location.assign(url);
      }
    });
  });

  sidebar.querySelector("#logout-button").addEventListener("click", () => {
    clearUserCookie();
    window.location.replace(createSiteUrl("login.html"));
  });
}
