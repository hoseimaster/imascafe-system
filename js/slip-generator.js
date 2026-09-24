import { supabase } from "./supabase.js";

let initialized = false;
let previewCanvas = null;

const CANVAS_WIDTH = 1480;
const CANVAS_HEIGHT = 2800;
const OUTPUT_FILE_NAME = "hoseimaster-cafe-slip.png";

export function initializeSlipGenerator() {
    if (initialized) return;
    initialized = true;

    const button = document.getElementById("settingsSlipGeneratorButton");
    if (!button) return;

    button.addEventListener("click", createSlipPreview);
}

async function createSlipPreview() {
    const button = document.getElementById("settingsSlipGeneratorButton");

    try {
        if (button) button.disabled = true;

        const products = await fetchProducts();
        previewCanvas = await renderSlip(products);
        openPreview(previewCanvas, products.length);
    } catch (error) {
        console.error("伝票データ作成エラー:", error);
        showToast("伝票データを作成できませんでした。", "error");
    } finally {
        if (button) button.disabled = false;
    }
}

async function fetchProducts() {
    const { data, error } = await supabase
        .from("products")
        .select("id,name,category,price,active")
        .eq("active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

    if (error) throw error;

    const categoryOrder = {
        drink: 0,
        dessert: 1,
        other: 2
    };

    return (data || []).sort((a, b) => {
        const categoryDiff =
            categoryOrder[normalizeCategory(a.category)] -
            categoryOrder[normalizeCategory(b.category)];

        if (categoryDiff !== 0) {
            return categoryDiff;
        }

        return String(a.name || "").localeCompare(
            String(b.name || ""),
            "ja"
        );
    });
}

async function renderSlip(products) {
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#000000";
    ctx.fillStyle = "#000000";
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";

    const margin = 52;
    const innerWidth = canvas.width - margin * 2;
    const titleY = 72;
    const titleHeight = 150;
    const infoY = titleY + titleHeight + 24;
    const infoHeight = 155;
    const tableY = infoY + infoHeight + 32;
    const totalHeight = 150;
    const bottomMargin = 58;
    const totalY = canvas.height - bottomMargin - totalHeight;
    const tableHeight = totalY - tableY - 34;

    drawOuterBorder(ctx, margin, 42, innerWidth, canvas.height - 84);

    ctx.textBaseline = "middle";
    const issueYear = new Date().getFullYear();
    ctx.font = '700 72px "Noto Sans JP", "Yu Gothic", sans-serif';
    ctx.fillText(`${issueYear}年法マス喫茶伝票`, margin + 28, titleY + titleHeight / 2);

    drawInfoFields(ctx, margin + 20, infoY, innerWidth - 40, infoHeight);
    const categoryIcons = await loadCategoryIcons();
    drawProductTable(ctx, products, margin + 20, tableY, innerWidth - 40, tableHeight, categoryIcons);
    drawTotal(ctx, margin + 20, totalY, innerWidth - 40, totalHeight);

    return canvas;
}

function drawOuterBorder(ctx, x, y, width, height) {
    ctx.lineWidth = 5;
    ctx.strokeRect(x, y, width, height);
}

function drawInfoFields(ctx, x, y, width, height) {
    const gap = 22;
    const tableWidth = width * 0.24;
    const peopleWidth = width * 0.22;
    const timeWidth = width - tableWidth - peopleWidth - gap * 2;

    drawLabeledBox(ctx, "卓番", x, y, tableWidth, height);
    drawLabeledBox(ctx, "人数", x + tableWidth + gap, y, peopleWidth, height);
    drawLabeledBox(ctx, "来店時間", x + tableWidth + peopleWidth + gap * 2, y, timeWidth, height, true);
}

function drawLabeledBox(ctx, label, x, y, width, height, time = false) {
    ctx.font = '700 38px "Noto Sans JP", "Yu Gothic", sans-serif';
    ctx.fillText(label, x + 8, y + 24);

    const boxY = y + 54;
    const boxHeight = height - 54;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, boxY, width, boxHeight);

    if (time) {
        ctx.font = '700 44px "Noto Sans JP", "Yu Gothic", sans-serif';
        ctx.textAlign = "center";
        ctx.fillText("：", x + width / 2, boxY + boxHeight / 2);
        ctx.textAlign = "left";
    }
}

