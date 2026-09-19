import { supabase } from "./supabase.js";

import {
    APP_CONFIG
} from "./config.js";

import {
    getTerminalId,
    canManageOrders
} from "./auth.js";

import { confirmOrderCancellation } from "./confirm-modal.js";


let initialized = false;

let ordersLoading = false;

let cancelLoading = false;


/* ========================================
   初期化
======================================== */

export function initializeOrderHistory() {

    if (initialized) {
        return;
    }

    initialized = true;

    setupOrderHistoryEvents();
    setupOrderHistoryDetailEvents();

    loadOrderHistory();

}


/* ========================================
   イベント設定
======================================== */

function setupOrderHistoryEvents() {

    const dateInput =
        document.getElementById(
            "orderHistoryDate"
        );


    if (dateInput) {

        dateInput.value =
            getTodayJST();

    }


    const clearButton =
        document.getElementById(
            "orderHistoryDateClear"
        );


    if (clearButton) {

        clearButton.addEventListener(
            "click",
            (event) => {

                event.preventDefault();
                event.stopPropagation();

                if (dateInput) {

                    dateInput.value = "";

                }

                loadOrderHistory();

            }
        );

    }


    if (dateInput) {

        dateInput.addEventListener(
            "change",
            () => {

                loadOrderHistory();

            }
        );

    }


    document.addEventListener(
        "app:screenchange",
        async (event) => {

            const screen =
                event.detail?.screen;

            if (
                screen ===
                "orderHistoryScreen"
            ) {

                await loadOrderHistory();

            }

        }
    );

}


/* ========================================
   注文履歴詳細イベント
======================================== */

