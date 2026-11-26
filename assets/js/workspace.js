function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateItems(items, path = "items") {
  if (!Array.isArray(items)) {
    throw new Error(`空间数据格式无效：${path} 必须是数组。`);
  }

  items.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!item || !isNonEmptyString(item.id)) {
      throw new Error(`空间数据格式无效：${itemPath} 缺少有效 id。`);
    }

    if (item.type === "folder") {
      if (!isNonEmptyString(item.name)) {
        throw new Error(`空间数据格式无效：${itemPath} 缺少文件夹名称。`);
      }
      validateItems(item.items, `${itemPath}.items`);
      return;
    }

    if (
      item.type !== "file" ||
      !isNonEmptyString(item.title) ||
      !["document", "spreadsheet", "pdf"].includes(item.fileType) ||
      typeof item.openable !== "boolean" ||
      typeof item.shared !== "boolean" ||
      !isNonEmptyString(item.creator) ||
      (item.openable && !item.passwordHint &&
        (!isSafeWorkspacePath(item.path) ||
          (item.fileType === "spreadsheet" && !isSafeWorkspacePath(item.previewPath)) ||
          (item.fileType === "pdf" && !item.path.toLowerCase().endsWith(".pdf")))) ||
      ((item.passwordHint !== undefined || item.target !== undefined) &&
        (!isNonEmptyString(item.passwordHint) ||
          typeof item.target !== "string" ||
          !/^[\w-]+(?:\/[\w-]+)*\.html$/.test(item.target)))
    ) {
      throw new Error(`空间数据格式无效：${itemPath} 文件信息不完整。`);
    }
  });
}

function isSafeWorkspacePath(path) {
  return typeof path === "string" &&
    path.length > 0 &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    path.split("/").every((part) => part && part !== "." && part !== "..");
}

async function loadWorkspace(directory) {
  const url = new URL(
    `../../data/${encodeURIComponent(directory)}/workspace/workspace.json`,
    import.meta.url
  );
  const response = await fetch(url);
  if (response.status === 404) return [];
  if (!response.ok) {
    throw new Error(`无法读取空间文件（HTTP ${response.status}）。`);
  }

  const workspace = await response.json();
  validateItems(workspace?.items);
  return workspace.items;
}

function createIconAsset(filename, iconId, className) {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.classList.add(...className.split(" "));
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");

  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `./assets/icons/${filename}.svg#${iconId}`);
  icon.append(use);
  return icon;
}

function createFolderIcon(item) {
  if (item.id === "recycle-bin" || item.name === "回收站") {
    return createIconAsset("folder-trash_bin", "icon-folder-trash-bin", "workspace-folder-icon");
  }

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M3 5h7l2 2h9v12H3zM3 9h18");
  icon.append(path);
  return icon;
}

function createFileIcon(fileType) {
  const isSpreadsheet = fileType === "spreadsheet";
  return createIconAsset(
    isSpreadsheet ? "file-sheet" : "file-text",
    isSpreadsheet ? "icon-file-sheet" : "icon-file-text",
    `workspace-file-icon workspace-file-icon--${fileType}`
  );
}

function getFiles(items) {
  return items.flatMap((item) =>
    item.type === "file" ? [item] : getFiles(item.items)
  );
}

function renderRecentFiles(container, items, onSelect) {
  container.replaceChildren();
  const files = getFiles(items).slice(0, 2);

  if (files.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "暂无文件";
    container.append(empty);
    return;
  }

  files.forEach((file) => {
    const item = document.createElement("li");
    const card = document.createElement("button");
    card.className = "recent-file";
    card.type = "button";
    card.append(createFileIcon(file.fileType));
    const title = document.createElement("span");
    title.className = "recent-file-title";
    title.textContent = file.title;
    title.title = file.title;
    card.dataset.itemId = file.id;
    card.append(title);
    card.addEventListener("click", () => onSelect?.(file.id));
    item.append(card);
    container.append(item);
  });
}

function openWorkspaceFile(directory, item) {
  const target = item.fileType === "spreadsheet" ? item.previewPath : item.path;
  const encodedPath = target.split("/").map(encodeURIComponent).join("/");
  window.open(
    new URL(`../../data/${encodeURIComponent(directory)}/workspace/${encodedPath}`, import.meta.url).href,
    "_blank",
    "noopener,noreferrer"
  );
}

