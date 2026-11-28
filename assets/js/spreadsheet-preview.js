import { initializeNavigation } from "./navigation.js?v=navigation-component-2";

try {
  await initializeNavigation({ includeSidebar: false });
} catch (error) {
  const notice = document.createElement("p");
  notice.className = "page-error";
  notice.setAttribute("role", "alert");
  notice.textContent = error.message;
  document.querySelector(".spreadsheet-preview-content").prepend(notice);
}
