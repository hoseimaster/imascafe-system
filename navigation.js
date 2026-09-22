import {
    getUserRole,
    isAuthenticated,
    isAdmin,
    isStaff,
    isViewer
} from "./auth.js";


let initialized = false;

let currentScreen =
    "dashboardScreen";


/* ========================================
   画面設定
======================================== */

const SCREEN_TITLES = {

    dashboardScreen:
        "ホーム",

    statisticsScreen:
        "統計",

    ordersScreen:
        "注文",

    orderHistoryScreen:
        "注文履歴",

    inventoryScreen:
        "在庫",

    historyScreen:
        "履歴",

    settingsScreen:
        "設定",

    productSettingsScreen:
        "商品設定",

    expensesScreen:
        "支出管理",

    incomeScreen:
        "収入管理",

    outputScreen:
        "データ出力",

    systemManagementScreen:
        "システム管理"
};


/* ========================================
   権限別アクセス可能画面
======================================== */

const SCREEN_PERMISSIONS = {

    dashboardScreen: [
        "super_admin",
        "admin",
        "staff",
        "viewer"
    ],

    statisticsScreen: [
        "super_admin",
        "admin",
        "staff",
        "viewer"
    ],

    ordersScreen: [
        "super_admin",
        "admin",
        "staff"
    ],

    orderHistoryScreen: [
        "super_admin",
        "admin",
        "staff"
    ],

    inventoryScreen: [
        "super_admin",
        "admin",
        "staff"
    ],

    historyScreen: [
        "super_admin",
        "admin",
        "staff"
    ],

    settingsScreen: [
        "super_admin",
        "admin",
        "staff",
        "viewer"
    ],

    productSettingsScreen: [
        "super_admin",
        "admin"
    ],

    expensesScreen: [
        "super_admin",
        "admin"
    ],

    incomeScreen: [
        "super_admin",
        "admin"
    ],

    outputScreen: [
        "super_admin",
        "admin",
        "staff"
    ],

    systemManagementScreen: [
        "super_admin"
    ]
};


/* ========================================
   初期化
======================================== */

export function initializeNavigation() {

    if (initialized) {
        return;
    }

    initialized = true;

    document.querySelectorAll(
        '[data-screen="eventDaySettingsScreen"], #eventDaySettingsScreen, #eventDayModalOverlay'
    ).forEach((element) => element.remove());

    document.addEventListener(
        "click",
        handleNavigationClick
    );

    document.addEventListener(
        "app:navigate",
        handleAppNavigate
    );

    window.addEventListener(
        "app:login",
        handleLogin
    );

    window.addEventListener(
        "app:logout",
        handleLogout
    );

    applyNavigationPermissions();

    if (
        isAuthenticated() &&
        canAccessScreen(
            currentScreen
        )
    ) {

        navigateTo(
            currentScreen
        );

    } else if (
        isAuthenticated()
    ) {

        navigateTo(
            getDefaultScreen()
        );

    } else {

        hideApplicationScreens();
    }
}


/* ========================================
   ナビゲーションクリック
======================================== */

function handleNavigationClick(
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

    const button =
        target.closest(
            "[data-screen]"
        );

    if (!button) {
        return;
    }

    const screenName =
        button.getAttribute(
            "data-screen"
        );

    if (!screenName) {
        return;
    }

    if (
        button.disabled ||
        button.getAttribute(
            "aria-disabled"
        ) === "true"
    ) {

        event.preventDefault();

        return;
    }

    event.preventDefault();

    navigateTo(
        screenName
    );
}


/* ========================================
   アプリ内画面移動
======================================== */

function handleAppNavigate(
    event
) {

    const screenName =
        event.detail?.screen;

    if (!screenName) {
        return;
    }

    navigateTo(
        screenName
    );
}


/* ========================================
   画面移動
======================================== */

