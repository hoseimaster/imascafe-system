import { supabase } from "./supabase.js";
import { showConfirmModal } from "./confirm-modal.js";

import {
    isAdmin,
    isSuperAdmin,
    getOperatorName,
    getTerminalId
} from "./auth.js";


let initialized = false;
let resetLoading = false;

let selectedResetCode = "";
let selectedResetType = "";
let selectedResetDate = null;


/* ========================================
   初期化
======================================== */

export function initializeReset() {

    if (initialized) {
        return;
    }

    initialized = true;

    setupResetEvents();

}


/* ========================================
   イベント
======================================== */

function setupResetEvents() {

    const resetButton =
        document.getElementById(
            "settingsResetButton"
        );


    if (resetButton) {

        resetButton.addEventListener(
            "click",
            handleOpenResetButton
        );

    }


    const resetCodeForm =
        document.getElementById(
            "resetCodeForm"
        );


    if (resetCodeForm) {

        resetCodeForm.addEventListener(
            "submit",
            handleResetCodeSubmit
        );

    }


    document.addEventListener(
        "click",
        handleResetButtonClick,
        true
    );


    const resetCodeOverlay =
        document.getElementById(
            "resetCodeModalOverlay"
        );


    if (resetCodeOverlay) {

        resetCodeOverlay.addEventListener(
            "click",
            (event) => {

                if (
                    event.target ===
                    resetCodeOverlay
                ) {

                    closeResetCodeModal();

                }

            }
        );

    }


    const resetActionOverlay =
        document.getElementById(
            "resetActionModalOverlay"
        );


    if (resetActionOverlay) {

        resetActionOverlay.addEventListener(
            "click",
            (event) => {

                if (
                    event.target ===
                    resetActionOverlay
                ) {

                    closeResetActionModal();

                }

            }
        );

    }


    removeResetCloseButtons();


    document.addEventListener(
        "keydown",
        handleResetEscapeKey
    );

}


/* ========================================
   リセット画面
======================================== */

function handleOpenResetButton(event) {

    event.preventDefault();
    event.stopPropagation();

    openResetCodeModal();

}


/* ========================================
   リセット関連ボタン
======================================== */

function handleResetButtonClick(event) {

    const target =
        event.target instanceof Element
            ? event.target
            : null;


    if (!target) {
        return;
    }


    const codeCancel =
        target.closest(
            "#resetCodeCancel"
        );


    if (codeCancel) {

        event.preventDefault();
        event.stopImmediatePropagation();

        closeResetCodeModal();

        return;
    }


    const actionCancel =
        target.closest(
            "#resetActionCancel"
        );


    if (actionCancel) {

        event.preventDefault();
        event.stopImmediatePropagation();

        closeResetActionModal();

        return;
    }


    const dateCancel =
        target.closest(
            "[data-reset-date-cancel]"
        );


    if (dateCancel) {

        event.preventDefault();
        event.stopImmediatePropagation();

        closeDynamicDateModal(null);

        return;
    }


    const dateButton =
        target.closest(
            "#resetDateButton"
        );


    if (dateButton) {

        event.preventDefault();
        event.stopImmediatePropagation();

        handleResetTypeSelect("date");

        return;
    }


    const allButton =
        target.closest(
            "#resetAllDataButton"
        );


    if (allButton) {

        event.preventDefault();
        event.stopImmediatePropagation();

        handleResetTypeSelect("all");

        return;
    }


    const completeButton =
        target.closest(
            "#resetCompleteButton"
        );


    if (completeButton) {

        event.preventDefault();
        event.stopImmediatePropagation();

        handleResetTypeSelect("full");

        return;
    }


    const dateConfirm =
        target.closest(
            "[data-reset-date-confirm]"
        );


    if (dateConfirm) {

        event.preventDefault();
        event.stopImmediatePropagation();

        confirmDynamicDateModal();

    }

}


/* ========================================
   Escape
======================================== */

