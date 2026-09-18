import { supabase } from "./supabase.js";

import {
    getOperatorName,
    getTerminalId,
    canManageInventory
} from "./auth.js";


let initialized = false;
let inventoryLoading = false;


/* ========================================
   初期化
======================================== */

export function initializeInventory() {

    if (initialized) {
        return;
    }

    initialized = true;

    setupInventoryEvents();
    setupScreenChangeEvent();

    loadInventory();
}


/* ========================================
   画面切替
======================================== */

function setupScreenChangeEvent() {

    document.addEventListener(
        "app:screenchange",
        (event) => {

            if (
                event.detail?.screen ===
                "inventoryScreen"
            ) {

                loadInventory();

            }

        }
    );
}


/* ========================================
   イベント
======================================== */

function setupInventoryEvents() {

    document.addEventListener(
        "click",
        handleInventoryClick
    );
}


function handleInventoryClick(event) {

    const target =
        event.target instanceof Element
            ? event.target
            : null;


    if (!target) {
        return;
    }


    const addButton =
        target.closest(
            "[data-add-inventory]"
        );


    if (addButton) {

        event.preventDefault();

        if (!canManageInventory()) {

            showToast(
                "在庫を変更する権限がありません。"
            );

            return;
        }


        const productId =
            addButton.dataset.addInventory;


        if (!productId) {
            return;
        }


        openInventoryAdd(
            productId
        );

        return;
    }


    const editButton =
        target.closest(
            "[data-edit-inventory]"
        );


    if (editButton) {

        event.preventDefault();

        if (!canManageInventory()) {

            showToast(
                "在庫を変更する権限がありません。"
            );

            return;
        }


        const productId =
            editButton.dataset.editInventory;


        if (!productId) {
            return;
        }


        openInventoryEdit(
            productId
        );

    }
}


/* ========================================
   在庫取得
======================================== */

export async function loadInventory() {

    if (inventoryLoading) {
        return;
    }


    inventoryLoading = true;


    const container =
        document.getElementById(
            "inventoryList"
        );


    if (!container) {

        inventoryLoading = false;

        return;
    }


    try {

        const {
            data,
            error
        } = await supabase
            .from("inventory_status")
            .select("*")
            .order(
                "name",
                {
                    ascending: true
                }
            );


        if (error) {

            console.error(
                "在庫取得エラー:",
                error
            );


            container.innerHTML = `
                <div class="empty-state">
                    在庫データを取得できませんでした
                </div>
            `;

            return;
        }


        renderInventory(
            data || []
        );

    } finally {

        inventoryLoading = false;

    }
}


/* ========================================
   在庫表示
======================================== */

function renderInventory(rows) {

    const container =
        document.getElementById(
            "inventoryList"
        );


    if (!container) {
        return;
    }


    if (!rows.length) {

        container.innerHTML = `
            <div class="empty-state">
                商品が登録されていません
            </div>
        `;

        return;
    }


    const canManage =
        canManageInventory();


    const categoryOrder = [
        "drink",
        "dessert",
        "other"
    ];


    const categoryLabels = {

        drink:
            "ドリンク",

        dessert:
            "デザート",

        other:
            "その他"

    };


    const grouped = {

        drink: [],
        dessert: [],
        other: []

    };


    rows.forEach(
        (row) => {

            const category =
                normalizeCategory(
                    row.category
                );


            if (
                grouped[category]
            ) {

                grouped[category].push(
                    row
                );

            } else {

                grouped.other.push(
                    row
                );

            }

        }
    );


    const sections =
        categoryOrder
            .map(
                (category) => {

                    const categoryRows =
                        grouped[category];


                    if (
                        !categoryRows.length
                    ) {

                        return "";

                    }


                    return `
                        <section
                            class="
                                inventory-category
                                inventory-category-${category}
                            "
                        >

                            <h3
                                class="inventory-category-title"
                            >
                                ${categoryLabels[category]}
                            </h3>


                            <div
                                class="inventory-category-list"
                            >
                                ${categoryRows
                                    .map(
                                        (row) =>
                                            renderInventoryItem(
                                                row,
                                                canManage
                                            )
                                    )
                                    .join("")
                                }
                            </div>

                        </section>
                    `;

                }
            )
            .join("");


    container.innerHTML =
        sections ||
        `
            <div class="empty-state">
                商品が登録されていません
            </div>
        `;
}


/* ========================================
   商品1件表示
======================================== */

