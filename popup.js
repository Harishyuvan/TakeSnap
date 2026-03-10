const captureBtn = document.getElementById("capture");
const retakeBtn = document.getElementById("retake");
const downloadBtn = document.getElementById("download");
const declineBtn = document.getElementById("decline");
const placeholder = document.getElementById("placeholder");
const decision = document.getElementById("decision");
const statusEl = document.getElementById("status");
const historyPreview = document.getElementById("historyPreview");
const historyBadge = document.getElementById("historyBadge");
const previewWrap = document.getElementById("previewWrap");
const shapeButtonsWrap = document.getElementById("shapeButtons");
const cropHint = document.getElementById("cropHint");
const applyCropBtn = document.getElementById("applyCrop");
const clearCropBtn = document.getElementById("clearCrop");
const cropPreviewImg = document.getElementById("cropPreview");

const captureCanvas = document.getElementById("captureCanvas");
const overlayCanvas = document.getElementById("overlayCanvas");
const captureCtx = captureCanvas.getContext("2d");
const overlayCtx = overlayCanvas.getContext("2d");

let currentDataUrl = null;
let originalDataUrl = null;
let capturedImg = null;
let scaleFactor = 1;
let selection = null;
let isDragging = false;
let currentShape = "rectangle";

const setStatus = (msg) => {
  statusEl.textContent = msg || "";
};

const resetSelection = () => {
  selection = null;
  isDragging = false;
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  applyCropBtn.disabled = true;
  clearCropBtn.disabled = true;
  cropHint.textContent = "Drag to create a crop selection.";
};

const resetPreview = () => {
  currentDataUrl = null;
  originalDataUrl = null;
  capturedImg = null;
  selection = null;
  captureCanvas.width = captureCanvas.height = 0;
  overlayCanvas.width = overlayCanvas.height = 0;
  placeholder.style.display = "grid";
  decision.classList.remove("show");
  retakeBtn.disabled = true;
  applyCropBtn.disabled = true;
  clearCropBtn.disabled = true;
  cropPreviewImg.removeAttribute("src");
  cropPreviewImg.style.display = "none";
};