function drawProductTable(ctx, products, x, y, width, height, categoryIcons) {
    const rows = Math.max(products.length, 1);
    const headerHeight = clamp(height * 0.055, 70, 104);
    const rowHeight = (height - headerHeight) / rows;

    const noWidth = width * 0.075;
    const quantityWidth = width * 0.15;
    const checkWidth = width * 0.13;
    const productWidth = width - noWidth - quantityWidth - checkWidth;

    const xs = [
        x,
        x + noWidth,
        x + noWidth + productWidth,
        x + noWidth + productWidth + quantityWidth,
        x + width
    ];

    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);

    xs.slice(1, -1).forEach((lineX) => {
        line(ctx, lineX, y, lineX, y + height);
    });

    line(ctx, x, y + headerHeight, x + width, y + headerHeight);

    for (let i = 1; i < rows; i += 1) {
        const lineY = y + headerHeight + rowHeight * i;
        line(ctx, x, lineY, x + width, lineY);
    }

    const headerFont = clamp(headerHeight * 0.43, 28, 40);
    ctx.font = `700 ${headerFont}px "Noto Sans JP", "Yu Gothic", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("No.", x + noWidth / 2, y + headerHeight / 2);
    ctx.fillText("商品名", xs[1] + productWidth / 2, y + headerHeight / 2);
    ctx.fillText("数量", xs[2] + quantityWidth / 2, y + headerHeight / 2);
    ctx.fillText("確認", xs[3] + checkWidth / 2, y + headerHeight / 2);

    const rowFont = getRowFontSize(rowHeight, products.length);
    const iconSize = clamp(rowHeight * 0.48, 28, 58);
    const productPadding = clamp(rowHeight * 0.16, 12, 24);

    products.forEach((product, index) => {
        const centerY = y + headerHeight + rowHeight * index + rowHeight / 2;

        ctx.font = `600 ${Math.max(24, rowFont - 3)}px "Noto Sans JP", "Yu Gothic", sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(String(index + 1), x + noWidth / 2, centerY);

        const iconX = xs[1] + productPadding + iconSize / 2;
        drawCategoryIcon(ctx, normalizeCategory(product.category), iconX, centerY, iconSize, categoryIcons);

        const nameX = iconX + iconSize / 2 + productPadding;
        const nameMaxWidth = productWidth - (nameX - xs[1]) - productPadding;
        drawProductNameWithPrice(
            ctx,
            product.name || "",
            Number(product.price || 0),
            nameX,
            centerY,
            nameMaxWidth,
            rowFont
        );

        const checkSize = clamp(rowHeight * 0.42, 26, 54);
        ctx.lineWidth = 3;
        ctx.strokeRect(
            xs[3] + (checkWidth - checkSize) / 2,
            centerY - checkSize / 2,
            checkSize,
            checkSize
        );
    });

    if (!products.length) {
        ctx.font = '500 34px "Noto Sans JP", "Yu Gothic", sans-serif';
        ctx.textAlign = "center";
        ctx.fillText("登録中の商品がありません", x + width / 2, y + headerHeight + rowHeight / 2);
    }

    ctx.textAlign = "left";
}

function drawProductNameWithPrice(ctx, name, price, x, y, maxWidth, preferredSize) {
    let nameSize = preferredSize;
    const minNameSize = 21;
    const priceText = `${price.toLocaleString("ja-JP")}円`;

    while (nameSize > minNameSize) {
        const priceSize = Math.max(18, Math.round(nameSize * 0.68));
        ctx.font = `600 ${nameSize}px "Noto Sans JP", "Yu Gothic", sans-serif`;
        const nameWidth = ctx.measureText(name).width;
        ctx.font = `500 ${priceSize}px "Noto Sans JP", "Yu Gothic", sans-serif`;
        const priceWidth = ctx.measureText(priceText).width;

        if (nameWidth + 18 + priceWidth <= maxWidth) {
            break;
        }
        nameSize -= 1;
    }

    const priceSize = Math.max(18, Math.round(nameSize * 0.68));
    ctx.textAlign = "left";
    ctx.font = `600 ${nameSize}px "Noto Sans JP", "Yu Gothic", sans-serif`;
    ctx.fillText(name, x, y);
    const nameWidth = ctx.measureText(name).width;

    ctx.font = `500 ${priceSize}px "Noto Sans JP", "Yu Gothic", sans-serif`;
    ctx.fillText(priceText, x + nameWidth + 18, y);
}

function getRowFontSize(rowHeight, count) {
    const densityAdjustment = count <= 12 ? 1 : count <= 18 ? 0.94 : count <= 24 ? 0.86 : 0.78;
    return clamp(rowHeight * 0.40 * densityAdjustment, 24, 46);
}