function setupOrderHistoryDetailEvents() {

    document.addEventListener(
        "click",
        (event) => {

            const detailButton =
                event.target.closest(
                    "[data-order-history-detail]"
                );


            if (detailButton) {

                event.preventDefault();
                event.stopPropagation();

                const orderId =
                    detailButton.dataset
                        .orderHistoryDetail;


                if (orderId) {

                    showOrderDetail(
                        orderId
                    );

                }

                return;

            }


            const cancelButton =
                event.target.closest(
                    "[data-order-history-cancel]"
                );


            if (cancelButton) {

                event.preventDefault();
                event.stopPropagation();

                const orderId =
                    cancelButton.dataset
                        .orderHistoryCancel;


                if (orderId) {

                    cancelOrder(
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
   注文履歴取得
======================================== */

export async function loadOrderHistory() {

    if (ordersLoading) {
        return;
    }


    const container =
        document.getElementById(
            "orderHistoryList"
        );


    if (!container) {

        console.warn(
            "orderHistoryList が見つかりません。"
        );

        return;

    }


    ordersLoading = true;


    container.innerHTML = `
        <div class="loading-message">
            注文履歴を読み込んでいます…
        </div>
    `;


    const dateInput =
        document.getElementById(
            "orderHistoryDate"
        );


    const selectedDate =
        String(
            dateInput?.value ||
            ""
        ).trim();


    try {

        let query =
            supabase
                .from("orders")
                .select(`
                    id,
                    order_id,
                    order_date,
                    order_time,
                    customer_count,
                    status,
                    terminal,
                    operator_name,
                    created_at,
                    updated_at,
                    cancelled_at,
                    order_items (
                        id,
                        product_id,
                        quantity,
                        unit_price
                    )
                `)
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
                );


        if (selectedDate) {

            query =
                query.eq(
                    "order_date",
                    selectedDate
                );

        }


        const {
            data,
            error
        } =
            await query;


        if (error) {

            throw error;

        }


        const orders =
            Array.isArray(data)
                ? data
                : [];


        renderOrderHistory(
            orders
        );

    } catch (error) {

        console.error(
            "注文履歴取得エラー:",
            error
        );


        container.innerHTML = `
            <div class="empty-state">
                注文履歴を取得できませんでした
            </div>
        `;

    } finally {

        ordersLoading = false;

    }

}


/* ========================================
   注文履歴表示
======================================== */

function renderOrderHistory(
    orders
) {

    const container =
        document.getElementById(
            "orderHistoryList"
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
                calculateOrderTotal(
                    order
                );


            const totalItems =
                calculateTotalItems(
                    order
                );


            const cancelled =
                String(
                    order.status ||
                    ""
                ).toLowerCase() ===
                "cancelled";


            const operatorName =
                String(
                    order.operator_name ||
                    ""
                ).trim();


            html += `
                <div class="
                    active-order-item
                    ${cancelled
                        ? "is-cancelled"
                        : ""
                    }
                ">

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
                            data-order-history-detail="${escapeHtml(
                                order.order_id
                            )}"
                        >
                            詳細
                        </button>


                        ${
                            cancelled
                                ? `
                                    <span class="order-history-cancelled">
                                        取消済み
                                    </span>
                                `
                                : `
                                    <button
                                        type="button"
                                        class="
                                            button
                                            button-danger
                                        "
                                        data-order-history-cancel="${escapeHtml(
                                            order.order_id
                                        )}"
                                    >
                                        取消
                                    </button>
                                `
                        }

                    </div>

                </div>
            `;

        }
    );


    container.innerHTML =
        html;

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


    /*
     * 注文画面と同じモーダルを使用
     */

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
                .select(`
                    id,
                    order_id,
                    order_date,
                    order_time,
                    customer_count,
                    status,
                    terminal,
                    operator_name,
                    created_at,
                    updated_at,
                    cancelled_at
                `)
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
                    unit_price
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


        const items =
            Array.isArray(
                orderItems
            )
                ? orderItems
                : [];


        let productMap =
            new Map();


        if (items.length) {

            const productIds =
                [
                    ...new Set(
                        items.map(
                            (item) =>
                                Number(
                                    item.product_id
                                )
                        )
                        .filter(
                            (id) =>
                                Number.isInteger(
                                    id
                                ) &&
                                id > 0
                        )
                    )
                ];


            if (productIds.length) {

                const {
                    data: productData,
                    error: productError
                } =
                    await supabase
                        .from("products")
                        .select(`
                            id,
                            name,
                            category,
                            price,
                            provided_quantity
                        `)
                        .in(
                            "id",
                            productIds
                        );


                if (productError) {

                    throw productError;

                }


                (
                    Array.isArray(
                        productData
                    )
                        ? productData
                        : []
                )
                .forEach(
                    (product) => {

                        productMap.set(
                            String(
                                product.id
                            ),
                            product
                        );

                    }
                );

            }

        }


        const enrichedItems =
            items.map(
                (item) => {

                    return {
                        ...item,
                        products:
                            productMap.get(
                                String(
                                    item.product_id
                                )
                            ) ||
                            null
                    };

                }
            );


        renderOrderDetail(
            order,
            enrichedItems
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
        calculateOrderTotalFromItems(
            orderItems
        );


    const totalItems =
        calculateTotalItemsFromItems(
            orderItems
        );


    const operatorName =
        String(
            order.operator_name ||
            ""
        ).trim();


    const terminal =
        String(
            order.terminal ||
            ""
        ).trim();


    const orderDate =
        formatDate(
            order.order_date
        );


    const orderTime =
        formatTime(
            order.order_time
        );


    const cancelled =
        String(
            order.status ||
            ""
        ).toLowerCase() ===
        "cancelled";


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
                            item.products ||
                            {};


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


                ${
                    cancelled
                        ? `
                            <div class="order-detail-row">

                                <span class="order-detail-label">
                                    状態
                                </span>

                                <span class="order-detail-value">
                                    取消済み
                                </span>

                            </div>
                        `
                        : ""
                }

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
                "[data-order-history-cancel]"
            )
        )
        .find(
            (element) =>
                String(
                    element.dataset
                        .orderHistoryCancel
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


            throw new Error(
                getSupabaseErrorMessage(
                    error
                )
            );

        }


        if (
            data === false
        ) {

            showToast(
                "注文はすでに取り消されています。"
            );


            await loadOrderHistory();

            return;

        }


        showToast(
            `${orderId} を取り消しました。`
        );


        await loadOrderHistory();

    } catch (error) {

        console.error(
            "注文取消エラー:",
            error
        );


        showToast(
            error?.message ||
            "注文の取消に失敗しました。"
        );

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

export async function refreshOrderHistory() {

    await loadOrderHistory();

}


/* ========================================
   注文合計
======================================== */

function calculateOrderTotal(
    order
) {

    const items =
        Array.isArray(
            order?.order_items
        )
            ? order.order_items
            : [];


    return calculateOrderTotalFromItems(
        items
    );

}


function calculateOrderTotalFromItems(
    items
) {

    return items.reduce(
        (
            total,
            item
        ) => {

            const quantity =
                Number(
                    item?.quantity
                ) || 0;


            const price =
                Number(
                    item?.unit_price
                ) || 0;


            return (
                total +
                (
                    quantity *
                    price
                )
            );

        },
        0
    );

}


/* ========================================
   点数
======================================== */

function calculateTotalItems(
    order
) {

    const items =
        Array.isArray(
            order?.order_items
        )
            ? order.order_items
            : [];


    return calculateTotalItemsFromItems(
        items
    );

}


function calculateTotalItemsFromItems(
    items
) {

    return items.reduce(
        (
            total,
            item
        ) => {

            return (
                total +
                (
                    Number(
                        item?.quantity
                    ) || 0
                )
            );

        },
        0
    );

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

        return "注文機能がデータベースに正しく設定されていません。";

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
