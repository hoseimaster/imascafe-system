import { supabase } from "./supabase.js";

import {
    APP_CONFIG
} from "./config.js";

import {
    getTerminalId,
    canManageOrders
} from "./auth.js";

import {
    confirmOrderCancellation,
    confirmOrderCountMismatch
} from "./confirm-modal.js";


let initialized = false;

let products = [];

let inventory = new Map();

let inventoryDetails = new Map();

let cart = new Map();

let ordersLoading = false;
let cancelLoading = false;

let orderSubmitting = false;


/* ========================================
   初期化
======================================== */

export function initializeOrders() {

    if (initialized) {
        return;
    }

    initialized = true;

    setupOrderForm();
    setupOrderEvents();
    setupOrderDetailEvents();
    setupOrderHistoryNavigation();

    document.addEventListener(
        "app:screenchange",
        async (event) => {

            const screen =
                event.detail?.screen;

            if (
                screen === "ordersScreen"
            ) {

                await refreshOrders();

            }

        }
    );

    refreshOrders();

}


/* ========================================
   注文フォーム初期化
======================================== */

function setupOrderForm() {

    const dateInput =
        document.getElementById(
            "orderDate"
        );

    const timeInput =
        document.getElementById(
            "orderTime"
        );

    const customerInput =
        document.getElementById(
            "customerCount"
        );


    if (dateInput) {

        dateInput.value =
            getTodayJST();

    }


    if (timeInput) {

        timeInput.value =
            getCurrentTimeJST();

    }


    if (customerInput) {

        customerInput.value =
            "1";

        customerInput.min =
            "1";

        customerInput.step =
            "1";

    }


    renderCart();

}


/* ========================================
   注文イベント
======================================== */

function setupOrderEvents() {

    const submitButton =
        document.getElementById(
            "submitOrderButton"
        );


    if (!submitButton) {

        console.warn(
            "submitOrderButton が見つかりません。"
        );

        return;

    }


    const form =
        submitButton.closest(
            "form"
        );


    if (form) {

        form.addEventListener(
            "submit",
            (event) => {

                event.preventDefault();
                event.stopPropagation();

                submitOrder();

            }
        );

    } else {

        submitButton.addEventListener(
            "click",
            (event) => {

                event.preventDefault();
                event.stopPropagation();

                submitOrder();

            }
        );

    }


    submitButton.type =
        "button";


    updateSubmitButtonState();

}


/* ========================================
   注文履歴ページ移動
======================================== */

function setupOrderHistoryNavigation() {

    document.addEventListener(
        "click",
        (event) => {

            const button =
                event.target.closest(
                    "[data-order-history]"
                );


            if (!button) {
                return;
            }


            event.preventDefault();
            event.stopPropagation();


            document.dispatchEvent(
                new CustomEvent(
                    "app:navigate",
                    {
                        detail: {
                            screen:
                                "orderHistoryScreen"
                        }
                    }
                )
            );

        }
    );

}


/* ========================================
   注文詳細イベント
======================================== */

function setupOrderDetailEvents() {

    document.addEventListener(
        "click",
        (event) => {

            const detailButton =
                event.target.closest(
                    "[data-order-detail]"
                );


            if (detailButton) {

                event.preventDefault();
                event.stopPropagation();

                const orderId =
                    detailButton.dataset.orderDetail;


                if (orderId) {

                    showOrderDetail(
                        orderId
                    );

                }

                return;

            }


            const closeButton =
                event.target.closest(
                    "[data-order-detail-close]"
                );


            if (closeButton) {

                event.preventDefault();
                event.stopPropagation();

                closeOrderDetail();

                return;

            }


            const modalCloseButton =
                event.target.closest(
                    "#modalCloseButton"
                );


            if (modalCloseButton) {

                event.preventDefault();
                event.stopPropagation();

                closeOrderDetail();

            }

        },
        true
    );


    const overlay =
        document.getElementById(
            "modalOverlay"
        );


    if (overlay) {

        overlay.addEventListener(
            "click",
            (event) => {

                if (
                    event.target === overlay
                ) {

                    closeOrderDetail();

                }

            }
        );

    }

}


/* ========================================
   注文詳細表示
======================================== */

async function showOrderDetail(
    orderId
) {

    if (!orderId) {
        return;
    }


    const overlay =
        document.getElementById(
            "modalOverlay"
        );

    const title =
        document.getElementById(
            "modalTitle"
        );

    const content =
        document.getElementById(
            "modalContent"
        );


    if (
        !overlay ||
        !title ||
        !content
    ) {

        console.error(
            "注文詳細モーダルの要素が見つかりません。"
        );

        return;

    }


    overlay.hidden =
        false;

    overlay.classList.add(
        "is-visible"
    );


    title.textContent =
        "注文詳細";


    content.innerHTML = `
        <div class="order-detail-loading">
            注文詳細を取得しています…
        </div>
    `;


    try {

        const {
            data: order,
            error: orderError
        } =
            await supabase
                .from("orders")
                .select("*")
                .eq(
                    "order_id",
                    orderId
                )
                .maybeSingle();


        if (orderError) {

            throw orderError;

        }


        if (!order) {

            throw new Error(
                "指定された注文が見つかりません。"
            );

        }


        const {
            data: orderItems,
            error: itemError
        } =
            await supabase
                .from("order_items")
                .select(`
                    id,
                    order_id,
                    product_id,
                    quantity,
                    unit_price,
                    products (
                        id,
                        name,
                        category,
                        price,
                        provided_quantity
                    )
                `)
                .eq(
                    "order_id",
                    order.id
                )
                .order(
                    "id",
                    {
                        ascending: true
                    }
                );


        if (itemError) {

            throw itemError;

        }


        renderOrderDetail(
            order,
            Array.isArray(orderItems)
                ? orderItems
                : []
        );

    } catch (error) {

        console.error(
            "注文詳細取得エラー:",
            error
        );


        content.innerHTML = `
            <div class="empty-state">
                注文詳細を取得できませんでした
            </div>
        `;

    }

}


