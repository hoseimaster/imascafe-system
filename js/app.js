import {
    initializeAuth,
    isAuthenticated,
    getUserRole,
    logout
} from "./auth.js";

import {
    showStartupScreen,
    updateStartupStep,
    finishStartupScreen,
    failStartupScreen
} from "./startup-status.js";

import {
    initializeAccessMonitor,
    stopAccessMonitor,
    showAccessDenied
} from "./system-access.js";

import {
    initializeSuperAdmin
} from "./super-admin.js";

import {
    initializeNavigation
} from "./navigation.js";

import {
    initializeDashboard
} from "./dashboard.js";

import {
    initializeStatistics
} from "./statistics.js";

import {
    initializeOrders
} from "./orders.js";

import {
    initializeOrderHistory
} from "./order-history.js";

import {
    initializeInventory
} from "./inventory.js";

import {
    initializeHistory
} from "./history.js";

import {
    initializeProducts
} from "./products.js";


import {
    initializeExpenses
} from "./expenses.js";

import {
    initializeIncome
} from "./income.js";

import {
    initializeSettings
} from "./settings.js";

import {
    initializeSlipGenerator
} from "./slip-generator.js";

import {
    initializeStayTime
} from "./stay-time.js";

import {
    initializeOutput
} from "./output.js";

import {
    initializeReset
} from "./reset.js";

import {
    initializeRealtime,
    refreshNow
} from "./realtime.js";

import {
    initializeStaffSwitch
} from "./staff-switch.js";

import {
    initializePresence
} from "./presence.js";


import "./confirm-modal.js";

let initialized = false;
let initializing = false;
let japaneseInputObserver = null;


/* ========================================
   アプリ起動
======================================== */

async function initializeApp(options = {}) {

    initializeJapaneseTextInputs();

    const showStartup =
        options.showStartup !== false;

    if (initializing) {
        return;
    }

    if (initialized) {
        if (isAuthenticated()) {
            await initializeSuperAdmin();

            initializeAccessMonitor({
                getRole: getUserRole,
                onBlocked: async (state, role) => {
                    if (role === "super_admin") {
                        return;
                    }
                    await logout();
                    showAccessDenied(state, role);
                }
            });
        }

        if (showStartup) {
            finishStartupScreen();
        }

        return;
    }

    initializing = true;

    if (showStartup) {
        showStartupScreen();
        updateStartupStep("page", "done");
        updateStartupStep("system", "active");
    }

    try {

        if (showStartup) {
            updateStartupStep("system", "done");
            updateStartupStep("server", "active");
        }

        await initializeAuth({
            onServerConnected: () => {
                if (!showStartup) {
                    return;
                }

                updateStartupStep("server", "done");
                updateStartupStep("session", "active");
            }
        });

        if (showStartup) {
            updateStartupStep("session", "done");
        }

        if (!isAuthenticated()) {
            if (showStartup) {
                finishStartupScreen();
            }
            return;
        }

        await initializeModule(
            "super-admin",
            initializeSuperAdmin
        );

        await initializeModule(
            "navigation",
            initializeNavigation
        );

        await initializeModule(
            "dashboard",
            initializeDashboard
        );

        await initializeModule(
            "statistics",
            initializeStatistics
        );

        await initializeModule(
            "orders",
            initializeOrders
        );

        await initializeModule(
            "order-history",
            initializeOrderHistory
        );

        await initializeModule(
            "inventory",
            initializeInventory
        );

        await initializeModule(
            "history",
            initializeHistory
        );

        await initializeModule(
            "products",
            initializeProducts
        );

        await initializeModule(
            "expenses",
            initializeExpenses
        );

        await initializeModule(
            "income",
            initializeIncome
        );

        await initializeModule(
            "settings",
            initializeSettings
        );

        await initializeModule(
            "slip-generator",
            initializeSlipGenerator
        );

        await initializeModule(
            "stay-time",
            initializeStayTime
        );

        await initializeModule(
            "output",
            initializeOutput
        );

        await initializeModule(
            "reset",
            initializeReset
        );

        await initializeModule(
            "staff-switch",
            initializeStaffSwitch
        );

        await initializeModule(
            "presence",
            initializePresence
        );

        await initializeModule(
            "realtime",
            initializeRealtime
        );

        setupRealtimeRefresh();
        setupManualRefresh();
        setupGlobalModal();
        setupGlobalEvents();

        initializeAccessMonitor({
            getRole: getUserRole,
            onBlocked: async (state, role) => {
                if (role === "super_admin") {
                    return;
                }
                await logout();
                showAccessDenied(state, role);
            }
        });

        initialized = true;

        if (showStartup) {
            finishStartupScreen();
        }

    } catch (error) {

        console.error(
            "アプリ初期化エラー:",
            error
        );

        if (showStartup) {
            failStartupScreen(
                "システムの初期化に失敗しました。ページを再読み込みしてください。"
            );
        }

        showGlobalError(
            "システムの初期化に失敗しました。ページを再読み込みしてください。"
        );

    } finally {

        initializing = false;

    }

}


