import { supabase } from "./supabase.js";

import {
    getCurrentSession,
    getCurrentProfile,
    getOperatorName,
    getTerminalId,
    isAdmin,
    logout
} from "./auth.js";


const HEARTBEAT_INTERVAL = 60 * 1000;
const FORCE_CHECK_INTERVAL = 5 * 1000;
const ONLINE_THRESHOLD_MINUTES = 5;

const LOGIN_STARTED_KEY =
    "hoseimaster_presence_login_started_at";

let heartbeatTimer = null;
let forceCheckTimer = null;
let initialized = false;
let forcedLogoutRunning = false;

let cachedUserId = null;
let cachedTerminal = null;


/* ========================================
   初期化
======================================== */

export function initializePresence() {

    if (initialized) {
        return;
    }

    initialized = true;

    window.addEventListener(
        "app:login",
        async () => {
            resetLoginStartedAt();
            await startPresence();
        }
    );

    window.addEventListener(
        "app:logout",
        () => {
            cleanupPresenceState();
        }
    );

    document.addEventListener(
        "visibilitychange",
        async () => {

            if (
                document.visibilityState !==
                "visible"
            ) {
                return;
            }

            await heartbeat();
            await checkForcedLogout();

            if (isAdmin()) {
                await loadOnlineUsers();
            }
        }
    );

    document.addEventListener(
        "app:screenchange",
        async (event) => {

            if (
                event.detail?.screen ===
                    "settingsScreen" &&
                isAdmin()
            ) {
                renderAdminArea(true);
                await loadOnlineUsers();
            }
        }
    );

    document.addEventListener(
        "click",
        handlePresenceClick
    );

    startPresence();
}


/* ========================================
   ログイン状態開始
======================================== */

export async function startPresence() {

    stopTimers();

    const session =
        getCurrentSession();

    const profile =
        getCurrentProfile();

    if (
        !session?.user?.id ||
        !profile?.role
    ) {
        renderAdminArea(false);
        return;
    }

    cachedUserId =
        session.user.id;

    cachedTerminal =
        getTerminalId();

    getLoginStartedAt();

    await heartbeat();
    await checkForcedLogout();

    heartbeatTimer =
        window.setInterval(
            heartbeat,
            HEARTBEAT_INTERVAL
        );

    forceCheckTimer =
        window.setInterval(
            checkForcedLogout,
            FORCE_CHECK_INTERVAL
        );

    if (isAdmin()) {
        renderAdminArea(true);
        await loadOnlineUsers();
    } else {
        renderAdminArea(false);
    }
}


/* ========================================
   ハートビート
======================================== */

export async function heartbeat() {

    if (forcedLogoutRunning) {
        return;
    }

    const session =
        getCurrentSession();

    const profile =
        getCurrentProfile();

    if (
        !session?.user?.id ||
        !profile?.role
    ) {
        return;
    }

    cachedUserId =
        session.user.id;

    cachedTerminal =
        getTerminalId();

    const operatorName =
        getOperatorName().trim();

    if (!operatorName) {
        return;
    }

    const now =
        new Date().toISOString();

    const {
        error
    } =
        await supabase
            .from("login_presence")
            .upsert(
                {
                    user_id:
                        cachedUserId,

                    operator_name:
                        operatorName,

                    role:
                        profile.role,

                    terminal:
                        cachedTerminal,

                    logged_in_at:
                        getLoginStartedAt(),

                    last_seen_at:
                        now,

                    is_online:
                        true
                },
                {
                    onConflict:
                        "user_id,terminal"
                }
            );

    if (error) {
        console.error(
            "ログイン状態更新エラー:",
            error
        );
    }
}


/* ========================================
   強制ログアウト確認
======================================== */

async function checkForcedLogout() {

    if (
        forcedLogoutRunning ||
        !cachedUserId ||
        !cachedTerminal
    ) {
        return;
    }

    const {
        data,
        error
    } =
        await supabase
            .from("login_presence")
            .select(`
                forced_logout_at,
                logged_in_at
            `)
            .eq(
                "user_id",
                cachedUserId
            )
            .eq(
                "terminal",
                cachedTerminal
            )
            .maybeSingle();

    if (error) {
        console.error(
            "強制ログアウト確認エラー:",
            error
        );
        return;
    }

    if (
        !data?.forced_logout_at
    ) {
        return;
    }

    const forcedAt =
        new Date(
            data.forced_logout_at
        ).getTime();

    const loggedInAt =
        new Date(
            data.logged_in_at ||
            getLoginStartedAt()
        ).getTime();

    if (
        !Number.isFinite(forcedAt) ||
        !Number.isFinite(loggedInAt) ||
        forcedAt < loggedInAt
    ) {
        return;
    }

    forcedLogoutRunning = true;

    stopTimers();

    await markOffline();

    cachedUserId = null;
    cachedTerminal = null;

    sessionStorage.removeItem(
        LOGIN_STARTED_KEY
    );

    try {
        await logout();
    } finally {
        forcedLogoutRunning = false;

        window.alert(
            "管理者によってログアウトされました。"
        );
    }
}


