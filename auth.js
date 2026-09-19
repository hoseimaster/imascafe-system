import { supabase } from "./supabase.js";
import { APP_CONFIG } from "./config.js";
import {
    getSystemAccessState,
    isRoleAllowed,
    showAccessDenied,
    showAccountDisabled
} from "./system-access.js";


/* ========================================
   認証アカウント
======================================== */

const AUTH_ACCOUNTS = {
    super_admin: "super-admin@hoseimaster-web.com",
    admin: "admin@hoseimaster-web.com",
    staff: "staff@hoseimaster-web.com",
    viewer: "viewer@hoseimaster-web.com"
};


/* ========================================
   権限
======================================== */

const ROLE_SUPER_ADMIN =
    APP_CONFIG?.ROLES?.SUPER_ADMIN || "super_admin";

const ROLE_ADMIN =
    APP_CONFIG?.ROLES?.ADMIN || "admin";

const ROLE_STAFF =
    APP_CONFIG?.ROLES?.STAFF || "staff";

const ROLE_VIEWER =
    APP_CONFIG?.ROLES?.VIEWER || "viewer";


const ROLE_LABELS = {
    [ROLE_SUPER_ADMIN]:
        APP_CONFIG?.ROLE_LABELS?.super_admin || "最高管理者",

    [ROLE_ADMIN]:
        APP_CONFIG?.ROLE_LABELS?.admin || "管理者",

    [ROLE_STAFF]:
        APP_CONFIG?.ROLE_LABELS?.staff || "スタッフ",

    [ROLE_VIEWER]:
        APP_CONFIG?.ROLE_LABELS?.viewer || "閲覧者"
};


/* ========================================
   状態
======================================== */

let currentSession = null;
let currentProfile = null;

let initialized = false;
let loginLoading = false;
let loginEventInitialized = false;
let authListenerInitialized = false;

let idleLogoutTimer = null;
let idleLogoutInitialized = false;
let idleLogoutRunning = false;

const IDLE_LOGOUT_MINUTES =
    Number(
        APP_CONFIG?.SECURITY?.IDLE_LOGOUT_MINUTES
    ) || 30;

const IDLE_LOGOUT_MS =
    IDLE_LOGOUT_MINUTES * 60 * 1000;


/* ========================================
   DOM
======================================== */

function getElement(id) {
    return document.getElementById(id);
}


function getLoginForm() {
    return getElement("loginForm");
}


function getOperatorNameInput() {
    return getElement("operatorName");
}


function getLoginPasswordInput() {
    return getElement("loginPassword");
}


function getLoginButton() {
    return getElement("loginButton");
}


function getLoginError() {
    return getElement("loginError");
}


function getLoginScreen() {
    return getElement("loginScreen");
}


function getMainApp() {
    return getElement("mainApp");
}


/* ========================================
   初期化
======================================== */

export async function initializeAuth(options = {}) {

    const onServerConnected =
        typeof options.onServerConnected === "function"
            ? options.onServerConnected
            : null;

    if (initialized) {
        return isAuthenticated();
    }

    initialized = true;

    setupLoginEvents();
    setupAuthStateListener();
    setupIdleLogout();

    try {

        const {
            data,
            error
        } = await supabase.auth.getSession();

        if (!error) {
            onServerConnected?.();
        }


        if (error) {

            console.error(
                "Session取得エラー:",
                error
            );

            clearAuthInformation();

            currentSession = null;
            currentProfile = null;

            showLoginScreen();

            return false;
        }


        const session =
            data?.session || null;


        if (!session) {

            currentSession = null;
            currentProfile = null;

            clearAuthInformation();

            showLoginScreen();

            return false;
        }


        const profile =
            await loadProfile(
                session.user.id
            );


        if (!profile) {

            await forceSignOut();

            showLoginError(
                "ユーザー情報を取得できませんでした。"
            );

            return false;
        }


        if (profile.active === false) {

            await forceSignOut();

            showAccountDisabled();
            showLoginError(
                "このアカウントは無効化されています。最高管理者に確認してください。"
            );

            return false;
        }


        if (!isValidRole(profile.role)) {

            await forceSignOut();

            showLoginError(
                "このアカウントには利用権限がありません。"
            );

            return false;
        }

        const accessState =
            await getSystemAccessState();

        if (!isRoleAllowed(accessState, profile.role)) {
            await forceSignOut();
            showAccessDenied(accessState, profile.role);
            return false;
        }


        currentSession = session;
        currentProfile = profile;

        resetIdleLogoutTimer();


        restoreOperatorInformation(
            profile
        );


        saveAuthInformation(
            session,
            profile
        );


        showMainApp();

        updateUserDisplay();


        window.dispatchEvent(
            new CustomEvent(
                "app:auth-restored",
                {
                    detail: {
                        session,
                        profile,
                        operatorName:
                            getOperatorName(),
                        role:
                            profile.role
                    }
                }
            )
        );


        return true;

    } catch (error) {

        console.error(
            "Auth初期化エラー:",
            error
        );

        currentSession = null;
        currentProfile = null;

        clearAuthInformation();

        showLoginScreen();

        showLoginError(
            "認証の初期化に失敗しました。"
        );

        return false;
    }
}


