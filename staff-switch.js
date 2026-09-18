/**
 * スタッフ切り替え
 */

import {
    APP_CONFIG
} from "./config.js";

import {
    getTerminalId
} from "./auth.js";


let initialized = false;

let currentOperatorName = "";


/* ========================================
   初期化
======================================== */

export function initializeStaffSwitch() {

    if (initialized) {
        refreshStaffSwitch();
        return;
    }

    initialized = true;

    currentOperatorName =
        getStoredOperatorName();

    createStaffSwitchModal();

    setupStaffSwitchEvents();

    refreshStaffSwitchDisplay();

}


/* ========================================
   保存済み担当者名
======================================== */

function getStoredOperatorName() {

    return String(
        localStorage.getItem(
            APP_CONFIG.OPERATOR_NAME_STORAGE_KEY
        ) ||
        ""
    ).trim();

}


/* ========================================
   担当者名取得
======================================== */

export function getCurrentOperatorName() {

    return String(
        currentOperatorName ||
        getStoredOperatorName() ||
        ""
    ).trim();

}


/* ========================================
   担当者切り替え
======================================== */

function switchOperator() {

    const input =
        document.getElementById(
            "staffSwitchNameInput"
        );

    if (!input) {
        return;
    }


    const name =
        String(
            input.value ||
            ""
        ).trim();


    if (!name) {

        showStaffSwitchMessage(
            "担当者名を入力してください。"
        );

        input.focus();

        return;

    }


    if (name.length > 50) {

        showStaffSwitchMessage(
            "担当者名は50文字以内で入力してください。"
        );

        input.focus();

        return;

    }


    const previousName =
        getCurrentOperatorName();


    if (
        previousName ===
        name
    ) {

        closeStaffSwitchModal();

        return;

    }


    currentOperatorName =
        name;


    localStorage.setItem(
        APP_CONFIG.OPERATOR_NAME_STORAGE_KEY,
        name
    );


    /*
     * 画面上の担当者情報を即時更新
     */
    refreshStaffSwitchDisplay();


    closeStaffSwitchModal();


    /*
     * 担当者変更イベント
     *
     * document側に統一する。
     */
    document.dispatchEvent(
        new CustomEvent(
            "staff:changed",
            {
                detail: {
                    operatorName:
                        name,

                    previousOperatorName:
                        previousName,

                    terminal:
                        getTerminalId()
                }
            }
        )
    );


    /*
     * 操作履歴
     */
    recordStaffSwitch(
        previousName,
        name
    );


    /*
     * 完了通知
     */
    showToast(
        `担当者を「${name}」に変更しました。`
    );

}


/* ========================================
   スタッフ切り替えモーダル生成
======================================== */

function createStaffSwitchModal() {

    if (
        document.getElementById(
            "staffSwitchModal"
        )
    ) {

        return;

    }


    const modal =
        document.createElement(
            "div"
        );


    modal.id =
        "staffSwitchModal";

    modal.className =
        "staff-switch-modal";

    modal.hidden =
        true;


    modal.innerHTML = `

        <div
            class="staff-switch-overlay"
            data-staff-switch-close
        ></div>


        <div
            class="staff-switch-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staffSwitchTitle"
        >

            <div class="staff-switch-header">

                <div
                    id="staffSwitchTitle"
                    class="staff-switch-title"
                >
                    担当者切り替え
                </div>


                <button
                    type="button"
                    class="staff-switch-close"
                    data-staff-switch-close
                    aria-label="閉じる"
                >
                    ×
                </button>

            </div>


            <div class="staff-switch-body">

                <div class="staff-switch-current">

                    <span class="staff-switch-current-label">
                        現在の担当者
                    </span>

                    <strong
                        id="staffSwitchCurrentName"
                        class="staff-switch-current-name"
                    >
                        未設定
                    </strong>

                </div>


                <div class="staff-switch-form">

                    <label
                        for="staffSwitchNameInput"
                        class="staff-switch-label"
                    >
                        新しい担当者名
                    </label>


                    <input
                        type="text"
                        id="staffSwitchNameInput"
                        class="staff-switch-input"
                        maxlength="50"
                        autocomplete="off"
                        placeholder="担当者名を入力"
                    >


                    <div
                        id="staffSwitchMessage"
                        class="staff-switch-message"
                        aria-live="polite"
                    ></div>

                </div>

            </div>


            <div class="staff-switch-actions">

                <button
                    type="button"
                    class="staff-switch-button staff-switch-cancel"
                    data-staff-switch-close
                >
                    キャンセル
                </button>


                <button
                    type="button"
                    id="staffSwitchConfirmButton"
                    class="staff-switch-button staff-switch-confirm"
                >
                    切り替える
                </button>

            </div>

        </div>

    `;


    document.body.appendChild(
        modal
    );

}


/* ========================================
   イベント
======================================== */

