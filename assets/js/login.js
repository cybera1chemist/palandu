import { findMatchingUser, getCurrentUser, renderAvatar, setUserCookie } from "./auth.js";

const form = document.querySelector("#login-form");
const idInput = document.querySelector("#account-id");
const passwordInput = document.querySelector("#account-password");
const message = document.querySelector("#form-message");
const submitButton = form.querySelector("button[type='submit']");
const logo = document.querySelector(".login-logo");
const heading = document.querySelector(".login-card h1");
const welcomeState = document.querySelector("#welcome-state");
const welcomeAvatar = document.querySelector("#welcome-avatar");
const welcomeMessage = document.querySelector("#welcome-message");

try {
  if (await getCurrentUser()) {
    window.location.replace("./index.html");
  }
} catch (error) {
  message.textContent = error.message;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";
  submitButton.disabled = true;

  try {
    const user = await findMatchingUser(idInput.value.trim(), passwordInput.value);
    if (!user) {
      message.textContent = "账号或密码错误。";
      return;
    }

    setUserCookie(user.directory);
    logo.hidden = true;
    heading.hidden = true;
    form.hidden = true;
    welcomeMessage.textContent = `欢迎回来，${user.profile.nickname}`;
    welcomeState.hidden = false;
    renderAvatar(welcomeAvatar, user.directory, user.profile.nickname);
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
    window.location.replace("./index.html");
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});
