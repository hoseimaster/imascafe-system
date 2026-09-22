let activeConfirm = null;
let confirmSequence = 0;

export function showConfirmModal(message, options = {}) {
    const title = options.title || "確認";
    const confirmText = options.confirmText || "実行";
    const cancelText = options.cancelText || "キャンセル";
    const tone = options.tone || (options.danger ? "danger" : "default");
    const operation = options.operation || "general";

    closeActiveConfirm(false);

    return new Promise((resolve) => {
        const previousFocus = document.activeElement;
        const titleId = `customConfirmTitle${++confirmSequence}`;
        const messageId = `customConfirmMessage${confirmSequence}`;
        const overlay = document.createElement("div");

        overlay.className = "custom-confirm-overlay";
        overlay.dataset.operation = operation;
        overlay.innerHTML = `
            <div class="custom-confirm-modal is-${tone}" role="dialog" aria-modal="true" aria-labelledby="${titleId}" aria-describedby="${messageId}">
                <div class="custom-confirm-heading">
                    <span class="custom-confirm-mark" aria-hidden="true"></span>
                    <h2 id="${titleId}" class="custom-confirm-title"></h2>
                </div>
                <p id="${messageId}" class="custom-confirm-message"></p>
                <div class="custom-confirm-actions">
                    <button type="button" class="custom-confirm-button custom-confirm-cancel"></button>
                    <button type="button" class="custom-confirm-button custom-confirm-ok"></button>
                </div>
            </div>
        `;

        const cancelButton = overlay.querySelector(".custom-confirm-cancel");
        const confirmButton = overlay.querySelector(".custom-confirm-ok");
        overlay.querySelector(".custom-confirm-title").textContent = title;
        overlay.querySelector(".custom-confirm-message").textContent = String(message || "");
        cancelButton.textContent = cancelText;
        confirmButton.textContent = confirmText;

        const finish = (result) => {
            if (activeConfirm?.overlay !== overlay) return;
            activeConfirm = null;
            overlay.remove();
            document.body.classList.remove("is-custom-confirm-open");
            if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
                previousFocus.focus();
            }
            resolve(result);
        };

        activeConfirm = { overlay, finish };
        cancelButton.addEventListener("click", () => finish(false));
        confirmButton.addEventListener("click", () => finish(true));
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) finish(false);
        });
        overlay.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                finish(false);
                return;
            }
            if (event.key === "Tab") {
                const focusable = [cancelButton, confirmButton];
                const currentIndex = focusable.indexOf(document.activeElement);
                const nextIndex = event.shiftKey
                    ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
                    : (currentIndex + 1) % focusable.length;
                event.preventDefault();
                focusable[nextIndex].focus();
            }
        });

        document.body.appendChild(overlay);
        document.body.classList.add("is-custom-confirm-open");
        cancelButton.focus();
    });
}

export function confirmOrderCancellation(orderId) {
    return showConfirmModal(
        `注文番号：${orderId}\n\n取消後は売上集計から除外され、使用した在庫が復元されます。`,
        { title: "注文を取り消しますか？", confirmText: "注文を取り消す", tone: "danger", operation: "order-cancel" }
    );
}

export function confirmInventoryAddition({ name, currentQuantity, quantity }) {
    return showConfirmModal(
        `${name}\n現在の在庫：${currentQuantity}個\n入庫する数量：${quantity}個\n入庫後の在庫：${currentQuantity + quantity}個`,
        { title: "在庫を入庫しますか？", confirmText: "入庫する", tone: "stock", operation: "inventory-add" }
    );
}

export function requestInventoryAddition({ name, currentQuantity }) {
    return showInventoryQuantityModal({
        title: "在庫を入庫",
        name,
        currentQuantity,
        initialValue: 1,
        minimum: 1,
        label: "入庫する数量",
        confirmText: "入庫する",
        tone: "stock",
        operation: "inventory-add",
        getAfterQuantity: (quantity) => currentQuantity + quantity
    });
}

export function confirmInventoryCorrection({ name, currentQuantity, quantity }) {
    return showConfirmModal(
        `${name}\n変更前：${currentQuantity}個\n変更後：${quantity}個`,
        { title: "在庫数を修正しますか？", confirmText: "修正する", tone: "warning", operation: "inventory-edit" }
    );
}

export function requestInventoryCorrection({ name, currentQuantity }) {
    return showInventoryQuantityModal({
        title: "在庫数を修正",
        name,
        currentQuantity,
        initialValue: currentQuantity,
        minimum: 0,
        label: "修正後の在庫数",
        confirmText: "修正する",
        tone: "warning",
        operation: "inventory-edit",
        getAfterQuantity: (quantity) => quantity
    });
}

export function confirmProductDeletion(productName) {
    return showConfirmModal(
        `「${productName}」を削除します。\nこの操作は元に戻せません。`,
        { title: "商品を削除しますか？", confirmText: "商品を削除する", tone: "danger", operation: "product-delete" }
    );
}

export function confirmEventDayStatusChange(dateText, nextActive) {
    const action = nextActive ? "有効化" : "無効化";
    return showConfirmModal(
        `${dateText} を${action}します。`,
        { title: `開催日を${action}しますか？`, confirmText: action, tone: nextActive ? "default" : "warning", operation: nextActive ? "event-day-enable" : "event-day-disable" }
    );
}