function handleResetEscapeKey(event) {

    if (event.key !== "Escape") {
        return;
    }


    const dateModal =
        document.querySelector(
            ".reset-date-selection-overlay"
        );


    if (dateModal) {

        closeDynamicDateModal(null);

        return;
    }


    const actionModal =
        document.getElementById(
            "resetActionModalOverlay"
        );


    if (
        actionModal &&
        isModalVisible(actionModal)
    ) {

        closeResetActionModal();

        return;
    }


    const codeModal =
        document.getElementById(
            "resetCodeModalOverlay"
        );


    if (
        codeModal &&
        isModalVisible(codeModal)
    ) {

        closeResetCodeModal();

    }

}


/* ========================================
   リセットモーダルの×を削除
======================================== */

function removeResetCloseButtons() {

    const selectors = [
        "#resetCodeModalOverlay .modal-close-button",
        "#resetCodeModalOverlay [aria-label='閉じる']",
        "#resetCodeModalOverlay button[aria-label*='閉じ']",
        "#resetActionModalOverlay .modal-close-button",
        "#resetActionModalOverlay [aria-label='閉じる']",
        "#resetActionModalOverlay button[aria-label*='閉じ']"
    ];


    document
        .querySelectorAll(
            selectors.join(",")
        )
        .forEach(
            (button) => {

                button.remove();

            }
        );

}


/* ========================================
   モーダル状態
======================================== */

function isModalVisible(element) {

    if (!element) {
        return false;
    }


    return (
        !element.hidden &&
        element.classList.contains(
            "is-visible"
        )
    );

}


function setModalVisible(
    element,
    visible
) {

    if (!element) {
        return;
    }


    if (visible) {

        element.hidden = false;

        element.removeAttribute(
            "hidden"
        );

        element.classList.add(
            "is-visible"
        );

    } else {

        element.classList.remove(
            "is-visible"
        );

        element.hidden = true;

        element.setAttribute(
            "hidden",
            ""
        );

    }


    updateBodyModalState();

}


/* ========================================
   リセットコード入力
======================================== */

async function openResetCodeModal() {

    if (!isAdmin()) {

        showToast(
            "リセットは管理者のみ実行できます。"
        );

        return;
    }


    if (resetLoading) {
        return;
    }


    closeResetActionModal();

    clearResetState();


    const issuedCodes =
        document.getElementById(
            "resetIssuedCodes"
        );

    if (issuedCodes) {
        issuedCodes.hidden = false;
        issuedCodes.innerHTML = `<div class="loading-message">一時リセットコードを発行しています</div>`;
    }

    try {
        const { data, error: issueError } =
            await supabase.rpc(
                "issue_reset_codes"
            );

        if (issueError) throw issueError;

        if (issuedCodes) {
            const rows = [
                ["日付リセット", data?.date_code],
                ["全データリセット", data?.all_code],
                ["完全初期化", data?.full_code]
            ].filter(([, code]) => code);

            issuedCodes.innerHTML = rows.map(([label, code]) => `
                <div class="reset-issued-code">
                    <span>${label}</span>
                    <strong>${escapeHtml(code)}</strong>
                </div>
            `).join("");
        }
    } catch (issueError) {
        console.error("リセットコード発行エラー:", issueError);
        if (issuedCodes) {
            issuedCodes.innerHTML = `<div class="form-error is-visible">${escapeHtml(getErrorMessage(issueError))}</div>`;
        }
    }


    const modal =
        document.getElementById(
            "resetCodeModalOverlay"
        );


    const input =
        document.getElementById(
            "resetCodeInput"
        );


    const error =
        document.getElementById(
            "resetCodeError"
        );


    if (!modal) {

        console.error(
            "resetCodeModalOverlay が見つかりません。"
        );

        showToast(
            "リセット画面を開けませんでした。"
        );

        return;
    }


    if (input) {

        input.value = "";

        input.disabled = false;

    }


    if (error) {

        error.textContent = "";

        error.hidden = true;

    }


    removeResetCloseButtons();


    setModalVisible(
        modal,
        true
    );


    setTimeout(
        () => {

            if (
                input &&
                !input.disabled &&
                isModalVisible(modal)
            ) {

                input.focus();

            }

        },
        50
    );

}


/* ========================================
   コード入力モーダルを閉じる
======================================== */