function drawFittedText(ctx, text, x, y, maxWidth, preferredSize) {
    let size = preferredSize;
    const minSize = 21;

    while (size > minSize) {
        ctx.font = `600 ${size}px "Noto Sans JP", "Yu Gothic", sans-serif`;
        if (ctx.measureText(text).width <= maxWidth) break;
        size -= 1;
    }

    ctx.textAlign = "left";
    ctx.fillText(text, x, y, maxWidth);
}

function drawCategoryIcon(ctx, category, cx, cy, size, categoryIcons) {
    const image = categoryIcons[category] || categoryIcons.other;

    if (!image) {
        return;
    }

    ctx.save();
    ctx.filter = "grayscale(1)";
    ctx.drawImage(
        image,
        cx - size / 2,
        cy - size / 2,
        size,
        size
    );
    ctx.restore();
}

async function loadCategoryIcons() {
    const paths = {
        drink: "./asset/logo_13.png",
        dessert: "./asset/logo_14.png",
        other: "./asset/logo_15.png"
    };

    const entries = await Promise.all(
        Object.entries(paths).map(async ([category, path]) => {
            try {
                const image = await loadImage(path);
                return [category, image];
            } catch (error) {
                console.warn(`伝票商品アイコン読込エラー (${path}):`, error);
                return [category, null];
            }
        })
    );

    return Object.fromEntries(entries);
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
    });
}

function normalizeCategory(category) {
    const value = String(category || "").trim().toLowerCase();
    if (["drink", "ドリンク", "飲み物"].includes(value)) return "drink";
    if (["dessert", "デザート", "スイーツ"].includes(value)) return "dessert";
    if (["set", "セット"].includes(value)) return "other";
    return "other";
}

function drawTotal(ctx, x, y, width, height) {
    const labelWidth = width * 0.22;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);
    line(ctx, x + labelWidth, y, x + labelWidth, y + height);

    ctx.font = '700 52px "Noto Sans JP", "Yu Gothic", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("総計", x + labelWidth / 2, y + height / 2);
    ctx.textAlign = "left";
}

function line(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function openPreview(canvas, productCount) {
    closePreview();

    const overlay = document.createElement("div");
    overlay.id = "slipPreviewOverlay";
    overlay.className = "slip-preview-overlay";

    const modal = document.createElement("div");
    modal.className = "slip-preview-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "slipPreviewTitle");

    const header = document.createElement("div");
    header.className = "slip-preview-header";
    header.innerHTML = `
        <div>
            <h2 id="slipPreviewTitle">伝票プレビュー</h2>
            <div class="form-note">${productCount}商品を反映しています</div>
        </div>
        <button type="button" class="slip-preview-close" aria-label="閉じる">×</button>
    `;

    const stage = document.createElement("div");
    stage.className = "slip-preview-stage";

    const image = document.createElement("img");
    image.className = "slip-preview-image";
    image.alt = "伝票プレビュー";
    image.src = canvas.toDataURL("image/png");
    stage.appendChild(image);

    const actions = document.createElement("div");
    actions.className = "slip-preview-actions";
    actions.innerHTML = `
        <button type="button" class="secondary-button" data-slip-close>閉じる</button>
        <button type="button" class="primary-button" data-slip-download>PNG出力</button>
    `;

    modal.append(header, stage, actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    header.querySelector(".slip-preview-close")?.addEventListener("click", closePreview);
    actions.querySelector("[data-slip-close]")?.addEventListener("click", closePreview);
    actions.querySelector("[data-slip-download]")?.addEventListener("click", downloadPreview);

    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) closePreview();
    });
}

function downloadPreview() {
    if (!previewCanvas) return;

    previewCanvas.toBlob((blob) => {
        if (!blob) {
            showToast("PNGを作成できませんでした。", "error");
            return;
        }

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = OUTPUT_FILE_NAME;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast("伝票PNGを出力しました。", "success");
    }, "image/png");
}

function closePreview() {
    const overlay = document.getElementById("slipPreviewOverlay");
    if (!overlay) return;

    const active = document.activeElement;
    if (active && overlay.contains(active) && typeof active.blur === "function") {
        active.blur();
    }

    overlay.remove();
}

function showToast(message, type = "success") {
    const toast = document.getElementById("toast");
    if (!toast) return;

    toast.textContent = message;
    toast.hidden = false;
    toast.classList.remove("success", "error", "is-success", "is-error");
    toast.classList.add(type === "error" ? "error" : "success");

    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
        toast.hidden = true;
    }, 2600);
}