/* ========================================
   オフライン
======================================== */

export async function markOffline() {

    if (
        !cachedUserId ||
        !cachedTerminal
    ) {
        return;
    }

    const {
        error
    } =
        await supabase
            .from("login_presence")
            .update({
                is_online:
                    false,

                last_seen_at:
                    new Date()
                        .toISOString()
            })
            .eq(
                "user_id",
                cachedUserId
            )
            .eq(
                "terminal",
                cachedTerminal
            );

    if (error) {
        console.error(
            "オフライン更新エラー:",
            error
        );
    }
}


/* ========================================
   停止
======================================== */

export async function prepareForLogout() {

    stopTimers();

    await markOffline();
}


export async function stopPresence() {

    await prepareForLogout();

    cleanupPresenceState();
}


function cleanupPresenceState() {

    stopTimers();

    sessionStorage.removeItem(
        LOGIN_STARTED_KEY
    );

    renderAdminArea(false);

    cachedUserId = null;
    cachedTerminal = null;
}

function stopTimers() {

    if (heartbeatTimer) {
        clearInterval(
            heartbeatTimer
        );
        heartbeatTimer = null;
    }

    if (forceCheckTimer) {
        clearInterval(
            forceCheckTimer
        );
        forceCheckTimer = null;
    }
}


/* ========================================
   ログイン開始時刻
======================================== */

function getLoginStartedAt() {

    let value =
        sessionStorage.getItem(
            LOGIN_STARTED_KEY
        );

    if (!value) {
        value =
            new Date()
                .toISOString();

        sessionStorage.setItem(
            LOGIN_STARTED_KEY,
            value
        );
    }

    return value;
}

function resetLoginStartedAt() {

    sessionStorage.setItem(
        LOGIN_STARTED_KEY,
        new Date().toISOString()
    );
}


/* ========================================
   ログイン中一覧
======================================== */

export async function loadOnlineUsers() {

    if (!isAdmin()) {
        renderAdminArea(false);
        return [];
    }

    const container =
        ensureAdminContainer();

    if (!container) {
        return [];
    }

    container.innerHTML = `
        <div class="login-presence-loading">
            ログイン状況を取得しています…
        </div>
    `;

    const threshold =
        new Date(
            Date.now() -
            ONLINE_THRESHOLD_MINUTES *
            60 *
            1000
        ).toISOString();

    const {
        data,
        error
    } =
        await supabase
            .from("login_presence")
            .select(`
                user_id,
                operator_name,
                role,
                terminal,
                logged_in_at,
                last_seen_at,
                is_online,
                forced_logout_at
            `)
            .eq(
                "is_online",
                true
            )
            .gte(
                "last_seen_at",
                threshold
            )
            .order(
                "last_seen_at",
                {
                    ascending:
                        false
                }
            );

    if (error) {

        console.error(
            "ログイン状況取得エラー:",
            error
        );

        container.innerHTML = `
            <div class="login-presence-error">
                ログイン状況を取得できませんでした。
            </div>
        `;

        return [];
    }

    const rows =
        Array.isArray(data)
            ? data
            : [];

    renderOnlineUsers(rows);

    return rows;
}


/* ========================================
   一覧描画
======================================== */

function renderOnlineUsers(rows) {

    const container =
        ensureAdminContainer();

    if (!container) {
        return;
    }

    if (!rows.length) {

        container.innerHTML = `
            <div class="login-presence-empty">
                現在ログイン中の端末はありません。
            </div>
        `;

        return;
    }

    const currentUserId =
        getCurrentSession()
            ?.user
            ?.id ||
        cachedUserId;

    const currentTerminal =
        getTerminalId();

    container.innerHTML =
        rows
            .map(
                (row) => {

                    const isCurrent =
                        row.user_id ===
                            currentUserId &&
                        row.terminal ===
                            currentTerminal;

                    return `
                        <div
                            class="login-presence-item"
                            data-presence-user="${escapeHtml(row.user_id)}"
                            data-presence-terminal="${escapeHtml(row.terminal)}"
                        >
                            <div class="login-presence-main">
                                <div class="login-presence-name-row">
                                    <strong>
                                        ${escapeHtml(
                                            row.operator_name ||
                                            "不明"
                                        )}
                                    </strong>

                                    <span class="login-presence-role">
                                        ${getPresenceRoleLabel(row.role)}
                                    </span>

                                    ${
                                        isCurrent
                                            ? `
                                                <span class="login-presence-current">
                                                    この端末
                                                </span>
                                            `
                                            : ""
                                    }
                                </div>

                                <div class="login-presence-meta">
                                    <span class="login-presence-online">
                                        オンライン
                                    </span>

                                    <span>
                                        最終確認
                                        ${escapeHtml(
                                            formatDateTime(
                                                row.last_seen_at
                                            )
                                        )}
                                    </span>
                                </div>
                            </div>

                            <div class="login-presence-actions">
                                ${
                                    isCurrent
                                        ? ""
                                        : `
                                            <button
                                                type="button"
                                                class="login-presence-force-button"
                                                data-force-logout
                                                data-user-id="${escapeHtml(row.user_id)}"
                                                data-terminal="${escapeHtml(row.terminal)}"
                                                data-operator-name="${escapeHtml(row.operator_name || "不明")}"
                                            >
                                                強制ログアウト
                                            </button>
                                        `
                                }
                            </div>
                        </div>
                    `;
                }
            )
            .join("");
}