/* ========================================
   注文詳細表示
======================================== */

function renderOrderDetail(
    order,
    orderItems
) {

    const content =
        document.getElementById(
            "modalContent"
        );


    if (!content) {
        return;
    }


    const total =
        Number(
            order.total_amount
        ) ||
        orderItems.reduce(
            (
                sum,
                item
            ) => {

                const price =
                    Number(
                        item.unit_price
                    ) || 0;

                const quantity =
                    Number(
                        item.quantity
                    ) || 0;

                return (
                    sum +
                    price *
                    quantity
                );

            },
            0
        );


    const totalItems =
        Number(
            order.total_items
        ) ||
        orderItems.reduce(
            (
                sum,
                item
            ) => {

                return (
                    sum +
                    (
                        Number(
                            item.quantity
                        ) || 0
                    )
                );

            },
            0
        );


    const operatorName =
        String(
            order.operator_name || ""
        ).trim();


    const terminal =
        String(
            order.terminal || ""
        ).trim();


    const orderDate =
        formatDate(
            order.order_date
        );


    const orderTime =
        formatTime(
            order.order_time
        );


    let productHtml = "";


    if (!orderItems.length) {

        productHtml = `
            <div class="order-detail-empty">
                商品情報がありません
            </div>
        `;

    } else {

        productHtml =
            orderItems
                .map(
                    (item) => {

                        const product =
                            item.products || {};


                        const name =
                            product.name ||
                            `商品ID ${item.product_id}`;


                        const quantity =
                            Number(
                                item.quantity
                            ) || 0;


                        const price =
                            Number(
                                item.unit_price
                            ) ||
                            Number(
                                product.price
                            ) ||
                            0;


                        const subtotal =
                            price *
                            quantity;


                        return `
                            <div class="order-detail-product">

                                <div class="order-detail-product-main">

                                    <div class="order-detail-product-name">
                                        ${escapeHtml(
                                            name
                                        )}
                                    </div>

                                    <div class="order-detail-product-price">
                                        ${formatYen(
                                            price
                                        )}
                                        ×
                                        ${formatNumber(
                                            quantity
                                        )}点
                                    </div>

                                </div>

                                <div class="order-detail-product-subtotal">
                                    ${formatYen(
                                        subtotal
                                    )}
                                </div>

                            </div>
                        `;

                    }
                )
                .join("");

    }


    content.innerHTML = `

        <div class="order-detail-content">

            <div class="order-detail-summary">

                <div class="order-detail-summary-title">
                    注文内容
                </div>

                <div class="order-detail-products">
                    ${productHtml}
                </div>

                <div class="order-detail-total">

                    <span>
                        合計
                    </span>

                    <strong>
                        ${formatYen(
                            total
                        )}
                    </strong>

                </div>

            </div>


            <div class="order-detail-info">

                <div class="order-detail-row">

                    <span class="order-detail-label">
                        注文ID
                    </span>

                    <span class="order-detail-value order-detail-id">
                        ${escapeHtml(
                            order.order_id
                        )}
                    </span>

                </div>


                <div class="order-detail-row">

                    <span class="order-detail-label">
                        注文日時
                    </span>

                    <span class="order-detail-value">
                        ${escapeHtml(
                            orderDate
                        )}
                        ${escapeHtml(
                            orderTime
                        )}
                    </span>

                </div>


                <div class="order-detail-row">

                    <span class="order-detail-label">
                        人数
                    </span>

                    <span class="order-detail-value">
                        ${formatNumber(
                            order.customer_count
                        )}人
                    </span>

                </div>


                <div class="order-detail-row">

                    <span class="order-detail-label">
                        点数
                    </span>

                    <span class="order-detail-value">
                        ${formatNumber(
                            totalItems
                        )}点
                    </span>

                </div>


                <div class="order-detail-row">

                    <span class="order-detail-label">
                        金額
                    </span>

                    <span class="order-detail-value">
                        ${formatYen(
                            total
                        )}
                    </span>

                </div>


                <div class="order-detail-row">

                    <span class="order-detail-label">
                        登録者
                    </span>

                    <span class="order-detail-value">
                        ${escapeHtml(
                            operatorName ||
                            "不明"
                        )}
                    </span>

                </div>


                <div class="order-detail-row">

                    <span class="order-detail-label">
                        登録端末
                    </span>

                    <span class="order-detail-value">
                        ${escapeHtml(
                            terminal ||
                            "不明"
                        )}
                    </span>

                </div>

            </div>

        </div>

    `;

}


/* ========================================
   注文詳細を閉じる
======================================== */

function closeOrderDetail() {

    const overlay =
        document.getElementById(
            "modalOverlay"
        );


    if (!overlay) {
        return;
    }


    overlay.classList.remove(
        "is-visible"
    );


    setTimeout(
        () => {

            if (
                !overlay.classList.contains(
                    "is-visible"
                )
            ) {

                overlay.hidden =
                    true;

            }

        },
        200
    );

}


/* ========================================
   注文登録ボタン状態
======================================== */

function updateSubmitButtonState() {

    const submitButton =
        document.getElementById(
            "submitOrderButton"
        );


    if (!submitButton) {
        return;
    }


    submitButton.disabled =
        orderSubmitting ||
        ordersLoading ||
        cart.size === 0;


    if (
        orderSubmitting
    ) {

        submitButton.textContent =
            "登録中…";

    }

}


/* ========================================
   商品・在庫取得
======================================== */

