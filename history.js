import { supabase } from "./supabase.js";
import {
    APP_CONFIG
} from "./config.js";


let initialized = false;
let historyLoading = false;
let historyRows = [];

const HISTORY_OPERATION_OPTIONS = [
    ["", "すべての操作"],
    ["login", "ログイン"],
    ["logout", "ログアウト"],
    ["order_create", "注文登録"],
    ["order_cancel", "注文取消"],
    ["order_datetime_update", "注文情報変更"],
    ["inventory_add", "在庫入庫"],
    ["inventory_update", "在庫修正"],
    ["product_create", "商品登録"],
    ["product_update", "商品変更"],
    ["product_delete", "商品削除"],
    ["product_stop", "販売停止"],
    ["event_day_create", "開催日登録"],
    ["event_day_update", "開催日変更"],
    ["event_day_activate", "開催日有効化"],
    ["event_day_deactivate", "開催日無効化"],
    ["settings_update", "設定変更"],
    ["expense_create", "支出登録"],
    ["expense_update", "支出変更"],
    ["expense_delete", "支出削除"],
    ["accounting_adjustment", "会計調整"],
    ["reset", "リセット"]
];


/* ========================================
   初期化
======================================== */

export function initializeHistory() {

    if (initialized) {
        return;
    }

    initialized = true;

    setupHistoryFilters();
    setupHistoryModal();
    setupHistoryDetailEvents();

    loadHistory();


    document.addEventListener(
        "app:screenchange",
        (event) => {

            if (
                event.detail?.screen ===
                "historyScreen"
            ) {
                loadHistory();
            }
        }
    );
}


/* ========================================
   フィルター
======================================== */

function setupHistoryFilters() {

    const dateInput =
        document.getElementById(
            "historyDate"
        );

    const typeSelect =
        document.getElementById(
            "historyOperationType"
        );


    if (dateInput) {

        dateInput.addEventListener(
            "change",
            () => {
                loadHistory();
            }
        );
    }


    if (typeSelect) {

        setupHistoryOperationOptions(
            typeSelect
        );

        typeSelect.addEventListener(
            "change",
            () => {
                loadHistory();
            }
        );
    }
}


/* ========================================
   詳細ボタン
======================================== */

function setupHistoryDetailEvents() {

    document.addEventListener(
        "click",
        (event) => {

            const target =
                event.target;

            if (
                !target ||
                typeof target.closest !==
                "function"
            ) {
                return;
            }


            const button =
                target.closest(
                    ".history-detail-button"
                );


            if (!button) {
                return;
            }


            const historyId =
                button.dataset.historyDetail;


            if (!historyId) {

                console.warn(
                    "履歴IDがありません"
                );

                return;
            }


            const row =
                historyRows.find(
                    (item) =>
                        String(item.id) ===
                        String(historyId)
                );


            if (!row) {

                console.warn(
                    "履歴詳細のデータが見つかりません:",
                    historyId
                );

                return;
            }


            event.preventDefault();
            event.stopPropagation();

            showHistoryDetail(row);
        },
        true
    );
}


/* ========================================
   詳細モーダル
======================================== */

function setupHistoryModal() {

    const overlay =
        document.getElementById(
            "modalOverlay"
        );

    const closeButton =
        document.getElementById(
            "modalCloseButton"
        );


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            (event) => {

                event.preventDefault();
                event.stopPropagation();

                closeHistoryModal();
            }
        );
    }


    if (overlay) {

        overlay.addEventListener(
            "click",
            (event) => {

                if (
                    event.target ===
                    overlay
                ) {
                    closeHistoryModal();
                }
            }
        );
    }


    document.addEventListener(
        "keydown",
        (event) => {

            const modal =
                document.getElementById(
                    "modalOverlay"
                );


            if (
                event.key === "Escape" &&
                modal &&
                !modal.hidden
            ) {
                closeHistoryModal();
            }
        }
    );
}


/* ========================================
   履歴取得
======================================== */