/* ========================================
   ボタン処理
======================================== */

async function handlePresenceClick(
    event
) {

    const refreshButton =
        event.target.closest(
            "#loginPresenceRefresh"
        );

    if (refreshButton) {
        await loadOnlineUsers();
        return;
    }

    const forceButton =
        event.target.closest(
            "[data-force-logout]"
        );

    if (!forceButton) {
        return;
    }

    if (!isAdmin()) {
        return;
    }

    const userId =
        forceButton.dataset.userId;

    const terminal =
        forceButton.dataset.terminal;

    const operatorName =
        forceButton.dataset.operatorName ||
        "この端末";

    if (
        !userId ||
        !terminal
    ) {
        return;
    }

    const confirmed =
        window.confirm(
            `${operatorName} を強制ログアウトしますか？`
        );

    if (!confirmed) {
        return;
    }

    forceButton.disabled = true;
    forceButton.textContent =
        "処理中…";

    try {

        const {
            error
        } =
            await supabase.rpc(
                "force_logout_presence",
                {
                    target_user_id:
                        userId,

                    target_terminal:
                        terminal,

                    requester_terminal:
                        getTerminalId()
                }
            );

        if (error) {
            throw error;
        }

        await loadOnlineUsers();

    } catch (error) {

        console.error(
            "強制ログアウトエラー:",
            error
        );

        window.alert(
            "強制ログアウトを実行できませんでした。"
        );

        forceButton.disabled = false;
        forceButton.textContent =
            "強制ログアウト";
    }
}


/* ========================================
   管理者表示
======================================== */

function renderAdminArea(
    visible
) {

    const section =
        document.getElementById(
            "loginPresenceSection"
        );

    if (section) {
        section.hidden =
            !visible;
    }

    if (visible) {
        ensureAdminContainer();
    }
}

function ensureAdminContainer() {

    if (!isAdmin()) {
        return null;
    }

    let section =
        document.getElementById(
            "loginPresenceSection"
        );

    let container =
        document.getElementById(
            "loginPresenceList"
        );

    if (
        section &&
        container
    ) {
        section.hidden = false;
        return container;
    }

    const settingsList =
        document.querySelector(
            "#settingsScreen .settings-list"
        );

    if (!settingsList) {
        return null;
    }

    section =
        document.createElement(
            "section"
        );

    section.id =
        "loginPresenceSection";

    section.className =
        "login-presence-section admin-only";

    section.innerHTML = `
        <div class="login-presence-header">
            <div class="login-presence-heading">
                <h2 class="login-presence-title">
                    現在ログイン中
                </h2>

                <p class="login-presence-description">
                    5分以内に通信があった端末をオンラインとして表示します。
                </p>
            </div>

            <button
                type="button"
                id="loginPresenceRefresh"
                class="login-presence-refresh"
            >
                更新
            </button>
        </div>

        <div
            id="loginPresenceList"
            class="login-presence-list"
        ></div>
    `;

    settingsList.appendChild(
        section
    );

    return section.querySelector(
        "#loginPresenceList"
    );
}


/* ========================================
   権限表示
======================================== */

function getPresenceRoleLabel(role) {

    switch (String(role || "")) {

        case "super_admin":
            return "最高管理者";

        case "admin":
            return "管理者";

        case "staff":
            return "スタッフ";

        case "viewer":
            return "閲覧者";

        default:
            return "不明";
    }
}


/* ========================================
   日時
======================================== */

function formatDateTime(value) {

    if (!value) {
        return "-";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return String(value);
    }

    return new Intl.DateTimeFormat(
        "ja-JP",
        {
            timeZone:
                "Asia/Tokyo",

            month:
                "2-digit",

            day:
                "2-digit",

            hour:
                "2-digit",

            minute:
                "2-digit",

            second:
                "2-digit"
        }
    ).format(date);
}


/* ========================================
   HTMLエスケープ
======================================== */

function escapeHtml(value) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}

window.hoseimasterPresence = {
    startPresence,
    stopPresence,
    prepareForLogout,
    markOffline,
    heartbeat,
    loadOnlineUsers
};