export async function loadProducts() {

    const container =
        document.getElementById(
            "productList"
        );


    if (container) {

        container.innerHTML = `
            <div class="loading-message">
                商品を読み込んでいます…
            </div>
        `;

    }


    const [
        productsResult,
        inventoryResult
    ] =
        await Promise.all([
            supabase
                .from("products")
                .select("*")
                .eq(
                    "active",
                    true
                )
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
                ),

            supabase
                .from("inventory_status")
                .select("*")
                .eq(
                    "active",
                    true
                )
        ]);


    if (productsResult.error) {

        console.error(
            "商品取得エラー:",
            productsResult.error
        );


        if (container) {

            container.innerHTML = `
                <div class="empty-state">
                    商品を取得できませんでした
                </div>
            `;

        }

        return;

    }


    if (inventoryResult.error) {

        console.error(
            "在庫取得エラー:",
            inventoryResult.error
        );


        if (container) {

            container.innerHTML = `
                <div class="empty-state">
                    在庫情報を取得できませんでした
                </div>
            `;

        }

        return;

    }


    products =
        Array.isArray(
            productsResult.data
        )
            ? productsResult.data
            : [];


    inventory =
        new Map();

    inventoryDetails =
        new Map();


    (
        Array.isArray(
            inventoryResult.data
        )
            ? inventoryResult.data
            : []
    )
    .forEach(
        (item) => {

            const key =
                String(
                    item.product_id
                );


            const quantity =
                Math.max(
                    Number(
                        item.quantity
                    ) || 0,
                    0
                );


            inventory.set(
                key,
                quantity
            );


            inventoryDetails.set(
                key,
                item
            );

        }
    );


    renderProducts();

    normalizeCartAgainstInventory();

}


/* ========================================
   商品一覧
======================================== */

function renderProducts() {

    const container =
        document.getElementById(
            "productList"
        );


    if (!container) {
        return;
    }


    if (!products.length) {

        container.innerHTML = `
            <div class="empty-state">
                販売可能な商品がありません
            </div>
        `;

        return;

    }


    const categoryLabels = {

        drink:
            "ドリンク",

        dessert:
            "デザート",

        food:
            "デザート",

        other:
            "その他"

    };


    const categoryOrder = [
        "drink",
        "dessert",
        "other"
    ];


    const grouped =
        new Map();


    products.forEach(
        (product) => {

            let category =
                String(
                    product.category ||
                    "other"
                )
                .trim()
                .toLowerCase();


            if (
                category === "food"
            ) {
                category = "dessert";
            }

            if (
                category === "set"
            ) {
                category = "other";
            }


            if (
                !grouped.has(
                    category
                )
            ) {

                grouped.set(
                    category,
                    []
                );

            }


            grouped
                .get(category)
                .push(product);

        }
    );


    let html = "";


    const renderCategory =
        (
            category,
            categoryProducts
        ) => {

            return `
                <section
                    class="
                        order-product-category
                        order-product-category-${escapeHtml(
                            category
                        )}
                    "
                >

                    <div class="order-product-category-title">

                        <span>
                            ${escapeHtml(
                                categoryLabels[
                                    category
                                ] ||
                                category
                            )}
                        </span>

                        <span class="order-product-category-count">
                            ${formatNumber(
                                categoryProducts.length
                            )}種
                        </span>

                    </div>


                    <div class="order-product-grid">

                        ${categoryProducts
                            .map(
                                (product) => {

                                    const stock =
                                        getInventoryQuantity(
                                            product.id
                                        );


                                    const providedQuantity =
                                        getProvidedQuantity(
                                            product
                                        );


                                    const availableOrders =
                                        Math.floor(
                                            stock /
                                            providedQuantity
                                        );


                                    const soldOut =
                                        availableOrders <= 0;


                                    const stockClass =
                                        getStockClass(
                                            product,
                                            stock,
                                            providedQuantity
                                        );


                                    return `
                                        <button
                                            type="button"
                                            class="
                                                product-button
                                                ${stockClass}
                                                ${soldOut
                                                    ? "is-sold-out"
                                                    : ""
                                                }
                                            "
                                            data-product-id="${escapeHtml(
                                                product.id
                                            )}"
                                            ${soldOut
                                                ? "disabled"
                                                : ""
                                            }
                                        >

                                            <img
                                            class="product-category-icon"
                                            src="./logo_${category === "drink" ? "13" : category === "dessert" ? "14" : "15"}.png"
                                            alt=""
                                            aria-hidden="true"
                                        >
                                        <span class="product-button-name">
                                                ${escapeHtml(
                                                    product.name
                                                )}
                                            </span>

                                            ${soldOut
                                                ? `
                                                    <span class="product-button-sold-out">
                                                        売り切れ
                                                    </span>
                                                `
                                                : ""
                                            }

                                        </button>
                                    `;

                                }
                            )
                            .join("")}

                    </div>

                </section>
            `;

        };


    categoryOrder.forEach(
        (category) => {

            if (
                grouped.has(
                    category
                )
            ) {

                html +=
                    renderCategory(
                        category,
                        grouped.get(
                            category
                        )
                    );

            }

        }
    );


    grouped.forEach(
        (
            categoryProducts,
            category
        ) => {

            if (
                categoryOrder.includes(
                    category
                )
            ) {

                return;

            }


            html +=
                renderCategory(
                    category,
                    categoryProducts
                );

        }
    );


    container.innerHTML =
        html;


    container
        .querySelectorAll(
            "[data-product-id]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    (event) => {

                        event.preventDefault();
                        event.stopPropagation();


                        if (
                            button.disabled
                        ) {

                            return;

                        }


                        const product =
                            products.find(
                                (item) =>
                                    String(
                                        item.id
                                    ) ===
                                    String(
                                        button.dataset
                                            .productId
                                    )
                            );


                        if (product) {

                            addToCart(
                                product
                            );

                        }

                    }
                );

            }
        );

}


