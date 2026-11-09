import { findMatchingUser, getCurrentUser, setUserCookie } from "./auth.js";

const form = document.querySelector("#login-form");
const idInput = document.querySelector("#account-id");
const passwordInput = document.querySelector("#account-password");
const message = document.querySelector("#form-message");
const submitButton = form.querySelector("button[type='submit']");

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
    window.location.replace("./index.html");
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});