/* ========================================
   日本語文字入力
======================================== */

function initializeJapaneseTextInputs() {

    applyJapaneseTextInputSettings(
        document
    );


    if (japaneseInputObserver) {
        return;
    }


    japaneseInputObserver =
        new MutationObserver(
            (mutations) => {

                mutations.forEach(
                    (mutation) => {

                        mutation.addedNodes.forEach(
                            (node) => {

                                if (
                                    node.nodeType ===
                                    Node.ELEMENT_NODE
                                ) {

                                    applyJapaneseTextInputSettings(
                                        node
                                    );
                                }
                            }
                        );
                    }
                );
            }
        );


    japaneseInputObserver.observe(
        document.body,
        {
            childList: true,
            subtree: true
        }
    );
}


function applyJapaneseTextInputSettings(root) {

    const selector = [
        'input:not([type])',
        'input[type="text"]',
        'input[type="search"]',
        "textarea"
    ].join(",");


    const elements = [];


    if (root.matches?.(selector)) {
        elements.push(root);
    }


    elements.push(
        ...root.querySelectorAll?.(selector) || []
    );


    elements.forEach(
        (element) => {

            if (
                element.dataset.inputLanguage ===
                "latin"
            ) {
                return;
            }


            element.lang = "ja";
            element.inputMode = "text";
            element.autocapitalize = "none";
            element.setAttribute(
                "autocorrect",
                "off"
            );
            element.spellcheck = false;
            element.style.imeMode = "active";
        }
    );
}


/* ========================================
   モジュール初期化
======================================== */

async function initializeModule(
    moduleName,
    initializeFunction
) {

    try {

        if (
            typeof initializeFunction !==
            "function"
        ) {

            throw new Error(
                `${moduleName}.js の初期化関数が見つかりません。`
            );

        }


        await initializeFunction();


    } catch (error) {

        console.error(
            `${moduleName}.js 初期化エラー:`,
            error
        );

        throw error;

    }

}


/* ========================================
   Realtime更新
======================================== */

function setupRealtimeRefresh() {

    document.addEventListener(
        "app:realtime-refresh",
        async (event) => {

            const screen =
                event.detail?.screen;


            if (!screen) {
                return;
            }


            await refreshScreen(
                screen
            );

        }
    );

}


/* ========================================
   手動更新
======================================== */

function setupManualRefresh() {

    document.addEventListener(
        "click",
        async (event) => {

            const button =
                event.target.closest(
                    "[data-refresh]"
                );


            if (!button) {
                return;
            }


            event.preventDefault();
            event.stopPropagation();


            if (
                button.dataset.refreshing ===
                "true"
            ) {

                return;

            }


            button.dataset.refreshing =
                "true";

            button.disabled =
                true;


            try {

                const screen =
                    getCurrentScreen();


                if (!screen) {
                    return;
                }


                await refreshScreen(
                    screen
                );


                try {

                    await refreshNow();


                } catch (error) {

                    console.warn(
                        "Realtime更新通知エラー:",
                        error
                    );

                }


            } catch (error) {

                console.error(
                    "手動更新エラー:",
                    error
                );


                showToast(
                    "データの更新に失敗しました。"
                );


            } finally {

                button.disabled =
                    false;

                button.dataset.refreshing =
                    "false";

            }

        }
    );

}


/* ========================================
   現在の画面取得
======================================== */

function getCurrentScreen() {

    const activeScreen =
        document.querySelector(
            ".app-screen.active-screen"
        );


    if (!activeScreen) {
        return null;
    }


    const screenId =
        activeScreen.id;


    const screenMap = {

        dashboardScreen:
            "dashboard",

        statisticsScreen:
            "statistics",

        ordersScreen:
            "orders",

        orderHistoryScreen:
            "order-history",

        inventoryScreen:
            "inventory",

        historyScreen:
            "history",

        settingsScreen:
            "settings",

        productSettingsScreen:
            "products",

        expensesScreen:
            "expenses",

        incomeScreen:
            "income",

        stayTimeScreen:
            "stay-time",

        outputScreen:
            "output"

    };


    return screenMap[
        screenId
    ] || null;

}


