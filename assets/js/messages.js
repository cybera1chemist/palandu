import { getUserById, renderAvatar } from "./auth.js";

function validateConversation(conversation) {
  if (
    !conversation ||
    typeof conversation.id !== "string" ||
    typeof conversation.participantId !== "string" ||
    !Array.isArray(conversation.messages)
  ) {
    throw new Error("消息数据格式无效。");
  }

  conversation.messages.forEach((message) => {
    const validBase =
      message &&
      typeof message.id === "string" &&
      typeof message.dateLabel === "string" &&
      typeof message.senderId === "string";
    const validText = message?.type === "text" && typeof message.text === "string";
    const validFile =
      message?.type === "file" &&
      typeof message.file?.path === "string" &&
      message.file.path.startsWith("files/") &&
      typeof message.file.nameTemplate === "string";

    if (!validBase || (!validText && !validFile)) {
      throw new Error(`消息数据格式无效：${message?.id ?? "未知消息"}。`);
    }
  });
}

async function loadConversation(directory) {
  const url = new URL(
    `../../data/${encodeURIComponent(directory)}/msg/msg-0.json`,
    import.meta.url
  );
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`无法读取对话记录（HTTP ${response.status}）。`);
  }

  const conversation = await response.json();
  validateConversation(conversation);
  return conversation;
}

function createFileIcon() {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M6 3.5h8l4 4v13H6zM14 3.5v5h5M9 13h6m-6 3h6");
  icon.append(path);
  return icon;
}

function getMessagePreview(message, sender) {
  if (message.type === "file") return `${sender.nickname} 发送了文件`;
  return message.text;
}

function resolveDownloadName(template, sender, recipient) {
  return template
    .replaceAll("{recipientId}", recipient.id)
    .replaceAll("{senderId}", sender.id)
    .replaceAll("{senderPassword}", sender.password)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
}

function createAttachmentMessage(message, sender, recipient, dialog) {
  const filename = resolveDownloadName(message.file.nameTemplate, sender, recipient);
  const card = document.createElement("button");
  card.className = "attachment-card";
  card.type = "button";
  card.setAttribute("aria-label", `下载文件：${filename}`);

  const icon = createFileIcon();
  const details = document.createElement("span");
  details.className = "attachment-details";
  const title = document.createElement("span");
  title.className = "attachment-title";
  title.textContent = filename;
  title.title = filename;
  const subtitle = document.createElement("span");
  subtitle.className = "attachment-subtitle";
  subtitle.textContent = "PDF 文件";
  details.append(title, subtitle);
  card.append(icon, details);

  card.addEventListener("click", () => {
    dialog.dataset.filePath = message.file.path;
    dialog.dataset.downloadName = filename;
    document.querySelector("#download-file-name").textContent = filename;
    document.querySelector("#download-file-name").title = filename;
    dialog.showModal();
  });

  return card;
}

function renderMessages(conversation, self, contact, chatMessages, dialog) {
  chatMessages.replaceChildren();
  let previousDate = null;

  conversation.messages.forEach((message) => {
    if (message.dateLabel !== previousDate) {
      const date = document.createElement("li");
      date.className = "chat-date";
      const label = document.createElement("span");
      label.textContent = message.dateLabel;
      date.append(label);
      chatMessages.append(date);
      previousDate = message.dateLabel;
    }

    const isOwn = message.senderId === self.id;
    const sender = isOwn ? self : contact.profile;
    const senderDirectory = isOwn ? contact.selfDirectory : contact.directory;
    const row = document.createElement("li");
    row.className = `chat-message ${isOwn ? "chat-message--own" : "chat-message--other"}`;

    const avatar = document.createElement("div");
    avatar.className = "user-avatar message-avatar";
    renderAvatar(avatar, senderDirectory, sender.nickname);

    const content = document.createElement("div");
    content.className = "chat-message-content";
    const senderName = document.createElement("span");
    senderName.className = "chat-sender-name";
    senderName.textContent = sender.nickname;
    content.append(senderName);

    const bubble = message.type === "file"
      ? createAttachmentMessage(message, sender, isOwn ? contact.profile : self, dialog)
      : document.createElement("p");
    if (message.type === "text") {
      bubble.className = "message-bubble";
      bubble.textContent = message.text;
    }
    content.append(bubble);
    row.append(avatar, content);
    chatMessages.append(row);
  });

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

export async function initializeMessages(directory, self, elements) {
  const conversation = await loadConversation(directory);
  if (!conversation.messages.every((message) =>
    message.senderId === self.id || message.senderId === conversation.participantId
  )) {
    throw new Error("对话中包含未知的发送者。");
  }

  const contact = await getUserById(conversation.participantId);
  if (!contact) {
    throw new Error("无法找到该对话成员的账号资料。");
  }

  const conversationButton = document.createElement("button");
  conversationButton.className = "conversation-item is-active";
  conversationButton.type = "button";
  const avatar = document.createElement("div");
  avatar.className = "user-avatar conversation-avatar";
  renderAvatar(avatar, contact.directory, contact.profile.nickname);
  const details = document.createElement("span");
  details.className = "conversation-details";
  const name = document.createElement("span");
  name.className = "conversation-name";
  name.textContent = contact.profile.nickname;
  const preview = document.createElement("span");
  preview.className = "conversation-preview";
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  preview.textContent = lastMessage ? getMessagePreview(lastMessage, self.id === lastMessage.senderId ? self : contact.profile) : "";
  details.append(name, preview);
  conversationButton.append(avatar, details);

  conversationButton.addEventListener("click", () => {
    elements.conversationList.querySelectorAll(".conversation-item")
      .forEach((item) => item.classList.remove("is-active"));
    conversationButton.classList.add("is-active");
    elements.contactName.textContent = contact.profile.nickname;
    renderMessages(conversation, self, {
      ...contact,
      selfDirectory: directory,
    }, elements.chatMessages, elements.downloadDialog);
  });

  elements.conversationList.replaceChildren(conversationButton);
  elements.contactName.textContent = contact.profile.nickname;
  renderAvatar(elements.contactAvatar, contact.directory, contact.profile.nickname);
  renderMessages(conversation, self, {
    ...contact,
    selfDirectory: directory,
  }, elements.chatMessages, elements.downloadDialog);

  elements.downloadCancel.addEventListener("click", () => elements.downloadDialog.close());
  elements.downloadConfirm.addEventListener("click", () => {
    const filePath = elements.downloadDialog.dataset.filePath;
    const downloadName = elements.downloadDialog.dataset.downloadName;
    if (!filePath || !downloadName) return;

    const siteRoot = new URL("../../", import.meta.url);
    const link = document.createElement("a");
    link.href = new URL(filePath, siteRoot).href;
    link.download = downloadName;
    link.hidden = true;
    elements.downloadDialog.close();
    document.body.append(link);
    link.click();
    link.remove();
  });
}
