import {
    supabase
} from "./supabase.js";

import {
    APP_CONFIG
} from "./config.js";

import {
    getTerminalId,
    canManageIncome
} from "./auth.js";

import { confirmIncomeDeletion as showIncomeDeletionConfirm } from "./confirm-modal.js";

async function confirmIncomeDeletion() {
    return showIncomeDeletionConfirm();
}


let initialized = false;
let loading = false;
let saving = false;

let toastTimer = null;


/* ========================================
   初期化
======================================== */

export function initializeIncome() {

    if (initialized) {
        return;
    }

    initialized = true;

    setupIncomeEvents();

    loadIncome();
}


/* ========================================
   イベント設定
======================================== */

function setupIncomeEvents() {

    const dateInput =
        document.getElementById(
            "incomeDate"
        );


    if (dateInput) {
        dateInput.value = "";

        const filter =
            dateInput.closest(
                ".income-filter"
            );

        if (filter) {
            filter.hidden = true;
        }
    }


    const form =
        document.getElementById(
            "incomeFormElement"
        );


    if (form) {

        form.addEventListener(
            "submit",
            handleIncomeSubmit
        );
    }


    const addButton =
        document.getElementById(
            "incomeAddButton"
        );


    if (addButton) {

        addButton.addEventListener(
            "click",
            () => {

                if (!canManageIncome()) {

                    showToast(
                        "この操作を実行する権限がありません"
                    );

                    return;
                }

                openIncomeForm();
            }
        );
    }


    const cancelButton =
        document.getElementById(
            "incomeCancelButton"
        );


    if (cancelButton) {

        cancelButton.addEventListener(
            "click",
            (event) => {

                event.preventDefault();

                closeIncomeForm();
            }
        );
    }


    const closeButton =
        document.getElementById(
            "incomeModalCloseButton"
        );


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closeIncomeForm
        );
    }


    const overlay =
        document.getElementById(
            "incomeModalOverlay"
        );


    if (overlay) {

        overlay.addEventListener(
            "click",
            (event) => {

                if (
                    event.target ===
                    overlay
                ) {

                    closeIncomeForm();
                }
            }
        );
    }


    document.addEventListener(
        "click",
        handleIncomeAction
    );
}


/* ========================================
   収入一覧取得
======================================== */

export async function loadIncome() {

    if (loading) {
        return;
    }


    const list =
        document.getElementById(
            "incomeList"
        );


    if (!list) {
        return;
    }


    loading = true;


    list.innerHTML = `
        <div class="loading-message">
            収入情報を読み込んでいます
        </div>
    `;


    try {

        const query =
            supabase
                .from("incomes")
                .select("*")
                .order(
                    "income_date",
                    {
                        ascending:
                            false
                    }
                )
                .order(
                    "id",
                    {
                        ascending:
                            false
                    }
                );


        const {
            data,
            error
        } =
            await query;


        if (error) {
            throw error;
        }


        renderIncome(
            Array.isArray(data)
                ? data
                : []
        );

    } catch (error) {

        console.error(
            "収入情報取得エラー:",
            error
        );


        list.innerHTML = `
            <div class="empty-state">
                収入情報を取得できませんでした
            </div>
        `;


        updateIncomeTotal(
            0
        );


        showToast(
            getErrorMessage(
                error
            )
        );

    } finally {

        loading = false;
    }
}


/* ========================================
   収入一覧表示
======================================== */

