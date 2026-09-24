import { supabase } from "./supabase.js";

import {
    isAdmin,
    getOperatorName,
    getTerminalId,
    getCurrentProfile,
    logout
} from "./auth.js";

import {
    refreshProducts
} from "./products.js";

import { confirmLogout } from "./confirm-modal.js";
import { showConfirmModal } from "./confirm-modal.js";


let initialized = false;


/* ========================================
   初期化
======================================== */

export function initializeSettings() {

    if (initialized) {
        return;
    }

    initialized = true;

    setupSettingsEvents();
    renderSettingsPermissions();
    setupOrderAcceptanceControl();

}


/* ========================================
   設定イベント
======================================== */

function setupSettingsEvents() {

    const logoutButton =
        document.getElementById(
            "logoutButton"
        );


    if (logoutButton) {

        logoutButton.hidden = false;
        logoutButton.disabled = false;
        logoutButton.classList.remove(
            "admin-only"
        );

        logoutButton.addEventListener(
            "click",
            async () => {

                const confirmed =
                    await confirmLogout();


                if (!confirmed) {
                    return;
                }


                try {

                    await logout();

                } catch (error) {

                    console.error(
                        "ログアウトエラー:",
                        error
                    );

                }

            }
        );

    }


    document.addEventListener(
        "click",
        (event) => {

            const resetButton =
                event.target.closest(
                    "#settingsResetButton"
                );


            if (!resetButton) {
                return;
            }


            if (!isAdmin()) {
                return;
            }


            openResetModal();

        }
    );


    const operationGuideButton =
        document.getElementById(
            "settingsOperationGuideButton"
        );

    if (operationGuideButton) {
        operationGuideButton.addEventListener(
            "click",
            openOperationGuidePreview
        );
    }


    document.addEventListener(
        "app:screenchange",
        async (event) => {

            const screen =
                event.detail?.screen;


            if (
                screen ===
                "settingsScreen"
            ) {

                renderSettingsPermissions();

                await loadSystemSettings();

                return;

            }


            if (
                screen ===
                "productSettingsScreen"
            ) {

                if (!isAdmin()) {
                    return;
                }

                await refreshProducts();

                return;

            }


        }
    );

}