/* ========================================
   カート追加
======================================== */

function addToCart(
    product
) {

    const key =
        String(
            product.id
        );


    const stock =
        getInventoryQuantity(
            product.id
        );


    const providedQuantity =
        getProvidedQuantity(
            product
        );


    const existing =
        cart.get(
            key
        );


    const currentQuantity =
        existing
            ? Number(
                existing.quantity
            ) || 0
            : 0;


    const nextQuantity =
        currentQuantity + 1;


    const requiredStock =
        nextQuantity *
        providedQuantity;


    if (
        requiredStock >
        stock
    ) {

        showToast(
            `「${product.name}」の在庫が不足しています。`
        );

        return;

    }


    if (existing) {

        existing.quantity =
            nextQuantity;

    } else {

        cart.set(
            key,
            {
                product,
                quantity: 1
            }
        );

    }


    renderCart();

}


/* ========================================
   数量変更
======================================== */

function changeCartQuantity(
    productId,
    change
) {

    const key =
        String(
            productId
        );


    const item =
        cart.get(
            key
        );


    if (!item) {
        return;
    }


    const currentQuantity =
        Number(
            item.quantity
        ) || 0;


    const nextQuantity =
        currentQuantity +
        Number(
            change
        );


    if (
        nextQuantity <= 0
    ) {

        cart.delete(
            key
        );

        renderCart();

        return;

    }


    const stock =
        getInventoryQuantity(
            productId
        );


    const providedQuantity =
        getProvidedQuantity(
            item.product
        );


    const requiredStock =
        nextQuantity *
        providedQuantity;


    if (
        requiredStock >
        stock
    ) {

        showToast(
            `「${item.product.name}」の在庫が不足しています。`
        );

        return;

    }


    item.quantity =
        nextQuantity;


    renderCart();

}


/* ========================================
   商品削除
======================================== */

function removeFromCart(
    productId
) {

    cart.delete(
        String(
            productId
        )
    );


    renderCart();

}


/* ========================================
   カート全削除
======================================== */

function clearCart() {

    cart.clear();

    renderCart();

}


/* ========================================
   カート表示
======================================== */

function renderCart() {

    const container =
        document.getElementById(
            "orderCart"
        );

    const totalElement =
        document.getElementById(
            "orderTotal"
        );


    if (!container) {

        updateSubmitButtonState();

        return;

    }


    if (!cart.size) {

        container.innerHTML = `
            <div class="order-cart-empty">
                商品を選択してください
            </div>
        `;


        if (totalElement) {

            totalElement.textContent =
                formatYen(0);

        }


        updateSubmitButtonState();

        return;

    }


    let total = 0;

    let html = "";


    cart.forEach(
        (item) => {

            const product =
                item.product;


            const quantity =
                Number(
                    item.quantity
                ) || 0;


            const price =
                Number(
                    product.price
                ) || 0;


            const providedQuantity =
                getProvidedQuantity(
                    product
                );


            const stock =
                getInventoryQuantity(
                    product.id
                );


            const subtotal =
                price *
                quantity;


            total +=
                subtotal;


            const requiredStock =
                quantity *
                providedQuantity;


            const canIncrease =
                requiredStock +
                providedQuantity <=
                stock;


            html += `
                <div class="order-cart-item">

                    <div class="order-cart-item-main">

                        <div class="order-cart-item-name">
                            ${escapeHtml(
                                product.name
                            )}
                        </div>

                        <div class="order-cart-item-info">
                            ${formatYen(
                                price
                            )}
                            ×
                            ${formatNumber(
                                quantity
                            )}
                            ＝
                            ${formatYen(
                                subtotal
                            )}
                        </div>

                    </div>


                    <div class="order-cart-item-controls">

                        <button
                            type="button"
                            class="
                                button
                                button-secondary
                                order-quantity-button
                            "
                            data-cart-minus="${escapeHtml(
                                product.id
                            )}"
                            aria-label="${escapeHtml(
                                product.name
                            )}を1点減らす"
                        >
                            −
                        </button>


                        <span class="order-cart-quantity">
                            ${formatNumber(
                                quantity
                            )}
                        </span>


                        <button
                            type="button"
                            class="
                                button
                                button-secondary
                                order-quantity-button
                            "
                            data-cart-plus="${escapeHtml(
                                product.id
                            )}"
                            aria-label="${escapeHtml(
                                product.name
                            )}を1点増やす"
                            ${canIncrease
                                ? ""
                                : "disabled"
                            }
                        >
                            ＋
                        </button>


                        <button
                            type="button"
                            class="
                                button
                                button-danger
                                order-remove-button
                            "
                            data-cart-remove="${escapeHtml(
                                product.id
                            )}"
                        >
                            削除
                        </button>

                    </div>

                </div>
            `;

        }
    );


    container.innerHTML =
        html;


    if (totalElement) {

        totalElement.textContent =
            formatYen(
                total
            );

    }


    container
        .querySelectorAll(
            "[data-cart-minus]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    (event) => {

                        event.preventDefault();
                        event.stopPropagation();


                        changeCartQuantity(
                            button.dataset.cartMinus,
                            -1
                        );

                    }
                );

            }
        );


    container
        .querySelectorAll(
            "[data-cart-plus]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    (event) => {

                        event.preventDefault();
                        event.stopPropagation();


                        if (
                            button.disabled
                        ) {

                            return;

                        }


                        changeCartQuantity(
                            button.dataset.cartPlus,
                            1
                        );

                    }
                );

            }
        );


    container
        .querySelectorAll(
            "[data-cart-remove]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    (event) => {

                        event.preventDefault();
                        event.stopPropagation();


                        removeFromCart(
                            button.dataset.cartRemove
                        );

                    }
                );

            }
        );


    updateSubmitButtonState();

}