export function confirmExpenseDeletion() {
    return showConfirmModal(
        "選択した支出記録を削除します。\nこの操作は元に戻せません。",
        { title: "支出を削除しますか？", confirmText: "支出を削除する", tone: "danger", operation: "expense-delete" }
    );
}


export function confirmIncomeDeletion() {
    return showConfirmModal(
        "選択した収入記録を削除します。\nこの操作は元に戻せません。",
        { title: "収入を削除しますか？", confirmText: "収入を削除する", tone: "danger", operation: "income-delete" }
    );
}

export function confirmForceLogout(operatorName = "この端末") {
    return showConfirmModal(
        `${operatorName} を強制ログアウトします。`,
        { title: "強制ログアウトしますか？", confirmText: "強制ログアウト", tone: "danger", operation: "force-logout-terminal" }
    );
}

export function showForceLogoutUnavailable() {
    return showConfirmModal(
        "最高管理者の端末は保護されているため、強制ログアウトの対象にできません。",
        { title: "強制ログアウトできません", confirmText: "閉じる", cancelText: "閉じる", tone: "warning", operation: "force-logout-unavailable" }
    );
}

export function confirmLogout() {
    return showConfirmModal(
        "現在のアカウントからログアウトします。",
        { title: "ログアウトしますか？", confirmText: "ログアウト", tone: "warning", operation: "logout" }
    );
}

export function confirmOrderCountMismatch(drinkCount, dessertCount) {
    return showConfirmModal(
        `ドリンク：${drinkCount}点\nデザート：${dessertCount}点\n\n注文数が一致していません。内容を確認したうえで登録してください。`,
        { title: "数が一致していません", confirmText: "このまま登録する", cancelText: "注文内容に戻る", tone: "warning", operation: "order-count-mismatch" }
    );
}

function closeActiveConfirm(result) {
    activeConfirm?.finish(result);
}

function showInventoryQuantityModal(options) {
    closeActiveConfirm(null);

    return new Promise((resolve) => {
        const previousFocus = document.activeElement;
        const titleId = `customConfirmTitle${++confirmSequence}`;
        const overlay = document.createElement("div");

        overlay.className = "custom-confirm-overlay";
        overlay.dataset.operation = options.operation;
        overlay.innerHTML = `
            <div class="custom-confirm-modal custom-confirm-quantity is-${options.tone}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
                <div class="custom-confirm-heading">
                    <span class="custom-confirm-mark" aria-hidden="true"></span>
                    <h2 id="${titleId}" class="custom-confirm-title"></h2>
                </div>
                <div class="custom-confirm-product"></div>
                <div class="custom-confirm-current"><span>現在の在庫</span><strong></strong></div>
                <label class="custom-confirm-field">
                    <span class="custom-confirm-label"></span>
                    <input class="custom-confirm-input" type="number" inputmode="numeric" step="1">
                </label>
                <p class="custom-confirm-error" role="alert" hidden></p>
                <div class="custom-confirm-after" aria-live="polite"><span>変更後の在庫</span><strong></strong></div>
                <div class="custom-confirm-actions">
                    <button type="button" class="custom-confirm-button custom-confirm-cancel">キャンセル</button>
                    <button type="button" class="custom-confirm-button custom-confirm-ok"></button>
                </div>
            </div>
        `;

        const input = overlay.querySelector(".custom-confirm-input");
        const errorElement = overlay.querySelector(".custom-confirm-error");
        const afterElement = overlay.querySelector(".custom-confirm-after strong");
        const cancelButton = overlay.querySelector(".custom-confirm-cancel");
        const confirmButton = overlay.querySelector(".custom-confirm-ok");

        overlay.querySelector(".custom-confirm-title").textContent = options.title;
        overlay.querySelector(".custom-confirm-product").textContent = options.name;
        overlay.querySelector(".custom-confirm-current strong").textContent = `${options.currentQuantity}個`;
        overlay.querySelector(".custom-confirm-label").textContent = options.label;
        confirmButton.textContent = options.confirmText;
        input.min = String(options.minimum);
        input.value = String(options.initialValue);

        const readQuantity = () => {
            const quantity = Number(input.value);
            return Number.isInteger(quantity) && quantity >= options.minimum ? quantity : null;
        };

        const updatePreview = () => {
            const quantity = readQuantity();
            afterElement.textContent = quantity === null ? "—" : `${options.getAfterQuantity(quantity)}個`;
            errorElement.hidden = true;
            input.removeAttribute("aria-invalid");
        };

        const finish = (result) => {
            if (activeConfirm?.overlay !== overlay) return;
            activeConfirm = null;
            overlay.remove();
            document.body.classList.remove("is-custom-confirm-open");
            if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
            resolve(result);
        };

        const submit = () => {
            const quantity = readQuantity();
            if (quantity === null) {
                errorElement.textContent = `${options.minimum}以上の整数を入力してください。`;
                errorElement.hidden = false;
                input.setAttribute("aria-invalid", "true");
                input.focus();
                return;
            }
            finish(quantity);
        };

        activeConfirm = { overlay, finish };
        input.addEventListener("input", updatePreview);
        cancelButton.addEventListener("click", () => finish(null));
        confirmButton.addEventListener("click", submit);
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) finish(null);
        });
        overlay.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                finish(null);
            } else if (event.key === "Enter") {
                event.preventDefault();
                submit();
            }
        });

        document.body.appendChild(overlay);
        document.body.classList.add("is-custom-confirm-open");
        updatePreview();
        input.focus();
        input.select();
    });
}