export function navigateTo(
    screenName
) {

    if (!isAuthenticated()) {

        hideApplicationScreens();

        return false;
    }

    const title =
        SCREEN_TITLES[
            screenName
        ];

    if (!title) {

        console.error(
            "存在しない画面です:",
            screenName
        );

        return false;
    }

    const targetScreen =
        document.getElementById(
            screenName
        );

    if (!targetScreen) {

        console.error(
            "画面要素が見つかりません:",
            screenName
        );

        return false;
    }

    if (
        !canAccessScreen(
            screenName
        )
    ) {

        console.warn(
            "権限のない画面への移動を拒否しました:",
            screenName
        );

        const fallbackScreen =
            getDefaultScreen();

        if (
            fallbackScreen ===
            screenName
        ) {

            return false;
        }

        return navigateTo(
            fallbackScreen
        );
    }

    currentScreen =
        screenName;

    showOnlyScreen(
        screenName
    );

    updateNavigationState(
        screenName
    );

    updateScreenTitle(
        title
    );

    window.scrollTo({
        top: 0,
        left: 0,
        behavior: "instant"
    });

    document.dispatchEvent(
        new CustomEvent(
            "app:screenchange",
            {
                detail: {
                    screen:
                        screenName
                }
            }
        )
    );

    return true;
}


/* ========================================
   画面表示制御
======================================== */

function showOnlyScreen(
    screenName
) {

    document
        .querySelectorAll(
            ".app-screen"
        )
        .forEach(
            (screen) => {

                const isTarget =
                    screen.id ===
                    screenName;

                screen.classList.toggle(
                    "active-screen",
                    isTarget
                );

                screen.hidden =
                    !isTarget;
            }
        );
}


/* ========================================
   画面非表示
======================================== */

function hideApplicationScreens() {

    document
        .querySelectorAll(
            ".app-screen"
        )
        .forEach(
            (screen) => {

                screen.classList.remove(
                    "active-screen"
                );

                screen.hidden =
                    true;
            }
        );

    updateNavigationState(
        ""
    );
}


/* ========================================
   現在の画面
======================================== */

export function getCurrentScreen() {

    return currentScreen;
}


/* ========================================
   画面タイトル
======================================== */

function updateScreenTitle(
    title
) {

    const titleElement =
        document.getElementById(
            "screenTitle"
        );

    if (!titleElement) {
        return;
    }

    titleElement.textContent =
        title;
}


/* ========================================
   ナビゲーション状態
======================================== */

function updateNavigationState(
    screenName
) {

    document
        .querySelectorAll(
            "[data-screen]"
        )
        .forEach(
            (button) => {

                const target =
                    button.getAttribute(
                        "data-screen"
                    );

                const isActive =
                    target ===
                    screenName;

                button.classList.toggle(
                    "active",
                    isActive
                );

                if (isActive) {

                    button.setAttribute(
                        "aria-current",
                        "page"
                    );

                } else {

                    button.removeAttribute(
                        "aria-current"
                    );
                }
            }
        );
}


/* ========================================
   権限確認
======================================== */

export function canAccessScreen(
    screenName
) {

    const permissions =
        SCREEN_PERMISSIONS[
            screenName
        ];

    if (!permissions) {
        return false;
    }

    if (!isAuthenticated()) {
        return false;
    }

    const role =
        getUserRole();

    if (!role) {
        return false;
    }

    return permissions.includes(
        role
    );
}


/* ========================================
   現在の権限
======================================== */

export function getCurrentRole() {

    return getUserRole();
}


/* ========================================
   権限別ナビゲーション制御
======================================== */

export function applyNavigationPermissions() {

    const role =
        getUserRole();

    const authenticated =
        isAuthenticated();

    document
        .querySelectorAll(
            "[data-screen]"
        )
        .forEach(
            (button) => {

                const screenName =
                    button.getAttribute(
                        "data-screen"
                    );

                const allowed =
                    Boolean(
                        authenticated &&
                        role &&
                        SCREEN_PERMISSIONS[
                            screenName
                        ]?.includes(
                            role
                        )
                    );

                button.disabled =
                    !allowed;

                button.setAttribute(
                    "aria-disabled",
                    String(
                        !allowed
                    )
                );

                button.classList.toggle(
                    "is-disabled",
                    !allowed
                );

                if (!allowed) {

                    button.classList.remove(
                        "active"
                    );

                    button.removeAttribute(
                        "aria-current"
                    );

                    button.style.opacity =
                        "0.45";

                    button.style.cursor =
                        "not-allowed";

                } else {

                    button.style.opacity =
                        "";

                    button.style.cursor =
                        "";
                }
            }
        );

    applyScreenPermissions();
}