/* ========================================
   操作説明プレビュー
======================================== */
function openOperationGuidePreview() {

    closeOperationGuidePreview();

    const overlay = document.createElement("div");
    overlay.className = "operation-guide-preview-overlay";
    overlay.id = "operationGuidePreviewOverlay";

    overlay.innerHTML = `
        <div
            class="operation-guide-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="operationGuidePreviewTitle"
        >
            <div class="operation-guide-preview-header">
                <h2 id="operationGuidePreviewTitle">操作説明</h2>

                <button
                    type="button"
                    class="operation-guide-preview-close"
                    id="operationGuidePreviewClose"
                    aria-label="閉じる"
                >
                    ×
                </button>
            </div>

            <div class="operation-guide-preview-body">
                <iframe
                    class="operation-guide-preview-frame"
                    src="./manual/operation-guide.pdf#view=FitH"
                    title="操作説明PDF"
                ></iframe>
            </div>

            <div class="operation-guide-preview-actions">
                <a
                    class="secondary-button operation-guide-preview-open"
                    href="./manual/operation-guide.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    PDFを別画面で開く
                </a>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const closeButton = document.getElementById(
        "operationGuidePreviewClose"
    );

    closeButton?.addEventListener(
        "click",
        closeOperationGuidePreview
    );

    overlay.addEventListener(
        "click",
        (event) => {
            if (event.target === overlay) {
                closeOperationGuidePreview();
            }
        }
    );

    document.addEventListener(
        "keydown",
        handleOperationGuidePreviewKeydown
    );

    requestAnimationFrame(() => {
        overlay.classList.add("is-visible");
        closeButton?.focus();
    });
}

function handleOperationGuidePreviewKeydown(event) {
    if (event.key === "Escape") {
        closeOperationGuidePreview();
    }
}

function closeOperationGuidePreview() {
    const overlay = document.getElementById(
        "operationGuidePreviewOverlay"
    );

    if (!overlay) {
        return;
    }

    if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
    }

    document.removeEventListener(
        "keydown",
        handleOperationGuidePreviewKeydown
    );

    overlay.remove();
}


/* ========================================
   リセットモーダル
======================================== */

function openResetModal() {

    const overlay =
        document.getElementById(
            "resetCodeModalOverlay"
        );


    if (!overlay) {
        return;
    }


    const form =
        document.getElementById(
            "resetCodeForm"
        );


    const input =
        document.getElementById(
            "resetCodeInput"
        );


    const error =
        document.getElementById(
            "resetCodeError"
        );


    if (form) {
        form.reset();
    }


    if (error) {

        error.textContent = "";

        error.hidden = true;

        error.classList.remove(
            "is-visible"
        );

    }


    overlay.hidden = false;

    overlay.classList.add(
        "is-visible"
    );


    requestAnimationFrame(
        () => {

            if (input) {
                input.focus();
            }

        }
    );

}


/* ========================================
   リセットモーダルを閉じる
======================================== */

export function closeResetModal() {

    const overlay =
        document.getElementById(
            "resetCodeModalOverlay"
        );


    if (!overlay) {
        return;
    }


    overlay.classList.remove(
        "is-visible"
    );


    overlay.hidden = true;

}


/* ========================================
   設定権限表示
======================================== */

export function renderSettingsPermissions() {

    const admin =
        isAdmin();


    const adminOnlyElements =
        document.querySelectorAll(
            ".admin-only"
        );


    adminOnlyElements.forEach(
        (element) => {

            if (
                element.id ===
                "logoutButton"
            ) {

                element.hidden = false;

                element.disabled = false;

                return;
            }

            element.hidden =
                !admin;

        }
    );


    const staffOnlyElements =
        document.querySelectorAll(
            ".staff-only"
        );


    staffOnlyElements.forEach(
        (element) => {

            element.hidden = false;

        }
    );


    const logoutButton =
        document.getElementById(
            "logoutButton"
        );


    if (logoutButton) {

        logoutButton.hidden = false;
        logoutButton.disabled = false;

        logoutButton.setAttribute(
            "aria-disabled",
            "false"
        );

        logoutButton.classList.remove(
            "is-disabled"
        );

    }


    renderAccountInformation();

}


/* ========================================
   アカウント情報
======================================== */

function renderAccountInformation() {

    const operatorElement =
        document.getElementById(
            "settingsOperatorName"
        );


    const roleElement =
        document.getElementById(
            "settingsOperatorRole"
        );


    const profile =
        getCurrentProfile();


    const role =
        profile?.role;


    if (operatorElement) {

        operatorElement.textContent =
            getOperatorName() || "-";

    }


    if (roleElement) {

        const roleLabels = {
            super_admin: "最高管理者",
            admin: "管理者",
            staff: "スタッフ",
            viewer: "閲覧者"
        };


        roleElement.textContent =
            roleLabels[role] || "-";

    }

}


/* ========================================
   システム設定取得
======================================== */

export async function loadSystemSettings() {

    if (!isAdmin()) {
        return;
    }


    const container =
        document.getElementById(
            "systemSettingsContainer"
        );


    if (!container) {
        return;
    }


    const {
        data,
        error
    } = await supabase
        .from("system_settings")
        .select(`
            key,
            value,
            description,
            updated_at
        `)
        .order(
            "key",
            {
                ascending: true
            }
        );


    if (error) {

        console.error(
            "システム設定取得エラー:",
            error
        );


        container.innerHTML = `
            <div class="empty-state">
                システム設定を取得できませんでした
            </div>
        `;

        return;
    }


    renderSystemSettings(
        data || []
    );

}


/* ========================================
   システム設定表示
======================================== */

function renderSystemSettings(
    settings
) {

    const container =
        document.getElementById(
            "systemSettingsContainer"
        );


    if (!container) {
        return;
    }


    if (!settings.length) {

        container.innerHTML = `
            <div class="empty-state">
                システム設定はありません
            </div>
        `;

        return;
    }


    container.innerHTML =
        settings
            .map(
                (setting) => {

                    return `
                        <div class="settings-item">

                            <div
                                style="
                                    min-width:0;
                                    flex:1;
                                "
                            >

                                <div class="settings-item-title">
                                    ${escapeHtml(
                                        setting.key
                                    )}
                                </div>

                                ${
                                    setting.description
                                        ? `
                                            <div class="settings-item-description">
                                                ${escapeHtml(
                                                    setting.description
                                                )}
                                            </div>
                                        `
                                        : ""
                                }

                            </div>

                            <button
                                type="button"
                                class="button button-secondary"
                                data-edit-setting="${escapeHtml(
                                    setting.key
                                )}"
                            >
                                変更
                            </button>

                        </div>
                    `;

                }
            )
            .join("");


    container
        .querySelectorAll(
            "[data-edit-setting]"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        const key =
                            button.dataset
                                .editSetting;


                        const setting =
                            settings.find(
                                (item) =>
                                    item.key ===
                                    key
                            );


                        if (setting) {

                            editSystemSetting(
                                setting
                            );

                        }

                    }
                );

            }
        );

}


/* ========================================
   システム設定変更
======================================== */

async function editSystemSetting(
    setting
) {

    const currentValue =
        formatSettingValue(
            setting.value
        );


    const newValue =
        window.prompt(
            `${setting.key} の値を入力してください`,
            currentValue
        );


    if (newValue === null) {
        return;
    }


    let parsedValue =
        newValue;


    try {

        parsedValue =
            JSON.parse(
                newValue
            );

    } catch {

        parsedValue =
            newValue;

    }


    const {
        error
    } = await supabase.rpc(
        "update_system_setting",
        {
            p_key:
                setting.key,

            p_value:
                parsedValue,

            p_operator_name:
                getOperatorName(),

            p_terminal:
                getTerminalId()
        }
    );


    if (error) {

        console.error(
            "システム設定変更エラー:",
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
        "システム設定を変更しました。"
    );


    await loadSystemSettings();

}


/* ========================================
   設定値表示
======================================== */

function formatSettingValue(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    if (
        typeof value === "string"
    ) {

        return value;

    }


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


/* ========================================
   権限確認
======================================== */

export function canAccessAdminSettings() {

    return isAdmin();

}


/* ========================================
   更新
======================================== */

export async function refreshSettings() {

    renderSettingsPermissions();


    if (!isAdmin()) {
        return;
    }


    return Promise.all([
        loadSystemSettings(),
        refreshProducts()
    ]);

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

                toast.hidden = true;

            },
            3000
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


    if (
        message.includes(
            "permission"
        )
    ) {

        return "この操作を実行する権限がありません。";

    }


    return (
        message ||
        "設定の変更に失敗しました。"
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


async function setupOrderAcceptanceControl() {

    if (!isAdmin()) {
        return;
    }

    const list =
        document.querySelector(
            "#settingsScreen .settings-list"
        );

    if (!list) {
        return;
    }

    let item =
        document.getElementById(
            "orderAcceptanceSetting"
        );

    if (!item) {
        item = document.createElement("div");
        item.id = "orderAcceptanceSetting";
        item.className = "settings-item admin-only order-acceptance-setting";
        item.innerHTML = `
            <span class="settings-item-content">
                <span>
                    <strong class="order-acceptance-title">注文受付</strong>
                    <small class="order-acceptance-status">確認中</small>
                </span>
            </span>
            <button type="button" class="button button-secondary" data-order-acceptance-toggle disabled>確認中</button>
        `;
        list.prepend(item);
    }

    const status = item.querySelector(".order-acceptance-status");
    const button = item.querySelector("[data-order-acceptance-toggle]");

    const refresh = async () => {
        const { data, error } = await supabase
            .from("system_settings")
            .select("value")
            .eq("key", "order_accepting")
            .maybeSingle();

        if (error || !data) {
            status.textContent = "DB設定が必要です";
            button.textContent = "利用不可";
            button.disabled = true;
            return;
        }

        const accepting = data.value === true;
        item.dataset.accepting = String(accepting);
        status.textContent = accepting ? "現在受付中" : "現在停止中";
        button.textContent = accepting ? "受付を停止" : "受付を開始";
        button.classList.toggle("danger-button", accepting);
        button.disabled = false;
    };

    if (!button.dataset.bound) {
        button.dataset.bound = "true";
        button.addEventListener("click", async () => {
            const accepting = item.dataset.accepting === "true";
            const confirmed = await showConfirmModal(
                accepting
                    ? "停止中はすべての端末から新しい注文を登録できません。"
                    : "すべての端末で注文登録を再開します。",
                {
                    title: accepting ? "注文受付を停止しますか？" : "注文受付を開始しますか？",
                    confirmText: accepting ? "受付を停止" : "受付を開始",
                    tone: accepting ? "danger" : "stock"
                }
            );

            if (!confirmed) return;

            button.disabled = true;
            const { error } = await supabase.rpc("update_system_setting", {
                p_key: "order_accepting",
                p_value: !accepting,
                p_operator_name: getOperatorName(),
                p_terminal: getTerminalId()
            });

            if (error) {
                console.error("注文受付状態変更エラー:", error);
                showToast(getErrorMessage(error));
            } else {
                showToast(accepting ? "注文受付を停止しました。" : "注文受付を開始しました。");
            }

            await refresh();
        });
    }

    await refresh();
}