/* ========================================
   カート在庫補正
======================================== */

function normalizeCartAgainstInventory() {

    let changed = false;


    cart.forEach(
        (item, key) => {

            const stock =
                getInventoryQuantity(
                    item.product.id
                );


            const providedQuantity =
                getProvidedQuantity(
                    item.product
                );


            const maxQuantity =
                Math.floor(
                    stock /
                    providedQuantity
                );


            if (
                maxQuantity <= 0
            ) {

                cart.delete(
                    key
                );

                changed = true;

                return;

            }


            if (
                item.quantity >
                maxQuantity
            ) {

                item.quantity =
                    maxQuantity;

                changed = true;

            }

        }
    );


    if (changed) {

        renderCart();

    }

}


/* ========================================
   ドリンク・デザート数量
======================================== */

function getDrinkAndDessertCounts() {

    let drinkCount =
        0;

    let dessertCount =
        0;


    cart.forEach(
        (item) => {

            let category =
                String(
                    item.product?.category ||
                    ""
                )
                .trim()
                .toLowerCase();


            if (
                category === "food"
            ) {
                category = "dessert";
            }

            if (
                category === "set"
            ) {
                category = "other";
            }


            const quantity =
                Number(
                    item.quantity
                ) || 0;


            if (
                category === "drink"
            ) {

                drinkCount +=
                    quantity;

            }


            if (
                category === "dessert"
            ) {

                dessertCount +=
                    quantity;

            }

        }
    );


    return {
        drinkCount,
        dessertCount
    };

}


/* ========================================
   注文登録
======================================== */

async function submitOrder() {

    if (!canManageOrders()) {
        showToast(
            "この操作を実行する権限がありません。"
        );
        return;
    }

    if (
        orderSubmitting
    ) {

        return;

    }


    if (
        ordersLoading
    ) {

        return;

    }


    if (!cart.size) {

        showToast(
            "商品を選択してください。"
        );

        updateSubmitButtonState();

        return;

    }


    const dateInput =
        document.getElementById(
            "orderDate"
        );

    const timeInput =
        document.getElementById(
            "orderTime"
        );

    const customerInput =
        document.getElementById(
            "customerCount"
        );


    if (
        !dateInput ||
        !timeInput ||
        !customerInput
    ) {

        console.error(
            "注文フォームの入力欄が見つかりません。"
        );


        showToast(
            "注文入力欄を取得できませんでした。"
        );

        return;

    }


    const orderDate =
        String(
            dateInput.value ||
            ""
        ).trim();


    const orderTime =
        normalizeTimeInput(
            timeInput.value
        );


    const customerCount =
        Number(
            customerInput.value
        );


    if (!orderDate) {

        showToast(
            "注文日を入力してください。"
        );

        dateInput.focus();

        return;

    }


    if (
        !isValidDate(
            orderDate
        )
    ) {

        showToast(
            "注文日が正しくありません。"
        );

        dateInput.focus();

        return;

    }


    if (!orderTime) {

        showToast(
            "注文時刻を入力してください。"
        );

        timeInput.focus();

        return;

    }


    if (
        !isValidTime(
            orderTime
        )
    ) {

        showToast(
            "注文時刻が正しくありません。"
        );

        timeInput.focus();

        return;

    }


    if (
        !Number.isInteger(
            customerCount
        ) ||
        customerCount < 1
    ) {

        showToast(
            "来客人数を1人以上で入力してください。"
        );

        customerInput.focus();

        return;

    }


    const {
        drinkCount,
        dessertCount
    } =
        getDrinkAndDessertCounts();


    if (
        drinkCount !==
        dessertCount
    ) {

        const confirmed =
            await confirmOrderCountMismatch(
                formatNumber(drinkCount),
                formatNumber(dessertCount)
            );


        if (!confirmed) {
            return;
        }

    }


    const orderItems =
        Array.from(
            cart.values()
        )
        .map(
            (item) => {

                return {
                    product_id:
                        Number(
                            item.product.id
                        ),

                    quantity:
                        Number(
                            item.quantity
                        )
                };

            }
        )
        .filter(
            (item) =>
                Number.isInteger(
                    item.product_id
                ) &&
                item.product_id > 0 &&
                Number.isInteger(
                    item.quantity
                ) &&
                item.quantity > 0
        );


    if (!orderItems.length) {

        showToast(
            "注文内容を確認してください。"
        );

        return;

    }


    const stockCheck =
        checkCartInventory();


    if (
        !stockCheck.valid
    ) {

        showToast(
            stockCheck.message
        );

        await loadProducts();

        return;

    }


    const {
        data: userData,
        error: userError
    } =
        await supabase.auth.getUser();


    if (
        userError ||
        !userData?.user?.id
    ) {

        console.error(
            "ログインユーザー取得エラー:",
            userError
        );


        showToast(
            "ログイン情報を取得できませんでした。もう一度ログインしてください。"
        );

        return;

    }


    const operatorName =
        String(
            localStorage.getItem(
                APP_CONFIG.OPERATOR_NAME_STORAGE_KEY
            ) ||
            ""
        )
        .trim();


    if (!operatorName) {

        showToast(
            "担当者名を取得できませんでした。もう一度ログインしてください。"
        );

        return;

    }


    if (
        orderSubmitting
    ) {

        return;

    }


    orderSubmitting =
        true;


    ordersLoading =
        true;


    const submitButton =
        document.getElementById(
            "submitOrderButton"
        );


    const originalButtonText =
        submitButton
            ? submitButton.textContent
            : "";


    if (submitButton) {

        submitButton.disabled =
            true;

        submitButton.textContent =
            "登録中…";

    }


    try {

        const {
            data,
            error
        } =
            await supabase.rpc(
                "create_order",
                {
                    p_items:
                        orderItems,

                    p_order_date:
                        orderDate,

                    p_order_time:
                        orderTime,

                    p_customer_count:
                        customerCount,

                    p_operator_name:
                        operatorName,

                    p_terminal:
                        getTerminalId(),

                    p_created_by:
                        userData.user.id
                }
            );


        if (error) {

            console.error(
                "注文登録エラー:",
                error
            );


            throw error;

        }


        clearCart();


        dateInput.value =
            getTodayJST();


        timeInput.value =
            getCurrentTimeJST();


        customerInput.value =
            "1";


        showToast(
            data
                ? `注文 ${data} を登録しました。`
                : "注文を登録しました。"
        );


        await Promise.all([
            loadProducts(),
            loadOrders()
        ]);

    } catch (error) {

        console.error(
            "注文登録エラー:",
            error
        );


        const communicationError =
            isCommunicationError(
                error
            );


        if (
            communicationError
        ) {

            showToast(
                "通信エラーが発生しました。注文内容は保持しています。登録状態を確認してから、もう一度登録してください。"
            );

        } else {

            showToast(
                getSupabaseErrorMessage(
                    error
                )
            );

        }

    } finally {

        orderSubmitting =
            false;


        ordersLoading =
            false;


        if (submitButton) {

            submitButton.textContent =
                originalButtonText ||
                "注文を登録";

        }


        updateSubmitButtonState();

    }

}