function closeResetCodeModal() {

    const modal =
        document.getElementById(
            "resetCodeModalOverlay"
        );


    if (!modal) {
        return;
    }


    setModalVisible(
        modal,
        false
    );


    const input =
        document.getElementById(
            "resetCodeInput"
        );


    if (input) {

        input.blur();

    }

}


/* ========================================
   コード確認
======================================== */

async function handleResetCodeSubmit(event) {

    event.preventDefault();
    event.stopPropagation();


    if (!isAdmin()) {

        showToast(
            "リセットは管理者のみ実行できます。"
        );

        return;
    }


    if (resetLoading) {
        return;
    }


    const input =
        document.getElementById(
            "resetCodeInput"
        );


    if (!input) {

        showToast(
            "リセットコード入力欄を取得できませんでした。"
        );

        return;
    }


    const resetCode =
        String(
            input.value || ""
        ).trim();


    if (!resetCode) {

        showResetCodeError(
            "リセットコードを入力してください。"
        );

        input.focus();

        return;
    }


    resetLoading = true;

    setResetCodeButtonState(true);


    try {

        const result =
            await validateResetCode(
                resetCode
            );


        if (!result) {
            return;
        }


        const resetType =
            normalizeResetType(
                result.reset_type
            );


        if (!resetType) {

            showResetCodeError(
                "リセットコードの種類を取得できませんでした。"
            );

            return;
        }


        selectedResetCode =
            resetCode;

        selectedResetType =
            resetType;


        closeResetCodeModal();

        openResetActionModal(
            resetType
        );

    } catch (error) {

        console.error(
            "リセットコード処理エラー:",
            error
        );

        showResetCodeError(
            getErrorMessage(error)
        );

    } finally {

        resetLoading = false;

        setResetCodeButtonState(false);

    }

}


/* ========================================
   リセットコード検証
======================================== */

async function validateResetCode(resetCode) {

    try {

        const {
            data,
            error
        } =
            await supabase.rpc(
                "validate_reset_code",
                {
                    p_code: resetCode
                }
            );


        if (error) {

            console.error(
                "validate_reset_code エラー:",
                error
            );

            showResetCodeError(
                getErrorMessage(error)
            );

            return null;
        }


        const result =
            Array.isArray(data)
                ? data[0]
                : data;


        if (!result) {

            showResetCodeError(
                "リセットコードが正しくありません。"
            );

            return null;
        }


        if (result.valid === false) {

            showResetCodeError(
                "リセットコードが正しくないか、使用できません。"
            );

            return null;
        }


        const resetType =
            normalizeResetType(
                result.reset_type
            );


        if (!resetType) {

            showResetCodeError(
                "リセットコードの種類を取得できませんでした。"
            );

            return null;
        }


        return {
            ...result,
            reset_type: resetType
        };

    } catch (error) {

        console.error(
            "リセットコード検証例外:",
            error
        );

        showResetCodeError(
            getErrorMessage(error)
        );

        return null;

    }

}


/* ========================================
   操作選択モーダル
======================================== */

function openResetActionModal(resetType) {

    const modal =
        document.getElementById(
            "resetActionModalOverlay"
        );


    if (!modal) {

        showToast(
            "リセット操作画面を開けませんでした。"
        );

        return;
    }


    selectedResetDate = null;


    const dateButton =
        document.getElementById(
            "resetDateButton"
        );


    const allButton =
        document.getElementById(
            "resetAllDataButton"
        );


    const fullButton =
        document.getElementById(
            "resetCompleteButton"
        );


    if (dateButton) {

        dateButton.hidden =
            resetType !== "date";

    }


    if (allButton) {

        allButton.hidden =
            resetType !== "all";

    }


    if (fullButton) {

        fullButton.hidden =
            resetType !== "full";

    }


    const title =
        document.getElementById(
            "resetActionModalTitle"
        );


    const description =
        document.getElementById(
            "resetActionModalDescription"
        );


    if (title) {

        title.textContent =
            "リセット内容を確認";

    }


    if (description) {

        switch (resetType) {

            case "date":

                description.textContent =
                    "指定した開催日の注文データのみを削除します。";

                break;

            case "all":

                description.textContent =
                    "すべての注文データを削除します。商品・在庫・開催日・操作履歴は残ります。";

                break;

            case "full":

                description.textContent =
                    "注文・商品・在庫・開催日・操作履歴を含むシステム内のデータを初期化します。";

                break;

            default:

                description.textContent =
                    getResetTypeLabel(resetType);

        }

    }


    removeResetCloseButtons();

    setModalVisible(
        modal,
        true
    );

}