function renderIncome(
    incomes
) {

    const list =
        document.getElementById(
            "incomeList"
        );


    if (!list) {
        return;
    }


    if (!incomes.length) {

        list.innerHTML = `
            <div class="empty-state">
                収入は登録されていません
            </div>
        `;


        updateIncomeTotal(
            0
        );

        return;
    }


    let total = 0;


    const cards =
        incomes
            .map(
                (income) => {

                    const amount =
                        Number(
                            income.amount
                        ) || 0;


                    total += amount;


                    const id =
                        String(
                            income.id ??
                            ""
                        );


                    const description =
                        String(
                            income.description ??
                            ""
                        );


                    const date =
                        String(
                            income.income_date ??
                            ""
                        );


                    const operator =
                        String(
                            income.operator_name ??
                            ""
                        );


                    return `
                        <article
                            class="income-card"
                            data-income-id="${escapeHtml(id)}"
                        >

                            <div class="income-card-header">

                                <div class="income-card-title">
                                    ${escapeHtml(description)}
                                </div>

                            </div>


                            <div class="income-card-amount">
                                ${formatYen(amount)}
                            </div>


                            <div class="income-card-info">

                                <div class="income-card-info-row">

                                    <span class="income-card-label">
                                        収入日
                                    </span>

                                    <span>
                                        ${escapeHtml(
                                            formatDate(date)
                                        )}
                                    </span>

                                </div>


                                ${
                                    operator
                                        ? `
                                            <div class="income-card-info-row">

                                                <span class="income-card-label">
                                                    担当者
                                                </span>

                                                <span>
                                                    ${escapeHtml(
                                                        operator
                                                    )}
                                                </span>

                                            </div>
                                        `
                                        : ""
                                }

                            </div>


                            ${
                                canManageIncome()
                                    ? `
                                        <div class="income-card-actions">

                                            <button
                                                type="button"
                                                class="secondary-button"
                                                data-income-edit="${escapeHtml(id)}"
                                            >
                                                編集
                                            </button>

                                            <button
                                                type="button"
                                                class="danger-button"
                                                data-income-delete="${escapeHtml(id)}"
                                            >
                                                削除
                                            </button>

                                        </div>
                                    `
                                    : ""
                            }

                        </article>
                    `;
                }
            )
            .join("");


    list.innerHTML = `
        <div class="income-card-grid">
            ${cards}
        </div>
    `;


    updateIncomeTotal(
        total
    );
}


/* ========================================
   合計表示
======================================== */

function updateIncomeTotal(
    total
) {

    const element =
        document.getElementById(
            "incomeTotal"
        );


    if (!element) {
        return;
    }


    element.textContent =
        formatYen(
            total
        );
}


/* ========================================
   登録・編集フォームを開く
======================================== */

function openIncomeForm(
    income = null
) {

    if (!canManageIncome()) {

        showToast(
            "この操作を実行する権限がありません"
        );

        return;
    }


    const overlay =
        document.getElementById(
            "incomeModalOverlay"
        );


    if (!overlay) {

        console.error(
            "incomeModalOverlay が見つかりません"
        );

        return;
    }


    const title =
        document.getElementById(
            "incomeFormTitle"
        );


    const idInput =
        document.getElementById(
            "incomeId"
        );


    const amountInput =
        document.getElementById(
            "incomeAmount"
        );


    const itemInput =
        document.getElementById(
            "incomeItem"
        );


    const dateInput =
        document.getElementById(
            "incomeDateInput"
        );


    const memoInput =
        document.getElementById(
            "incomeMemo"
        );


    if (title) {

        title.textContent =
            income
                ? "収入を編集"
                : "収入を登録";
    }


    if (idInput) {

        idInput.value =
            income
                ? String(
                    income.id ??
                    ""
                )
                : "";
    }


    if (amountInput) {

        amountInput.value =
            income
                ? String(
                    Number(
                        income.amount
                    ) || 0
                )
                : "";
    }


    if (itemInput) {

        itemInput.value =
            income
                ? getIncomeItem(
                    income.description
                )
                : "";
    }


    if (dateInput) {

        dateInput.value =
            income
                ? String(
                    income.income_date ??
                    ""
                )
                : getTodayJST();
    }


    if (memoInput) {

        memoInput.value =
            income
                ? getIncomeMemo(
                    income.description
                )
                : "";
    }


    overlay.hidden =
        false;


    overlay.classList.remove(
        "is-visible"
    );


    requestAnimationFrame(
        () => {

            requestAnimationFrame(
                () => {

                    overlay.classList.add(
                        "is-visible"
                    );
                }
            );
        }
    );


    setTimeout(
        () => {

            if (itemInput) {

                itemInput.focus();
            }

        },
        100
    );
}


/* ========================================
   フォームを閉じる
======================================== */

function closeIncomeForm() {

    const overlay =
        document.getElementById(
            "incomeModalOverlay"
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
        180
    );
}


/* ========================================
   登録・更新
======================================== */