/* ========================================
   画面自体の権限制御
======================================== */

function applyScreenPermissions() {

    document
        .querySelectorAll(
            ".app-screen"
        )
        .forEach(
            (screen) => {

                const screenName =
                    screen.id;

                if (
                    !SCREEN_TITLES[
                        screenName
                    ]
                ) {
                    return;
                }

                const allowed =
                    canAccessScreen(
                        screenName
                    );

                screen.dataset.accessible =
                    String(
                        allowed
                    );

                if (!allowed) {

                    screen.setAttribute(
                        "aria-hidden",
                        "true"
                    );

                } else {

                    screen.removeAttribute(
                        "aria-hidden"
                    );
                }
            }
        );
}


/* ========================================
   初期画面
======================================== */

function getDefaultScreen() {

    if (!isAuthenticated()) {
        return "dashboardScreen";
    }

    if (
        isAdmin() ||
        isStaff() ||
        isViewer()
    ) {

        return "dashboardScreen";
    }

    return "dashboardScreen";
}


/* ========================================
   権限変更時の再適用
======================================== */

export function refreshNavigationPermissions() {

    applyNavigationPermissions();

    if (!isAuthenticated()) {

        hideApplicationScreens();

        return false;
    }

    if (
        !canAccessScreen(
            currentScreen
        )
    ) {

        return navigateTo(
            getDefaultScreen()
        );
    }

    return true;
}


/* ========================================
   画面変更監視
======================================== */

export function onScreenChange(
    callback
) {

    if (
        typeof callback !==
        "function"
    ) {

        return () => {};
    }

    const handler =
        (event) => {

            callback(
                event.detail?.screen
            );
        };

    document.addEventListener(
        "app:screenchange",
        handler
    );

    return () => {

        document.removeEventListener(
            "app:screenchange",
            handler
        );
    };
}


/* ========================================
   直接遷移
======================================== */

export function openSettings() {

    return navigateTo(
        "settingsScreen"
    );
}


export function openProductSettings() {

    return navigateTo(
        "productSettingsScreen"
    );
}


export function openOrderHistory() {

    return navigateTo(
        "orderHistoryScreen"
    );
}


export function openExpenses() {

    return navigateTo(
        "expensesScreen"
    );
}


export function openIncome() {

    return navigateTo(
        "incomeScreen"
    );
}


export function openOutput() {

    return navigateTo(
        "outputScreen"
    );
}


/* ========================================
   画面アクセス一覧
======================================== */

export function getAccessibleScreens() {

    if (!isAuthenticated()) {
        return [];
    }

    const role =
        getUserRole();

    if (!role) {
        return [];
    }

    return Object.keys(
        SCREEN_TITLES
    )
        .filter(
            (screenName) =>
                SCREEN_PERMISSIONS[
                    screenName
                ]?.includes(
                    role
                )
        );
}


/* ========================================
   権限別判定
======================================== */

export function canAccessAdminScreen() {

    return (
        isAuthenticated() &&
        isAdmin()
    );
}


export function canAccessStaffScreen() {

    return (
        isAuthenticated() &&
        (
            isAdmin() ||
            isStaff()
        )
    );
}


export function canAccessViewerScreen() {

    return (
        isAuthenticated() &&
        (
            isAdmin() ||
            isStaff() ||
            isViewer()
        )
    );
}


/* ========================================
   ログイン処理
======================================== */

function handleLogin() {

    applyNavigationPermissions();

    const defaultScreen =
        getDefaultScreen();

    if (
        !canAccessScreen(
            currentScreen
        )
    ) {

        navigateTo(
            defaultScreen
        );

        return;
    }

    navigateTo(
        currentScreen
    );
}


/* ========================================
   ログアウト処理
======================================== */

function handleLogout() {

    hideApplicationScreens();

    currentScreen =
        "dashboardScreen";

    applyNavigationPermissions();
}


/* ========================================
   ログイン状態変更監視
======================================== */

document.addEventListener(
    "app:authchange",
    () => {

        refreshNavigationPermissions();
    }
);


/* ========================================
   初期状態
======================================== */

if (!isAuthenticated()) {

    hideApplicationScreens();
}