/* ========================================
   カート在庫確認
======================================== */

function checkCartInventory() {

    for (
        const item of cart.values()
    ) {

        const product =
            item.product;


        const quantity =
            Number(
                item.quantity
            ) || 0;


        const providedQuantity =
            getProvidedQuantity(
                product
            );


        const stock =
            getInventoryQuantity(
                product.id
            );


        const requiredStock =
            quantity *
            providedQuantity;


        if (
            requiredStock >
            stock
        ) {

            return {
                valid: false,
                message:
                    `「${product.name}」の在庫が不足しています。`
            };

        }

    }


    return {
        valid: true,
        message: ""
    };

}


/* ========================================
   通信エラー判定
======================================== */

function isCommunicationError(
    error
) {

    if (!error) {
        return false;
    }


    const message =
        String(
            error.message ||
            ""
        )
        .toLowerCase();


    const name =
        String(
            error.name ||
            ""
        )
        .toLowerCase();


    const code =
        String(
            error.code ||
            ""
        )
        .toLowerCase();


    if (
        name.includes(
            "network"
        ) ||
        name.includes(
            "fetch"
        )
    ) {

        return true;

    }


    if (
        message.includes(
            "failed to fetch"
        ) ||
        message.includes(
            "network error"
        ) ||
        message.includes(
            "networkerror"
        ) ||
        message.includes(
            "fetch failed"
        ) ||
        message.includes(
            "connection"
        ) ||
        message.includes(
            "timeout"
        ) ||
        message.includes(
            "timed out"
        ) ||
        message.includes(
            "abort"
        ) ||
        code === "network_error"
    ) {

        return true;

    }


    return false;

}


/* ========================================
   最新注文3件取得
======================================== */

export async function loadOrders() {

    const container =
        document.getElementById(
            "activeOrdersList"
        );


    if (!container) {
        return;
    }


    container.innerHTML = `
        <div class="loading-message">
            注文履歴を読み込んでいます…
        </div>
    `;


    const {
        data,
        error
    } =
        await supabase
            .from("active_orders")
            .select("*")
            .order(
                "order_date",
                {
                    ascending: false
                }
            )
            .order(
                "order_time",
                {
                    ascending: false
                }
            )
            .order(
                "id",
                {
                    ascending: false
                }
            )
            .limit(
                3
            );


    if (error) {

        console.error(
            "注文一覧取得エラー:",
            error
        );


        container.innerHTML = `
            <div class="empty-state">
                注文履歴を取得できませんでした
            </div>
        `;

        return;

    }


    renderActiveOrders(
        Array.isArray(data)
            ? data
            : []
    );

}


/* ========================================
   最新注文3件表示
======================================== */

