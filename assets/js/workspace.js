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
      !isNonEmptyString(item.fileType) ||
      typeof item.openable !== "boolean" ||
      typeof item.shared !== "boolean" ||
      !isNonEmptyString(item.creator)
    ) {
      throw new Error(`空间数据格式无效：${itemPath} 文件信息不完整。`);
    }
  });
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

function createFolderIcon() {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M3 6.5A1.5 1.5 0 0 1 4.5 5h5l2 2h8A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z");
  icon.append(path);
  return icon;
}

function createFileIcon(fileType) {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.classList.add("workspace-file-icon", `workspace-file-icon--${fileType}`);
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const iconPath = fileType === "spreadsheet"
    ? "M6 3.5h8l4 4v13H6zM14 3.5v5h5M9 12h6M9 15h6M9 18h6M12 12v6M15 12v6"
    : "M6 3.5h8l4 4v13H6zM14 3.5v5h5M9 13h6m-6 3h6";
  path.setAttribute("d", iconPath);
  icon.append(path);
  return icon;
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

function createWorkspaceItem(item, onOpenFolder) {
  const button = document.createElement("button");
  button.className = `workspace-item ${item.type}-item`;
  button.type = "button";

  const icon = item.type === "folder" ? createFolderIcon() : createFileIcon(item.fileType);
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
    button.setAttribute("aria-disabled", "true");
  } else {
    button.addEventListener("click", () => onOpenFolder(item));
    button.setAttribute("aria-label", `打开文件夹：${item.name}`);
  }

  button.append(icon, details);
  return button;
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
  onSelectRecentFile
) {
  const rootItems = await loadWorkspace(directory);
  renderRecentFiles(recentFiles, rootItems, onSelectRecentFile);
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
      grid.append(createWorkspaceItem(item, (folder) => {
        path.push(folder);
        render();
      }));
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