/* ========================================
   ログインイベント
======================================== */

function setupLoginEvents() {

    if (loginEventInitialized) {
        return;
    }

    loginEventInitialized = true;


    const loginForm =
        getLoginForm();


    if (!loginForm) {

        console.error(
            "loginForm が見つかりません。"
        );

        return;
    }


    loginForm.addEventListener(
        "submit",
        handleLogin
    );
}


/* ========================================
   ログイン
======================================== */

async function handleLogin(event) {

    event.preventDefault();


    if (loginLoading) {
        return;
    }


    clearLoginError();


    const operatorNameInput =
        getOperatorNameInput();

    const passwordInput =
        getLoginPasswordInput();


    const operatorName =
        operatorNameInput?.value.trim() || "";

    const password =
        passwordInput?.value || "";


    if (!operatorName) {

        showLoginError(
            "名前を入力してください。"
        );

        operatorNameInput?.focus();

        return;
    }


    if (!password) {

        showLoginError(
            "パスワードを入力してください。"
        );

        passwordInput?.focus();

        return;
    }


    loginLoading = true;

    setLoginButtonState(true);


    try {

        const authResult =
            await authenticateByPassword(
                password
            );


        if (!authResult) {

            await safeSignOut();

            throw new Error(
                "名前またはパスワードが正しくありません。"
            );
        }


        const session =
            authResult.session;


        if (!session?.user?.id) {

            await safeSignOut();

            throw new Error(
                "認証情報を取得できませんでした。"
            );
        }


        const profile =
            await loadProfile(
                session.user.id
            );


        if (!profile) {

            await safeSignOut();

            throw new Error(
                "認証は成功しましたが、ユーザー情報が登録されていません。"
            );
        }


        if (profile.active === false) {

            await safeSignOut();

            currentSession = null;
            currentProfile = null;
            clearAuthInformation();
            showLoginScreen();
            showAccountDisabled();

            return;
        }


        if (!isValidRole(profile.role)) {

            await safeSignOut();

            throw new Error(
                "このアカウントには利用権限がありません。"
            );
        }


        const authenticatedRole =
            authResult.role;


        if (
            authenticatedRole &&
            profile.role !== authenticatedRole
        ) {

            await safeSignOut();

            throw new Error(
                "アカウントの権限設定が正しくありません。"
            );
        }

        const accessState =
            await getSystemAccessState();

        if (!isRoleAllowed(accessState, profile.role)) {
            await safeSignOut();

            currentSession = null;
            currentProfile = null;
            clearAuthInformation();
            showLoginScreen();
            showAccessDenied(accessState, profile.role);

            return;
        }


        currentSession =
            session;

        currentProfile =
            profile;

        resetIdleLogoutTimer();


        saveOperatorInformation(
            operatorName
        );


        saveAuthInformation(
            session,
            profile
        );


        await recordAuthHistory(
            "login",
            operatorName,
            getTerminalId(),
            "ログイン",
            null,
            {
                role: profile.role,
                role_label:
                    getUserRoleLabel(profile.role),
                user_id:
                    session.user.id
            }
        );


        showMainApp();

        updateUserDisplay();


        window.dispatchEvent(
            new CustomEvent(
                "app:login",
                {
                    detail: {
                        session,
                        profile,
                        operatorName,
                        role:
                            profile.role
                    }
                }
            )
        );


        if (passwordInput) {
            passwordInput.value = "";
        }


    } catch (error) {

        console.error(
            "Login error:",
            error
        );


        showLoginError(
            error?.message ||
            "ログインできませんでした。"
        );


    } finally {

        loginLoading = false;

        setLoginButtonState(false);
    }
}