function renderActiveOrders(
    orders
) {

    const container =
        document.getElementById(
            "activeOrdersList"
        );


    if (!container) {
        return;
    }


    if (!orders.length) {

        container.innerHTML = `
            <div class="empty-state">
                注文履歴はありません
            </div>
        `;

        return;

    }


    const sortedOrders =
        [...orders].sort(
            (a, b) => {

                const dateCompare =
                    String(
                        b.order_date ||
                        ""
                    )
                    .localeCompare(
                        String(
                            a.order_date ||
                            ""
                        )
                    );


                if (
                    dateCompare !== 0
                ) {

                    return dateCompare;

                }


                const timeCompare =
                    String(
                        b.order_time ||
                        ""
                    )
                    .localeCompare(
                        String(
                            a.order_time ||
                            ""
                        )
                    );


                if (
                    timeCompare !== 0
                ) {

                    return timeCompare;

                }


                return (
                    Number(
                        b.id || 0
                    ) -
                    Number(
                        a.id || 0
                    )
                );

            }
        );


    let html = "";


    sortedOrders.forEach(
        (
            order,
            index
        ) => {

            const displayNumber =
                index + 1;


            const total =
                Number(
                    order.total_amount
                ) || 0;


            const totalItems =
                Number(
                    order.total_items
                ) || 0;


            const operatorName =
                String(
                    order.operator_name ||
                    ""
                ).trim();


            html += `
                <div class="active-order-item">

                    <div class="active-order-main">

                        <div class="active-order-number">

                            <span class="active-order-display-number">
                                No.${formatNumber(
                                    displayNumber
                                )}
                            </span>

                        </div>


                        <div class="active-order-detail">

                            <span>
                                ${formatDate(
                                    order.order_date
                                )}
                            </span>

                            <span>
                                ${formatTime(
                                    order.order_time
                                )}
                            </span>

                            <span>
                                ${formatNumber(
                                    order.customer_count
                                )}人
                            </span>

                            <span>
                                ${formatNumber(
                                    totalItems
                                )}点
                            </span>

                            <strong>
                                ${formatYen(
                                    total
                                )}
                            </strong>

                            <span class="active-order-operator">
                                ${escapeHtml(
                                    operatorName ||
                                    "不明"
                                )}
                            </span>

                        </div>

                    </div>


                    <div class="active-order-actions">

                        <button
                            type="button"
                            class="
                                button
                                button-secondary
                                order-detail-button
                            "
                            data-order-detail="${escapeHtml(
                                order.order_id
                            )}"
                        >
                            詳細
                        </button>


                        <button
                            type="button"
                            class="
                                button
                                button-danger
                            "
                            data-cancel-order="${escapeHtml(
                                order.order_id
                            )}"
                        >
                            取消
                        </button>

                    </div>

                </div>
            `;

        }
    );


    container.innerHTML =
        html;


    container
        .querySelectorAll(
            "[data-cancel-order]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    (event) => {

                        event.preventDefault();
                        event.stopPropagation();


                        cancelOrder(
                            button.dataset
                                .cancelOrder
                        );

                    }
                );

            }
        );

}


/* ========================================
   注文取消
======================================== */

async function cancelOrder(
    orderId
) {

    if (!canManageOrders()) {
        showToast(
            "この操作を実行する権限がありません。"
        );
        return;
    }

    if (
        cancelLoading ||
        !orderId
    ) {

        return;

    }


    const confirmed =
        await confirmOrderCancellation(orderId);


    if (!confirmed) {
        return;
    }


    const operatorName =
        String(
            localStorage.getItem(
                APP_CONFIG.OPERATOR_NAME_STORAGE_KEY
            ) ||
            ""
        )
        .trim();


    if (!operatorName) {

        showToast(
            "担当者名を取得できませんでした。もう一度ログインしてください。"
        );

        return;

    }


    cancelLoading =
        true;


    const button =
        Array.from(
            document.querySelectorAll(
                "[data-cancel-order]"
            )
        )
        .find(
            (element) =>
                String(
                    element.dataset
                        .cancelOrder
                ) ===
                String(
                    orderId
                )
        );


    if (button) {

        button.disabled =
            true;

        button.dataset.originalText =
            button.textContent;

        button.textContent =
            "取消中…";

    }


    try {

        const {
            data,
            error
        } =
            await supabase.rpc(
                "cancel_order",
                {
                    p_order_id:
                        orderId,

                    p_operator_name:
                        operatorName,

                    p_terminal:
                        getTerminalId()
                }
            );


        if (error) {

            console.error(
                "注文取消エラー:",
                error
            );


            throw error;

        }


        if (
            data === false
        ) {

            showToast(
                "注文はすでに取り消されています。"
            );


            await Promise.all([
                loadProducts(),
                loadOrders()
            ]);

            return;

        }


        showToast(
            `${orderId} を取り消しました。`
        );


        await Promise.all([
            loadProducts(),
            loadOrders()
        ]);

    } catch (error) {

        console.error(
            "注文取消エラー:",
            error
        );


        if (
            isCommunicationError(
                error
            )
        ) {

            showToast(
                "通信エラーが発生しました。取消状態を確認してから、必要に応じてもう一度操作してください。"
            );

        } else {

            showToast(
                getSupabaseErrorMessage(
                    error
                )
            );

        }

    } finally {

        cancelLoading =
            false;


        if (button) {

            button.disabled =
                false;

            button.textContent =
                button.dataset.originalText ||
                "取消";

            delete button.dataset.originalText;

        }

    }

}


/* ========================================
   更新
======================================== */

export async function refreshOrders() {

    await Promise.all([
        loadProducts(),
        loadOrders()
    ]);

}


/* ========================================
   在庫数量取得
======================================== */

function getInventoryQuantity(
    productId
) {

    return Math.max(
        Number(
            inventory.get(
                String(
                    productId
                )
            )
        ) || 0,
        0
    );

}


/* ========================================
   提供個数取得
======================================== */

function getProvidedQuantity(
    product
) {

    const value =
        Number(
            product?.provided_quantity
        );


    if (
        Number.isInteger(value) &&
        value >= 1
    ) {

        return value;

    }


    return 1;

}


/* ========================================
   在庫アラート基準値取得
======================================== */

function getLowStockThreshold(
    product
) {

    const productValue =
        Number(
            product?.low_stock_threshold
        );


    if (
        Number.isInteger(
            productValue
        ) &&
        productValue >= 0
    ) {

        return productValue;

    }


    const inventoryItem =
        inventoryDetails.get(
            String(
                product?.id
            )
        );


    const inventoryValue =
        Number(
            inventoryItem?.low_stock_threshold
        );


    if (
        Number.isInteger(
            inventoryValue
        ) &&
        inventoryValue >= 0
    ) {

        return inventoryValue;

    }


    return 3;

}


/* ========================================
   在庫表示クラス
======================================== */

function getStockClass(
    product,
    stock,
    providedQuantity
) {

    if (
        stock <= 0
    ) {

        return "is-sold-out";

    }


    const availableOrders =
        Math.floor(
            stock /
            providedQuantity
        );


    if (
        availableOrders <= 0
    ) {

        return "is-sold-out";

    }


    const threshold =
        getLowStockThreshold(
            product
        );


    if (
        threshold > 0 &&
        availableOrders <= threshold
    ) {

        return "is-low-stock";

    }


    return "is-normal-stock";

}