const setShape = (shape) => {
  currentShape = shape;
  [...shapeButtonsWrap.querySelectorAll("button")].forEach((btn) => {
    const active = btn.dataset.shape === shape;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
  if (selection) {
    drawOverlay();
  }
};

const withLoading = async (fn) => {
  captureBtn.disabled = true;
  setStatus("Capturing...");
  try {
    await fn();
  } catch (err) {
    console.error(err);
    setStatus(err?.message || "Something went wrong while capturing.");
  } finally {
    captureBtn.disabled = false;
  }
};

const fitCanvasToImage = () => {
  const wrapWidth = previewWrap.clientWidth;
  if (!capturedImg) return;
  scaleFactor = wrapWidth / capturedImg.width;
  const height = capturedImg.height * scaleFactor;
  captureCanvas.width = wrapWidth;
  captureCanvas.height = height;
  overlayCanvas.width = wrapWidth;
  overlayCanvas.height = height;
};

const drawBaseImage = () => {
  if (!capturedImg) return;
  captureCtx.clearRect(0, 0, captureCanvas.width, captureCanvas.height);
  captureCtx.drawImage(capturedImg, 0, 0, captureCanvas.width, captureCanvas.height);
};

const normalizeSelection = () => {
  if (!selection) return null;
  let { x, y, w, h } = selection;
  if (w < 0) {
    x += w;
    w = Math.abs(w);
  }
  if (h < 0) {
    y += h;
    h = Math.abs(h);
  }
  selection = { x, y, w, h };
  return selection;
};

const enforceShape = (sel) => {
  if (!sel) return sel;
  let { x, y, w, h } = sel;
  if (currentShape === "square" || currentShape === "circle") {
    const size = Math.min(Math.abs(w), Math.abs(h));
    const sx = w < 0 ? -1 : 1;
    const sy = h < 0 ? -1 : 1;
    w = size * sx;
    h = size * sy;
  }
  return { x, y, w, h };
};

const buildShapePath = (ctx, rect) => {
  const { x, y, w, h } = rect;
  const r = Math.min(w, h) / 2;
  ctx.beginPath();
  if (currentShape === "circle") {
    ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
  } else if (currentShape === "triangle") {
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
  } else {
    ctx.rect(x, y, w, h);
  }
};

const drawOverlay = () => {
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  if (!selection) return;
  const rect = normalizeSelection();
  if (!rect || rect.w < 5 || rect.h < 5) return;

  overlayCtx.fillStyle = "rgba(0, 0, 0, 0.35)";
  overlayCtx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  overlayCtx.save();
  overlayCtx.globalCompositeOperation = "destination-out";
  buildShapePath(overlayCtx, rect);
  overlayCtx.fill();
  overlayCtx.restore();

  overlayCtx.save();
  overlayCtx.strokeStyle = "#38bdf8";
  overlayCtx.lineWidth = 2;
  buildShapePath(overlayCtx, rect);
  overlayCtx.stroke();
  overlayCtx.restore();
};

const loadImageToCanvas = async (dataUrl) => {
  placeholder.style.display = "none";
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      capturedImg = img;
      fitCanvasToImage();
      drawBaseImage();
      resetSelection();
      resolve();
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
};

const captureSnap = async () => {
  await withLoading(async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) {
      throw new Error("No active tab found.");
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(activeTab.windowId, {
      format: "png"
    });

    if (!dataUrl) {
      throw new Error("Unable to capture this tab.");
    }

    originalDataUrl = dataUrl;
    currentDataUrl = dataUrl;
    await loadImageToCanvas(dataUrl);
    decision.classList.add("show");
    retakeBtn.disabled = false;
    setStatus("Captured. Drag to crop or download full image.");
  });
};

const toNaturalRect = (rect) => {
  const factor = capturedImg.width / captureCanvas.width;
  return {
    x: rect.x * factor,
    y: rect.y * factor,
    w: rect.w * factor,
    h: rect.h * factor
  };
};

const applyCrop = () => {
  const rect = normalizeSelection();
  if (!rect || rect.w < 5 || rect.h < 5 || !capturedImg) {
    setStatus("Make a selection first.");
    return;
  }
  const natural = toNaturalRect(rect);
  const off = document.createElement("canvas");
  off.width = Math.max(1, Math.round(natural.w));
  off.height = Math.max(1, Math.round(natural.h));
  const ctx = off.getContext("2d");

  ctx.save();
  buildShapePath(ctx, { x: 0, y: 0, w: off.width, h: off.height });
  ctx.clip();
  ctx.drawImage(
    capturedImg,
    natural.x,
    natural.y,
    natural.w,
    natural.h,
    0,
    0,
    off.width,
    off.height
  );
  ctx.restore();

  const dataUrl = off.toDataURL("image/png");
  currentDataUrl = dataUrl;
  cropPreviewImg.src = dataUrl;
  cropPreviewImg.style.display = "block";
  decision.classList.add("show");
  clearCropBtn.disabled = false;
  setStatus("Crop ready. Download when you like.");
};

const clearCrop = () => {
  resetSelection();
  currentDataUrl = originalDataUrl;
  if (currentDataUrl) {
    cropPreviewImg.src = currentDataUrl;
    cropPreviewImg.style.display = "block";
  } else {
    cropPreviewImg.removeAttribute("src");
    cropPreviewImg.style.display = "none";
  }
  setStatus("Crop cleared. Drag again to set a shape.");
};

const downloadSnap = async () => {
  if (!currentDataUrl) return;
  setStatus("Preparing download...");

  const stamp = new Date();
  const filename = `TakeSnap/snap-${stamp.toISOString().replace(/[:.]/g, "-")}.png`;

  try {
    await chrome.downloads.download({
      url: currentDataUrl,
      filename,
      saveAs: true
    });

    await saveToHistory(currentDataUrl, stamp);
    setStatus("Saved to downloads and remembered in the extension.");
  } catch (err) {
    console.error(err);
    setStatus(err?.message || "Download failed.");
  }
};

const saveToHistory = async (dataUrl, stamp) => {
  const existing = (await chrome.storage.local.get("snaps")).snaps || [];
  const next = [
    { id: stamp.getTime(), when: stamp.toISOString(), dataUrl },
    ...existing
  ].slice(0, 5);

  await chrome.storage.local.set({ snaps: next });
  renderHistory(next);
};

const renderHistory = async (snapsFromStorage) => {
  const snaps =
    snapsFromStorage || (await chrome.storage.local.get("snaps")).snaps || [];

  if (!snaps.length) {
    historyPreview.innerHTML = '<p class="hint">No saved snaps yet.</p>';
    historyBadge.textContent = "Empty";
    return;
  }

  const latest = snaps[0];
  historyPreview.innerHTML = `<img src="${latest.dataUrl}" alt="Last snap" />`;
  const when = new Date(latest.when).toLocaleString();
  historyBadge.textContent = `Saved ${when}`;
};

shapeButtonsWrap.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-shape]");
  if (!btn) return;
  setShape(btn.dataset.shape);
  if (selection) {
    selection = enforceShape(selection);
    drawOverlay();
  }
});

overlayCanvas.addEventListener("pointerdown", (e) => {
  if (!capturedImg) return;
  isDragging = true;
  const rect = overlayCanvas.getBoundingClientRect();
  selection = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    w: 0,
    h: 0
  };
  overlayCanvas.setPointerCapture(e.pointerId);
});

overlayCanvas.addEventListener("pointermove", (e) => {
  if (!isDragging || !selection) return;
  const rect = overlayCanvas.getBoundingClientRect();
  const next = {
    x: selection.x,
    y: selection.y,
    w: e.clientX - rect.left - selection.x,
    h: e.clientY - rect.top - selection.y
  };
  selection = enforceShape(next);
  drawOverlay();
  applyCropBtn.disabled = false;
  clearCropBtn.disabled = false;
  cropHint.textContent = `Shape: ${currentShape}. Release to apply or click Apply.`;
});

overlayCanvas.addEventListener("pointerup", (e) => {
  if (!isDragging) return;
  isDragging = false;
  overlayCanvas.releasePointerCapture(e.pointerId);
  drawOverlay();
});

applyCropBtn.addEventListener("click", applyCrop);
clearCropBtn.addEventListener("click", clearCrop);

captureBtn.addEventListener("click", captureSnap);
retakeBtn.addEventListener("click", () => {
  resetPreview();
  setStatus("Retake when ready.");
});
declineBtn.addEventListener("click", () => {
  decision.classList.remove("show");
  setStatus("Decided not to download this snap.");
});
downloadBtn.addEventListener("click", downloadSnap);

renderHistory();
resetPreview();
setShape("rectangle");

