import { supabase } from "./supabase.js";

let cachedState = null;
let monitorTimer = null;
let monitorRunning = false;
let loginRoleListenerInitialized = false;

export async function getSystemAccessState() {
    const { data, error } = await supabase.rpc(
        "get_system_access_state"
    );

    if (error) {
        console.error("アクセス状態取得エラー:", error);
        return null;
    }

    cachedState = data || null;
    renderLoginAccessNotice(cachedState);
    return cachedState;
}

export function isRoleAllowed(state, role) {
    if (!state || !role) return false;
    if (role === "super_admin") return true;
    if (state.maintenance_enabled) return false;
    if (state.access_allowed === false && !state.current_role) return false;

    const key = `${role}_login_enabled`;
    return state[key] === true;
}

export function getAccessDeniedMessage(state, role) {
    if (!state) {
        return "システムのアクセス状態を確認できないためログインできません。時間をおいて再度お試しください。";
    }

    if (
        state?.access_allowed === false &&
        !state?.current_role &&
        !state?.maintenance_enabled
    ) {
        return "このアカウントは無効化されています。最高管理者に確認してください。";
    }

    if (state?.maintenance_enabled) {
        return state.maintenance_message ||
            "現在、システムメンテナンスを実施しています。終了までログインできません。";
    }

    const labels = {
        admin: "管理者",
        staff: "スタッフ",
        viewer: "閲覧者"
    };

    return `${labels[role] || "この権限"}からのログインは現在停止されています。`;
}

export function showAccessDenied(state, role) {
    renderLoginAccessNotice(
        state,
        getAccessDeniedMessage(state, role),
        true
    );
}

export function showAccountDisabled() {
    renderLoginAccessNotice(
        { maintenance_enabled: false },
        "このアカウントは無効化されています。最高管理者に確認してください。",
        true
    );
}

export function initializeAccessMonitor({ getRole, onBlocked }) {
    stopAccessMonitor();

    const check = async () => {
        if (monitorRunning) return;

        monitorRunning = true;

        try {
            const state = await getSystemAccessState();
            const role = getRole?.();

            if (role && !isRoleAllowed(state, role)) {
                stopAccessMonitor();
                await onBlocked?.(state, role);
            }
        } finally {
            monitorRunning = false;
        }
    };

    void check();

    monitorTimer = window.setInterval(
        check,
        10000
    );
}

export function stopAccessMonitor() {
    if (monitorTimer) {
        window.clearInterval(monitorTimer);
        monitorTimer = null;
    }
}

function renderLoginAccessNotice(
    state,
    forcedMessage = "",
    denied = false
) {
    const loginContainer = document.querySelector(
        "#loginScreen .login-container"
    );

    if (!loginContainer) return;

    const loginScreen = document.getElementById(
        "loginScreen"
    );

    loginScreen?.classList.toggle(
        "is-maintenance-mode",
        Boolean(state?.maintenance_enabled)
    );

    setupLoginRoleListener();
    updateLoginButtonAccess(state);

    let notice = document.getElementById(
        "systemAccessNotice"
    );

    if (!notice) {
        notice = document.createElement("div");
        notice.id = "systemAccessNotice";
        notice.className = "system-access-notice";

        const form = document.getElementById(
            "loginForm"
        );

        loginContainer.insertBefore(
            notice,
            form || null
        );
    }

    if (
        !state?.maintenance_enabled &&
        !forcedMessage
    ) {
        notice.hidden = true;
        notice.textContent = "";
        return;
    }

    if (state?.maintenance_enabled) {
        renderMaintenanceNotice(notice, state);
    } else {
        notice.textContent = forcedMessage || "現在ログインできません。";
    }

    notice.classList.toggle(
        "is-denied",
        denied
    );

    notice.hidden = false;
}

function renderMaintenanceNotice(notice, state) {
    notice.innerHTML = `
        <div class="maintenance-notice-heading">
            <span class="maintenance-notice-mark" aria-hidden="true"></span>
            <div>
                <strong class="maintenance-notice-title"></strong>
                <p class="maintenance-notice-lead"></p>
            </div>
        </div>
        <div class="maintenance-notice-details">
            <div class="maintenance-notice-row">
                <span>終了予定</span>
                <strong class="maintenance-notice-end"></strong>
            </div>
            <div class="maintenance-notice-message" hidden>
                <span>お知らせ</span>
                <p></p>
            </div>
        </div>
    `;

    notice.querySelector(".maintenance-notice-title").textContent =
        "現在メンテナンス中";
    notice.querySelector(".maintenance-notice-lead").textContent =
        "メンテナンス終了後に再度アクセスしてください。";
    notice.querySelector(".maintenance-notice-end").textContent =
        formatMaintenanceEndAt(state?.maintenance_end_at);

    const message = String(state?.maintenance_message || "").trim();
    const messageBox = notice.querySelector(".maintenance-notice-message");

    if (message && messageBox) {
        messageBox.querySelector("p").textContent = message;
        messageBox.hidden = false;
    }
}

function formatMaintenanceEndAt(value) {
    if (!value) return "終了時間は未定です";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "終了時間は未定です";

    return new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).format(date);
}

function setupLoginRoleListener() {
    if (loginRoleListenerInitialized) return;

    const roleSelect = document.getElementById("loginRole");
    if (!roleSelect) return;

    loginRoleListenerInitialized = true;

    roleSelect.addEventListener("change", () => {
        renderLoginAccessNotice(cachedState);
    });
}

function updateLoginButtonAccess(state) {
    const loginButton = document.getElementById("loginButton");
    if (!loginButton) return;

    const selectedRole = document.getElementById("loginRole")?.value || "";
    const maintenanceBlocked = Boolean(
        state?.maintenance_enabled &&
        selectedRole !== "super_admin"
    );

    loginButton.dataset.accessBlocked = String(maintenanceBlocked);
    loginButton.disabled = maintenanceBlocked;
    loginButton.setAttribute("aria-disabled", String(maintenanceBlocked));

    if (!loginButton.dataset.defaultText) {
        loginButton.dataset.defaultText = loginButton.textContent.trim() || "ログイン";
    }

    if (maintenanceBlocked) {
        loginButton.title = "メンテナンス中は最高管理者のみログインできます。";
        loginButton.textContent = "メンテナンス中";
    } else {
        loginButton.removeAttribute("title");
        loginButton.textContent = loginButton.dataset.defaultText;
    }
}

export function getCachedSystemAccessState() {
    return cachedState;
}