/* ========================================
   認証履歴
======================================== */

async function recordAuthHistory(
    operationType,
    operatorName,
    terminal,
    description,
    beforeValue = null,
    afterValue = null
) {

    try {

        const {
            error
        } = await supabase.rpc(
            "record_auth_history",
            {
                p_operation_type:
                    operationType,

                p_operator_name:
                    operatorName,

                p_terminal:
                    terminal,

                p_description:
                    description,

                p_before_value:
                    beforeValue,

                p_after_value:
                    afterValue
            }
        );


        if (error) {

            console.error(
                "認証履歴記録エラー:",
                error
            );

            return false;
        }


        return true;

    } catch (error) {

        console.error(
            "認証履歴記録エラー:",
            error
        );

        return false;
    }
}


/* ========================================
   パスワード認証
======================================== */

async function authenticateByPassword(
    password
) {

    const accountEntries = [
        {
            role: ROLE_SUPER_ADMIN,
            email: AUTH_ACCOUNTS.super_admin
        },
        {
            role: ROLE_ADMIN,
            email: AUTH_ACCOUNTS.admin
        },
        {
            role: ROLE_STAFF,
            email: AUTH_ACCOUNTS.staff
        },
        {
            role: ROLE_VIEWER,
            email: AUTH_ACCOUNTS.viewer
        }
    ];


    for (
        const account
        of accountEntries
    ) {

        const result =
            await signIn(
                account.email,
                password
            );


        if (result) {

            return {
                ...result,
                role: account.role
            };
        }


        await safeSignOut();
    }


    return null;
}


/* ========================================
   Supabase Auth
======================================== */

async function signIn(
    email,
    password
) {

    const {
        data,
        error
    } = await supabase.auth.signInWithPassword({
        email,
        password
    });


    if (error) {
        return null;
    }


    if (!data?.session) {
        return null;
    }


    return data;
}


/* ========================================
   プロフィール
======================================== */

async function loadProfile(
    userId
) {

    if (!userId) {
        return null;
    }


    const {
        data,
        error
    } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();


    if (error) {

        console.error(
            "Profile取得エラー:",
            error
        );

        return null;
    }


    return data || null;
}


/* ========================================
   権限
======================================== */

function isValidRole(role) {

    return (
        role === ROLE_SUPER_ADMIN ||
        role === ROLE_ADMIN ||
        role === ROLE_STAFF ||
        role === ROLE_VIEWER
    );
}


export function getUserRole() {

    return (
        currentProfile?.role ||
        null
    );
}


export function isAdmin() {

    return (
        getUserRole() === ROLE_SUPER_ADMIN ||
        getUserRole() === ROLE_ADMIN
    );
}


export function isSuperAdmin() {

    return (
        getUserRole() === ROLE_SUPER_ADMIN
    );
}


export function isStaff() {

    const role =
        getUserRole();


    return (
        role === ROLE_STAFF ||
        role === ROLE_SUPER_ADMIN ||
        role === ROLE_ADMIN
    );
}


export function isViewer() {

    return (
        getUserRole() === ROLE_VIEWER
    );
}


export function canViewStatistics() {

    return (
        isAdmin() ||
        isStaff() ||
        isViewer()
    );
}


export function canViewAnomalyDetection() {

    return (
        isAdmin() ||
        isStaff() ||
        isViewer()
    );
}


export function canManageOrders() {

    return (
        isAdmin() ||
        isStaff()
    );
}


export function canManageInventory() {

    return (
        isAdmin() ||
        isStaff()
    );
}


export function canManageProducts() {

    return isAdmin();
}


export function canManageEventDays() {

    return isAdmin();
}


export function canManageExpenses() {

    return isAdmin();
}


export function canResetData() {

    return isAdmin();
}


