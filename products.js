import { supabase } from "./supabase.js";

import {
    isAdmin,
    getOperatorName,
    getTerminalId
} from "./auth.js";

import { confirmProductDeletion } from "./confirm-modal.js";


let initialized = false;
let productsLoading = false;
let products = [];


/* ========================================
   初期化
======================================== */

export function initializeProducts() {

    if (initialized) {
        return;
    }

    initialized = true;

    setupProductEvents();
    setupScreenChangeEvent();
    removeSetCategoryOption();

    loadProducts();
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
                "productSettingsScreen"
            ) {

                loadProducts();

            }

        }
    );
}


/* ========================================
   商品取得
======================================== */

export async function loadProducts() {

    if (productsLoading) {
        return;
    }

    productsLoading = true;

    try {

        const {
            data,
            error
        } = await supabase
            .from("products")
            .select(`
                id,
                name,
                category,
                price,
                provided_quantity,
                low_stock_threshold,
                active,
                created_at,
                updated_at
            `)
            .order(
                "category",
                {
                    ascending: true
                }
            )
            .order(
                "name",
                {
                    ascending: true
                }
            );

        if (error) {

            console.error(
                "商品取得エラー:",
                error
            );

            showToast(
                getErrorMessage(
                    error
                )
            );

            return;
        }

        products =
            data || [];

        renderProducts();

    } finally {

        productsLoading = false;

    }
}


/* ========================================
   商品表示
======================================== */

function renderProducts() {

    const container =
        document.getElementById(
            "productSettingsList"
        );


    if (!container) {
        return;
    }


    if (!isAdmin()) {

        container.innerHTML = `
            <div class="empty-state">
                商品設定は管理者のみ利用できます。
            </div>
        `;

        return;
    }


    if (!products.length) {

        container.innerHTML = `
            <div class="empty-state">
                <strong>商品が登録されていません</strong>
                <span>商品を追加して登録してください。</span>
            </div>
        `;

        return;
    }


    const groupedProducts =
        groupProductsByCategory();


    container.innerHTML =
        Object.entries(
            groupedProducts
        )
        .map(
            ([category, categoryProducts]) =>
                renderCategory(
                    category,
                    categoryProducts
                )
        )
        .join("");
}


/* ========================================
   カテゴリ別表示
======================================== */

function groupProductsByCategory() {

    const groups = {};


    products.forEach(
        (product) => {

            const category =
                normalizeCategory(
                    product.category
                ) || "other";


            if (!groups[category]) {
                groups[category] = [];
            }


            groups[category].push(
                product
            );

        }
    );


    const categoryOrder = [
        "drink",
        "dessert",
        "other"
    ];


    const orderedGroups = {};


    categoryOrder.forEach(
        (category) => {

            if (
                groups[category]
            ) {

                orderedGroups[category] =
                    groups[category];

            }

        }
    );


    Object.entries(
        groups
    ).forEach(
        ([category, categoryProducts]) => {

            if (
                !orderedGroups[category]
            ) {

                orderedGroups[category] =
                    categoryProducts;

            }

        }
    );


    return orderedGroups;
}


function renderCategory(
    category,
    categoryProducts
) {

    return `
        <section class="product-category-section">

            <div class="product-category-header">

                <div>

                    <h2>
                        ${escapeHtml(
                            getCategoryLabel(
                                category
                            )
                        )}
                    </h2>

                    <span>
                        ${categoryProducts.length}商品
                    </span>

                </div>

            </div>


            <div class="product-management-list">

                ${categoryProducts
                    .map(
                        (product) =>
                            renderProductItem(
                                product
                            )
                    )
                    .join("")}

            </div>

        </section>
    `;
}


/* ========================================
   商品項目
======================================== */