export async function loadHistory() {

    if (historyLoading) {
        return;
    }


    historyLoading = true;


    const container =
        document.getElementById(
            "historyList"
        );


    if (!container) {

        historyLoading = false;

        return;
    }


    try {

        const dateInput =
            document.getElementById(
                "historyDate"
            );

        const typeSelect =
            document.getElementById(
                "historyOperationType"
            );


        const selectedDate =
            dateInput?.value || "";

        const selectedType =
            normalizeOperationType(
                typeSelect?.value || ""
            );


        let query =
            supabase
                .from(
                    "operation_history"
                )
                .select(`
                    id,
                    operated_at,
                    operator_name,
                    terminal,
                    operation_type,
                    order_id,
                    target,
                    description,
                    before_value,
                    after_value,
                    event_date,
                    created_at
                `)
                .order(
                    "operated_at",
                    {
                        ascending: false
                    }
                )
                .limit(300);


        if (selectedDate) {

            query =
                query.eq(
                    "event_date",
                    selectedDate
                );
        }


        if (selectedType) {

            query =
                query.eq(
                    "operation_type",
                    selectedType
                );
        }


        const {
            data,
            error
        } = await query;


        if (error) {

            console.error(
                "履歴取得エラー:",
                error
            );


            historyRows = [];


            container.innerHTML = `
                <div class="empty-state">
                    履歴を取得できませんでした
                </div>
            `;

            return;
        }


        historyRows =
            Array.isArray(data)
                ? data
                : [];


        renderHistory(
            historyRows
        );

    } catch (error) {

        console.error(
            "履歴読み込みエラー:",
            error
        );


        historyRows = [];


        container.innerHTML = `
            <div class="empty-state">
                履歴を取得できませんでした
            </div>
        `;

    } finally {

        historyLoading = false;

    }
}


/* ========================================
   操作種類フィルター正規化
======================================== */

function normalizeOperationType(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }


    const text =
        String(
            value
        ).trim();


    if (
        !text ||
        text === "all" ||
        text === "すべて"
    ) {
        return "";
    }


    const aliases = {

        order_created:
            "order_create",

        order_create:
            "order_create",


        order_cancelled:
            "order_cancel",

        order_cancelled:
            "order_cancel",

        order_cancel:
            "order_cancel",


        order_datetime_updated:
            "order_datetime_update",

        order_datetime_update:
            "order_datetime_update",


        inventory_added:
            "inventory_add",

        inventory_add:
            "inventory_add",

        inventory_updated:
            "inventory_update",

        inventory_update:
            "inventory_update",


        product_created:
            "product_create",

        product_create:
            "product_create",


        product_updated:
            "product_update",

        product_update:
            "product_update",

        product_deleted:
            "product_delete",

        product_delete:
            "product_delete",

        product_stopped:
            "product_stop",

        product_stop:
            "product_stop",


        event_day_created:
            "event_day_create",

        event_day_create:
            "event_day_create",


        event_day_updated:
            "event_day_update",

        event_day_update:
            "event_day_update",

        event_day_activated:
            "event_day_activate",

        event_day_activate:
            "event_day_activate",


        event_day_deactivated:
            "event_day_deactivate",

        event_day_deactivate:
            "event_day_deactivate",


        settings_updated:
            "settings_update",

        settings_update:
            "settings_update",


        expense_created:
            "expense_create",

        expense_create:
            "expense_create",


        expense_updated:
            "expense_update",

        expense_update:
            "expense_update",

        expense_deleted:
            "expense_delete",

        expense_delete:
            "expense_delete",

        login:
            "login",

        logout:
            "logout",

        reset:
            "reset",


        accounting_adjusted:
            "accounting_adjustment",

        accounting_adjustment:
            "accounting_adjustment",


        注文登録:
            "order_create",

        注文キャンセル:
            "order_cancel",

        注文取消:
            "order_cancel",

        注文日時変更:
            "order_datetime_update",

        注文情報変更:
            "order_datetime_update",

        在庫追加:
            "inventory_add",

        在庫入庫:
            "inventory_add",

        在庫修正:
            "inventory_update",

        商品追加:
            "product_create",

        商品登録:
            "product_create",

        商品変更:
            "product_update",

        商品削除:
            "product_delete",

        販売停止:
            "product_stop",

        日付追加:
            "event_day_create",

        開催日登録:
            "event_day_create",

        日付変更:
            "event_day_update",

        開催日変更:
            "event_day_update",

        開催日有効化:
            "event_day_activate",

        開催日無効化:
            "event_day_deactivate",

        リセット:
            "reset",

        経費登録:
            "expense_create",

        経費変更:
            "expense_update",

        支出登録:
            "expense_create",

        支出変更:
            "expense_update",

        支出削除:
            "expense_delete",

        会計調整:
            "accounting_adjustment",

        ログイン:
            "login",

        ログアウト:
            "logout"
    };


    return (
        aliases[text] ||
        text
    );
}