/* ========================================
   権限ラベル
======================================== */

export function getUserRoleLabel(
    role = getUserRole()
) {

    return (
        ROLE_LABELS[role] ||
        "-"
    );
}


/* ========================================
   セッション
======================================== */

export function getCurrentSession() {
    return currentSession;
}


export function getCurrentProfile() {
    return currentProfile;
}


export function isAuthenticated() {

    return Boolean(
        currentSession?.user &&
        currentProfile?.id &&
        currentProfile?.active !== false &&
        isValidRole(currentProfile?.role)
    );
}


/* ========================================
   オペレーター名
======================================== */

export function getOperatorName() {

    return (
        localStorage.getItem(
            APP_CONFIG.OPERATOR_NAME_STORAGE_KEY
        ) || ""
    );
}


function saveOperatorInformation(
    operatorName
) {

    if (!operatorName) {
        return;
    }


    localStorage.setItem(
        APP_CONFIG.OPERATOR_NAME_STORAGE_KEY,
        operatorName
    );


    const currentOperatorKey =
        APP_CONFIG.CURRENT_OPERATOR_STORAGE_KEY ||
        "hoseimaster_cafe_current_operator";


    localStorage.setItem(
        currentOperatorKey,
        operatorName
    );
}


function restoreOperatorInformation(
    profile
) {

    const existingName =
        getOperatorName();


    if (existingName) {
        return;
    }


    const profileOperatorName =
        profile?.operator_name ||
        profile?.operatorName ||
        profile?.name ||
        "";


    if (profileOperatorName) {

        saveOperatorInformation(
            profileOperatorName
        );
    }
}


/* ========================================
   現在の担当者
======================================== */

export function getCurrentOperator() {

    const key =
        APP_CONFIG.CURRENT_OPERATOR_STORAGE_KEY ||
        "hoseimaster_cafe_current_operator";


    return (
        localStorage.getItem(key) ||
        getOperatorName() ||
        ""
    );
}


export function setCurrentOperator(
    operatorName
) {

    if (!isAuthenticated()) {
        return false;
    }


    const normalizedName =
        String(operatorName || "").trim();


    if (!normalizedName) {
        return false;
    }


    saveOperatorInformation(
        normalizedName
    );


    updateUserDisplay();


    window.dispatchEvent(
        new CustomEvent(
            "app:operator-change",
            {
                detail: {
                    operatorName:
                        normalizedName,
                    profile:
                        currentProfile,
                    role:
                        getUserRole()
                }
            }
        )
    );


    return true;
}


/* ========================================
   端末ID
======================================== */

export function getTerminalId() {

    let terminalId =
        localStorage.getItem(
            APP_CONFIG.TERMINAL_STORAGE_KEY
        );


    if (!terminalId) {

        terminalId =
            createTerminalId();


        localStorage.setItem(
            APP_CONFIG.TERMINAL_STORAGE_KEY,
            terminalId
        );
    }


    return terminalId;
}


function createTerminalId() {

    if (
        window.crypto &&
        typeof window.crypto.randomUUID ===
            "function"
    ) {

        return window.crypto.randomUUID();
    }


    return (
        "terminal-" +
        Date.now().toString(36) +
        "-" +
        Math.random()
            .toString(36)
            .slice(2, 10)
    );
}


/* ========================================
   認証情報保存
======================================== */

function saveAuthInformation(
    session,
    profile
) {

    localStorage.setItem(
        APP_CONFIG.SESSION_STORAGE_KEY,
        "authenticated"
    );


    if (profile?.role) {

        const roleKey =
            APP_CONFIG.CURRENT_ROLE_STORAGE_KEY ||
            "hoseimaster_cafe_role";


        localStorage.setItem(
            roleKey,
            profile.role
        );


        localStorage.setItem(
            "hoseimaster_cafe_role",
            profile.role
        );
    }


    if (profile?.id) {

        localStorage.setItem(
            "hoseimaster_cafe_user_id",
            profile.id
        );
    }


    if (session?.user?.id) {

        localStorage.setItem(
            "hoseimaster_cafe_auth_user_id",
            session.user.id
        );
    }
}


/* ========================================
   認証情報削除
======================================== */