function renderInventoryItem(
    row,
    canManage
) {

    const quantity =
        Number(
            row.quantity
        ) || 0;


    const providedQuantity =
        Number(
            row.provided_quantity
        ) || 1;


    const lowStockThreshold =
        getLowStockThreshold(
            row.low_stock_threshold
        );


    const stockClass =
        getStockClass(
            quantity,
            lowStockThreshold
        );


    const soldOut =
        quantity <= 0;

    const category =
        normalizeCategory(
            row.category
        );

    const categoryIcon =
        getCategoryIcon(
            category
        );


    const lowStock =
        !soldOut &&
        lowStockThreshold > 0 &&
        quantity <= lowStockThreshold;


    return `
        <div
            class="
                inventory-item
                ${soldOut ? "is-sold-out" : ""}
                ${lowStock ? "is-low-stock" : ""}
            "
            data-category="${escapeHtml(category)}"
        >

            <div
                class="inventory-item-main"
                style="
                    min-width:0;
                    flex:1;
                "
            >

                <div class="inventory-item-title-row">
                    <img
                        class="product-category-icon"
                        src="${categoryIcon}"
                        alt=""
                        aria-hidden="true"
                    >

                    <div
                        class="inventory-item-name"
                    >
                    ${escapeHtml(
                        row.name
                    )}
                    </div>
                </div>


                <div
                    class="inventory-item-provided"
                    style="
                        color:var(--text-secondary);
                        font-size:12px;
                        margin-top:3px;
                    "
                >
                    1注文あたり
                    ${formatNumber(
                        providedQuantity
                    )}個消費
                </div>


                ${
                    soldOut
                        ? `
                            <div
                                class="inventory-item-sold-out"
                                style="
                                    color:#d98b8b;
                                    font-size:12px;
                                    font-weight:700;
                                    margin-top:3px;
                                "
                            >
                                売り切れ
                            </div>
                        `
                        : lowStock
                            ? `
                                <div
                                    class="inventory-item-low-stock"
                                    style="
                                        color:#e6a04f;
                                        font-size:12px;
                                        font-weight:700;
                                        margin-top:3px;
                                    "
                                >
                                    在庫少
                                </div>
                            `
                            : ""
                }

            </div>


            <div
                class="inventory-item-actions"
                style="
                    display:flex;
                    align-items:center;
                    gap:8px;
                    flex-shrink:0;
                "
            >

                <div
                    class="
                        inventory-item-stock
                        ${stockClass}
                    "
                >
                    ${formatNumber(
                        quantity
                    )}
                </div>


                ${
                    canManage
                        ? `
                            <button
                                type="button"
                                class="button button-secondary"
                                data-add-inventory="${escapeHtml(
                                    row.product_id
                                )}"
                            >
                                入庫
                            </button>

                            <button
                                type="button"
                                class="button button-secondary"
                                data-edit-inventory="${escapeHtml(
                                    row.product_id
                                )}"
                            >
                                修正
                            </button>
                        `
                        : ""
                }

            </div>

        </div>
    `;
}


/* ========================================
   在庫少アラート閾値
======================================== */

function getLowStockThreshold(
    value
) {

    const threshold =
        Number(value);


    if (
        !Number.isInteger(
            threshold
        ) ||
        threshold < 0
    ) {

        return 0;

    }


    return threshold;
}


/* ========================================
   カテゴリ
======================================== */

function normalizeCategory(
    category
) {

    const value =
        String(
            category ?? ""
        )
            .trim()
            .toLowerCase();


    if (
        value === "drink" ||
        value === "drinks" ||
        value === "飲み物" ||
        value === "ドリンク"
    ) {

        return "drink";

    }


    if (
        value === "dessert" ||
        value === "デザート" ||
        value === "food" ||
        value === "フード" ||
        value === "料理"
    ) {

        return "dessert";

    }


    if (
        value === "set" ||
        value === "セット"
    ) {
        return "other";
    }


    if (
        value === "other" ||
        value === "その他"
    ) {

        return "other";

    }


    return "other";
}


function getCategoryIcon(
    category
) {
    if (category === "drink") {
        return "./logo_13.png";
    }

    if (category === "dessert") {
        return "./logo_14.png";
    }

    return "./logo_15.png";
}


/* ========================================
   在庫状態
======================================== */

function getStockClass(
    quantity,
    lowStockThreshold
) {

    if (
        quantity <= 0
    ) {

        return "sold-out";

    }


    if (
        lowStockThreshold > 0 &&
        quantity <= lowStockThreshold
    ) {

        return "low";

    }


    return "normal";
}


/* ========================================
   入庫入力
======================================== */

function openInventoryAdd(
    productId
) {

    if (!canManageInventory()) {

        showToast(
            "在庫を変更する権限がありません。"
        );

        return;
    }


    const quantityText =
        window.prompt(
            "追加する数量を入力してください",
            "1"
        );


    if (
        quantityText === null
    ) {

        return;

    }


    const quantity =
        Number(
            quantityText
        );


    if (
        !Number.isInteger(
            quantity
        ) ||
        quantity <= 0
    ) {

        showToast(
            "1以上の整数を入力してください。"
        );

        return;
    }


    addInventory(
        productId,
        quantity
    );
}


