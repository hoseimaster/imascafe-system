import {
    supabase
} from "./supabase.js";

import {
    APP_CONFIG
} from "./config.js";

import {
    getTerminalId,
    canManageExpenses
} from "./auth.js";


let initialized = false;
let loading = false;
let saving = false;

let toastTimer = null;


/* ========================================
   初期化
======================================== */

export function initializeExpenses() {

    if (initialized) {
        return;
    }

    initialized = true;

    setupExpenseEvents();

    loadExpenses();
}


/* ========================================
   イベント設定
======================================== */

function setupExpenseEvents() {

    const dateInput =
        document.getElementById(
            "expenseDate"
        );


    if (
        dateInput &&
        !dateInput.value
    ) {

        dateInput.value =
            getTodayJST();
    }


    const form =
        document.getElementById(
            "expenseFormElement"
        );


    if (form) {

        form.addEventListener(
            "submit",
            handleExpenseSubmit
        );
    }


    const addButton =
        document.getElementById(
            "expenseAddButton"
        );


    if (addButton) {

        addButton.addEventListener(
            "click",
            () => {

                if (!canManageExpenses()) {

                    showToast(
                        "この操作を実行する権限がありません"
                    );

                    return;
                }

                openExpenseForm();
            }
        );
    }


    const cancelButton =
        document.getElementById(
            "expenseCancelButton"
        );


    if (cancelButton) {

        cancelButton.addEventListener(
            "click",
            (event) => {

                event.preventDefault();

                closeExpenseForm();
            }
        );
    }


    const closeButton =
        document.getElementById(
            "expenseModalCloseButton"
        );


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closeExpenseForm
        );
    }


    const overlay =
        document.getElementById(
            "expenseModalOverlay"
        );


    if (overlay) {

        overlay.addEventListener(
            "click",
            (event) => {

                if (
                    event.target ===
                    overlay
                ) {

                    closeExpenseForm();
                }
            }
        );
    }


    const clearButton =
        document.getElementById(
            "expenseDateClear"
        );


    if (clearButton) {

        clearButton.addEventListener(
            "click",
            () => {

                if (dateInput) {

                    dateInput.value =
                        "";
                }

                loadExpenses();
            }
        );
    }


    if (dateInput) {

        dateInput.addEventListener(
            "change",
            () => {

                loadExpenses();
            }
        );
    }


    document.addEventListener(
        "click",
        handleExpenseAction
    );
}


/* ========================================
   支出一覧取得
======================================== */