/* ========================================
   履歴一覧
======================================== */

function renderHistory(
    rows
) {

    const container =
        document.getElementById(
            "historyList"
        );


    if (!container) {
        return;
    }


    if (!rows.length) {

        container.innerHTML = `
            <div class="empty-state">
                該当する履歴はありません
            </div>
        `;

        return;
    }


    container.innerHTML =
        rows
            .map(
                (row) => {

                    const description =
                        getHistoryDescription(
                            row
                        );


                    return `
                        <div
                            class="history-item"
                        >

                            <div
                                class="history-item-header"
                            >

                                <span
                                    class="history-item-type"
                                >
                                    ${escapeHtml(
                                        getOperationLabel(
                                            row.operation_type
                                        )
                                    )}
                                </span>

                                <span
                                    class="history-item-date"
                                >
                                    ${escapeHtml(
                                        formatDateTime(
                                            row.operated_at
                                        )
                                    )}
                                </span>

                            </div>


                            <p
                                class="history-item-description"
                            >
                                ${escapeHtml(
                                    description
                                )}
                            </p>


                            <button
                                type="button"
                                class="button history-detail-button"
                                data-history-detail="${escapeHtml(
                                    row.id
                                )}"
                            >
                                詳細
                            </button>

                        </div>
                    `;
                }
            )
            .join("");
}


/* ========================================
   詳細表示
======================================== */

function showHistoryDetail(
    row
) {

    const overlay =
        document.getElementById(
            "modalOverlay"
        );

    const content =
        document.getElementById(
            "modalContent"
        );

    const title =
        document.getElementById(
            "modalTitle"
        );


    if (
        !overlay ||
        !content
    ) {

        console.error(
            "詳細モーダルのHTML要素が見つかりません"
        );

        return;
    }


    if (title) {

        title.textContent =
            "操作履歴の詳細";
    }


    const description =
        getHistoryDescription(
            row
        );


    const before =
        createReadableDetail(
            row.before_value
        );


    const after =
        createReadableDetail(
            row.after_value
        );


    let html = `

        <div
            class="history-detail-content"
        >

            <div
                class="history-detail-main"
            >

                <div
                    class="history-detail-main-label"
                >
                    操作内容
                </div>

                <div
                    class="history-detail-main-value"
                >
                    ${escapeHtml(
                        description
                    )}
                </div>

            </div>


            <div
                class="history-detail-section"
            >

                <div
                    class="history-detail-label"
                >
                    操作
                </div>

                <div
                    class="history-detail-value"
                >
                    ${escapeHtml(
                        getOperationLabel(
                            row.operation_type
                        )
                    )}
                </div>

            </div>


            <div
                class="history-detail-section"
            >

                <div
                    class="history-detail-label"
                >
                    操作日時
                </div>

                <div
                    class="history-detail-value"
                >
                    ${escapeHtml(
                        formatDateTime(
                            row.operated_at
                        )
                    )}
                </div>

            </div>
    `;


    if (
        hasValue(
            row.operator_name
        )
    ) {

        html += `

            <div
                class="history-detail-section"
            >

                <div
                    class="history-detail-label"
                >
                    操作者
                </div>

                <div
                    class="history-detail-value"
                >
                    ${escapeHtml(
                        row.operator_name
                    )}
                </div>

            </div>
        `;
    }


    if (
        hasValue(
            row.terminal
        )
    ) {

        html += `

            <div
                class="history-detail-section"
            >

                <div
                    class="history-detail-label"
                >
                    操作端末
                </div>

                <div
                    class="history-detail-value history-detail-id"
                >
                    ${escapeHtml(
                        row.terminal
                    )}
                </div>

            </div>
        `;
    }


    if (
        hasValue(
            row.target
        )
    ) {

        html += `

            <div
                class="history-detail-section"
            >

                <div
                    class="history-detail-label"
                >
                    対象
                </div>

                <div
                    class="history-detail-value"
                >
                    ${escapeHtml(
                        formatTarget(
                            row.target
                        )
                    )}
                </div>

            </div>
        `;
    }


    if (
        hasValue(
            row.order_id
        )
    ) {

        html += `

            <div
                class="history-detail-section"
            >

                <div
                    class="history-detail-label"
                >
                    注文ID
                </div>

                <div
                    class="history-detail-value history-detail-id"
                >
                    ${escapeHtml(
                        row.order_id
                    )}
                </div>

            </div>
        `;
    }


    const relatedIds =
        getRelatedIds(
            row
        );


    relatedIds.forEach(
        (item) => {

            html += `

                <div
                    class="history-detail-section"
                >

                    <div
                        class="history-detail-label"
                    >
                        ${escapeHtml(
                            item.label
                        )}
                    </div>

                    <div
                        class="history-detail-value history-detail-id"
                    >
                        ${escapeHtml(
                            item.value
                        )}
                    </div>

                </div>
            `;
        }
    );


    if (
        before ||
        after
    ) {

        html += `

            <div
                class="history-detail-change-section"
            >

                <div
                    class="history-detail-change-title"
                >
                    変更内容
                </div>
        `;


        if (before) {

            html += `

                <div
                    class="history-detail-change-block"
                >

                    <div
                        class="history-detail-change-label"
                    >
                        変更前
                    </div>

                    <div
                        class="history-detail-change-value"
                    >
                        ${before}
                    </div>

                </div>
            `;
        }


        if (after) {

            html += `

                <div
                    class="history-detail-change-block"
                >

                    <div
                        class="history-detail-change-label"
                    >
                        変更後
                    </div>

                    <div
                        class="history-detail-change-value"
                    >
                        ${after}
                    </div>

                </div>
            `;
        }


        html += `
            </div>
        `;
    }


    html += `
        </div>
    `;


    content.innerHTML =
        html;


    overlay.hidden = false;


    requestAnimationFrame(
        () => {

            overlay.classList.add(
                "is-visible"
            );
        }
    );


    document.body.classList.add(
        "modal-open"
    );
}