function renderProductItem(
    product
) {

    const active =
        Boolean(
            product.active
        );

    const category =
        normalizeCategory(
            product.category
        ) || "other";

    const categoryIcon =
        getCategoryIcon(
            category
        );


    const providedQuantity =
        getProvidedQuantity(
            product.provided_quantity
        );


    const lowStockThreshold =
        getLowStockThreshold(
            product.low_stock_threshold
        );


    return `
        <article
            class="product-management-item ${
                active
                    ? ""
                    : "is-inactive"
            }"
            data-product-id="${escapeHtml(
                product.id
            )}"
            data-category="${escapeHtml(category)}"
        >

            <div class="product-management-main">

                <div class="product-management-title-row">
                    <img
                        class="product-category-icon"
                        src="${categoryIcon}"
                        alt=""
                        aria-hidden="true"
                    >
                    <div class="product-management-name">
                    ${escapeHtml(
                        product.name
                    )}
                    </div>
                </div>


                <div class="product-management-meta">

                    <span>
                        ${formatYen(
                            product.price
                        )}
                    </span>

                    <span>
                        提供個数 ${formatNumber(
                            providedQuantity
                        )}個
                    </span>

                    <span>
                        在庫少 ${formatNumber(
                            lowStockThreshold
                        )}個
                    </span>

                    <span
                        class="product-management-status ${
                            active
                                ? "is-active"
                                : "is-stopped"
                        }"
                    >
                        ${
                            active
                                ? "販売中"
                                : "販売停止"
                        }
                    </span>

                </div>

            </div>


            <div class="product-management-actions">

                <button
                    type="button"
                    class="button button-secondary"
                    data-product-edit="${escapeHtml(
                        product.id
                    )}"
                >
                    編集
                </button>


                <button
                    type="button"
                    class="button ${
                        active
                            ? "button-danger"
                            : "button-secondary"
                    }"
                    data-product-toggle="${escapeHtml(
                        product.id
                    )}"
                >
                    ${
                        active
                            ? "販売停止"
                            : "販売再開"
                    }
                </button>


                <button
                    type="button"
                    class="button button-danger"
                    data-product-delete="${escapeHtml(
                        product.id
                    )}"
                >
                    削除
                </button>

            </div>

        </article>
    `;
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


function removeSetCategoryOption() {
    const select =
        document.getElementById(
            "productCategory"
        );

    if (!select) {
        return;
    }

    Array.from(
        select.options
    ).forEach(
        (option) => {
            const value =
                String(
                    option.value || ""
                )
                    .trim()
                    .toLowerCase();

            if (
                value === "set" ||
                option.textContent?.trim() === "セット"
            ) {
                option.remove();
            }
        }
    );
}


/* ========================================
   イベント
======================================== */

function setupProductEvents() {

    document.addEventListener(
        "click",
        (event) => {

            const target =
                event.target instanceof Element
                    ? event.target
                    : null;


            if (!target) {
                return;
            }


            const addButton =
                target.closest(
                    "#addProductButton"
                );


            if (addButton) {

                event.preventDefault();

                if (!isAdmin()) {

                    showToast(
                        "商品を登録する権限がありません。"
                    );

                    return;
                }


                openProductCreate();

                return;
            }


            const editButton =
                target.closest(
                    "[data-product-edit]"
                );


            if (editButton) {

                event.preventDefault();

                if (!isAdmin()) {

                    showToast(
                        "商品を編集する権限がありません。"
                    );

                    return;
                }


                const id =
                    editButton.dataset
                        .productEdit;


                if (!id) {
                    return;
                }


                openProductEdit(
                    id
                );

                return;
            }


            const toggleButton =
                target.closest(
                    "[data-product-toggle]"
                );


            if (toggleButton) {

                event.preventDefault();

                if (!isAdmin()) {

                    showToast(
                        "商品を変更する権限がありません。"
                    );

                    return;
                }


                const id =
                    toggleButton.dataset
                        .productToggle;


                if (!id) {
                    return;
                }


                toggleProduct(
                    id
                );

                return;
            }


            const deleteButton =
                target.closest(
                    "[data-product-delete]"
                );


            if (deleteButton) {

                event.preventDefault();

                if (!isAdmin()) {

                    showToast(
                        "商品を削除する権限がありません。"
                    );

                    return;
                }


                const id =
                    deleteButton.dataset
                        .productDelete;


                if (!id) {
                    return;
                }


                deleteProduct(
                    id
                );

                return;
            }


            const closeButton =
                target.closest(
                    "#productModalCloseButton, #productModalCancelButton"
                );


            if (closeButton) {

                event.preventDefault();

                closeProductModal();

            }

        }
    );


    const productForm =
        document.getElementById(
            "productForm"
        );


    if (productForm) {

        productForm.addEventListener(
            "submit",
            handleProductSubmit
        );

    }


    const modalOverlay =
        document.getElementById(
            "productModalOverlay"
        );


    if (modalOverlay) {

        modalOverlay.addEventListener(
            "click",
            (event) => {

                if (
                    event.target ===
                    modalOverlay
                ) {

                    closeProductModal();

                }

            }
        );

    }

}


/* ========================================
   商品追加モーダル
======================================== */

function openProductCreate() {

    const form =
        document.getElementById(
            "productForm"
        );


    if (!form) {
        return;
    }


    form.reset();


    const productId =
        document.getElementById(
            "productId"
        );


    if (productId) {
        productId.value = "";
    }


    const categoryInput =
        document.getElementById(
            "productCategory"
        );


    if (categoryInput) {
        categoryInput.value =
            "drink";
    }


    const priceInput =
        document.getElementById(
            "productPrice"
        );


    if (priceInput) {
        priceInput.value =
            "0";
    }


    const providedQuantityInput =
        document.getElementById(
            "productProvidedQuantity"
        );


    if (providedQuantityInput) {

        providedQuantityInput.value =
            "1";

    }


    const lowStockThresholdInput =
        document.getElementById(
            "productLowStockThreshold"
        );


    if (lowStockThresholdInput) {

        lowStockThresholdInput.value =
            "5";

    }


    const title =
        document.getElementById(
            "productModalTitle"
        );


    if (title) {

        title.textContent =
            "商品を追加";

    }


    openProductModal();
}


/* ========================================
   商品編集モーダル
======================================== */

function openProductEdit(
    productId
) {

    const product =
        products.find(
            (item) =>
                String(item.id) ===
                String(productId)
        );


    if (!product) {
        return;
    }


    const productIdInput =
        document.getElementById(
            "productId"
        );


    const nameInput =
        document.getElementById(
            "productName"
        );


    const categoryInput =
        document.getElementById(
            "productCategory"
        );


    const priceInput =
        document.getElementById(
            "productPrice"
        );


    const providedQuantityInput =
        document.getElementById(
            "productProvidedQuantity"
        );


    const lowStockThresholdInput =
        document.getElementById(
            "productLowStockThreshold"
        );


    const descriptionInput =
        document.getElementById(
            "productDescription"
        );


    if (productIdInput) {

        productIdInput.value =
            product.id;

    }


    if (nameInput) {

        nameInput.value =
            product.name || "";

    }


    if (categoryInput) {

        categoryInput.value =
            normalizeCategory(
                product.category
            );

    }


    if (priceInput) {

        priceInput.value =
            Number(
                product.price
            ) || 0;

    }


    if (providedQuantityInput) {

        providedQuantityInput.value =
            getProvidedQuantity(
                product.provided_quantity
            );

    }


    if (lowStockThresholdInput) {

        lowStockThresholdInput.value =
            getLowStockThreshold(
                product.low_stock_threshold
            );

    }


    if (descriptionInput) {

        descriptionInput.value =
            "";

    }


    const title =
        document.getElementById(
            "productModalTitle"
        );


    if (title) {

        title.textContent =
            "商品を編集";

    }


    openProductModal();
}


/* ========================================
   モーダル表示
======================================== */

function openProductModal() {

    const overlay =
        document.getElementById(
            "productModalOverlay"
        );


    if (!overlay) {
        return;
    }


    overlay.hidden = false;


    document.body.classList.add(
        "modal-open"
    );


    const firstInput =
        overlay.querySelector(
            "input:not([type='hidden']), select, textarea"
        );


    if (firstInput) {

        setTimeout(
            () => firstInput.focus(),
            50
        );

    }

}


/* ========================================
   モーダル閉じる
======================================== */

function closeProductModal() {

    const overlay =
        document.getElementById(
            "productModalOverlay"
        );


    if (!overlay) {
        return;
    }


    overlay.hidden = true;


    document.body.classList.remove(
        "modal-open"
    );

}


/* ========================================
   商品フォーム送信
======================================== */

async function handleProductSubmit(
    event
) {

    event.preventDefault();


    if (!isAdmin()) {

        showToast(
            "商品設定を変更する権限がありません。"
        );

        return;
    }


    const productId =
        document.getElementById(
            "productId"
        )?.value;


    const name =
        document.getElementById(
            "productName"
        )?.value
            ?.trim();


    const category =
        normalizeCategory(
            document.getElementById(
                "productCategory"
            )?.value
        );


    const price =
        Number(
            document.getElementById(
                "productPrice"
            )?.value
        );


    const providedQuantity =
        Number(
            document.getElementById(
                "productProvidedQuantity"
            )?.value
        );


    const lowStockThreshold =
        Number(
            document.getElementById(
                "productLowStockThreshold"
            )?.value
        );


    if (!name) {

        showToast(
            "商品名を入力してください。"
        );

        return;
    }


    if (!category) {

        showToast(
            "商品カテゴリを選択してください。"
        );

        return;
    }


    if (
        !Number.isInteger(
            price
        ) ||
        price < 0
    ) {

        showToast(
            "価格は0以上の整数で入力してください。"
        );

        return;
    }


    if (
        !Number.isInteger(
            providedQuantity
        ) ||
        providedQuantity < 1
    ) {

        showToast(
            "提供個数は1以上の整数で入力してください。"
        );

        return;
    }


    if (
        !Number.isInteger(
            lowStockThreshold
        ) ||
        lowStockThreshold < 0
    ) {

        showToast(
            "在庫警告閾値は0以上の整数で入力してください。"
        );

        return;
    }


    const saveButton =
        document.getElementById(
            "productSaveButton"
        );


    if (saveButton) {

        saveButton.disabled =
            true;

    }


    try {

        let success = false;


        if (productId) {

            success =
                await updateProduct(
                    productId,
                    name,
                    category,
                    price,
                    providedQuantity,
                    lowStockThreshold
                );

        } else {

            success =
                await createProduct(
                    name,
                    category,
                    price,
                    providedQuantity,
                    lowStockThreshold
                );

        }


        if (!success) {
            return;
        }

    } finally {

        if (saveButton) {

            saveButton.disabled =
                false;

        }

    }

}


/* ========================================
   商品登録
======================================== */

async function createProduct(
    name,
    category,
    price,
    providedQuantity,
    lowStockThreshold
) {

    const normalizedCategory =
        normalizeCategory(
            category
        );


    const {
        data,
        error
    } = await supabase.rpc(
        "create_product",
        {
            p_name:
                name,

            p_category:
                normalizedCategory,

            p_price:
                price,

            p_provided_quantity:
                providedQuantity,

            p_low_stock_threshold:
                lowStockThreshold,

            p_operator_name:
                getOperatorName(),

            p_terminal:
                getTerminalId()
        }
    );


    if (error) {

        console.error(
            "商品登録エラー:",
            error
        );


        showToast(
            getErrorMessage(
                error
            )
        );


        return false;
    }


    console.log(
        "商品登録:",
        data
    );


    showToast(
        "商品を登録しました。"
    );


    closeProductModal();


    await loadProducts();


    return true;
}


/* ========================================
   商品変更
======================================== */

async function updateProduct(
    productId,
    name,
    category,
    price,
    providedQuantity,
    lowStockThreshold
) {

    const normalizedCategory =
        normalizeCategory(
            category
        );


    const {
        data,
        error
    } = await supabase.rpc(
        "update_product",
        {
            p_product_id:
                productId,

            p_name:
                name,

            p_category:
                normalizedCategory,

            p_price:
                price,

            p_provided_quantity:
                providedQuantity,

            p_low_stock_threshold:
                lowStockThreshold,

            p_operator_name:
                getOperatorName(),

            p_terminal:
                getTerminalId()
        }
    );


    if (error) {

        console.error(
            "商品変更エラー:",
            error
        );


        showToast(
            getErrorMessage(
                error
            )
        );


        return false;
    }


    console.log(
        "商品変更:",
        data
    );


    showToast(
        "商品情報を変更しました。"
    );


    closeProductModal();


    await loadProducts();


    return true;
}


/* ========================================
   販売停止・再開
======================================== */

async function toggleProduct(
    productId
) {

    const product =
        products.find(
            (item) =>
                String(item.id) ===
                String(productId)
        );


    if (!product) {
        return;
    }


    const nextActive =
        !Boolean(
            product.active
        );


    const {
        data,
        error
    } = await supabase.rpc(
        "set_product_active",
        {
            p_product_id:
                product.id,

            p_active:
                nextActive,

            p_operator_name:
                getOperatorName(),

            p_terminal:
                getTerminalId()
        }
    );


    if (error) {

        console.error(
            "販売状態変更エラー:",
            error
        );


        showToast(
            getErrorMessage(
                error
            )
        );


        return;
    }


    console.log(
        "販売状態変更:",
        data
    );


    showToast(
        nextActive
            ? "販売を再開しました。"
            : "販売を停止しました。"
    );


    await loadProducts();
}


/* ========================================
   商品削除
======================================== */

async function deleteProduct(
    productId
) {

    const product =
        products.find(
            (item) =>
                String(item.id) ===
                String(productId)
        );


    if (!product) {
        return;
    }


    const confirmed =
        await confirmProductDeletion(product.name);


    if (!confirmed) {
        return;
    }


    const deleteButton =
        document.querySelector(
            `[data-product-delete="${CSS.escape(
                String(productId)
            )}"]`
        );


    if (deleteButton) {

        deleteButton.disabled =
            true;

    }


    try {

        const {
            data,
            error
        } = await supabase.rpc(
            "delete_product",
            {
                p_product_id:
                    product.id,

                p_operator_name:
                    getOperatorName(),

                p_terminal:
                    getTerminalId()
            }
        );


        if (error) {

            console.error(
                "商品削除エラー:",
                error
            );


            showToast(
                getDeleteErrorMessage(
                    error
                )
            );


            return;
        }


        console.log(
            "商品削除:",
            data
        );


        showToast(
            "商品を削除しました。"
        );


        await loadProducts();

    } finally {

        if (deleteButton) {

            deleteButton.disabled =
                false;

        }

    }

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


    return "";
}


function getCategoryLabel(
    category
) {

    const normalizedCategory =
        normalizeCategory(
            category
        );


    const labels = {

        drink:
            "飲み物",

        dessert:
            "デザート",

        other:
            "その他"

    };


    return (
        labels[normalizedCategory] ||
        "その他"
    );
}


/* ========================================
   提供個数
======================================== */

function getProvidedQuantity(
    value
) {

    const quantity =
        Number(value);


    if (
        !Number.isInteger(
            quantity
        ) ||
        quantity < 1
    ) {

        return 1;

    }


    return quantity;
}


/* ========================================
   在庫警告閾値
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

        return 5;

    }


    return threshold;
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
   金額
======================================== */

function formatYen(
    value
) {

    const number =
        Number(value) || 0;


    return `¥${number.toLocaleString(
        "ja-JP"
    )}`;
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
            "管理者権限"
        ) ||
        message.includes(
            "権限"
        )
    ) {

        return (
            "この操作を実行するには管理者権限が必要です。"
        );
    }


    if (
        message.includes(
            "商品カテゴリーが不正"
        )
    ) {

        return (
            "商品カテゴリの指定が不正です。"
        );
    }


    if (
        message.includes(
            "提供個数"
        ) ||
        lowerMessage.includes(
            "provided_quantity"
        )
    ) {

        return (
            "提供個数は1以上の整数で入力してください。"
        );
    }


    if (
        message.includes(
            "在庫警告閾値"
        ) ||
        message.includes(
            "在庫少アラート"
        ) ||
        lowerMessage.includes(
            "low_stock_threshold"
        )
    ) {

        return (
            "在庫警告閾値は0以上の整数で入力してください。"
        );
    }


    if (
        lowerMessage.includes(
            "duplicate"
        ) ||
        lowerMessage.includes(
            "already exists"
        )
    ) {

        return (
            "同じ商品がすでに登録されています。"
        );
    }


    return (
        message ||
        "商品情報の更新に失敗しました。"
    );
}


function getDeleteErrorMessage(
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
            "管理者権限"
        ) ||
        message.includes(
            "権限"
        )
    ) {

        return (
            "商品を削除する権限がありません。"
        );
    }


    if (
        lowerMessage.includes(
            "foreign key"
        ) ||
        lowerMessage.includes(
            "violates"
        )
    ) {

        return (
            "この商品は他のデータから参照されているため削除できません。"
        );
    }


    if (
        message.includes(
            "商品が存在しません"
        )
    ) {

        return (
            "商品がすでに削除されています。"
        );
    }


    return (
        message ||
        "商品を削除できませんでした。"
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


/* ========================================
   更新
======================================== */

export function refreshProducts() {

    return loadProducts();

}
