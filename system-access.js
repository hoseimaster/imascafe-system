import { supabase } from "./supabase.js";

let cachedState = null;
let monitorTimer = null;
let monitorRunning = false;

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

    return `${labels[role] || "この権限"}からのログインは現在停止されています。停止解除については最高管理者に確認してください。`;
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

    const message =
        forcedMessage ||
        state?.maintenance_message ||
        "現在、システムメンテナンスを実施しています。";

    notice.textContent = state?.maintenance_enabled
        ? `システムメンテナンス中\n${message}\n最高管理者のみログインできます。`
        : message;

    notice.classList.toggle(
        "is-denied",
        denied
    );

    notice.hidden = false;
}

export function getCachedSystemAccessState() {
    return cachedState;
}