/* ========================================
   詳細データ表示
======================================== */

function createReadableDetail(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "";
    }


    let parsed =
        value;


    if (
        typeof value ===
        "string"
    ) {

        try {

            parsed =
                JSON.parse(
                    value
                );

        } catch {

            return `
                <div
                    class="history-detail-plain"
                >
                    ${escapeHtml(
                        value
                    )}
                </div>
            `;
        }
    }


    if (
        parsed === null ||
        typeof parsed !==
        "object"
    ) {

        return `
            <div
                class="history-detail-plain"
            >
                ${escapeHtml(
                    formatReadableValue(
                        parsed
                    )
                )}
            </div>
        `;
    }


    if (
        Array.isArray(parsed)
    ) {

        return `
            <div
                class="history-detail-array"
            >
                ${
                    parsed
                        .map(
                            (item) => {

                                if (
                                    typeof item ===
                                    "object" &&
                                    item !== null
                                ) {

                                    return `
                                        <div
                                            class="history-detail-object"
                                        >
                                            ${createReadableDetail(
                                                item
                                            )}
                                        </div>
                                    `;
                                }


                                return `
                                    <div
                                        class="history-detail-line"
                                    >
                                        ${escapeHtml(
                                            formatReadableValue(
                                                item
                                            )
                                        )}
                                    </div>
                                `;
                            }
                        )
                        .join("")
                }
            </div>
        `;
    }


    return `
        <div
            class="history-detail-info"
        >
            ${
                Object.entries(
                    parsed
                )
                    .map(
                        ([key, itemValue]) => {

                            return `
                                <div
                                    class="history-detail-row"
                                >

                                    <span
                                        class="history-detail-key"
                                    >
                                        ${escapeHtml(
                                            getDetailLabel(
                                                key
                                            )
                                        )}
                                    </span>

                                    <span
                                        class="history-detail-data"
                                    >
                                        ${escapeHtml(
                                            formatReadableValue(
                                                itemValue,
                                                key
                                            )
                                        )}
                                    </span>

                                </div>
                            `;
                        }
                    )
                    .join("")
            }
        </div>
    `;
}


/* ========================================
   関連ID
======================================== */

function getRelatedIds(
    row
) {

    const result =
        [];


    const found =
        new Map();


    [
        row.before_value,
        row.after_value
    ]
        .forEach(
            (value) => {

                const parsed =
                    parseDetailValue(
                        value
                    );


                if (
                    parsed &&
                    typeof parsed ===
                    "object"
                ) {

                    collectIds(
                        parsed,
                        found
                    );
                }
            }
        );


    found.forEach(
        (item) => {

            if (
                item.key ===
                "order_id"
            ) {
                return;
            }


            result.push({

                label:
                    getDetailLabel(
                        item.key
                    ),

                value:
                    String(
                        item.value
                    )
            });
        }
    );


    return result;
}