/* ========================================
   リセット実行前確認
======================================== */

async function handleResetTypeSelect(resetType) {

    if (!isAdmin()) {

        showToast(
            "リセットは管理者のみ実行できます。"
        );

        return;
    }

    if (
        (resetType === "all" || resetType === "full") &&
        !isSuperAdmin()
    ) {
        showToast(
            "全データリセットと完全初期化は最高管理者のみ実行できます。"
        );

        return;
    }


    if (
        resetType !==
        selectedResetType
    ) {

        showToast(
            "このリセットコードでは実行できない操作です。"
        );

        return;
    }


    if (resetLoading) {
        return;
    }


    selectedResetDate = null;


    if (resetType === "date") {

        const targetDate =
            await selectResetDate();


        if (!targetDate) {
            return;
        }


        selectedResetDate =
            targetDate;

    }


    closeResetActionModal();


    if (resetType === "full") {

        const firstConfirmed =
            await showConfirmModal(
                "注文・商品・在庫・開催日・操作履歴などのデータを初期化します。\n\n認証情報やリセットコード、注文IDの連番は維持されます。\n\nこの操作は取り消せません。",
                {
                    title: "完全初期化を続けますか？",
                    confirmText: "確認して次へ",
                    cancelText: "キャンセル",
                    tone: "danger",
                    operation: "reset-full-first"
                }
            );


        if (!firstConfirmed) {

            clearResetState();

            return;
        }


        const secondConfirmed =
            await showConfirmModal(
                "完全初期化したデータを元に戻すことはできません。\n\n管理者による最終確認です。",
                {
                    title: "最終確認",
                    confirmText: "完全初期化を実行",
                    cancelText: "中止する",
                    tone: "danger",
                    operation: "reset-full-final"
                }
            );


        if (!secondConfirmed) {

            clearResetState();

            return;
        }

    } else {

        const typeLabel =
            getResetTypeLabel(
                resetType
            );


        const targetLabel =
            selectedResetDate
                ? `対象日：${formatDate(
                    selectedResetDate
                )}`
                : "";


        let warning =
            "この操作は取り消せません。";


        if (resetType === "date") {

            warning =
                `${targetLabel}\n\n指定した日の注文データのみ削除します。\n\n${warning}`;

        }


        if (resetType === "all") {

            warning =
                `すべての注文データを削除します。\n\n${warning}`;

        }


        const confirmed =
            await showConfirmModal(
                warning,
                {
                    title: `${typeLabel}を実行しますか？`,
                    confirmText: "リセットを実行",
                    cancelText: "キャンセル",
                    tone: "danger",
                    operation: resetType === "date"
                        ? "reset-date-final"
                        : "reset-all-final"
                }
            );


        if (!confirmed) {

            clearResetState();

            return;
        }

    }


    await executeReset(
        selectedResetCode,
        selectedResetDate
    );

}


/* ========================================
   リセット対象日取得
======================================== */

