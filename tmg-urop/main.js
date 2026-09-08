// ./web/main.js
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const grid = $("#grid");
  const cards = $$(".card", grid);
  const search = $("#search");
  const shown = $("#shown");
  const empty = $("#empty");
  const tagLabels = $$("#tags .tag");
  const sortBtns = $$("button.sort");
  const dialog = $("#dialog");
  const dImg = $("#dialog-img");
  const dTitle = $("#dialog-title");
  const dBody = $("#dialog-body");

  // precompute searchable text per card
  const text = new Map(cards.map((c) => [c, c.textContent.toLowerCase().replace(/\s+/g, " ")]));
  const tags = new Map(cards.map((c) => [c, new Set(c.dataset.tags.split(" ").filter(Boolean))]));

  // tag filter state: Map tag -> 'checked' | 'invert'
  const tagFilters = new Map();

  // sort state: Map key -> 'desc' | 'asc', insertion order = priority
  const sorts = new Map();
  const ARROW = { desc: "↓", asc: "↑" };
  const SIZE_RANK = { xs: 1, s: 2, m: 3, l: 4, xl: 5 };

  const getVal = (c, k) => {
    if (k === "size") {
      const s = (c.dataset.size || "").trim().toLowerCase();
      return SIZE_RANK[s] || 0;
    }
    return +c.dataset[k] || 0;
  };

  function apply() {
    const q = search.value.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);

    const include = [];
    const exclude = [];
    for (const [tag, state] of tagFilters) {
      if (state === "checked") include.push(tag);
      else if (state === "invert") exclude.push(tag);
    }

    const visible = cards.filter((c) => {
      if (words.length && !words.every((w) => text.get(c).includes(w))) return false;
      const t = tags.get(c);
      if (include.length && !include.every((a) => t.has(a))) return false;
      if (exclude.length && exclude.some((a) => t.has(a))) return false;
      return true;
    });

    const keys = [...sorts];
    if (keys.length) {
      visible.sort((a, b) => {
        for (const [k, dir] of keys) {
          const d = getVal(b, k) - getVal(a, k);
          if (d) return dir === "desc" ? d : -d;
        }
        return +a.dataset.id - +b.dataset.id;
      });
    } else {
      visible.sort((a, b) => +a.dataset.id - +b.dataset.id);
    }

    for (const c of cards) c.hidden = true;
    for (const c of visible) c.hidden = false;
    grid.append(...visible); // reorder in place
    shown.textContent = visible.length;
    empty.hidden = visible.length > 0;
  }

  function renderTags() {
    for (const label of tagLabels) {
      const input = $("input", label);
      const val = input ? input.value : label.textContent.trim();
      const state = tagFilters.get(val);
      if (input) {
        input.checked = state === "checked";
      }
      label.dataset.state = state || "rest";
      label.classList.toggle("checked", state === "checked");
      label.classList.toggle("invert", state === "invert");
    }
  }

  function renderSortButtons() {
    const order = [...sorts.keys()];
    for (const b of sortBtns) {
      const k = b.dataset.key;
      const dir = sorts.get(k);
      b.classList.toggle("on", !!dir);
      b.textContent = dir ? `${k} ${ARROW[dir]}${order.length > 1 ? order.indexOf(k) + 1 : ""}` : k;
    }
  }

  search.addEventListener("input", apply);
  tagLabels.forEach((label) => {
    label.addEventListener("click", (e) => {
      e.preventDefault();
      const input = $("input", label);
      const val = input ? input.value : label.textContent.trim();
      const cur = tagFilters.get(val);
      if (!cur) {
        tagFilters.set(val, "checked");
      } else if (cur === "checked") {
        tagFilters.set(val, "invert");
      } else {
        tagFilters.delete(val);
      }
      renderTags();
      apply();
    });
    label.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        label.click();
      }
    });
  });
  sortBtns.forEach((b) =>
    b.addEventListener("click", () => {
      const k = b.dataset.key;
      const cur = sorts.get(k);
      if (k === "size") {
        // size supports: off -> desc -> asc -> off
        if (!cur) sorts.set(k, "desc");
        else if (cur === "desc") sorts.set(k, "asc");
        else sorts.delete(k);
      } else {
        // other keys (mission, creative) support descending only: off -> desc -> off
        if (!cur) sorts.set(k, "desc");
        else sorts.delete(k);
      }
      renderSortButtons();
      apply();
    }),
  );

  // dialog
  function findCardById(id) {
    if (!id) return null;
    const cleanId = String(id).replace(/^[#]?issue-?/i, "");
    return cards.find((c) => c.dataset.id === cleanId || c.dataset.id === String(id)) || null;
  }

  function getIssueId(anchor) {
    if (!anchor) return null;
    const href = anchor.getAttribute("href") || anchor.href || "";
    const dataUrl = anchor.dataset.url || "";
    const m = (href + " " + dataUrl).match(/(?:^|\/)issues\/(\d+)(?:[/?#]|$)/i);
    if (m) return m[1];
    const hashMatch = href.match(/^#(?:issue-)?(\d+)$/i);
    if (hashMatch) return hashMatch[1];
    if (anchor.classList.contains("issue-link")) {
      const textMatch = anchor.textContent.trim().match(/^#?(\d+)$/);
      if (textMatch) return textMatch[1];
    }
    return null;
  }

  function openIssue(id, pushHash = true) {
    if (!id) return;
    const cleanId = String(id).replace(/^[#]?issue-?/i, "");
    const card = findCardById(cleanId);
    if (card) {
      const img = $("img", card);
      const src = img ? img.getAttribute("src") || img.src || "" : "";
      if (src && !src.endsWith("/") && !src.endsWith("/undefined")) {
        dImg.src = src;
        dImg.alt = img.getAttribute("alt") || $("h2", card)?.textContent || "";
        dImg.hidden = false;
      } else {
        dImg.removeAttribute("src");
        dImg.hidden = true;
      }
      dTitle.textContent = $("h2", card).textContent;
      dBody.replaceChildren(...[...$(".body", card).childNodes].map((n) => n.cloneNode(true)));
    } else {
      dImg.removeAttribute("src");
      dImg.hidden = true;
      dTitle.textContent = `Issue #${cleanId}`;
      dBody.innerHTML = `<p>Issue #${cleanId} is not in the current list.</p><p><a href="https://github.com/chuanqisun/paper-db/issues/${cleanId}" target="_blank" rel="noopener noreferrer">View on GitHub &rarr;</a></p>`;
    }
    if (!dialog.open) {
      dialog.showModal();
    }
    dialog.scrollTop = 0;
    const hash = `#${cleanId}`;
    if (pushHash && location.hash !== hash) {
      history.pushState(null, "", hash);
    }
  }

  function syncFromHash() {
    const raw = location.hash.replace(/^#/, "");
    if (!raw) {
      if (dialog.open) dialog.close();
      return;
    }
    const cleanId = raw.replace(/^[#]?issue-?/i, "");
    openIssue(cleanId, false);
  }

  grid.addEventListener("click", (e) => {
    const anchor = e.target.closest("a");
    if (anchor) {
      const issueId = getIssueId(anchor);
      if (issueId) {
        e.preventDefault();
        e.stopPropagation();
        openIssue(issueId);
        return;
      }
    }
    const card = e.target.closest(".card");
    if (card) openIssue(card.dataset.id);
  });
  grid.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList.contains("card")) openIssue(e.target.dataset.id);
  });
  dialog.addEventListener("click", (e) => {
    const anchor = e.target.closest("a");
    if (anchor) {
      const issueId = getIssueId(anchor);
      if (issueId) {
        e.preventDefault();
        e.stopPropagation();
        openIssue(issueId);
        return;
      }
    }
    if (e.target === dialog) dialog.close(); // backdrop click
  });
  dialog.addEventListener("close", () => {
    if (location.hash) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  });
  window.addEventListener("hashchange", syncFromHash);

  renderSortButtons();
  apply();
  syncFromHash();
})();