export async function loadExpenses() {

    if (loading) {
        return;
    }


    const list =
        document.getElementById(
            "expenseList"
        );


    if (!list) {
        return;
    }


    loading = true;


    list.innerHTML = `
        <div class="loading-message">
            支出情報を読み込んでいます
        </div>
    `;


    try {

        const dateInput =
            document.getElementById(
                "expenseDate"
            );


        const selectedDate =
            String(
                dateInput?.value ||
                ""
            ).trim();


        let query =
            supabase
                .from("expenses")
                .select("*")
                .order(
                    "expense_date",
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


        if (selectedDate) {

            query =
                query.eq(
                    "expense_date",
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


        renderExpenses(
            Array.isArray(data)
                ? data
                : []
        );

    } catch (error) {

        console.error(
            "支出情報取得エラー:",
            error
        );


        list.innerHTML = `
            <div class="empty-state">
                支出情報を取得できませんでした
            </div>
        `;


        updateExpenseTotal(
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
   支出一覧表示
======================================== */

function renderExpenses(
    expenses
) {

    const list =
        document.getElementById(
            "expenseList"
        );


    if (!list) {
        return;
    }


    if (!expenses.length) {

        list.innerHTML = `
            <div class="empty-state">
                支出は登録されていません
            </div>
        `;


        updateExpenseTotal(
            0
        );

        return;
    }


    let total = 0;


    const cards =
        expenses
            .map(
                (expense) => {

                    const amount =
                        Number(
                            expense.amount
                        ) || 0;


                    total += amount;


                    const id =
                        String(
                            expense.id ??
                            ""
                        );


                    const description =
                        String(
                            expense.description ??
                            ""
                        );


                    const date =
                        String(
                            expense.expense_date ??
                            ""
                        );


                    const operator =
                        String(
                            expense.operator_name ??
                            ""
                        );


                    return `
                        <article
                            class="expense-card"
                            data-expense-id="${escapeHtml(id)}"
                        >

                            <div class="expense-card-header">

                                <div class="expense-card-title">
                                    ${escapeHtml(description)}
                                </div>

                            </div>


                            <div class="expense-card-amount">
                                ${formatYen(amount)}
                            </div>


                            <div class="expense-card-info">

                                <div class="expense-card-info-row">

                                    <span class="expense-card-label">
                                        支出日
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
                                            <div class="expense-card-info-row">

                                                <span class="expense-card-label">
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
                                canManageExpenses()
                                    ? `
                                        <div class="expense-card-actions">

                                            <button
                                                type="button"
                                                class="secondary-button"
                                                data-expense-edit="${escapeHtml(id)}"
                                            >
                                                編集
                                            </button>

                                            <button
                                                type="button"
                                                class="danger-button"
                                                data-expense-delete="${escapeHtml(id)}"
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
        <div class="expense-card-grid">
            ${cards}
        </div>
    `;


    updateExpenseTotal(
        total
    );
}


/* ========================================
   合計表示
======================================== */

function updateExpenseTotal(
    total
) {

    const element =
        document.getElementById(
            "expenseTotal"
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

function openExpenseForm(
    expense = null
) {

    if (!canManageExpenses()) {

        showToast(
            "この操作を実行する権限がありません"
        );

        return;
    }


    const overlay =
        document.getElementById(
            "expenseModalOverlay"
        );


    if (!overlay) {

        console.error(
            "expenseModalOverlay が見つかりません"
        );

        return;
    }


    const title =
        document.getElementById(
            "expenseFormTitle"
        );


    const idInput =
        document.getElementById(
            "expenseId"
        );


    const amountInput =
        document.getElementById(
            "expenseAmount"
        );


    const itemInput =
        document.getElementById(
            "expenseItem"
        );


    const dateInput =
        document.getElementById(
            "expenseDateInput"
        );


    const memoInput =
        document.getElementById(
            "expenseMemo"
        );


    if (title) {

        title.textContent =
            expense
                ? "支出を編集"
                : "支出を登録";
    }


    if (idInput) {

        idInput.value =
            expense
                ? String(
                    expense.id ??
                    ""
                )
                : "";
    }


    if (amountInput) {

        amountInput.value =
            expense
                ? String(
                    Number(
                        expense.amount
                    ) || 0
                )
                : "";
    }


    if (itemInput) {

        itemInput.value =
            expense
                ? getExpenseItem(
                    expense.description
                )
                : "";
    }


    if (dateInput) {

        dateInput.value =
            expense
                ? String(
                    expense.expense_date ??
                    ""
                )
                : getTodayJST();
    }


    if (memoInput) {

        memoInput.value =
            expense
                ? getExpenseMemo(
                    expense.description
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

function closeExpenseForm() {

    const overlay =
        document.getElementById(
            "expenseModalOverlay"
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

async function handleExpenseSubmit(
    event
) {

    event.preventDefault();


    if (!canManageExpenses()) {

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
                "expenseId"
            )?.value ||
            ""
        ).trim();


    const amountValue =
        String(
            document.getElementById(
                "expenseAmount"
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
                "expenseItem"
            )?.value ||
            ""
        ).trim();


    const date =
        String(
            document.getElementById(
                "expenseDateInput"
            )?.value ||
            ""
        ).trim();


    const memo =
        String(
            document.getElementById(
                "expenseMemo"
            )?.value ||
            ""
        ).trim();


    if (!amountValue) {

        showToast(
            "支出金額を入力してください"
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
            "支出金額を正しく入力してください"
        );

        return;
    }


    if (!Number.isInteger(amount)) {

        showToast(
            "支出金額は整数で入力してください"
        );

        return;
    }


    if (!item) {

        showToast(
            "支出項目を入力してください"
        );

        return;
    }


    if (!date) {

        showToast(
            "支出日を入力してください"
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
            "expenseSaveButton"
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
            expense_date:
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
                "update_expense",
                {
                    p_expense_id:
                        Number(id),

                    p_expense_date:
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
                        "支出を更新できませんでした"
                };
            }


            showToast(
                "支出を更新しました"
            );

        } else {

            const {
                data,
                error
            } = await supabase.rpc(
                "create_expense",
                {
                    p_expense_date:
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
                        "支出を登録できませんでした"
                };
            }


            showToast(
                "支出を登録しました"
            );
        }


        closeExpenseForm();


        await loadExpenses();

    } catch (error) {

        console.error(
            "支出保存エラー:",
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

async function handleExpenseAction(
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


    if (!canManageExpenses()) {
        return;
    }


    const editButton =
        target.closest(
            "[data-expense-edit]"
        );


    if (editButton) {

        const id =
            editButton.dataset
                .expenseEdit;


        await editExpense(
            id
        );

        return;
    }


    const deleteButton =
        target.closest(
            "[data-expense-delete]"
        );


    if (deleteButton) {

        const id =
            deleteButton.dataset
                .expenseDelete;


        await deleteExpense(
            id
        );
    }
}


/* ========================================
   編集
======================================== */

async function editExpense(
    id
) {

    if (!canManageExpenses()) {

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
                .from("expenses")
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
                "指定された支出が見つかりません"
            );

            return;
        }


        openExpenseForm(
            data
        );

    } catch (error) {

        console.error(
            "支出取得エラー:",
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

async function deleteExpense(
    id
) {

    if (!canManageExpenses()) {

        showToast(
            "この操作を実行する権限がありません"
        );

        return;
    }


    if (!id) {
        return;
    }


    const confirmed =
        window.confirm(
            "この支出を削除しますか？"
        );


    if (!confirmed) {
        return;
    }


    try {

        const {
            data,
            error
        } = await supabase.rpc(
            "delete_expense",
            {
                p_expense_id:
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
                    "支出を削除できませんでした"
            };
        }


        showToast(
            "支出を削除しました"
        );


        await loadExpenses();

    } catch (error) {

        console.error(
            "支出削除エラー:",
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

export async function refreshExpenses() {

    await loadExpenses();
}


/* ========================================
   支出項目取得
======================================== */

function getExpenseItem(
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

function getExpenseMemo(
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

        return "同じ支出が重複して登録された可能性があります";
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

        return "支出テーブルの項目構成を確認してください";
    }


    if (
        error.code ===
        "42P01"
    ) {

        return "支出テーブルが見つかりません";
    }


    if (
        error.code ===
        "PGRST116"
    ) {

        return "指定された支出が見つかりません";
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