async function handleIncomeSubmit(
    event
) {

    event.preventDefault();


    if (!canManageIncome()) {

        showToast(
            "この操作を実行する権限がありません"
        );

        return;
    }


    if (saving) {
        return;
    }


    const id =
        String(
            document.getElementById(
                "incomeId"
            )?.value ||
            ""
        ).trim();


    const amountValue =
        String(
            document.getElementById(
                "incomeAmount"
            )?.value ||
            ""
        ).trim();


    const amount =
        Number(
            amountValue
        );


    const item =
        String(
            document.getElementById(
                "incomeItem"
            )?.value ||
            ""
        ).trim();


    const date =
        String(
            document.getElementById(
                "incomeDateInput"
            )?.value ||
            ""
        ).trim();


    const memo =
        String(
            document.getElementById(
                "incomeMemo"
            )?.value ||
            ""
        ).trim();


    if (!amountValue) {

        showToast(
            "収入金額を入力してください"
        );

        return;
    }


    if (
        !Number.isFinite(
            amount
        ) ||
        amount <= 0
    ) {

        showToast(
            "収入金額を正しく入力してください"
        );

        return;
    }


    if (!Number.isInteger(amount)) {

        showToast(
            "収入金額は整数で入力してください"
        );

        return;
    }


    if (!item) {

        showToast(
            "収入項目を入力してください"
        );

        return;
    }


    if (!date) {

        showToast(
            "収入日を入力してください"
        );

        return;
    }


    const operatorName =
        String(
            localStorage.getItem(
                APP_CONFIG.OPERATOR_NAME_STORAGE_KEY
            ) ||
            ""
        ).trim();


    if (!operatorName) {

        showToast(
            "担当者情報を取得できませんでした"
        );

        return;
    }


    saving = true;


    const saveButton =
        document.getElementById(
            "incomeSaveButton"
        );


    if (saveButton) {

        saveButton.disabled =
            true;
    }


    try {

        const description =
            memo
                ? `${item}：${memo}`
                : item;


        const payload = {
            income_date:
                date,

            amount:
                amount,

            description:
                description,

            operator_name:
                operatorName,

            terminal:
                getTerminalId()
        };


        if (id) {

            const {
                data,
                error
            } = await supabase.rpc(
                "update_income",
                {
                    p_income_id:
                        Number(id),

                    p_income_date:
                        date,

                    p_amount:
                        amount,

                    p_description:
                        description,

                    p_operator_name:
                        operatorName,

                    p_terminal:
                        getTerminalId()
                }
            );


            if (error) {
                throw error;
            }


            if (data !== true) {

                throw {
                    code:
                        "P0001",

                    message:
                        "収入を更新できませんでした"
                };
            }


            showToast(
                "収入を更新しました"
            );

        } else {

            const {
                data,
                error
            } = await supabase.rpc(
                "create_income",
                {
                    p_income_date:
                        date,

                    p_amount:
                        amount,

                    p_description:
                        description,

                    p_operator_name:
                        operatorName,

                    p_terminal:
                        getTerminalId()
                }
            );


            if (error) {
                throw error;
            }


            if (
                data === null ||
                data === undefined
            ) {

                throw {
                    code:
                        "P0001",

                    message:
                        "収入を登録できませんでした"
                };
            }


            showToast(
                "収入を登録しました"
            );
        }


        closeIncomeForm();


        await loadIncome();

    } catch (error) {

        console.error(
            "収入保存エラー:",
            error
        );


        showToast(
            getErrorMessage(
                error
            )
        );

    } finally {

        saving = false;


        if (saveButton) {

            saveButton.disabled =
                false;
        }
    }
}


/* ========================================
   編集・削除イベント
======================================== */

async function handleIncomeAction(
    event
) {

    const target =
        event.target;


    if (
        !target ||
        typeof target.closest !==
            "function"
    ) {

        return;
    }


    if (!canManageIncome()) {
        return;
    }


    const editButton =
        target.closest(
            "[data-income-edit]"
        );


    if (editButton) {

        const id =
            editButton.dataset
                .incomeEdit;


        await editIncome(
            id
        );

        return;
    }


    const deleteButton =
        target.closest(
            "[data-income-delete]"
        );


    if (deleteButton) {

        const id =
            deleteButton.dataset
                .incomeDelete;


        await deleteIncome(
            id
        );
    }
}


/* ========================================
   編集
======================================== */