function createWorkspaceItem(item, onOpenFolder, onOpenProtectedFile, directory) {
  const button = document.createElement("button");
  button.className = `workspace-item ${item.type}-item`;
  button.type = "button";

  const icon = item.type === "folder" ? createFolderIcon(item) : createFileIcon(item.fileType);
  const details = document.createElement("span");
  details.className = "workspace-item-details";
  const title = document.createElement("span");
  title.className = "workspace-item-title";
  title.textContent = item.type === "folder" ? item.name : item.title;
  details.append(title);

  if (item.type === "file") {
    const creator = document.createElement("span");
    creator.className = "workspace-item-creator";
    creator.textContent = `创建者：${item.creator}`;
    details.append(creator);
    button.dataset.itemId = item.id;
    if (item.passwordHint) {
      button.setAttribute("aria-label", `输入密码以打开文件：${item.title}`);
      button.addEventListener("click", () => onOpenProtectedFile(item));
    } else if (item.openable) {
      button.setAttribute("aria-label", `在新标签页预览文件：${item.title}`);
      button.addEventListener("click", () => openWorkspaceFile(directory, item));
    } else {
      button.setAttribute("aria-disabled", "true");
    }
  } else {
    button.addEventListener("click", () => onOpenFolder(item));
    button.setAttribute("aria-label", `打开文件夹：${item.name}`);
  }

  button.append(icon, details);
  return button;
}

function getYesterdayPassword() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const month = String(yesterday.getMonth() + 1).padStart(2, "0");
  const day = String(yesterday.getDate()).padStart(2, "0");
  return `${month}${day}`;
}

function createPasswordPrompt(dialog) {
  const form = dialog.querySelector("#workspace-password-form");
  const hint = dialog.querySelector("#workspace-password-hint");
  const input = dialog.querySelector("#workspace-password-input");
  const error = dialog.querySelector("#workspace-password-error");
  const cancel = dialog.querySelector("#workspace-password-cancel");
  let expectedPassword = "";
  let target = "";

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (input.value !== expectedPassword) {
      error.hidden = false;
      input.select();
      return;
    }

    dialog.close();
    window.location.assign(new URL(`../../${target}`, import.meta.url));
  });

  cancel.addEventListener("click", () => dialog.close());

  return (item) => {
    expectedPassword = getYesterdayPassword();
    target = item.target;
    hint.textContent = `密码提示：${item.passwordHint}`;
    input.value = "";
    error.hidden = true;
    dialog.showModal();
    input.focus();
  };
}

function createBreadcrumb(label, onClick, current = false) {
  const button = document.createElement("button");
  button.className = "workspace-breadcrumb";
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  if (current) button.setAttribute("aria-current", "page");
  return button;
}

export async function initializeWorkspace(
  directory,
  breadcrumbs,
  container,
  recentFiles,
  onSelectRecentFile,
  passwordDialog
) {
  const rootItems = await loadWorkspace(directory);
  renderRecentFiles(recentFiles, rootItems, onSelectRecentFile);
  const openProtectedFile = createPasswordPrompt(passwordDialog);
  const path = [];

  function render() {
    breadcrumbs.replaceChildren();
    const rootCrumb = createBreadcrumb("我的空间", () => {
      path.length = 0;
      render();
    }, path.length === 0);
    breadcrumbs.append(rootCrumb);

    path.forEach((folder, index) => {
      const separator = document.createElement("span");
      separator.className = "workspace-breadcrumb-separator";
      separator.setAttribute("aria-hidden", "true");
      separator.textContent = "/";
      breadcrumbs.append(separator);
      breadcrumbs.append(createBreadcrumb(
        folder.name,
        () => {
          path.length = index + 1;
          render();
        },
        index === path.length - 1
      ));
    });

    const items = path.length > 0 ? path[path.length - 1].items : rootItems;
    container.replaceChildren();
    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "workspace-empty-state";
      empty.textContent = "暂无文件";
      container.append(empty);
      return;
    }

    const grid = document.createElement("div");
    grid.className = "workspace-grid";
    items.forEach((item) => {
      grid.append(createWorkspaceItem(
        item,
        (folder) => {
          path.push(folder);
          render();
        },
        openProtectedFile,
        directory
      ));
    });
    container.append(grid);
  }

  function findFolderPath(items, id, ancestors = []) {
    for (const item of items) {
      if (item.id === id) return ancestors;
      if (item.type === "folder") {
        const result = findFolderPath(item.items, id, [...ancestors, item]);
        if (result) return result;
      }
    }
    return null;
  }

  function navigateToItem(id) {
    const ancestors = findFolderPath(rootItems, id);
    if (!ancestors) return false;

    path.splice(0, path.length, ...ancestors);
    render();
    requestAnimationFrame(() => {
      const target = Array.from(container.querySelectorAll("[data-item-id]"))
        .find((item) => item.dataset.itemId === id);
      if (!target) return;
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      target.focus({ preventScroll: true });
      target.classList.add("is-targeted");
      window.setTimeout(() => target.classList.remove("is-targeted"), 1800);
    });
    return true;
  }

  render();
  return navigateToItem;
}
