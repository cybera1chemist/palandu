const ANNOUNCEMENTS_URL = new URL("../../data/anoucements.json", import.meta.url);
const LEVEL_RANK = new Map([
  ["一", 1],
  ["二", 2],
  ["三", 3],
  ["四", 4],
  ["五", 5],
  ["六", 6],
  ["七", 7],
  ["八", 8],
  ["九", 9],
  ["十", 10],
]);
const UNIT_DAYS = {
  days: 1,
  weeks: 7,
  months: 30,
  years: 365,
};

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateAnnouncement(announcement) {
  if (
    !announcement ||
    !isNonEmptyString(announcement.id) ||
    !isNonEmptyString(announcement.title) ||
    !isNonEmptyString(announcement.publisher) ||
    !announcement.published ||
    !Number.isFinite(announcement.published.amount) ||
    announcement.published.amount < 0 ||
    !Object.hasOwn(UNIT_DAYS, announcement.published.unit) ||
    !isNonEmptyString(announcement.published.label) ||
    !Array.isArray(announcement.content) ||
    !announcement.content.every((block) =>
      block?.type === "paragraph"
        ? isNonEmptyString(block.text)
        : block?.type === "list" &&
          Array.isArray(block.items) &&
          block.items.every((item) =>
            isNonEmptyString(item.label) && isNonEmptyString(item.text)
          )
    )
  ) {
    throw new Error("公告数据格式无效。");
  }

  const audience = announcement.whoCanView;
  if (
    audience !== "所有成员" &&
    !(audience && isNonEmptyString(audience.minimumLevel) && LEVEL_RANK.has(audience.minimumLevel))
  ) {
    throw new Error(`公告“${announcement.title}”的可见权限格式无效。`);
  }
}

function canViewAnnouncement(announcement, profile) {
  if (announcement.whoCanView === "所有成员") return true;

  const viewerRank = LEVEL_RANK.get(profile.level);
  const requiredRank = LEVEL_RANK.get(announcement.whoCanView.minimumLevel);
  return viewerRank !== undefined && viewerRank <= requiredRank;
}

function getAgeInDays(announcement) {
  return announcement.published.amount * UNIT_DAYS[announcement.published.unit];
}

export async function loadAnnouncements(profile) {
  const response = await fetch(ANNOUNCEMENTS_URL);
  if (!response.ok) {
    throw new Error(`无法读取公告（HTTP ${response.status}）。`);
  }

  const announcements = await response.json();
  if (!Array.isArray(announcements)) {
    throw new Error("公告数据格式无效：预期为数组。");
  }
  announcements.forEach(validateAnnouncement);

  return announcements
    .filter((announcement) => canViewAnnouncement(announcement, profile))
    .sort((left, right) => getAgeInDays(left) - getAgeInDays(right));
}

function getAnnouncementText(announcement) {
  return announcement.content.map((block) => {
    if (block.type === "paragraph") return block.text;
    return block.items.map((item) => `${item.label}：${item.text}`).join(" ");
  }).join(" ");
}

function createAnnouncementBody(announcement) {
  const body = document.createElement("div");
  body.className = "announcement-body";

  announcement.content.forEach((block) => {
    if (block.type === "paragraph") {
      const paragraph = document.createElement("p");
      paragraph.textContent = block.text;
      body.append(paragraph);
      return;
    }

    const list = document.createElement("ul");
    block.items.forEach((item) => {
      const listItem = document.createElement("li");
      const label = document.createElement("strong");
      label.textContent = `${item.label}：`;
      listItem.append(label, document.createTextNode(item.text));
      list.append(listItem);
    });
    body.append(list);
  });

  return body;
}

export function renderAnnouncementList(
  container,
  announcements,
  { preview = false, onSelect } = {}
) {
  container.replaceChildren();

  if (announcements.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "暂无公告";
    container.append(empty);
    return;
  }

  const visibleAnnouncements = preview ? announcements.slice(0, 2) : announcements;
  visibleAnnouncements.forEach((announcement) => {
    if (preview) {
      const item = document.createElement("li");
      item.className = "recent-announcement";

      const card = document.createElement("button");
      card.className = "recent-announcement-card";
      card.type = "button";
      const title = document.createElement("h3");
      title.textContent = announcement.title;
      const excerpt = document.createElement("p");
      excerpt.textContent = getAnnouncementText(announcement);
      const published = document.createElement("span");
      published.className = "announcement-time";
      published.textContent = announcement.published.label;

      card.append(title, excerpt, published);
      card.addEventListener("click", () => onSelect?.(announcement.id));
      item.append(card);
      container.append(item);
      return;
    }

    const article = document.createElement("li");
    article.className = "announcement-card";
    article.dataset.announcementId = announcement.id;
    article.tabIndex = -1;

    const heading = document.createElement("h2");
    heading.textContent = announcement.title;
    const metadata = document.createElement("div");
    metadata.className = "announcement-meta";

    const time = document.createElement("time");
    time.textContent = announcement.published.label;
    const publisher = document.createElement("span");
    publisher.textContent = `发布者：${announcement.publisher}`;
    metadata.append(time, publisher);

    article.append(heading, metadata, createAnnouncementBody(announcement));
    container.append(article);
  });
}