function setupStaffSwitchEvents() {

    /*
     * 担当者切り替え・モーダル閉じる
     */
    document.addEventListener(
        "click",
        (event) => {

            const openButton =
                event.target.closest(
                    "[data-staff-switch]"
                );


            if (openButton) {

                event.preventDefault();
                event.stopPropagation();

                openStaffSwitchModal();

                return;

            }


            const closeButton =
                event.target.closest(
                    "[data-staff-switch-close]"
                );


            if (closeButton) {

                event.preventDefault();
                event.stopPropagation();

                closeStaffSwitchModal();

            }

        }
    );


    /*
     * 切り替え確定
     */
    document.addEventListener(
        "click",
        (event) => {

            const confirmButton =
                event.target.closest(
                    "#staffSwitchConfirmButton"
                );


            if (!confirmButton) {
                return;
            }


            event.preventDefault();
            event.stopPropagation();


            if (
                confirmButton.disabled
            ) {
                return;
            }


            confirmButton.disabled =
                true;


            try {

                switchOperator();

            } finally {

                setTimeout(
                    () => {

                        confirmButton.disabled =
                            false;

                    },
                    300
                );

            }

        }
    );


    /*
     * キーボード操作
     */
    document.addEventListener(
        "keydown",
        (event) => {

            const modal =
                document.getElementById(
                    "staffSwitchModal"
                );


            if (
                !modal ||
                modal.hidden
            ) {

                return;

            }


            if (
                event.key ===
                "Escape"
            ) {

                event.preventDefault();

                closeStaffSwitchModal();

                return;

            }


            if (
                event.key ===
                "Enter"
            ) {

                const target =
                    event.target;


                if (
                    target?.id ===
                    "staffSwitchNameInput"
                ) {

                    event.preventDefault();

                    switchOperator();

                }

            }

        }
    );


    /*
     * 外部から担当者名が変更された場合も同期
     */
    document.addEventListener(
        "staff:changed",
        (event) => {

            const operatorName =
                String(
                    event?.detail?.operatorName ||
                    ""
                ).trim();


            if (
                operatorName
            ) {

                currentOperatorName =
                    operatorName;

            } else {

                currentOperatorName =
                    getStoredOperatorName();

            }


            refreshStaffSwitchDisplay();

        }
    );

}


/* ========================================
   モーダルを開く
======================================== */

function openStaffSwitchModal() {

    const modal =
        document.getElementById(
            "staffSwitchModal"
        );


    const input =
        document.getElementById(
            "staffSwitchNameInput"
        );


    const message =
        document.getElementById(
            "staffSwitchMessage"
        );


    if (!modal) {
        return;
    }


    refreshStaffSwitchDisplay();


    if (input) {

        input.value =
            "";

    }


    if (message) {

        message.textContent =
            "";

    }


    modal.hidden =
        false;


    requestAnimationFrame(
        () => {

            modal.classList.add(
                "is-visible"
            );

        }
    );


    document.body.classList.add(
        "staff-switch-open"
    );


    setTimeout(
        () => {

            if (input) {

                input.focus();

            }

        },
        50
    );

}


/* ========================================
   モーダルを閉じる
======================================== */

function closeStaffSwitchModal() {

    const modal =
        document.getElementById(
            "staffSwitchModal"
        );


    if (!modal) {
        return;
    }


    modal.classList.remove(
        "is-visible"
    );


    document.body.classList.remove(
        "staff-switch-open"
    );


    setTimeout(
        () => {

            if (
                !modal.classList.contains(
                    "is-visible"
                )
            ) {

                modal.hidden =
                    true;

            }

        },
        150
    );

}


/* ========================================
   現在の担当者表示
======================================== */

function refreshStaffSwitchDisplay() {

    const name =
        getCurrentOperatorName();


    const displayName =
        name ||
        "未設定";


    /*
     * 切り替えモーダル
     */
    const modalName =
        document.getElementById(
            "staffSwitchCurrentName"
        );


    if (modalName) {

        modalName.textContent =
            displayName;

    }


    /*
     * 共通担当者表示
     */
    document
        .querySelectorAll(
            "[data-current-operator]"
        )
        .forEach(
            (element) => {

                element.textContent =
                    displayName;

            }
        );


    /*
     * ヘッダー右上
     */
    const headerName =
        document.getElementById(
            "headerOperatorName"
        );


    if (headerName) {

        headerName.textContent =
            displayName;

    }


    /*
     * 設定画面
     */
    const settingsName =
        document.getElementById(
            "settingsOperatorName"
        );


    if (settingsName) {

        settingsName.textContent =
            displayName;

    }


    /*
     * ログイン状態として表示される
     * 担当者名用の汎用要素
     */
    document
        .querySelectorAll(
            "[data-operator-name]"
        )
        .forEach(
            (element) => {

                element.textContent =
                    displayName;

            }
        );

}


/* ========================================
   操作履歴
======================================== */

async function recordStaffSwitch(
    previousName,
    newName
) {

    if (
        previousName ===
        newName
    ) {

        return;
    }


    try {

        const {
            supabase
        } =
            await import(
                "./supabase.js"
            );


        const {
            error
        } = await supabase.rpc(
            "record_staff_switch",
            {
                p_previous_name:
                    previousName || null,

                p_new_name:
                    newName,

                p_terminal:
                    getTerminalId()
            }
        );


        if (error) {
            throw error;
        }


    } catch (error) {

        console.error(
            "担当者切り替え履歴の記録に失敗しました:",
            error
        );

    }

}


/* ========================================
   メッセージ
======================================== */

function showStaffSwitchMessage(
    message
) {

    const element =
        document.getElementById(
            "staffSwitchMessage"
        );


    if (!element) {
        return;
    }


    element.textContent =
        message;

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
   外部更新
======================================== */

export function refreshStaffSwitch() {

    currentOperatorName =
        getStoredOperatorName();

    refreshStaffSwitchDisplay();

}