/* ========================================
   ID収集
======================================== */

function collectIds(
    value,
    result
) {

    if (
        !result ||
        !(result instanceof Map)
    ) {
        return;
    }


    if (
        Array.isArray(value)
    ) {

        value.forEach(
            (item) => {

                collectIds(
                    item,
                    result
                );
            }
        );

        return;
    }


    if (
        !value ||
        typeof value !==
        "object"
    ) {
        return;
    }


    Object.entries(
        value
    )
        .forEach(
            ([key, itemValue]) => {

                if (
                    (
                        key ===
                        "product_id" ||

                        key ===
                        "user_id" ||

                        key ===
                        "id"
                    ) &&
                    hasValue(
                        itemValue
                    )
                ) {

                    const unique =
                        `${key}:${itemValue}`;


                    if (
                        !result.has(
                            unique
                        )
                    ) {

                        result.set(
                            unique,
                            {
                                key,
                                value:
                                    itemValue
                            }
                        );
                    }
                }


                if (
                    itemValue &&
                    typeof itemValue ===
                    "object"
                ) {

                    collectIds(
                        itemValue,
                        result
                    );
                }
            }
        );
}


/* ========================================
   詳細値解析
======================================== */

function parseDetailValue(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }


    if (
        typeof value !==
        "string"
    ) {
        return value;
    }


    try {

        return JSON.parse(
            value
        );

    } catch {

        return null;
    }
}


/* ========================================
   対象表示
======================================== */

function formatTarget(
    target
) {

    const labels = {

        product:
            "商品",

        products:
            "商品",

        order:
            "注文",

        orders:
            "注文",

        inventory:
            "在庫",

        event_day:
            "開催日",

        settings:
            "設定",

        account:
            "アカウント",

        user:
            "アカウント"
    };


    const text =
        String(
            target
        );


    return (
        labels[text] ||
        text
    );
}


/* ========================================
   履歴説明
======================================== */

function getHistoryDescription(
    row
) {

    if (
        row.description &&
        String(
            row.description
        ).trim()
    ) {

        return convertDescription(
            row.description
        );
    }


    const descriptions = {

        order_create:
            "注文を登録しました",

        order_cancel:
            "注文を取り消しました",

        order_datetime_update:
            "注文日時を変更しました",

        inventory_add:
            "在庫を追加しました",

        inventory_update:
            "在庫数を修正しました",

        product_create:
            "商品を登録しました",

        product_update:
            "商品情報を変更しました",

        product_delete:
            "商品を削除しました",

        product_stop:
            "商品の販売を停止しました",

        event_day_create:
            "開催日を登録しました",

        event_day_update:
            "開催日を変更しました",

        event_day_activate:
            "開催日を有効にしました",

        event_day_deactivate:
            "開催日を無効にしました",

        settings_update:
            "設定を変更しました",

        reset:
            "データをリセットしました",

        expense_create:
            "経費を登録しました",

        expense_update:
            "経費を変更しました",

        expense_delete:
            "支出を削除しました",

        accounting_adjustment:
            "会計を調整しました",

        login:
            "ログインしました",

        logout:
            "ログアウトしました"
    };


    return (
        descriptions[
            row.operation_type
        ] ||
        "操作を実行しました"
    );
}


/* ========================================
   説明文変換
======================================== */

function convertDescription(
    value
) {

    return String(
        value
    )
        .replace(
            /\bfood\b/gi,
            "デザート"
        )
        .replace(
            /\bdrink\b/gi,
            "ドリンク"
        )
        .replace(
            /\bdessert\b/gi,
            "デザート"
        )
        .replace(
            /\bset\b/gi,
            "セット"
        )
        .replace(
            /\bother\b/gi,
            "その他"
        );
}


/* ========================================
   操作種類
======================================== */