/* ========================================
   今日の日付
======================================== */

function getTodayJST() {

    const parts =
        new Intl.DateTimeFormat(
            "ja-JP",
            {
                timeZone:
                    APP_CONFIG.TIME_ZONE,

                year:
                    "numeric",

                month:
                    "2-digit",

                day:
                    "2-digit"
            }
        )
        .formatToParts(
            new Date()
        );


    const values = {};


    parts.forEach(
        (part) => {

            if (
                part.type !== "literal"
            ) {

                values[part.type] =
                    part.value;

            }

        }
    );


    return `${values.year}-${values.month}-${values.day}`;

}


/* ========================================
   現在時刻
======================================== */

function getCurrentTimeJST() {

    const parts =
        new Intl.DateTimeFormat(
            "ja-JP",
            {
                timeZone:
                    APP_CONFIG.TIME_ZONE,

                hour:
                    "2-digit",

                minute:
                    "2-digit",

                hour12:
                    false
            }
        )
        .formatToParts(
            new Date()
        );


    let hour =
        "00";

    let minute =
        "00";


    parts.forEach(
        (part) => {

            if (
                part.type === "hour"
            ) {

                hour =
                    part.value;

            }


            if (
                part.type === "minute"
            ) {

                minute =
                    part.value;

            }

        }
    );


    if (
        hour === "24"
    ) {

        hour =
            "00";

    }


    return `${hour}:${minute}`;

}


/* ========================================
   時刻正規化
======================================== */

function normalizeTimeInput(
    value
) {

    if (!value) {
        return "";
    }


    const text =
        String(
            value
        )
        .trim();


    if (
        /^\d{2}:\d{2}$/.test(
            text
        )
    ) {

        return `${text}:00`;

    }


    if (
        /^\d{2}:\d{2}:\d{2}$/.test(
            text
        )
    ) {

        return text;

    }


    return "";

}


/* ========================================
   日付チェック
======================================== */

function isValidDate(
    value
) {

    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
            value
        )
    ) {

        return false;

    }


    const [
        year,
        month,
        day
    ] =
        value
            .split("-")
            .map(
                Number
            );


    const date =
        new Date(
            Date.UTC(
                year,
                month - 1,
                day
            )
        );


    return (
        date.getUTCFullYear() ===
            year &&
        date.getUTCMonth() ===
            month - 1 &&
        date.getUTCDate() ===
            day
    );

}


/* ========================================
   時刻チェック
======================================== */

function isValidTime(
    value
) {

    if (
        !/^\d{2}:\d{2}:\d{2}$/.test(
            value
        )
    ) {

        return false;

    }


    const [
        hour,
        minute,
        second
    ] =
        value
            .split(":")
            .map(
                Number
            );


    return (
        hour >= 0 &&
        hour <= 23 &&
        minute >= 0 &&
        minute <= 59 &&
        second >= 0 &&
        second <= 59
    );

}


/* ========================================
   日付表示
======================================== */

function formatDate(
    value
) {

    if (!value) {
        return "";
    }


    const parts =
        String(
            value
        )
        .split("-");


    if (
        parts.length !== 3
    ) {

        return String(
            value
        );

    }


    return `${parts[0]}/${parts[1]}/${parts[2]}`;

}


/* ========================================
   時刻表示
======================================== */

function formatTime(
    value
) {

    if (!value) {
        return "";
    }


    const text =
        String(
            value
        );


    if (
        /^\d{2}:\d{2}:\d{2}/.test(
            text
        )
    ) {

        return text.slice(
            0,
            5
        );

    }


    if (
        /^\d{2}:\d{2}/.test(
            text
        )
    ) {

        return text.slice(
            0,
            5
        );

    }


    return text;

}


/* ========================================
   金額
======================================== */

function formatYen(
    value
) {

    const number =
        Number(
            value
        ) || 0;


    return `${number.toLocaleString(
        "ja-JP"
    )}円`;

}


/* ========================================
   数値
======================================== */

function formatNumber(
    value
) {

    const number =
        Number(
            value
        ) || 0;


    return number.toLocaleString(
        "ja-JP"
    );

}


/* ========================================
   Supabaseエラー
======================================== */

function getSupabaseErrorMessage(
    error
) {

    if (!error) {

        return "処理に失敗しました。";

    }


    const message =
        String(
            error.message ||
            ""
        );


    if (
        message.includes(
            "在庫不足"
        ) ||
        message.includes(
            "在庫が不足"
        )
    ) {

        return "在庫が不足しているため、注文を登録できませんでした。";

    }


    if (
        message.includes(
            "注文はすでに"
        )
    ) {

        return message;

    }


    if (
        message.includes(
            "営業日"
        ) &&
        (
            message.includes(
                "締"
            ) ||
            message.includes(
                "終了"
            )
        )
    ) {

        return "この営業日は締め処理済みのため、注文を登録できません。";

    }


    if (
        error.code === "23505"
    ) {

        return "同じ注文が重複して登録された可能性があります。";

    }


    if (
        error.code === "23503"
    ) {

        return "指定された商品が存在しません。";

    }


    if (
        error.code === "PGRST202"
    ) {

        return "注文登録機能がデータベースに正しく設定されていません。";

    }


    if (
        error.code === "42501"
    ) {

        return "この操作を実行する権限がありません。";

    }


    if (
        error.code === "42883"
    ) {

        return "データベースの注文機能が正しく設定されていません。";

    }


    return (
        error.message ||
        "処理に失敗しました。"
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

        console.warn(
            message
        );

        return;

    }


    toast.textContent =
        message;


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