/* ========================================
   画面更新
======================================== */

async function refreshScreen(
    screen
) {

    switch (screen) {

        case "dashboard":

            await refreshModule(
                "./dashboard.js",
                "refreshDashboard"
            );

            break;


        case "statistics":

            await refreshModule(
                "./statistics.js",
                "refreshStatistics"
            );

            break;


        case "orders":

            await refreshModule(
                "./orders.js",
                "refreshOrders"
            );

            break;


        case "order-history":

            await refreshModule(
                "./order-history.js",
                "refreshOrderHistory"
            );

            break;


        case "inventory":

            await refreshModule(
                "./inventory.js",
                "refreshInventory"
            );

            break;


        case "history":

            await refreshModule(
                "./history.js",
                "refreshHistory"
            );

            break;


        case "products":

            await refreshModule(
                "./products.js",
                "refreshProducts"
            );

            break;


        case "expenses":

            await refreshModule(
                "./expenses.js",
                "refreshExpenses"
            );

            break;


        case "income":

            await refreshModule(
                "./income.js",
                "refreshIncome"
            );

            break;


        case "stay-time":

            await refreshModule(
                "./stay-time.js",
                "refreshStayTime"
            );

            break;


        case "settings":

            await refreshModule(
                "./settings.js",
                "refreshSettings"
            );

            break;


        case "output":

            await refreshModule(
                "./output.js",
                "refreshOutput"
            );

            break;


        default:

            console.warn(
                `更新対象の画面が見つかりません: ${screen}`
            );

            break;

    }

}


/* ========================================
   モジュール更新
======================================== */

async function refreshModule(
    path,
    functionName
) {

    try {

        const module =
            await import(
                path
            );


        const refreshFunction =
            module[
                functionName
            ];


        if (
            typeof refreshFunction !==
            "function"
        ) {

            console.warn(
                `更新関数 ${functionName} が ${path} にありません。`
            );

            return false;

        }


        await refreshFunction();

        return true;


    } catch (error) {

        console.error(
            `画面更新エラー (${path}):`,
            error
        );

        throw error;

    }

}


/* ========================================
   トースト表示
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
            2500
        );

}


/* ========================================
   モーダル
======================================== */

function setupGlobalModal() {

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
            closeModal
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

                    closeModal();

                }

            }
        );

    }


    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key ===
                "Escape"
            ) {

                closeModal();

            }

        }
    );

}


/* ========================================
   モーダル閉じる
======================================== */

export function closeModal() {

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


    overlay.hidden =
        true;

}


/* ========================================
   モーダル表示
======================================== */

export function openModal(
    title,
    content
) {

    const overlay =
        document.getElementById(
            "modalOverlay"
        );


    const titleElement =
        document.getElementById(
            "modalTitle"
        );


    const contentElement =
        document.getElementById(
            "modalContent"
        );


    if (
        !overlay ||
        !contentElement
    ) {

        return;

    }


    if (titleElement) {

        titleElement.textContent =
            title || "";

    }


    contentElement.innerHTML =
        content || "";


    overlay.hidden =
        false;


    requestAnimationFrame(
        () => {

            overlay.classList.add(
                "is-visible"
            );

        }
    );

}


/* ========================================
   全体イベント
======================================== */

function setupGlobalEvents() {

    document.addEventListener(
        "click",
        (event) => {

            const button =
                event.target.closest(
                    "[data-close-modal]"
                );


            if (button) {

                closeModal();

            }

        }
    );


    window.addEventListener(
        "beforeunload",
        () => {

            /* セッションはブラウザ側に保持 */

        }
    );

}


/* ========================================
   エラー
======================================== */

function showGlobalError(
    message
) {

    const loginError =
        document.getElementById(
            "loginError"
        );


    if (loginError) {

        loginError.textContent =
            message;


        loginError.hidden =
            false;


        loginError.classList.add(
            "is-visible"
        );


        return;

    }


    showToast(
        message
    );

}


/* ========================================
   起動
======================================== */

/*
 * 初回表示時に未ログインだった場合は認証画面だけを表示して
 * initializeApp() が終了するため、ログイン成功後に再度初期化する。
 */
window.addEventListener(
    "app:login",
    () => {
        void initializeApp({
            showStartup: false
        });
    }
);

window.addEventListener(
    "app:logout",
    stopAccessMonitor
);


if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeApp,
        {
            once: true
        }
    );

} else {

    initializeApp();

}
