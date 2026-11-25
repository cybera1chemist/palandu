import { getUserById, renderAvatar } from "./auth.js";

function validateConversation(conversation) {
  if (
    !conversation ||
    typeof conversation.id !== "string" ||
    typeof conversation.participantId !== "string" ||
    (conversation.unlockPassword !== undefined &&
      !/^[0-9]{3}$/.test(conversation.unlockPassword)) ||
    (conversation.participant !== undefined &&
      (typeof conversation.participant?.nickname !== "string" ||
        typeof conversation.participant?.avatar !== "string" ||
        !/^assets\/images\/avatars\/[^/\\]+\.(?:png|jpe?g)$/i.test(conversation.participant.avatar))) ||
    !Array.isArray(conversation.messages)
  ) {
    throw new Error("消息数据格式无效。");
  }

  conversation.messages.forEach((message) => {
    const validBase =
      message &&
      typeof message.id === "string" &&
      typeof message.dateLabel === "string" &&
      (message.locked === undefined || typeof message.locked === "boolean") &&
      (!message.locked || typeof conversation.unlockPassword === "string") &&
      (message.type === "system" || typeof message.senderId === "string");
    const validText = message?.type === "text" && typeof message.text === "string";
    const validSystem = message?.type === "system" && typeof message.text === "string";
    const validImage = message?.type === "image" &&
      typeof message.image?.path === "string" &&
      /^assets\/images\/[^/\\]+\.(?:png|jpe?g)$/i.test(message.image.path) &&
      typeof message.image.alt === "string";
    const validLink = message?.type === "link" &&
      typeof message.text === "string" &&
      message.url === "https://cybera1chemist.github.io/palandu-database/";
    const validUnavailableFile = message?.type === "unavailable-file" &&
      typeof message.text === "string";
    const validFile =
      message?.type === "file" &&
      typeof message.file?.path === "string" &&
      message.file.path.startsWith("files/") &&
      typeof message.file.nameTemplate === "string";

    if (!validBase || (!validText && !validSystem && !validImage && !validLink &&
      !validUnavailableFile && !validFile)) {
      throw new Error(`消息数据格式无效：${message?.id ?? "未知消息"}。`);
    }
  });
}

async function loadMessageList(directory) {
  const url = new URL(
    `../../data/${encodeURIComponent(directory)}/msg/messages.json`,
    import.meta.url
  );
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`无法读取消息列表（HTTP ${response.status}）。`);
  }

  const messageList = await response.json();
  if (
    !Array.isArray(messageList?.items) ||
    !messageList.items.every((item) =>
      item?.openable === true
        ? typeof item.file === "string" && /^[\w-]+\.json$/.test(item.file)
        : item?.openable === false &&
          typeof item.name === "string" &&
          typeof item.avatar === "string" &&
          item.avatar.startsWith("assets/images/") &&
          typeof item.preview === "string"
    )
  ) {
    throw new Error("消息列表格式无效。");
  }
  return messageList.items;
}

