import { clearUserCookie, getCurrentUser, renderAvatar } from "./auth.js";

const sections = ["主页", "公告", "空间", "消息", "我"];
const navigationMarkup = `
  <header class="topbar">
    <a class="brand" data-home-link aria-label="帕拉恩度主页">
      <img data-logo alt="帕拉恩度 Logo">
    </a>
    <div class="user-avatar" id="user-avatar" aria-label="当前用户"></div>
  </header>
  <aside class="sidebar" aria-label="主导航">
    <nav class="navigation">
      <button class="nav-item" type="button" data-section="主页">
        <svg viewBox="0 0 24 24" aria-hidden="true"><use data-icon="home"></use></svg>
        <span>主页</span>
      </button>
      <button class="nav-item" type="button" data-section="公告">
        <svg viewBox="0 0 24 24" aria-hidden="true"><use data-icon="notice"></use></svg>
        <span>公告</span>
      </button>
      <button class="nav-item" type="button" data-section="空间">
        <svg viewBox="0 0 24 24" aria-hidden="true"><use data-icon="workspace"></use></svg>
        <span>空间</span>
      </button>
      <button class="nav-item" type="button" data-section="消息">
        <svg viewBox="0 0 24 24" aria-hidden="true"><use data-icon="messages"></use></svg>
        <span>消息</span>
      </button>
      <button class="nav-item" type="button" data-section="我">
        <svg viewBox="0 0 24 24" aria-hidden="true"><use data-icon="user"></use></svg>
        <span>我</span>
      </button>
    </nav>
    <button class="nav-item logout-button" id="logout-button" type="button">
      <svg viewBox="0 0 24 24" aria-hidden="true"><use data-icon="log-out"></use></svg>
      <span>退出登录</span>
    </button>
  </aside>
`;

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

  const template = document.createElement("template");
  template.innerHTML = navigationMarkup;
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
