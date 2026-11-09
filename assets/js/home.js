import { clearUserCookie, getCurrentUser } from "./auth.js";

const sectionTitle = document.querySelector("#section-title");
const avatar = document.querySelector("#user-avatar");
const navItems = document.querySelectorAll(".nav-item[data-section]");

try {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    window.location.replace("./login.html");
  } else {
    avatar.textContent = currentUser.profile.nickname.slice(0, 1);
    avatar.title = currentUser.profile.nickname;
  }
} catch (error) {
  sectionTitle.textContent = error.message;
}

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    navItems.forEach((navItem) => navItem.classList.remove("is-active"));
    item.classList.add("is-active");
    sectionTitle.textContent = item.dataset.section;
  });
});

document.querySelector("#logout-button").addEventListener("click", () => {
  clearUserCookie();
  window.location.replace("./login.html");
});