async function loadConversation(directory, filename) {
  const url = new URL(
    `../../data/${encodeURIComponent(directory)}/msg/${encodeURIComponent(filename)}`,
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

function createFileIcon(filename = "file-text") {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.classList.add("attachment-file-icon");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `./assets/icons/${filename}.svg#icon-${filename}`);
  icon.append(use);
  return icon;
}

function renderContactAvatar(element, contact) {
  if (!contact.avatar) {
    renderAvatar(element, contact.directory, contact.profile.nickname);
    return;
  }

  element.textContent = contact.profile.nickname.slice(0, 1);
  element.title = contact.profile.nickname;
  element.setAttribute("aria-label", contact.profile.nickname);

  const image = new Image();
  image.alt = "";
  image.addEventListener("load", () => {
    element.textContent = "";
    element.append(image);
  }, { once: true });
  image.src = new URL(`../../${contact.avatar}`, import.meta.url).href;
}

function getMessagePreview(message, sender) {
  if (message.type === "file") return `${sender.nickname} 发送了文件`;
  if (message.type === "image") return `${sender.nickname} 发送了图片`;
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
  subtitle.textContent = message.file.path.toLowerCase().endsWith(".docx")
    ? "DOCX 文件"
    : "PDF 文件";
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

function renderMessages(
  conversation,
  self,
  contact,
  chatMessages,
  elements,
  unlocked,
  onUnlock,
  onOpenImage
) {
  chatMessages.replaceChildren();
  let previousDate = null;

  if (!unlocked && conversation.messages.some((message) => message.locked)) {
    const row = document.createElement("li");
    row.className = "chat-unlock";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chat-unlock-button";
    button.textContent = "输入密码解锁之前的聊天记录";
    button.addEventListener("click", onUnlock);
    row.append(button);
    chatMessages.append(row);
  }

  conversation.messages.filter((message) => unlocked || !message.locked).forEach((message) => {
    if (message.dateLabel !== previousDate) {
      const date = document.createElement("li");
      date.className = "chat-date";
      const label = document.createElement("span");
      label.textContent = message.dateLabel;
      date.append(label);
      chatMessages.append(date);
      previousDate = message.dateLabel;
    }

    if (message.type === "system") {
      const notice = document.createElement("li");
      notice.className = "chat-system-notice";
      notice.textContent = message.text;
      chatMessages.append(notice);
      return;
    }

    const isOwn = message.senderId === self.id;
    const sender = isOwn ? self : contact.profile;
    const senderDirectory = isOwn ? contact.selfDirectory : contact.directory;
    const row = document.createElement("li");
    row.className = `chat-message ${isOwn ? "chat-message--own" : "chat-message--other"}`;

    const avatar = document.createElement("div");
    avatar.className = "user-avatar message-avatar";
    if (isOwn) {
      renderAvatar(avatar, senderDirectory, sender.nickname);
    } else {
      renderContactAvatar(avatar, contact);
    }

    const content = document.createElement("div");
    content.className = "chat-message-content";
    const senderName = document.createElement("span");
    senderName.className = "chat-sender-name";
    senderName.textContent = sender.nickname;
    content.append(senderName);

    let bubble;
    if (message.type === "file") {
      bubble = createAttachmentMessage(message, sender, isOwn ? contact.profile : self, elements.downloadDialog);
    } else if (message.type === "image") {
      bubble = document.createElement("button");
      bubble.type = "button";
      bubble.className = "chat-image-button";
      bubble.setAttribute("aria-label", `查看大图：${message.image.alt}`);
      const image = document.createElement("img");
      image.src = new URL(`../../${message.image.path}`, import.meta.url).href;
      image.alt = message.image.alt;
      bubble.append(image);
      bubble.addEventListener("click", () => onOpenImage(image.src, image.alt));
    } else if (message.type === "link") {
      bubble = document.createElement("a");
      bubble.className = "attachment-card program-link";
      bubble.href = message.url;
      bubble.target = "_blank";
      bubble.rel = "noopener noreferrer";
      bubble.append(createFileIcon("program"));
      const title = document.createElement("span");
      title.className = "attachment-title";
      title.textContent = message.text;
      bubble.append(title);
    } else if (message.type === "unavailable-file") {
      bubble = document.createElement("button");
      bubble.type = "button";
      bubble.className = "attachment-card";
      bubble.append(createFileIcon());
      const title = document.createElement("span");
      title.className = "attachment-title";
      title.textContent = message.text;
      bubble.append(title);
      bubble.addEventListener("click", () => {
        elements.largeFileDialog.querySelector("[data-download-status]").hidden = true;
        elements.largeFileDialog.showModal();
      });
    } else {
      bubble = document.createElement("p");
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
  const entries = await loadMessageList(directory);
  const conversations = await Promise.all(entries.map(async (entry) => {
    if (!entry.openable) return { entry, conversation: null, contact: null };

    const conversation = await loadConversation(directory, entry.file);
    if (!conversation.messages.every((message) =>
      message.type === "system" ||
      message.senderId === self.id || message.senderId === conversation.participantId
    )) {
      throw new Error("对话中包含未知的发送者。");
    }

    let contact = await getUserById(conversation.participantId);
    if (!contact) {
      if (!conversation.participant) {
        throw new Error("无法找到该对话成员的账号资料。");
      }
      contact = {
        profile: {
          id: conversation.participantId,
          nickname: conversation.participant.nickname,
        },
        avatar: conversation.participant.avatar,
      };
    }
    return { entry, conversation, contact };
  }));

  elements.conversationList.replaceChildren();
  let selectedConversation = null;
  const unlockForm = elements.unlockDialog.querySelector("form");
  const unlockInputs = Array.from(unlockForm.querySelectorAll("input"));
  const unlockError = unlockForm.querySelector(".chat-unlock-error");
  let imageScale = 1;
  let imageOffsetX = 0;
  let imageOffsetY = 0;
  let imageDrag = null;

  function updateImageTransform() {
    elements.imagePreview.style.transform =
      `translate(calc(-50% + ${imageOffsetX}px), calc(-50% + ${imageOffsetY}px)) scale(${imageScale})`;
  }

  function openImagePreview(src, alt) {
    elements.imagePreview.src = src;
    elements.imagePreview.alt = alt;
    imageScale = 1;
    imageOffsetX = 0;
    imageOffsetY = 0;
    elements.imagePreview.classList.remove("is-dragging");
    updateImageTransform();
    elements.imageDialog.showModal();
  }

  elements.imageDialog.addEventListener("wheel", (event) => {
    event.preventDefault();
    const previousScale = imageScale;
    const nextScale = Math.min(6, Math.max(1, previousScale * (event.deltaY < 0 ? 1.15 : 1 / 1.15)));
    if (nextScale === previousScale) return;

    const bounds = elements.imageDialog.getBoundingClientRect();
    const pointerX = event.clientX - (bounds.left + bounds.width / 2);
    const pointerY = event.clientY - (bounds.top + bounds.height / 2);
    const ratio = nextScale / previousScale;
    imageOffsetX = pointerX * (1 - ratio) + imageOffsetX * ratio;
    imageOffsetY = pointerY * (1 - ratio) + imageOffsetY * ratio;
    imageScale = nextScale;
    updateImageTransform();
  }, { passive: false });

  elements.imagePreview.addEventListener("pointerdown", (event) => {
    if (imageScale <= 1) return;
    imageDrag = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      offsetX: imageOffsetX,
      offsetY: imageOffsetY,
    };
    elements.imagePreview.setPointerCapture(event.pointerId);
    elements.imagePreview.classList.add("is-dragging");
  });
  elements.imagePreview.addEventListener("pointermove", (event) => {
    if (!imageDrag || event.pointerId !== imageDrag.pointerId) return;
    imageOffsetX = imageDrag.offsetX + event.clientX - imageDrag.x;
    imageOffsetY = imageDrag.offsetY + event.clientY - imageDrag.y;
    updateImageTransform();
  });
  function stopImageDrag(event) {
    if (!imageDrag || event.pointerId !== imageDrag.pointerId) return;
    imageDrag = null;
    elements.imagePreview.classList.remove("is-dragging");
  }
  elements.imagePreview.addEventListener("pointerup", stopImageDrag);
  elements.imagePreview.addEventListener("pointercancel", stopImageDrag);
  elements.imageDialog.addEventListener("click", (event) => {
    if (event.target === elements.imageDialog) elements.imageDialog.close();
  });

  function storageKey(conversation) {
    return `palandu:messages-unlocked:${directory}:${conversation.id}`;
  }

  function showConversation(selected, preserveScroll = false) {
    let unlocked;
    try {
      unlocked = !selected.conversation.unlockPassword ||
        localStorage.getItem(storageKey(selected.conversation)) === "true";
    } catch (error) {
      const notice = document.createElement("li");
      notice.className = "page-error";
      notice.setAttribute("role", "alert");
      notice.textContent = "无法读取聊天记录解锁进度，请检查浏览器存储设置。";
      elements.chatMessages.replaceChildren(notice);
      return;
    }
    const oldHeight = elements.chatMessages.scrollHeight;
    const oldTop = elements.chatMessages.scrollTop;
    renderMessages(selected.conversation, self, {
      ...selected.contact,
      selfDirectory: directory,
    }, elements.chatMessages, elements, unlocked, () => {
        unlockInputs.forEach((input) => { input.value = ""; });
        unlockError.hidden = true;
        elements.unlockDialog.showModal();
        unlockInputs[0].focus();
      }, openImagePreview);
    if (preserveScroll) {
      elements.chatMessages.scrollTop = oldTop + elements.chatMessages.scrollHeight - oldHeight;
    }
  }

  unlockForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!selectedConversation) return;
    if (unlockInputs.map((input) => input.value).join("") !== selectedConversation.conversation.unlockPassword) {
      unlockError.textContent = "密码错误，请重试。";
      unlockError.hidden = false;
      return;
    }
    try {
      localStorage.setItem(storageKey(selectedConversation.conversation), "true");
    } catch (error) {
      unlockError.textContent = "无法保存解锁进度，请检查浏览器存储设置。";
      unlockError.hidden = false;
      return;
    }
    elements.unlockDialog.close();
    showConversation(selectedConversation, true);
  });
  unlockInputs.forEach((input, index) => {
    input.addEventListener("input", () => {
      if (input.value && index < unlockInputs.length - 1) unlockInputs[index + 1].focus();
    });
  });
  elements.unlockDialog.querySelector("[data-cancel]").addEventListener("click", () => elements.unlockDialog.close());
  elements.imageDialog.querySelector("[data-close]").addEventListener("click", () => elements.imageDialog.close());
  elements.largeFileDialog.querySelector("[data-close]").addEventListener("click", () => elements.largeFileDialog.close());
  elements.largeFileDialog.querySelector("[data-download]").addEventListener("click", () => {
    elements.largeFileDialog.querySelector("[data-download-status]").hidden = false;
  });

  function selectConversation(selected) {
    selectedConversation = selected;
    elements.conversationList.querySelectorAll(".conversation-item")
      .forEach((item) => item.classList.toggle("is-active", item === selected.button));
    elements.onTargetConversationChange?.(
      directory === "user1" &&
      selected.conversation.participantId === "external-mengmeng"
    );
    elements.contactName.textContent = selected.contact.profile.nickname;
    renderContactAvatar(elements.contactAvatar, selected.contact);
    showConversation(selected);
  }

  conversations.forEach((item) => {
    const button = document.createElement("button");
    button.className = "conversation-item";
    button.type = "button";
    const avatar = document.createElement("span");
    avatar.className = "user-avatar conversation-avatar";
    const details = document.createElement("span");
    details.className = "conversation-details";
    const name = document.createElement("span");
    name.className = "conversation-name";
    const preview = document.createElement("span");
    preview.className = "conversation-preview";

    if (item.entry.openable) {
      name.textContent = item.contact.profile.nickname;
      const lastMessage = [...item.conversation.messages].reverse().find((message) => !message.locked);
      preview.textContent = lastMessage
        ? getMessagePreview(
          lastMessage,
          lastMessage.senderId === self.id ? self : item.contact.profile
        )
        : "暂无消息";
      renderContactAvatar(avatar, item.contact);
    } else {
      const image = document.createElement("img");
      image.className = "conversation-group-avatar";
      image.src = new URL(`../../${item.entry.avatar}`, import.meta.url).href;
      image.alt = "";
      avatar.append(image);
      name.textContent = item.entry.name;
      preview.textContent = item.entry.preview;
      button.setAttribute("aria-disabled", "true");
    }

    details.append(name, preview);
    button.append(avatar, details);
    elements.conversationList.append(button);
    item.button = button;

    if (item.entry.openable) {
      button.addEventListener("click", () => selectConversation(item));
    }
  });

  const firstWithContent = conversations.find((item) =>
    item.entry.openable && item.conversation.messages.length > 0
  );
  if (firstWithContent) {
    selectConversation(firstWithContent);
  } else {
    elements.contactAvatar.replaceChildren();
    elements.contactName.textContent = "";
    const empty = document.createElement("li");
    empty.className = "chat-empty-state";
    empty.textContent = "暂无可打开的对话";
    elements.chatMessages.replaceChildren(empty);
  }

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