function getOperationLabel(
    type
) {

    const labels = {

        order_create:
            "注文登録",

        order_cancel:
            "注文取消",

        order_datetime_update:
            "注文情報変更",

        inventory_add:
            "在庫入庫",

        inventory_update:
            "在庫修正",

        product_create:
            "商品登録",

        product_update:
            "商品変更",

        product_delete:
            "商品削除",

        product_stop:
            "販売停止",

        event_day_create:
            "開催日登録",

        event_day_update:
            "開催日変更",

        event_day_activate:
            "開催日有効化",

        event_day_deactivate:
            "開催日無効化",

        settings_update:
            "設定変更",

        reset:
            "リセット",

        expense_create:
            "支出登録",

        expense_update:
            "支出変更",

        expense_delete:
            "支出削除",

        accounting_adjustment:
            "会計調整",

        login:
            "ログイン",

        logout:
            "ログアウト"
    };


    return (
        labels[type] ||
        type ||
        "操作"
    );
}


/* ========================================
   詳細項目名
======================================== */

function getDetailLabel(
    key
) {

    const labels = {

        id:
            "ID",

        name:
            "名称",

        product_name:
            "商品名",

        product_id:
            "商品ID",

        category:
            "カテゴリ",

        price:
            "価格",

        stock:
            "在庫数",

        quantity:
            "数量",

        count:
            "数量",

        customer_count:
            "来客数",

        total:
            "合計",

        total_amount:
            "合計金額",

        amount:
            "金額",

        subtotal:
            "小計",

        status:
            "状態",

        is_active:
            "有効状態",

        is_available:
            "販売状態",

        order_id:
            "注文ID",

        order_date:
            "注文日",

        order_time:
            "注文時刻",

        operator_name:
            "操作者",

        terminal:
            "端末",

        event_date:
            "開催日",

        start_time:
            "開始時刻",

        end_time:
            "終了時刻",

        description:
            "内容",

        reason:
            "理由",

        role:
            "権限",

        display_name:
            "表示名",

        user_id:
            "ユーザーID"
    };


    return (
        labels[key] ||
        key
    );
}


/* ========================================
   値表示
======================================== */

function formatReadableValue(
    value,
    key = ""
) {

    if (
        value === null ||
        value === undefined
    ) {
        return "なし";
    }


    if (
        typeof value ===
        "boolean"
    ) {

        return value
            ? "有効"
            : "無効";
    }


    if (
        typeof value ===
        "number"
    ) {

        if (
            [
                "price",
                "amount",
                "total",
                "total_amount",
                "subtotal"
            ].includes(
                key
            )
        ) {

            return `${value.toLocaleString(
                "ja-JP"
            )}円`;
        }


        return value.toLocaleString(
            "ja-JP"
        );
    }


    if (
        typeof value ===
        "object"
    ) {

        try {

            return JSON.stringify(
                value
            );

        } catch {

            return String(
                value
            );
        }
    }


    const labels = {

        drink:
            "ドリンク",

        dessert:
            "デザート",

        food:
            "デザート",

        set:
            "セット",

        other:
            "その他",

        preparing:
            "準備中",

        available:
            "販売中",

        active:
            "有効",

        inactive:
            "無効",

        stopped:
            "販売停止",

        admin:
            "管理者",

        staff:
            "スタッフ"
    };


    const text =
        String(
            value
        );


    return (
        labels[text] ||
        text
    );
}


/* ========================================
   日時
======================================== */

function formatDateTime(
    value
) {

    if (!value) {
        return "";
    }


    const date =
        new Date(
            value
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return String(
            value
        );
    }


    return new Intl.DateTimeFormat(
        "ja-JP",
        {
            timeZone:
                APP_CONFIG.TIME_ZONE,

            year:
                "numeric",

            month:
                "2-digit",

            day:
                "2-digit",

            hour:
                "2-digit",

            minute:
                "2-digit",

            second:
                "2-digit",

            hour12:
                false
        }
    ).format(
        date
    );
}


/* ========================================
   値の有無
======================================== */

function hasValue(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return false;
    }


    if (
        typeof value ===
        "object" &&
        !Array.isArray(value) &&
        Object.keys(value).length === 0
    ) {
        return false;
    }


    return true;
}


/* ========================================
   モーダルを閉じる
======================================== */

export function closeHistoryModal() {

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


    document.body.classList.remove(
        "modal-open"
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
   手動更新
======================================== */

export function refreshHistory() {

    return loadHistory();
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


function setupHistoryOperationOptions(
    select
) {

    const selectedValue =
        normalizeOperationType(
            select.value
        );


    select.replaceChildren(
        ...HISTORY_OPERATION_OPTIONS.map(
            ([value, label]) =>
                new Option(
                    label,
                    value,
                    false,
                    value === selectedValue
                )
        )
    );
}