async function editIncome(
    id
) {

    if (!canManageIncome()) {

        showToast(
            "この操作を実行する権限がありません"
        );

        return;
    }


    if (!id) {
        return;
    }


    try {

        const {
            data,
            error
        } =
            await supabase
                .from("incomes")
                .select("*")
                .eq(
                    "id",
                    id
                )
                .maybeSingle();


        if (error) {
            throw error;
        }


        if (!data) {

            showToast(
                "指定された収入が見つかりません"
            );

            return;
        }


        openIncomeForm(
            data
        );

    } catch (error) {

        console.error(
            "収入取得エラー:",
            error
        );


        showToast(
            getErrorMessage(
                error
            )
        );
    }
}


/* ========================================
   削除
======================================== */

async function deleteIncome(
    id
) {

    if (!canManageIncome()) {

        showToast(
            "この操作を実行する権限がありません"
        );

        return;
    }


    if (!id) {
        return;
    }


    const confirmed =
        await confirmIncomeDeletion();


    if (!confirmed) {
        return;
    }


    try {

        const {
            data,
            error
        } = await supabase.rpc(
            "delete_income",
            {
                p_income_id:
                    Number(id),

                p_operator_name:
                    String(
                        localStorage.getItem(
                            APP_CONFIG.OPERATOR_NAME_STORAGE_KEY
                        ) ||
                        ""
                    ).trim(),

                p_terminal:
                    getTerminalId()
            }
        );


        if (error) {
            throw error;
        }


        if (data !== true) {

            throw {
                code:
                    "P0001",

                message:
                    "収入を削除できませんでした"
            };
        }


        showToast(
            "収入を削除しました"
        );


        await loadIncome();

    } catch (error) {

        console.error(
            "収入削除エラー:",
            error
        );


        showToast(
            getErrorMessage(
                error
            )
        );
    }
}


/* ========================================
   更新
======================================== */

export async function refreshIncome() {

    await loadIncome();
}


/* ========================================
   収入項目取得
======================================== */

function getIncomeItem(
    description
) {

    const value =
        String(
            description ??
            ""
        );


    const separatorIndex =
        value.indexOf(
            "："
        );


    if (
        separatorIndex >= 0
    ) {

        return value.slice(
            0,
            separatorIndex
        ).trim();
    }


    return value.trim();
}


/* ========================================
   メモ取得
======================================== */

function getIncomeMemo(
    description
) {

    const value =
        String(
            description ??
            ""
        );


    const separatorIndex =
        value.indexOf(
            "："
        );


    if (
        separatorIndex >= 0
    ) {

        return value.slice(
            separatorIndex + 1
        ).trim();
    }


    return "";
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
                part.type !==
                "literal"
            ) {

                values[
                    part.type
                ] =
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
        ).split("-");


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
   金額表示
======================================== */

function formatYen(
    value
) {

    const amount =
        Number(
            value
        ) || 0;


    return `${amount.toLocaleString(
        "ja-JP"
    )}円`;
}


/* ========================================
   エラー表示
======================================== */

function getErrorMessage(
    error
) {

    if (!error) {

        return "処理に失敗しました";
    }


    if (
        error.code ===
        "42501"
    ) {

        return "この操作を実行する権限がありません";
    }


    if (
        error.code ===
        "23514"
    ) {

        return "入力内容がデータベースの条件を満たしていません";
    }


    if (
        error.code ===
        "23505"
    ) {

        return "同じ収入が重複して登録された可能性があります";
    }


    if (
        error.code ===
        "22P02"
    ) {

        return "入力された値を確認してください";
    }


    if (
        error.code ===
        "42703"
    ) {

        return "収入テーブルの項目構成を確認してください";
    }


    if (
        error.code ===
        "42P01"
    ) {

        return "収入テーブルが見つかりません";
    }


    if (
        error.code ===
        "PGRST116"
    ) {

        return "指定された収入が見つかりません";
    }


    return (
        error.message ||
        "処理に失敗しました"
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


    toast.hidden =
        false;


    toast.classList.add(
        "is-visible"
    );


    if (toastTimer) {

        clearTimeout(
            toastTimer
        );
    }


    toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "is-visible"
                );


                setTimeout(
                    () => {

                        if (
                            !toast.classList.contains(
                                "is-visible"
                            )
                        ) {

                            toast.hidden =
                                true;
                        }

                    },
                    150
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
