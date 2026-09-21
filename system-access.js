import { supabase } from "./supabase.js";

let cachedState = null;
let monitorTimer = null;
let monitorRunning = false;
let loginRoleListenerInitialized = false;
let maintenanceModalDismissed = false;
let maintenanceModalStateKey = "";

window.addEventListener("app:login-screen-shown", () => {
    maintenanceModalDismissed = false;
    void getSystemAccessState();
});

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

    if (
        state?.maintenance_enabled &&
        state?.current_role !== "super_admin"
    ) {
        if (notice) {
            notice.hidden = true;
            notice.textContent = "";
        }
        renderMaintenanceModal(state);
        return;
    }

    closeMaintenanceModal(false);

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

    notice.textContent = forcedMessage || "現在ログインできません。";

    notice.classList.toggle(
        "is-denied",
        denied
    );

    notice.hidden = false;
}

function renderMaintenanceModal(state) {
    const stateKey = JSON.stringify({
        endAt: state?.maintenance_end_at || "",
        message: state?.maintenance_message || ""
    });

    if (stateKey !== maintenanceModalStateKey) {
        maintenanceModalStateKey = stateKey;
        maintenanceModalDismissed = false;
    }

    if (maintenanceModalDismissed) return;

    let overlay = document.getElementById("maintenanceNoticeModal");

    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "maintenanceNoticeModal";
        overlay.className = "maintenance-notice-overlay";
        overlay.innerHTML = `
            <section class="maintenance-notice-modal" role="dialog" aria-modal="true" aria-labelledby="maintenanceNoticeTitle">
                <button type="button" class="maintenance-notice-close" aria-label="メンテナンス案内を閉じる">×</button>
                <div class="maintenance-notice-heading">
            <span class="maintenance-notice-mark" aria-hidden="true"></span>
            <div>
                        <h2 id="maintenanceNoticeTitle" class="maintenance-notice-title"></h2>
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
        <p class="maintenance-notice-admin">※メンテナンス中はすべての機能を利用できません</p>
            </section>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector(".maintenance-notice-close")
            ?.addEventListener("click", () => closeMaintenanceModal(true));

        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) closeMaintenanceModal(true);
        });

        overlay.addEventListener("keydown", (event) => {
            if (event.key === "Escape") closeMaintenanceModal(true);
        });
    }

    overlay.hidden = false;
    document.body.classList.add("maintenance-notice-open");

    overlay.querySelector(".maintenance-notice-title").textContent =
        "現在メンテナンス中";
    overlay.querySelector(".maintenance-notice-lead").textContent =
        "メンテナンス終了後に再度アクセスしてください。";
    overlay.querySelector(".maintenance-notice-end").textContent =
        formatMaintenanceEndAt(state?.maintenance_end_at);

    const message = String(state?.maintenance_message || "").trim();
    const messageBox = overlay.querySelector(".maintenance-notice-message");

    if (messageBox) {
        messageBox.hidden = !message;
        messageBox.querySelector("p").textContent = message;
    }

    window.setTimeout(() => {
        overlay.querySelector(".maintenance-notice-close")?.focus();
    }, 0);
}

function closeMaintenanceModal(dismissed) {
    const overlay = document.getElementById("maintenanceNoticeModal");
    if (overlay) overlay.hidden = true;
    document.body.classList.remove("maintenance-notice-open");

    if (dismissed) maintenanceModalDismissed = true;

    if (!cachedState?.maintenance_enabled) {
        maintenanceModalDismissed = false;
        maintenanceModalStateKey = "";
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