function clearAuthInformation() {

    localStorage.removeItem(
        APP_CONFIG.SESSION_STORAGE_KEY
    );


    const roleKey =
        APP_CONFIG.CURRENT_ROLE_STORAGE_KEY ||
        "hoseimaster_cafe_role";


    localStorage.removeItem(
        roleKey
    );


    localStorage.removeItem(
        "hoseimaster_cafe_role"
    );


    localStorage.removeItem(
        "hoseimaster_cafe_user_id"
    );


    localStorage.removeItem(
        "hoseimaster_cafe_auth_user_id"
    );


    localStorage.removeItem(
        APP_CONFIG.CURRENT_OPERATOR_STORAGE_KEY ||
        "hoseimaster_cafe_current_operator"
    );
}


/* ========================================
   無操作タイムアウト
======================================== */

function setupIdleLogout() {

    if (idleLogoutInitialized) {
        return;
    }

    idleLogoutInitialized = true;

    const activityEvents = [
        "pointerdown",
        "keydown",
        "touchstart",
        "wheel"
    ];

    for (const eventName of activityEvents) {

        window.addEventListener(
            eventName,
            handleUserActivity,
            {
                passive: true,
                capture: true
            }
        );
    }
}


function handleUserActivity() {

    if (!isAuthenticated()) {
        return;
    }

    resetIdleLogoutTimer();
}


function resetIdleLogoutTimer() {

    stopIdleLogoutTimer();

    if (
        !isAuthenticated() ||
        IDLE_LOGOUT_MS <= 0
    ) {
        return;
    }

    idleLogoutTimer =
        window.setTimeout(
            handleIdleLogout,
            IDLE_LOGOUT_MS
        );
}


function stopIdleLogoutTimer() {

    if (idleLogoutTimer !== null) {

        window.clearTimeout(
            idleLogoutTimer
        );

        idleLogoutTimer = null;
    }
}


async function handleIdleLogout() {

    if (
        idleLogoutRunning ||
        !isAuthenticated()
    ) {
        return;
    }

    idleLogoutRunning = true;

    try {

        await logout();

        window.alert(
            `一定時間（${IDLE_LOGOUT_MINUTES}分）操作がなかったため、自動的にログアウトしました。`
        );

    } finally {

        idleLogoutRunning = false;
    }
}


async function waitForPresenceOffline() {

    const handler =
        window.hoseimasterPresence
            ?.prepareForLogout;

    if (typeof handler !== "function") {
        return;
    }

    try {
        await handler();
    } catch (error) {
        console.error(
            "ログアウト前のPresence停止エラー:",
            error
        );
    }
}


/* ========================================
   ログアウト
======================================== */

export async function logout() {

    stopIdleLogoutTimer();

    const sessionBeforeLogout =
        currentSession;

    const profileBeforeLogout =
        currentProfile;

    const operatorNameBeforeLogout =
        getOperatorName();

    const roleBeforeLogout =
        getUserRole();

    const terminalIdBeforeLogout =
        getTerminalId();


    if (sessionBeforeLogout) {

        window.dispatchEvent(
            new CustomEvent(
                "app:before-logout",
                {
                    detail: {
                        session: sessionBeforeLogout,
                        profile: profileBeforeLogout,
                        operatorName: operatorNameBeforeLogout,
                        role: roleBeforeLogout,
                        terminalId: terminalIdBeforeLogout
                    }
                }
            )
        );

        await waitForPresenceOffline();

        await recordAuthHistory(
            "logout",
            operatorNameBeforeLogout,
            terminalIdBeforeLogout,
            "ログアウト",
            {
                role:
                    roleBeforeLogout,
                user_id:
                    sessionBeforeLogout?.user?.id ||
                    null
            },
            null
        );
    }


    try {

        await supabase.auth.signOut();

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );
    }


    currentSession = null;
    currentProfile = null;


    clearAuthInformation();


    localStorage.removeItem(
        APP_CONFIG.OPERATOR_NAME_STORAGE_KEY
    );


    const passwordInput =
        getLoginPasswordInput();


    if (passwordInput) {
        passwordInput.value = "";
    }


    showLoginScreen();

    clearLoginError();


    window.dispatchEvent(
        new CustomEvent(
            "app:logout",
            {
                detail: {
                    session:
                        sessionBeforeLogout,
                    profile:
                        profileBeforeLogout,
                    operatorName:
                        operatorNameBeforeLogout,
                    role:
                        roleBeforeLogout,
                    terminalId:
                        terminalIdBeforeLogout
                }
            }
        )
    );
}


