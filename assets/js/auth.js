const COOKIE_NAME = "palandu_user";
const USERS_INDEX_URL = new URL("../../data/users.json", import.meta.url);

function readUserCookie() {
  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${COOKIE_NAME}=`));

  if (!cookie) return null;

  try {
    return decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1));
  } catch {
    return null;
  }
}

function setUserCookie(directory) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(directory)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

function clearUserCookie() {
  document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

async function fetchJson(url, label) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`无法读取${label}（HTTP ${response.status}）。`);
  }
  return response.json();
}

async function fetchUserDirectories() {
  const directories = await fetchJson(USERS_INDEX_URL, "账号目录索引");
  if (!Array.isArray(directories) || !directories.every((directory) =>
    typeof directory === "string" && /^[\w-]+$/.test(directory)
  )) {
    throw new Error("账号目录索引格式无效。");
  }
  return directories;
}

async function fetchUser(directory) {
  const profileUrl = new URL(`../../data/${encodeURIComponent(directory)}/info.json`, import.meta.url);
  const profile = await fetchJson(profileUrl, `账号资料 ${directory}`);
  if (
    !profile ||
    typeof profile.id !== "string" ||
    typeof profile.password !== "string" ||
    typeof profile.nickname !== "string"
  ) {
    throw new Error(`账号资料 ${directory} 格式无效。`);
  }
  return profile;
}

export async function findMatchingUser(id, password) {
  const directories = await fetchUserDirectories();
  const profiles = await Promise.all(directories.map(async (directory) => ({
    directory,
    profile: await fetchUser(directory),
  })));
  return profiles.find(({ profile }) => profile.id === id && profile.password === password) ?? null;
}

export async function getCurrentUser() {
  const directory = readUserCookie();
  if (!directory) return null;

  const directories = await fetchUserDirectories();
  if (!directories.includes(directory)) {
    clearUserCookie();
    return null;
  }

  return { directory, profile: await fetchUser(directory) };
}

export { clearUserCookie, readUserCookie, setUserCookie };