async function selectResetDate() {

    try {

        const {
            data,
            error
        } =
            await supabase.rpc(
                "get_reset_event_days"
            );


        if (error) {

            console.error(
                "get_reset_event_days エラー:",
                error
            );

            showToast(
                getErrorMessage(error)
            );

            return null;
        }


        const eventDays =
            Array.isArray(data)
                ? data
                : [];


        const uniqueDates =
            new Map();


        eventDays.forEach(
            (day) => {

                const date =
                    String(
                        day?.event_date ||
                        day?.date ||
                        ""
                    ).trim();


                if (!date) {
                    return;
                }


                if (
                    !/^\d{4}-\d{2}-\d{2}$/.test(
                        date
                    )
                ) {
                    return;
                }


                if (
                    !uniqueDates.has(date)
                ) {

                    uniqueDates.set(
                        date,
                        day
                    );

                }

            }
        );


        const dates =
            Array.from(
                uniqueDates.entries()
            ).sort(
                (a, b) =>
                    a[0].localeCompare(
                        b[0]
                    )
            );


        if (!dates.length) {

            showToast(
                "注文データが存在する日付がありません。"
            );

            return null;
        }


        const options =
            dates
                .map(
                    (
                        [
                            date,
                            day
                        ],
                        index
                    ) => {

                        const label =
                            String(
                                day?.label ||
                                day?.name ||
                                ""
                            ).trim();


                        const safeDate =
                            escapeHtml(
                                date
                            );


                        const safeLabel =
                            escapeHtml(
                                label
                            );


                        const displayLabel =
                            label
                                ? `${formatDate(
                                    date
                                )}（${safeLabel}）`
                                : formatDate(
                                    date
                                );


                        return `
                            <option value="${safeDate}">
                                ${index + 1}. ${displayLabel}
                            </option>
                        `;

                    }
                )
                .join("");


        return await showDateSelectionDialog(
            options
        );

    } catch (error) {

        console.error(
            "対象日取得例外:",
            error
        );

        showToast(
            getErrorMessage(error)
        );

        return null;

    }

}


/* ========================================
   日付選択
======================================== */

function showDateSelectionDialog(options) {

    return new Promise(
        (resolve) => {

            const existing =
                document.querySelector(
                    ".reset-date-selection-overlay"
                );


            if (existing) {

                if (
                    typeof existing._resetClose ===
                    "function"
                ) {

                    existing._resetClose(
                        null
                    );

                } else {

                    existing.remove();

                }

            }


            const overlay =
                document.createElement(
                    "div"
                );


            overlay.className =
                "modal-overlay is-visible reset-date-selection-overlay";


            overlay.innerHTML = `
                <div
                    class="modal reset-date-selection-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="resetDateSelectionTitle"
                >

                    <div class="modal-header">

                        <div>

                            <h2 id="resetDateSelectionTitle">
                                対象日を選択
                            </h2>

                            <p>
                                注文データが存在する日付から選択してください。
                            </p>

                        </div>

                    </div>


                    <div class="modal-body">

                        <div class="form-group">

                            <label for="resetTargetDate">
                                対象日
                            </label>

                            <select
                                id="resetTargetDate"
                                class="form-input"
                            >
                                ${options}
                            </select>

                        </div>

                    </div>


                    <div class="modal-footer">

                        <button
                            type="button"
                            class="button button-secondary"
                            data-reset-date-cancel
                        >
                            キャンセル
                        </button>


                        <button
                            type="button"
                            class="button button-primary"
                            data-reset-date-confirm
                        >
                            次へ
                        </button>

                    </div>

                </div>
            `;


            document.body.appendChild(
                overlay
            );


            updateBodyModalState();


            const select =
                overlay.querySelector(
                    "#resetTargetDate"
                );


            let finished = false;


            const cleanup =
                () => {

                    document.removeEventListener(
                        "keydown",
                        escapeHandler
                    );


                    if (
                        overlay.parentNode
                    ) {

                        overlay.remove();

                    }


                    updateBodyModalState();

                };


            const close =
                (value) => {

                    if (finished) {
                        return;
                    }


                    finished = true;

                    cleanup();

                    resolve(value);

                };


            const escapeHandler =
                (event) => {

                    if (
                        event.key ===
                        "Escape"
                    ) {

                        event.preventDefault();

                        close(null);

                    }

                };


            overlay.addEventListener(
                "click",
                (event) => {

                    if (
                        event.target ===
                        overlay
                    ) {

                        close(null);

                    }

                }
            );


            overlay._resetClose =
                close;


            document.addEventListener(
                "keydown",
                escapeHandler
            );


            if (select) {

                setTimeout(
                    () => {

                        if (!finished) {

                            select.focus();

                        }

                    },
                    50
                );

            }

        }
    );

}


/* ========================================
   日付選択キャンセル
======================================== */

function closeDynamicDateModal(value) {

    const overlay =
        document.querySelector(
            ".reset-date-selection-overlay"
        );


    if (!overlay) {
        return;
    }


    if (
        typeof overlay._resetClose ===
        "function"
    ) {

        overlay._resetClose(
            value
        );

        return;
    }


    overlay.remove();

    updateBodyModalState();

}