/* ========================================
   強制ログアウト
======================================== */

async function forceSignOut() {

    stopIdleLogoutTimer();

    await safeSignOut();

    currentSession = null;
    currentProfile = null;

    clearAuthInformation();

    showLoginScreen();
}


/* ========================================
   安全なログアウト
======================================== */

async function safeSignOut() {

    try {

        await supabase.auth.signOut();

    } catch (error) {

        console.error(
            "SignOut error:",
            error
        );
    }
}


/* ========================================
   Auth状態監視
======================================== */

function setupAuthStateListener() {

    if (authListenerInitialized) {
        return;
    }

    authListenerInitialized = true;


    supabase.auth.onAuthStateChange(
        (
            event,
            session
        ) => {

            console.log(
                "Auth state:",
                event
            );


            if (
                event === "SIGNED_IN" &&
                session
            ) {

                /*
                 * SIGNED_IN はパスワード認証が通っただけの段階。
                 * profile / active / system access の検査完了前に
                 * アプリを認証済み扱いにしない。
                 */
                return;
            }


            if (
                (
                    event === "TOKEN_REFRESHED" ||
                    event === "USER_UPDATED"
                ) &&
                session &&
                currentProfile?.id
            ) {

                currentSession =
                    session;

                return;
            }


            if (
                event === "SIGNED_OUT"
            ) {

                currentSession = null;
                currentProfile = null;

                clearAuthInformation();

                showLoginScreen();
            }
        }
    );
}


/* ========================================
   ユーザー表示
======================================== */

function updateUserDisplay() {

    const operatorName =
        getCurrentOperator();

    const role =
        getUserRole();


    const headerName =
        getElement(
            "headerOperatorName"
        );


    const headerRole =
        getElement(
            "headerOperatorRole"
        );


    const settingsName =
        getElement(
            "settingsOperatorName"
        );


    const settingsRole =
        getElement(
            "settingsOperatorRole"
        );


    if (headerName) {

        headerName.textContent =
            operatorName || "-";
    }


    if (settingsName) {

        settingsName.textContent =
            operatorName || "-";
    }


    const roleText =
        getUserRoleLabel(role);


    if (headerRole) {

        headerRole.textContent =
            roleText;
    }


    if (settingsRole) {

        settingsRole.textContent =
            roleText;
    }


    document
        .querySelectorAll(".admin-only")
        .forEach(
            (element) => {

                if (
                    role === ROLE_SUPER_ADMIN ||
                    role === ROLE_ADMIN
                ) {

                    element.hidden =
                        false;

                    element.classList.remove(
                        "hidden"
                    );

                } else {

                    element.hidden =
                        true;

                    element.classList.add(
                        "hidden"
                    );
                }
            }
        );


    document
        .querySelectorAll(".staff-only")
        .forEach(
            (element) => {

                if (
                    role === ROLE_SUPER_ADMIN ||
                    role === ROLE_ADMIN ||
                    role === ROLE_STAFF
                ) {

                    element.hidden =
                        false;

                    element.classList.remove(
                        "hidden"
                    );

                } else {

                    element.hidden =
                        true;

                    element.classList.add(
                        "hidden"
                    );
                }
            }
        );


    document
        .querySelectorAll(".viewer-access")
        .forEach(
            (element) => {

                if (
                    role === ROLE_SUPER_ADMIN ||
                    role === ROLE_ADMIN ||
                    role === ROLE_STAFF ||
                    role === ROLE_VIEWER
                ) {

                    element.hidden =
                        false;

                    element.classList.remove(
                        "hidden"
                    );

                } else {

                    element.hidden =
                        true;

                    element.classList.add(
                        "hidden"
                    );
                }
            }
        );


    document
        .querySelectorAll("[data-role]")
        .forEach(
            (element) => {

                const requiredRole =
                    element.dataset.role;

                if (
                    requiredRole ===
                    ROLE_SUPER_ADMIN
                ) {

                    const allowed =
                        role === ROLE_SUPER_ADMIN;

                    element.hidden = !allowed;
                    element.classList.toggle(
                        "hidden",
                        !allowed
                    );

                    return;
                }


                if (
                    requiredRole ===
                    ROLE_ADMIN
                ) {

                    const allowed =
                        role === ROLE_SUPER_ADMIN ||
                        role === ROLE_ADMIN;

                    element.hidden =
                        !allowed;

                    element.classList.toggle(
                        "hidden",
                        !allowed
                    );

                    return;
                }


                if (
                    requiredRole ===
                    ROLE_STAFF
                ) {

                    const allowed =
                        role === ROLE_SUPER_ADMIN ||
                        role === ROLE_ADMIN ||
                        role === ROLE_STAFF;

                    element.hidden =
                        !allowed;

                    element.classList.toggle(
                        "hidden",
                        !allowed
                    );

                    return;
                }


                if (
                    requiredRole ===
                    ROLE_VIEWER
                ) {

                    const allowed =
                        role === ROLE_SUPER_ADMIN ||
                        role === ROLE_ADMIN ||
                        role === ROLE_STAFF ||
                        role === ROLE_VIEWER;

                    element.hidden =
                        !allowed;

                    element.classList.toggle(
                        "hidden",
                        !allowed
                    );
                }
            }
        );
}