/* ========================================
   在庫追加
======================================== */

async function addInventory(
    productId,
    quantity
) {

    if (!canManageInventory()) {

        showToast(
            "在庫を変更する権限がありません。"
        );

        return;
    }


    const {
        error
    } = await supabase.rpc(
        "add_inventory",
        {
            p_product_id:
                productId,

            p_quantity:
                quantity,

            p_operator_name:
                getOperatorName(),

            p_terminal:
                getTerminalId()
        }
    );


    if (error) {

        console.error(
            "在庫追加エラー:",
            error
        );


        showToast(
            getErrorMessage(
                error
            )
        );

        return;
    }


    showToast(
        "在庫を追加しました。"
    );


    await loadInventory();
}


/* ========================================
   在庫修正入力
======================================== */

async function openInventoryEdit(
    productId
) {

    if (!canManageInventory()) {

        showToast(
            "在庫を変更する権限がありません。"
        );

        return;
    }


    const {
        data,
        error
    } = await supabase
        .from("inventory_status")
        .select(
            "product_id,name,quantity"
        )
        .eq(
            "product_id",
            productId
        )
        .maybeSingle();


    if (error) {

        console.error(
            "在庫確認エラー:",
            error
        );


        showToast(
            "現在の在庫数を取得できませんでした。"
        );

        return;
    }


    if (!data) {

        showToast(
            "在庫データが見つかりません。"
        );

        return;
    }


    const currentQuantity =
        Number(
            data.quantity
        ) || 0;


    const quantityText =
        window.prompt(
            `${data.name}の在庫数を修正してください`,
            String(
                currentQuantity
            )
        );


    if (
        quantityText === null
    ) {

        return;

    }


    const quantity =
        Number(
            quantityText
        );


    if (
        !Number.isInteger(
            quantity
        ) ||
        quantity < 0
    ) {

        showToast(
            "0以上の整数を入力してください。"
        );

        return;
    }


    await updateInventory(
        productId,
        quantity,
        currentQuantity
    );
}


/* ========================================
   在庫修正
======================================== */

async function updateInventory(
    productId,
    quantity,
    currentQuantity
) {

    if (!canManageInventory()) {

        showToast(
            "在庫を変更する権限がありません。"
        );

        return;
    }


    if (
        quantity ===
        currentQuantity
    ) {

        showToast(
            "在庫数に変更はありません。"
        );

        return;
    }


    const {
        error
    } = await supabase.rpc(
        "update_inventory",
        {
            p_product_id:
                productId,

            p_quantity:
                quantity,

            p_operator_name:
                getOperatorName(),

            p_terminal:
                getTerminalId()
        }
    );


    if (error) {

        console.error(
            "在庫修正エラー:",
            error
        );


        showToast(
            getErrorMessage(
                error
            )
        );

        return;
    }


    showToast(
        "在庫数を修正しました。"
    );


    await loadInventory();
}


/* ========================================
   手動更新
======================================== */

export function refreshInventory() {

    return loadInventory();

}


/* ========================================
   数値
======================================== */

function formatNumber(
    value
) {

    const number =
        Number(value) || 0;


    return number.toLocaleString(
        "ja-JP"
    );
}


/* ========================================
   エラー
======================================== */

function getErrorMessage(
    error
) {

    const message =
        error?.message || "";


    const lowerMessage =
        message.toLowerCase();


    if (
        lowerMessage.includes(
            "permission"
        ) ||
        lowerMessage.includes(
            "not authorized"
        ) ||
        lowerMessage.includes(
            "forbidden"
        ) ||
        message.includes(
            "権限"
        )
    ) {

        return (
            "この操作を実行する権限がありません。"
        );
    }


    if (
        lowerMessage.includes(
            "inventory"
        )
    ) {

        return (
            "在庫の更新に失敗しました。"
        );
    }


    return (
        message ||
        "在庫の更新に失敗しました。"
    );
}


/* ========================================
   トースト
======================================== */

function showToast(
    message
) {

    const toast =
        document.getElementById(
            "toast"
        );


    if (!toast) {
        return;
    }


    toast.textContent =
        message;


    toast.hidden = false;


    toast.classList.add(
        "is-visible"
    );


    clearTimeout(
        showToast.timer
    );


    showToast.timer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "is-visible"
                );

            },
            3000
        );
}


/* ========================================
   HTMLエスケープ
======================================== */

function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}