/* ========================================
   日付選択確定
======================================== */

function confirmDynamicDateModal() {

    const overlay =
        document.querySelector(
            ".reset-date-selection-overlay"
        );


    if (!overlay) {
        return;
    }


    const select =
        overlay.querySelector(
            "#resetTargetDate"
        );


    const value =
        String(
            select?.value ||
            ""
        ).trim();


    if (!value) {

        showToast(
            "対象日を選択してください。"
        );

        return;
    }


    if (
        typeof overlay._resetClose ===
        "function"
    ) {

        overlay._resetClose(
            value
        );

    }

}


/* ========================================
   リセット実行
======================================== */

async function executeReset(
    resetCode,
    targetDate
) {

    if (resetLoading) {
        return;
    }


    if (!resetCode) {

        showToast(
            "リセットコードを取得できませんでした。"
        );

        return;
    }


    if (!isAdmin()) {

        showToast(
            "リセットを実行する権限がありません。"
        );

        return;
    }


    resetLoading = true;


    try {

        const operatorName =
            String(
                getOperatorName() || ""
            ).trim();


        const terminal =
            String(
                getTerminalId() || ""
            ).trim();


        const {
            data,
            error
        } =
            await supabase.rpc(
                "execute_reset",
                {
                    p_code:
                        resetCode,

                    p_operator_name:
                        operatorName,

                    p_terminal:
                        terminal,

                    p_target_date:
                        targetDate ||
                        null
                }
            );


        if (error) {

            console.error(
                "execute_reset エラー:",
                error
            );

            showToast(
                getErrorMessage(error)
            );

            return;
        }


        const result =
            Array.isArray(data)
                ? data[0]
                : data;


        showToast(
            getResetCompleteMessage(
                result
            )
        );


        clearResetState();


        setTimeout(
            () => {

                window.location.reload();

            },
            1200
        );

    } catch (error) {

        console.error(
            "リセット実行例外:",
            error
        );

        showToast(
            getErrorMessage(error)
        );

    } finally {

        resetLoading = false;

    }

}


/* ========================================
   リセット種類
======================================== */

function normalizeResetType(type) {

    const value =
        String(
            type ?? ""
        )
            .trim()
            .toLowerCase();


    if (
        value === "date" ||
        value === "日付" ||
        value === "日付リセット"
    ) {

        return "date";

    }


    if (
        value === "all" ||
        value === "全データ" ||
        value === "全データリセット"
    ) {

        return "all";

    }


    if (
        value === "full" ||
        value === "完全" ||
        value === "完全初期化"
    ) {

        return "full";

    }


    return "";

}


/* ========================================
   リセット種類表示
======================================== */

function getResetTypeLabel(type) {

    const labels = {

        date:
            "日付リセット",

        all:
            "全データリセット",

        full:
            "完全初期化"

    };


    return (
        labels[type] ||
        type ||
        "不明"
    );

}


/* ========================================
   完了メッセージ
======================================== */

function getResetCompleteMessage(result) {

    const type =
        normalizeResetType(
            result?.reset_type
        ) ||
        selectedResetType;


    switch (type) {

        case "date":

            return (
                "対象日の注文データをリセットしました。"
            );


        case "all":

            return (
                "すべての注文データをリセットしました。"
            );


        case "full":

            return (
                "システムを初期状態に戻しました。"
            );


        default:

            return (
                "リセットが完了しました。"
            );

    }

}


/* ========================================
   状態クリア
======================================== */

function clearResetState() {

    selectedResetCode = "";

    selectedResetType = "";

    selectedResetDate = null;

}


/* ========================================
   エラー表示
======================================== */

function showResetCodeError(message) {

    const error =
        document.getElementById(
            "resetCodeError"
        );


    if (!error) {

        showToast(message);

        return;
    }


    error.textContent =
        message;

    error.hidden =
        false;

}


/* ========================================
   コード確認ボタン
======================================== */

function setResetCodeButtonState(
    loading
) {

    const button =
        document.querySelector(
            '#resetCodeForm button[type="submit"]'
        );


    if (!button) {
        return;
    }


    if (loading) {

        if (
            !button.dataset.originalText
        ) {

            button.dataset.originalText =
                button.textContent.trim();

        }


        button.disabled = true;

        button.textContent =
            "確認中…";

    } else {

        button.disabled = false;

        button.textContent =
            button.dataset.originalText ||
            "確認";

        delete button.dataset.originalText;

    }

}