/* ========================================
   ログイン画面
======================================== */

function showLoginScreen() {

    const loginScreen =
        getLoginScreen();

    const mainApp =
        getMainApp();


    if (loginScreen) {

        loginScreen.hidden =
            false;

        loginScreen.classList.remove(
            "hidden"
        );
    }


    if (mainApp) {

        mainApp.hidden =
            true;

        mainApp.classList.add(
            "hidden"
        );
    }


    document.body.classList.remove(
        "is-authenticated"
    );
}


/* ========================================
   メイン画面
======================================== */

function showMainApp() {

    const loginScreen =
        getLoginScreen();

    const mainApp =
        getMainApp();


    if (loginScreen) {

        loginScreen.hidden =
            true;

        loginScreen.classList.add(
            "hidden"
        );
    }


    if (mainApp) {

        mainApp.hidden =
            false;

        mainApp.classList.remove(
            "hidden"
        );
    }


    document.body.classList.add(
        "is-authenticated"
    );
}


/* ========================================
   ログインエラー
======================================== */

function showLoginError(
    message
) {

    const loginError =
        getLoginError();


    if (!loginError) {
        return;
    }


    loginError.textContent =
        message;


    loginError.hidden =
        false;


    loginError.classList.remove(
        "hidden"
    );
}


function clearLoginError() {

    const loginError =
        getLoginError();


    if (!loginError) {
        return;
    }


    loginError.textContent =
        "";


    loginError.hidden =
        true;


    loginError.classList.add(
        "hidden"
    );
}


/* ========================================
   ログインボタン
======================================== */

function setLoginButtonState(
    isLoading
) {

    const loginButton =
        getLoginButton();


    if (!loginButton) {
        return;
    }


    loginButton.disabled =
        isLoading;


    if (isLoading) {

        if (
            !loginButton.dataset.originalText
        ) {

            loginButton.dataset.originalText =
                loginButton.textContent;
        }


        loginButton.textContent =
            "ログイン中…";

    } else {

        loginButton.textContent =
            loginButton.dataset.originalText ||
            "ログイン";
    }
}


/* ========================================
   グローバル公開
======================================== */

window.hoseimasterAuth = {

    initialize:
        initializeAuth,

    login:
        handleLogin,

    logout,

    getCurrentSession,

    getCurrentProfile,

    getOperatorName,

    getCurrentOperator,

    setCurrentOperator,

    getTerminalId,

    getUserRole,

    getUserRoleLabel,

    isAdmin,

    isSuperAdmin,

    isStaff,

    isViewer,

    canViewStatistics,

    canViewAnomalyDetection,

    canManageOrders,

    canManageInventory,

    canManageProducts,

    canManageEventDays,

    canManageExpenses,

    canResetData,

    isAuthenticated
};