/* ========================================
   操作モーダルを閉じる
======================================== */

function closeResetActionModal() {

    const modal =
        document.getElementById(
            "resetActionModalOverlay"
        );


    if (!modal) {
        return;
    }


    setModalVisible(
        modal,
        false
    );

}


/* ========================================
   body
======================================== */

function updateBodyModalState() {

    const visibleModal =
        document.querySelector(
            ".modal-overlay.is-visible:not([hidden])"
        );


    if (visibleModal) {

        document.body.classList.add(
            "modal-open"
        );

    } else {

        document.body.classList.remove(
            "modal-open"
        );

    }

}


/* ========================================
   日付表示
======================================== */

function formatDate(value) {

    if (!value) {
        return "";
    }


    const parts =
        String(value).split("-");


    if (parts.length !== 3) {

        return String(value);

    }


    return (
        `${parts[0]}年` +
        `${Number(parts[1])}月` +
        `${Number(parts[2])}日`
    );

}


/* ========================================
   エラー
======================================== */

function getErrorMessage(error) {

    if (!error) {

        return (
            "リセットに失敗しました。"
        );

    }


    const code =
        String(
            error.code || ""
        );


    const message =
        String(
            error.message || ""
        );


    const details =
        String(
            error.details || ""
        );


    const hint =
        String(
            error.hint || ""
        );


    const text =
        `${code} ${message} ${details} ${hint}`;


    console.error(
        "リセットエラー詳細:",
        {
            code,
            message,
            details,
            hint
        }
    );


    if (code === "PGRST202") {

        if (
            text.includes(
                "validate_reset_code"
            )
        ) {

            return (
                "リセットコード検証機能がデータベースに設定されていません。"
            );

        }


        if (
            text.includes(
                "execute_reset"
            )
        ) {

            return (
                "リセット実行機能がデータベースに設定されていません。"
            );

        }


        if (
            text.includes(
                "get_reset_event_days"
            )
        ) {

            return (
                "リセット対象日取得機能がデータベースに設定されていません。"
            );

        }


        return (
            "リセット機能がデータベースに設定されていません。"
        );

    }


    if (code === "PGRST203") {

        return (
            "リセット機能のデータベース関数が重複しています。"
        );

    }


    if (code === "42501") {

        return (
            "リセットを実行する権限がありません。"
        );

    }


    if (code === "22P02") {

        return (
            "リセットに使用した値の形式が正しくありません。"
        );

    }


    if (code === "23514") {

        return (
            "リセット処理でデータ制約エラーが発生しました。"
        );

    }


    if (code === "42883") {

        return (
            "リセット機能のデータベース関数が存在しません。"
        );

    }


    if (
        text.includes("404")
    ) {

        return (
            "リセット機能のデータベース設定を確認してください。"
        );

    }


    if (
        text.includes("permission") ||
        text.includes("Permission")
    ) {

        return (
            "リセットを実行する権限がありません。"
        );

    }


    if (
        text.includes("invalid") ||
        text.includes("Invalid")
    ) {

        return (
            "リセットコードまたは入力値が正しくありません。"
        );

    }


    if (
        text.includes("expired") ||
        text.includes("Expired")
    ) {

        return (
            "このリセットコードは使用できません。"
        );

    }


    if (
        text.includes("target") ||
        text.includes("Target")
    ) {

        return (
            "リセット対象日を指定してください。"
        );

    }


    return (
        message ||
        "リセットに失敗しました。"
    );

}


/* ========================================
   トースト
======================================== */

function showToast(message) {

    const toast =
        document.getElementById(
            "toast"
        );


    if (!toast) {

        console.warn(message);

        return;
    }


    toast.textContent =
        message;


    toast.hidden =
        false;


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

                toast.hidden =
                    true;

            },
            3000
        );

}


/* ========================================
   HTMLエスケープ
======================================== */

function escapeHtml(value) {

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

export function refreshReset() {

    return Promise.resolve();

}
