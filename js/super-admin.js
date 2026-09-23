import { supabase } from "./supabase.js";
import {
    getOperatorName,
    getTerminalId,
    isSuperAdmin
} from "./auth.js";
import { showConfirmModal,
    showForceLogoutUnavailable
} from "./confirm-modal.js";
import { getSystemAccessState } from "./system-access.js";

const BACKUP_FORMAT = "hoseimaster-cafe-backup";
const BACKUP_VERSION = 1;
const PBKDF2_ITERATIONS = 250000;

let initialized = false;
let decryptedBackup = null;
let backupFileHash = "";
let currentAccessState = null;
let cancelledOrderRows = [];
let currentAuditLogs = [];

export async function initializeSuperAdmin() {
    if (!isSuperAdmin()) return;

    if (initialized) {
        await refreshSuperAdmin();
        return;
    }

    initialized = true;
    injectSystemManagementNavigation();
    injectSystemManagementScreen();
    bindEvents();

    await refreshSuperAdmin();
}

function injectSystemManagementNavigation() {
    const settingsList = document.querySelector("#settingsScreen .settings-list");
    if (!settingsList || settingsList.querySelector('[data-screen="systemManagementScreen"]')) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "settings-item system-management-settings-entry super-admin-only";
    button.dataset.screen = "systemManagementScreen";
    button.dataset.role = "super_admin";
    button.innerHTML = `
        <span class="settings-item-content">
            <img src="./asset/logo_30.png" class="settings-icon" alt="" aria-hidden="true">
            <span>
                <strong>システム管理</strong>
                <small>最高管理者専用のアクセス制御・復旧・監査</small>
            </span>
        </span>
        <span class="settings-arrow">›</span>
    `;
    settingsList.appendChild(button);
}

function injectSystemManagementScreen() {
    if (document.getElementById("systemManagementScreen")) return;

    const main = document.querySelector(".main-content") ||
        document.querySelector("#mainApp main") ||
        document.querySelector("#mainApp");
    if (!main) return;

    const section = document.createElement("section");
    section.id = "systemManagementScreen";
    section.className = "app-screen settings-management-screen system-management-screen";
    section.dataset.role = "super_admin";
    section.innerHTML = `
        <div class="screen-header management-screen-header">
            <div class="screen-header-back">
                <button type="button" class="panel-back-button" data-screen="settingsScreen" aria-label="設定に戻る">‹</button>
                <div>
                    <h1><img src="./asset/logo_30.png" class="title-icon" alt="" aria-hidden="true"><span>システム管理</span></h1>
                    <p>最高管理者専用のアクセス制御・復旧・監査</p>
                </div>
            </div>
            <button type="button" id="systemManagementRefresh" class="secondary-button">すべて更新</button>
        </div>

        <div class="system-admin-grid">
            <section class="system-admin-card system-admin-card-wide">
                <div class="system-admin-card-header"><h2 class="system-admin-title"><img src="./asset/logo_19.png" alt="" aria-hidden="true">システム状態</h2><span id="systemOverallBadge" class="system-status-badge is-unknown">確認中</span></div>
                <div id="systemStateSummary" class="system-summary-grid"></div>
            </section>

            <section class="system-admin-card">
                <h2 class="system-admin-title"><img src="./asset/logo_20.png" alt="" aria-hidden="true">アクセス制御</h2>
                <p>権限ごとにログインを即時停止・再開できます。最高管理者は対象外です。</p>
                <div class="system-access-control-list">
                    <div class="system-access-control-row"><div><span class="system-role-badge is-admin">管理者</span><span id="adminAccessStatus" class="system-status-badge is-unknown">確認中</span></div><button type="button" class="warning-button" data-access-role="admin">確認中</button></div>
                    <div class="system-access-control-row"><div><span class="system-role-badge is-staff">スタッフ</span><span id="staffAccessStatus" class="system-status-badge is-unknown">確認中</span></div><button type="button" class="warning-button" data-access-role="staff">確認中</button></div>
                    <div class="system-access-control-row"><div><span class="system-role-badge is-viewer">閲覧者</span><span id="viewerAccessStatus" class="system-status-badge is-unknown">確認中</span></div><button type="button" class="warning-button" data-access-role="viewer">確認中</button></div>
                </div>
            </section>

            <section class="system-admin-card">
                <h2 class="system-admin-title"><img src="./asset/logo_21.png" alt="" aria-hidden="true">メンテナンス</h2>
                <div class="system-maintenance-state"><span>現在の状態</span><strong id="maintenanceStatusText">確認中</strong></div>
                <label class="system-admin-field"><span>終了予定</span><input type="datetime-local" id="maintenanceEndAt"></label>
                <label class="system-admin-field"><span>案内メッセージ</span><textarea id="maintenanceMessage" rows="3" maxlength="300"></textarea></label>
                <button type="button" id="toggleMaintenance" class="danger-button">確認中</button>
            </section>

            <section class="system-admin-card system-admin-card-wide">
                <div class="system-admin-card-header"><div><h2 class="system-admin-title"><img src="./asset/logo_22.png" alt="" aria-hidden="true">ログイン中端末</h2><p>権限単位または端末単位でログアウトできます。</p></div><button type="button" id="refreshSuperSessions" class="secondary-button">更新</button></div>
                <div class="system-role-actions">
                    <button type="button" data-force-role="admin" class="warning-button">管理者を一括ログアウト</button>
                    <button type="button" data-force-role="staff" class="warning-button">スタッフを一括ログアウト</button>
                    <button type="button" data-force-role="viewer" class="warning-button">閲覧者を一括ログアウト</button>
                </div>
                <div id="superSessionList" class="system-data-list"></div>
            </section>

            <section class="system-admin-card system-admin-card-wide">
                <div class="system-admin-card-header"><div><h2 class="system-admin-title"><img src="./asset/logo_23.png" alt="" aria-hidden="true">アカウント管理</h2><p>各アカウントの有効状態とパスワードを管理します。</p></div><button type="button" id="refreshManagedAccounts" class="secondary-button">更新</button></div>
                <div id="managedAccountList" class="system-data-list"></div>
            </section>

            <section class="system-admin-card">
                <h2 class="system-admin-title"><img src="./asset/logo_24.png" alt="" aria-hidden="true">在庫の緊急補充</h2>
                <p>通常の入庫・修正では対応できない場合のみ使用してください。</p>
                <label class="system-admin-field"><span>商品</span><select id="emergencyInventoryProduct"></select></label>
                <label class="system-admin-field"><span>補正後の在庫数</span><input type="number" id="emergencyInventoryQuantity" min="0" step="1" inputmode="numeric"></label>
                <label class="system-admin-field"><span>補正理由</span><input type="text" id="emergencyInventoryReason" maxlength="200"></label>
                <button type="button" id="executeEmergencyInventory" class="danger-button">在庫を緊急補正</button>
            </section>

            <section class="system-admin-card system-admin-card-wide">
                <div class="system-admin-card-header"><div><h2 class="system-admin-title"><img src="./asset/logo_25.png" alt="" aria-hidden="true">注文履歴の復元</h2><p>在庫が足りる注文だけ復元できます。</p></div><button type="button" id="refreshCancelledOrders" class="secondary-button">更新</button></div>
                <div id="cancelledOrderList" class="system-data-list"></div>
            </section>

            <section class="system-admin-card system-admin-card-wide">
                <div class="system-admin-card-header"><div><h2 class="system-admin-title"><img src="./asset/logo_26.png" alt="" aria-hidden="true">操作ログ</h2><p>通常の操作履歴に表示しないシステム管理操作のみ表示します。</p></div><button type="button" id="refreshAuditLogs" class="secondary-button">更新</button></div>
                <div id="superAuditList" class="system-data-list system-audit-list"></div>
            </section>

            <section class="system-admin-card">
                <h2 class="system-admin-title"><img src="./asset/logo_27.png" alt="" aria-hidden="true">バックアップ</h2>
                <p>バックアップ本体はDBへ保存されません。</p>
                <label class="system-admin-field"><span>バックアップパスワード</span><input type="password" id="backupPassword" autocomplete="new-password" minlength="8"></label>
                <button type="button" id="createSystemBackup" class="primary-button">バックアップファイルを作成</button>
                <p class="system-admin-note">iPadでは共有画面から「ファイルに保存」を選択できます。</p>
                <div class="backup-log-section">
                    <div class="backup-log-heading"><strong>作成ログ</strong><button type="button" id="refreshBackupLogs" class="secondary-button">更新</button></div>
                    <div id="backupCreationLog" class="backup-log-list"></div>
                </div>
            </section>

            <section class="system-admin-card">
                <h2 class="system-admin-title"><img src="./asset/logo_28.png" alt="" aria-hidden="true">復旧</h2>
                <label class="system-admin-field system-file-field"><span>バックアップファイル</span><input type="file" id="restoreBackupFile" accept=".hmcbackup,application/json"></label>
                <label class="system-admin-field"><span>バックアップパスワード</span><input type="password" id="restorePassword" autocomplete="current-password"></label>
                <button type="button" id="inspectBackupFile" class="secondary-button">ファイルを確認</button>
                <div id="restorePreview" class="restore-preview" hidden></div>
                <label class="system-admin-field"><span>復旧理由</span><input type="text" id="restoreReason" maxlength="200"></label>
                <label class="system-admin-field"><span>確認文字「データを復旧する」</span><input type="text" id="restoreConfirmation" autocomplete="off"></label>
                <button type="button" id="restoreSystemBackup" class="danger-button" disabled>全置換復旧を実行</button>
            </section>

            <section class="system-admin-card system-admin-card-wide">
                <div class="system-admin-card-header"><div><h2 class="system-admin-title"><img src="./asset/logo_29.png" alt="" aria-hidden="true">システム診断</h2><p>DB・権限・注文・在庫・同期状態を確認します。</p></div><button type="button" id="runSystemDiagnostics" class="primary-button">診断を実行</button></div>
                <div id="systemDiagnostics" class="diagnostics-results"></div>
                <button type="button" id="exportDiagnostics" class="secondary-button" disabled>診断結果をファイル出力</button>
            </section>
        </div>
    `;
    main.appendChild(section);
}

function bindEvents() {
    document.addEventListener("app:screenchange", (event) => {
        if (event.detail?.screen === "systemManagementScreen" && isSuperAdmin()) {
            void refreshSuperAdmin();
        }
    });

    document.addEventListener("click", async (event) => {
        const target = event.target.closest("button");
        if (!target || !isSuperAdmin()) return;

        if (target.id === "systemManagementRefresh") await refreshSuperAdmin();
        if (target.dataset.accessRole) await toggleRoleAccess(target.dataset.accessRole);
        if (target.id === "toggleMaintenance") await toggleMaintenance();
        if (target.id === "refreshSuperSessions") await loadSessions();
        if (target.dataset.forceRole) await forceLogoutRole(target.dataset.forceRole);
        if (target.dataset.forceUnavailable) await showForceLogoutUnavailable();
        if (target.dataset.forceUser) await forceLogoutTerminal(target);
        if (target.id === "refreshManagedAccounts") await loadManagedAccounts();
        if (target.dataset.passwordAccountId) await changeAccountPassword(target);
        if (target.dataset.accountId) await toggleAccount(target);
        if (target.id === "executeEmergencyInventory") await emergencyAdjustInventory();
        if (target.id === "refreshCancelledOrders") await loadCancelledOrders();
        if (target.dataset.cancelledOrderDetail) openCancelledOrderDetail(target.dataset.cancelledOrderDetail);
        if (target.dataset.restoreOrder) await restoreOrder(target.dataset.restoreOrder);
        if (target.id === "refreshAuditLogs") await loadAuditLogs();
        if (target.dataset.auditDetail) openAuditLogDetail(target.dataset.auditDetail);
        if (target.id === "createSystemBackup") await createBackup();
        if (target.id === "refreshBackupLogs") await loadBackupCreationLog();
        if (target.id === "inspectBackupFile") await inspectBackup();
        if (target.id === "restoreSystemBackup") await restoreBackup();
        if (target.id === "runSystemDiagnostics") await runDiagnostics();
        if (target.dataset.diagnosticStalledSessions) await openStalledSessionDetails();
        if (target.id === "exportDiagnostics") exportDiagnostics();
    });
}

async function refreshSuperAdmin() {
    if (!isSuperAdmin()) return;
    await Promise.all([
        loadControlState(),
        loadSessions(),
        loadManagedAccounts(),
        loadEmergencyProducts(),
        loadCancelledOrders(),
        loadAuditLogs(),
        loadBackupCreationLog(),
        runDiagnostics(false)
    ]);
}

async function loadManagedAccounts() {
    const container = document.getElementById("managedAccountList");
    if (!container) return;
    container.innerHTML = loadingText();
    const { data, error } = await supabase.rpc("get_password_manageable_accounts");
    if (error) return renderError(container, "アカウントを取得できませんでした。");
    if (!data?.length) return renderEmpty(container, "管理対象のアカウントはありません。");
    container.innerHTML = data.map((row) => `
        <article class="system-data-row">
            <div><strong>${escapeHtml(row.display_name)}</strong><span class="system-account-meta">${roleBadge(row.role)}<span>${row.active ? "有効" : "無効"}</span></span><small>最終利用 ${formatDateTime(row.last_seen_at)}</small></div>
            <div class="system-account-actions">
                <button type="button" class="secondary-button" data-password-account-id="${escapeHtml(row.id)}" data-password-account-name="${escapeHtml(row.display_name)}">パスワード変更</button>
                ${row.role === "super_admin"
                    ? '<span class="system-protected-label">保護対象</span>'
                    : `<button type="button" class="${row.active ? "danger-outline-button" : "primary-button"}" data-account-id="${escapeHtml(row.id)}" data-account-active="${row.active ? "true" : "false"}">${row.active ? "無効化" : "有効化"}</button>`}
            </div>
        </article>
    `).join("");
}

async function changeAccountPassword(button) {
    const accountId = button.dataset.passwordAccountId;
    const accountName = button.dataset.passwordAccountName || "選択したアカウント";
    const password = await requestPasswordModal(accountName);
    if (!password) return;

    const confirmed = await showConfirmModal(
        `${accountName}のログインパスワードを変更します。`,
        { title: "パスワードを変更しますか？", confirmText: "変更", tone: "warning", operation: "account-password-update" }
    );
    if (!confirmed) return;

    const { error } = await supabase.rpc("change_managed_account_password", {
        p_user_id: accountId,
        p_new_password: password
    });
    if (error) return showError("パスワードを変更できませんでした。", error);

    await supabase.rpc("record_auth_history", {
        p_operation_type: "account_password_update",
        p_operator_name: getOperatorName(),
        p_terminal: getTerminalId(),
        p_description: `${accountName}のパスワードを変更`,
        p_before_value: null,
        p_after_value: { user_id: accountId }
    });

    showToast(`${accountName}のパスワードを変更しました。`, "success");
    await loadAuditLogs();
}

async function toggleAccount(button) {
    const enable = button.dataset.accountActive !== "true";
    const reason = await requestTextModal(
        enable ? "アカウント有効化の理由" : "アカウント無効化の理由",
        "理由を入力してください。",
        "account-active-reason"
    );
    if (!reason) return;
    const confirmed = await showConfirmModal(
        enable ? "選択したアカウントを有効化します。" : "選択したアカウントを無効化し、ログイン中であれば強制ログアウトします。",
        { title: enable ? "アカウントを有効化しますか？" : "アカウントを無効化しますか？", confirmText: enable ? "有効化" : "無効化", tone: enable ? "warning" : "danger", operation: "account-active-update" }
    );
    if (!confirmed) return;
    const { error } = await supabase.rpc("set_account_active", {
        p_user_id: button.dataset.accountId,
        p_active: enable,
        p_reason: reason,
        p_operator_name: getOperatorName(),
        p_terminal: getTerminalId()
    });
    if (error) return showError("アカウント状態を変更できませんでした。", error);
    showToast(`アカウントを${enable ? "有効化" : "無効化"}しました。`, "success");
    await Promise.all([loadManagedAccounts(), loadSessions(), loadAuditLogs()]);
}

async function loadEmergencyProducts() {
    const select = document.getElementById("emergencyInventoryProduct");
    if (!select) return;
    const selected = select.value;
    const { data, error } = await supabase.from("products")
        .select("id,name,active,inventory(quantity)")
        .order("category").order("name");
    if (error) {
        select.innerHTML = '<option value="">商品を取得できません</option>';
        return;
    }
    select.innerHTML = '<option value="">商品を選択</option>' + (data || []).map((row) => {
        const quantity = Array.isArray(row.inventory) ? row.inventory[0]?.quantity : row.inventory?.quantity;
        return `<option value="${row.id}" data-current-quantity="${Number(quantity || 0)}">${escapeHtml(row.name)}（現在 ${Number(quantity || 0)}）${row.active ? "" : "［停止中］"}</option>`;
    }).join("");
    if ([...select.options].some((option) => option.value === selected)) select.value = selected;
}

async function emergencyAdjustInventory() {
    const productId = Number(valueOf("emergencyInventoryProduct"));
    const quantityText = valueOf("emergencyInventoryQuantity");
    const quantity = Number(quantityText);
    const reason = valueOf("emergencyInventoryReason");
    if (!Number.isInteger(productId) || productId < 1) return showToast("商品を選択してください。", "error");
    if (quantityText === "" || !Number.isInteger(quantity) || quantity < 0) return showToast("補正後の在庫数を0以上の整数で入力してください。", "error");
    if (!reason) return showToast("補正理由を入力してください。", "error");
    const confirmed = await showConfirmModal(
        `在庫数を ${quantity} に直接補正します。`,
        { title: "在庫を緊急補正しますか？", confirmText: "緊急補正", tone: "danger", operation: "inventory-emergency-adjustment" }
    );
    if (!confirmed) return;
    const { error } = await supabase.rpc("emergency_adjust_inventory", {
        p_product_id: productId,
        p_quantity: quantity,
        p_reason: reason,
        p_operator_name: getOperatorName(),
        p_terminal: getTerminalId()
    });
    if (error) return showError("在庫を緊急補正できませんでした。", error);
    setValue("emergencyInventoryQuantity", "");
    setValue("emergencyInventoryReason", "");
    showToast("在庫を緊急補正しました。", "success");
    await Promise.all([loadEmergencyProducts(), loadAuditLogs(), runDiagnostics(false)]);
    document.dispatchEvent(new CustomEvent("app:realtime-refresh", { detail: { screen: "inventory" } }));
}

async function loadControlState() {
    const state = await getSystemAccessState();
    if (!state) return;
    currentAccessState = state;

    setValue("maintenanceMessage", state.maintenance_message || "");
    setValue("maintenanceEndAt", toLocalInput(state.maintenance_end_at));

    for (const role of ["admin", "staff", "viewer"]) {
        const enabled = state[`${role}_login_enabled`] !== false;
        const badge = document.getElementById(`${role}AccessStatus`);
        const button = document.querySelector(`[data-access-role="${role}"]`);
        if (badge) {
            badge.textContent = enabled ? "ログイン許可" : "ログイン停止中";
            badge.className = `system-status-badge ${enabled ? "is-ok" : "is-error"}`;
        }
        const accessRow = button?.closest(".system-access-control-row");
        if (accessRow) {
            accessRow.classList.toggle("is-allowed", enabled);
            accessRow.classList.toggle("is-blocked", !enabled);
        }
        if (button) {
            button.textContent = enabled ? "ログインを停止" : "ログインを許可";
            button.className = enabled ? "warning-button" : "primary-button";
        }
    }

    const maintenanceText = document.getElementById("maintenanceStatusText");
    const maintenanceButton = document.getElementById("toggleMaintenance");
    if (maintenanceText) {
        maintenanceText.textContent = state.maintenance_enabled ? "メンテナンス中" : "通常稼働中";
        maintenanceText.className = `system-maintenance-status ${state.maintenance_enabled ? "is-error" : "is-ok"}`;
    }
    if (maintenanceButton) {
        maintenanceButton.textContent = state.maintenance_enabled ? "メンテナンスを終了" : "メンテナンスモードを開始";
        maintenanceButton.className = state.maintenance_enabled ? "primary-button" : "danger-button";
    }

    const summary = document.getElementById("systemStateSummary");
    if (summary) {
        summary.innerHTML = [
            ["メンテナンス", state.maintenance_enabled ? "実施中" : "通常", !state.maintenance_enabled],
            ["管理者ログイン", state.admin_login_enabled ? "許可" : "停止", state.admin_login_enabled],
            ["スタッフログイン", state.staff_login_enabled ? "許可" : "停止", state.staff_login_enabled],
            ["閲覧者ログイン", state.viewer_login_enabled ? "許可" : "停止", state.viewer_login_enabled]
        ].map(([label, value, normal]) => `<div class="${normal ? "is-ok" : "is-error"}"><span>${label}</span><strong>${value}</strong></div>`).join("");
    }
}

async function updateAccessState(patch, confirmation) {
    if (!currentAccessState) await loadControlState();
    if (!currentAccessState) return showToast("現在のアクセス設定を取得できませんでした。", "error");
    const confirmed = await showConfirmModal(confirmation.message, confirmation.options);
    if (!confirmed) return;

    const next = { ...currentAccessState, ...patch };
    const endValue = document.getElementById("maintenanceEndAt")?.value || "";
    const { error } = await supabase.rpc("update_system_access_control", {
        p_maintenance_enabled: Boolean(next.maintenance_enabled),
        p_maintenance_end_at: endValue ? new Date(endValue).toISOString() : null,
        p_maintenance_message: valueOf("maintenanceMessage") || next.maintenance_message || "現在、システムメンテナンスを実施しています。",
        p_admin_login_enabled: next.admin_login_enabled !== false,
        p_staff_login_enabled: next.staff_login_enabled !== false,
        p_viewer_login_enabled: next.viewer_login_enabled !== false,
        p_operator_name: getOperatorName(),
        p_terminal: getTerminalId()
    });
    if (error) return showError("アクセス設定を変更できませんでした。", error);
    showToast("アクセス設定を変更しました。", "success");
    await refreshSuperAdmin();
}

async function toggleRoleAccess(role) {
    if (!currentAccessState) await loadControlState();
    if (!currentAccessState) return;
    const key = `${role}_login_enabled`;
    const enabled = currentAccessState[key] !== false;
    const label = roleLabel(role);
    await updateAccessState({ [key]: !enabled }, {
        message: enabled
            ? `${label}からの新規ログインを停止し、現在ログイン中の対象端末をログアウトします。`
            : `${label}からのログインを再び許可します。`,
        options: {
            title: enabled ? `${label}ログインを停止しますか？` : `${label}ログインを許可しますか？`,
            confirmText: enabled ? "ログインを停止" : "ログインを許可",
            tone: enabled ? "danger" : "warning",
            operation: "system-access-update"
        }
    });
}

async function toggleMaintenance() {
    if (!currentAccessState) await loadControlState();
    if (!currentAccessState) return;
    const starting = !currentAccessState.maintenance_enabled;
    await updateAccessState({ maintenance_enabled: starting }, {
        message: starting
            ? "最高管理者以外の利用を停止し、ログイン中の管理者・スタッフ・閲覧者をログアウトします。"
            : "メンテナンスモードを終了し、権限別アクセス設定に従ってログインを再開します。",
        options: {
            title: starting ? "メンテナンスモードを開始しますか？" : "メンテナンスを終了しますか？",
            confirmText: starting ? "メンテナンスを開始" : "メンテナンスを終了",
            tone: starting ? "danger" : "warning",
            operation: "system-access-update"
        }
    });
}

async function loadSessions() {
    const container = document.getElementById("superSessionList");
    if (!container) return;
    container.innerHTML = loadingText();

    const threshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data, error } = await supabase.from("login_presence")
        .select("user_id,operator_name,role,terminal,logged_in_at,last_seen_at,is_online,forced_logout_at")
        .eq("is_online", true)
        .gte("last_seen_at", threshold)
        .order("last_seen_at", { ascending: false });

    if (error) return renderError(container, "ログイン中端末を取得できませんでした。");
    if (!data?.length) return renderEmpty(container, "現在ログイン中の端末はありません。");

    container.innerHTML = data.map((row) => `
        <article class="system-data-row">
            <div><strong>${escapeHtml(row.operator_name)}</strong><span class="system-session-meta">${roleBadge(row.role)}<span>${escapeHtml(row.terminal)}</span></span><small>最終確認 ${formatDateTime(row.last_seen_at)}</small></div>
            ${row.role === "super_admin" ? '<button type="button" class="system-protected-label" data-force-unavailable="true">強制ログアウト不可</button>' : `<button type="button" class="danger-outline-button" data-force-user="${escapeHtml(row.user_id)}" data-force-terminal="${escapeHtml(row.terminal)}">強制ログアウト</button>`}
        </article>
    `).join("");
}

async function forceLogoutRole(role) {
    const confirmed = await showConfirmModal(
        `${roleLabel(role)}としてログイン中の端末を一括ログアウトします。`,
        { title: "一括ログアウトしますか？", confirmText: "一括ログアウト", tone: "danger", operation: "force-logout-role" }
    );
    if (!confirmed) return;

    const { data, error } = await supabase.rpc("force_logout_by_role", {
        p_target_role: role,
        p_operator_name: getOperatorName(),
        p_terminal: getTerminalId()
    });
    if (error) return showError("一括ログアウトを実行できませんでした。", error);
    showToast(`${Number(data || 0)}端末をログアウト対象にしました。`, "success");
    await loadSessions();
}

async function forceLogoutTerminal(button) {
    const confirmed = await showConfirmModal(
        "選択した端末を強制ログアウトします。",
        { title: "強制ログアウトしますか？", confirmText: "ログアウト", tone: "danger", operation: "force-logout-terminal" }
    );
    if (!confirmed) return;

    const { error } = await supabase.rpc("force_logout_presence", {
        target_user_id: button.dataset.forceUser,
        target_terminal: button.dataset.forceTerminal,
        requester_terminal: getTerminalId()
    });
    if (error) return showError("強制ログアウトを実行できませんでした。", error);
    showToast("強制ログアウトを設定しました。", "success");
    await loadSessions();
}

async function loadCancelledOrders() {
    const container = document.getElementById("cancelledOrderList");
    if (!container) return;
    container.innerHTML = loadingText();

    const { data, error } = await supabase.rpc("get_cancelled_orders");
    if (error) return renderError(container, "取消済み注文を取得できませんでした。");
    cancelledOrderRows = Array.isArray(data) ? data : [];
    if (!cancelledOrderRows.length) return renderEmpty(container, "取消済み注文はありません。");

    container.innerHTML = cancelledOrderRows.map((row, index) => {
        const shortages = Array.isArray(row.shortages) ? row.shortages : [];
        const items = Array.isArray(row.items) ? row.items : [];
        const canRestore = shortages.length === 0;
        const totalItems = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        const operatorName = String(row.operator_name || "").trim();
        const orderTime = String(row.order_time || "").slice(0, 5);

        return `
            <div class="active-order-item is-cancelled">
                <div class="active-order-main">
                    <div class="active-order-number">
                        <span class="active-order-display-number">
                            No.${Number(index + 1).toLocaleString("ja-JP")}
                        </span>
                    </div>

                    <div class="active-order-detail">
                        <span>${escapeHtml(row.order_date || "-")}</span>
                        <span>${escapeHtml(orderTime || "-")}</span>
                        <span>${Number(row.customer_count || 0).toLocaleString("ja-JP")}人</span>
                        <span>${Number(totalItems).toLocaleString("ja-JP")}点</span>
                        <strong>${formatCurrency(row.total_amount)}</strong>
                        <span class="active-order-operator">
                            ${escapeHtml(operatorName || "不明")}
                        </span>
                    </div>
                </div>

                <div class="active-order-actions">
                    <button
                        type="button"
                        class="button button-secondary order-detail-button"
                        data-cancelled-order-detail="${escapeHtml(row.order_id)}"
                    >
                        詳細
                    </button>

                    <button
                        type="button"
                        class="button order-restore-button"
                        data-restore-order="${escapeHtml(row.order_id)}"
                        ${canRestore ? "" : "disabled"}
                        title="${canRestore ? "取消済み注文を復元" : "在庫不足のため復元できません"}"
                    >
                        復元
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

function openCancelledOrderDetail(orderId) {
    const row = cancelledOrderRows.find((item) => String(item.order_id) === String(orderId));
    if (!row) return;

    const overlay = document.getElementById("modalOverlay");
    const title = document.getElementById("modalTitle");
    const content = document.getElementById("modalContent");
    if (!overlay || !title || !content) return;

    const items = Array.isArray(row.items) ? row.items : [];
    const shortages = Array.isArray(row.shortages) ? row.shortages : [];
    const totalItems = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalAmount = Number(row.total_amount || items.reduce(
        (sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0),
        0
    ));

    title.textContent = "注文詳細";
    content.innerHTML = `
        <div class="order-detail-content">
            <div class="order-detail-summary">
                <div class="order-detail-summary-title">注文内容</div>

                <div class="order-detail-products">
                    ${items.length ? items.map((item) => {
                        const quantity = Number(item.quantity || 0);
                        const unitPrice = Number(item.unit_price || 0);
                        return `
                            <div class="order-detail-product">
                                <div class="order-detail-product-main">
                                    <div class="order-detail-product-name">${escapeHtml(item.name || "商品名不明")}</div>
                                    <div class="order-detail-product-price">${formatCurrency(unitPrice)} × ${quantity.toLocaleString("ja-JP")}点</div>
                                </div>
                                <div class="order-detail-product-subtotal">${formatCurrency(unitPrice * quantity)}</div>
                            </div>
                        `;
                    }).join("") : `<div class="order-detail-product"><div class="order-detail-product-main"><div class="order-detail-product-name">商品情報がありません。</div></div></div>`}
                </div>

                <div class="order-detail-total">
                    <span>合計</span>
                    <strong>${formatCurrency(totalAmount)}</strong>
                </div>
            </div>

            <div class="order-detail-info">
                <div class="order-detail-row">
                    <span class="order-detail-label">注文ID</span>
                    <span class="order-detail-value order-detail-id">${escapeHtml(row.order_id || "-")}</span>
                </div>
                <div class="order-detail-row">
                    <span class="order-detail-label">注文日時</span>
                    <span class="order-detail-value">${escapeHtml(row.order_date || "-")} ${escapeHtml(String(row.order_time || "").slice(0, 5) || "-")}</span>
                </div>
                <div class="order-detail-row">
                    <span class="order-detail-label">人数</span>
                    <span class="order-detail-value">${Number(row.customer_count || 0).toLocaleString("ja-JP")}人</span>
                </div>
                <div class="order-detail-row">
                    <span class="order-detail-label">点数</span>
                    <span class="order-detail-value">${totalItems.toLocaleString("ja-JP")}点</span>
                </div>
                <div class="order-detail-row">
                    <span class="order-detail-label">金額</span>
                    <span class="order-detail-value">${formatCurrency(totalAmount)}</span>
                </div>
                <div class="order-detail-row">
                    <span class="order-detail-label">登録者</span>
                    <span class="order-detail-value">${escapeHtml(row.operator_name || "不明")}</span>
                </div>
                <div class="order-detail-row">
                    <span class="order-detail-label">登録端末</span>
                    <span class="order-detail-value">${escapeHtml(row.terminal || "-")}</span>
                </div>
                <div class="order-detail-row">
                    <span class="order-detail-label">状態</span>
                    <span class="order-detail-value">取消済み</span>
                </div>
            </div>

            ${shortages.length ? `
                <div class="system-cancelled-shortage">
                    在庫不足のため復元できません。<br>
                    ${shortages.map((item) => `${escapeHtml(item.name)}：現在 ${Number(item.current_quantity || 0).toLocaleString("ja-JP")} / 必要 ${Number(item.required_quantity || 0).toLocaleString("ja-JP")}`).join("<br>")}
                </div>
            ` : ""}

            <div class="active-order-actions">
                <button
                    type="button"
                    class="button order-restore-button"
                    data-restore-order="${escapeHtml(row.order_id)}"
                    ${shortages.length === 0 ? "" : "disabled"}
                    title="${shortages.length === 0 ? "取消済み注文を復元" : "在庫不足のため復元できません"}"
                >
                    復元
                </button>
            </div>
        </div>
    `;

    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
    document.body.classList.add("modal-open");
}

function closeCancelledOrderDetail() {
    const overlay = document.getElementById("modalOverlay");
    if (!overlay) return;
    overlay.classList.remove("is-visible");
    window.setTimeout(() => {
        if (!overlay.classList.contains("is-visible")) overlay.hidden = true;
    }, 180);
    document.body.classList.remove("modal-open");
}

async function restoreOrder(orderId) {
    const reason = await requestReasonModal(
        "注文の復元理由を入力してください。"
    );
    if (!reason) return;
    const confirmed = await showConfirmModal(
        `注文番号：${orderId}\n在庫を再度減算して注文を有効状態へ戻します。`,
        { title: "取消済み注文を復元しますか？", confirmText: "注文を復元", tone: "warning", operation: "order-restore" }
    );
    if (!confirmed) return;

    const { error } = await supabase.rpc("restore_cancelled_order", {
        p_order_id: orderId,
        p_reason: reason,
        p_operator_name: getOperatorName(),
        p_terminal: getTerminalId()
    });
    if (error) return showError("注文を復元できませんでした。", error);
    closeCancelledOrderDetail();
    showToast("取消済み注文を復元しました。", "success");
    await Promise.all([loadCancelledOrders(), loadAuditLogs(), runDiagnostics(false)]);
    document.dispatchEvent(new CustomEvent("app:realtime-refresh", { detail: { screen: "orders" } }));
}

async function loadAuditLogs() {
    const container = document.getElementById("superAuditList");
    if (!container) return;
    container.innerHTML = loadingText();
    const systemOnlyTypes = [
        "account_active_update",
        "account_password_update",
        "system_access_update",
        "order_restore",
        "force_logout_role",
        "force_logout_terminal",
        "inventory_emergency_adjustment",
        "backup_export",
        "backup_file_created",
        "backup_restore"
    ];
    const { data, error } = await supabase.from("operation_history")
        .select("id,operated_at,operator_name,actor_role,operation_type,target,description,reason")
        .in("operation_type", systemOnlyTypes)
        .order("operated_at", { ascending: false })
        .limit(100);    if (error) return renderError(container, "操作ログを取得できませんでした。");
    if (!data?.length) {
        currentAuditLogs = [];
        return renderEmpty(container, "操作ログはありません。");
    }

    currentAuditLogs = data;

    container.innerHTML = data.map((row) => `
        <article class="system-data-row system-audit-row">
            <strong class="system-audit-title">${escapeHtml(row.description || row.operation_type)}</strong>
            <button type="button" class="secondary-button system-audit-detail-button" data-audit-detail="${row.id}">詳細</button>
        </article>
    `).join("");
}

async function loadBackupCreationLog() {
    const container = document.getElementById("backupCreationLog");
    if (!container) return;
    container.innerHTML = loadingText();

    const { data, error } = await supabase.from("operation_history")
        .select("id,operated_at,operator_name,target,description")
        .eq("operation_type", "backup_file_created")
        .order("operated_at", { ascending: false })
        .limit(3);

    if (error) return renderError(container, "作成ログを取得できませんでした。");
    if (!data?.length) return renderEmpty(container, "作成履歴はありません。");

    container.innerHTML = data.map((row) => `
        <article class="backup-log-row">
            <div><strong>${escapeHtml(row.target || row.description || "バックアップファイル")}</strong><span>${formatDateTime(row.operated_at)}</span></div>
            <small>${escapeHtml(row.operator_name || "担当者不明")}</small>
        </article>
    `).join("");
}


function openAuditLogDetail(id) {
    const row = currentAuditLogs.find((item) => String(item.id) === String(id));
    if (!row) {
        showToast("操作ログの詳細を取得できませんでした。", "error");
        return;
    }

    document.getElementById("systemAuditDetailOverlay")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "systemAuditDetailOverlay";
    overlay.className = "system-audit-detail-overlay";
    overlay.innerHTML = `
        <div class="system-audit-detail-modal" role="dialog" aria-modal="true" aria-labelledby="systemAuditDetailTitle">
            <div class="system-audit-detail-header">
                <div>
                    <span class="system-audit-detail-label">操作ログ</span>
                    <h3 id="systemAuditDetailTitle">${escapeHtml(row.description || row.operation_type)}</h3>
                </div>
                <button type="button" class="system-audit-detail-close" data-close-audit-detail aria-label="閉じる">×</button>
            </div>

            <div class="system-audit-detail-grid">
                <div><span>操作日時</span><strong>${formatDateTime(row.operated_at)}</strong></div>
                <div><span>担当者</span><strong>${escapeHtml(row.operator_name || "不明")}</strong></div>
                <div><span>権限</span><strong>${roleBadge(row.actor_role)}</strong></div>
                <div><span>操作種別</span><strong>${escapeHtml(row.operation_type || "－")}</strong></div>
                <div class="system-audit-detail-wide"><span>対象</span><strong>${escapeHtml(row.target || "－")}</strong></div>
                <div class="system-audit-detail-wide"><span>理由</span><strong>${escapeHtml(row.reason || "－")}</strong></div>
            </div>

            <div class="system-audit-detail-actions">
                <button type="button" class="secondary-button" data-close-audit-detail>閉じる</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener("click", (event) => {
        if (event.target === overlay || event.target.closest("[data-close-audit-detail]")) {
            overlay.remove();
        }
    });
}


async function createBackup() {
    const password = valueOf("backupPassword");
    if (password.length < 8) return showToast("8文字以上のバックアップパスワードを入力してください。", "error");

    const confirmed = await showConfirmModal(
        "現在の業務データを暗号化ファイルとして出力します。パスワードを忘れると復旧できません。",
        { title: "バックアップを作成しますか？", confirmText: "ファイルを作成", tone: "warning", operation: "backup-create" }
    );
    if (!confirmed) return;

    const { data, error } = await supabase.rpc("create_system_backup", {
        p_operator_name: getOperatorName(),
        p_terminal: getTerminalId()
    });
    if (error) return showError("バックアップを作成できませんでした。", error);

    try {
        const plaintext = new TextEncoder().encode(JSON.stringify(data));
        const checksum = await sha256Hex(plaintext);
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveKey(password, salt, ["encrypt"]);
        const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
        const wrapper = {
            format: BACKUP_FORMAT,
            version: BACKUP_VERSION,
            encryption: { algorithm: "AES-GCM", keyDerivation: "PBKDF2-SHA-256", iterations: PBKDF2_ITERATIONS, salt: toBase64(salt), iv: toBase64(iv) },
            checksum,
            ciphertext: toBase64(new Uint8Array(encrypted))
        };
        const stamp = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", dateStyle: "short", timeStyle: "medium" }).format(new Date()).replaceAll("-", "").replaceAll(":", "").replace(" ", "_");
        const filename = `法マス喫茶_backup_${stamp}.hmcbackup`;
        const file = new File([JSON.stringify(wrapper)], filename, { type: "application/json" });
        await saveFile(file);
        const { error: recordError } = await supabase.rpc("record_backup_file_created", {
            p_file_name: filename,
            p_file_hash: checksum,
            p_counts: data?.counts || {},
            p_operator_name: getOperatorName(),
            p_terminal: getTerminalId()
        });
        if (recordError) console.error("バックアップ記録エラー:", recordError);
        setValue("backupPassword", "");
        showToast("バックアップファイルを作成しました。", "success");
        await Promise.all([loadBackupCreationLog(), loadAuditLogs()]);
    } catch (cryptoError) {
        showError("バックアップの暗号化に失敗しました。", cryptoError);
    }
}

async function inspectBackup() {
    const file = document.getElementById("restoreBackupFile")?.files?.[0];
    const password = valueOf("restorePassword");
    if (!file) return showToast("バックアップファイルを選択してください。", "error");
    if (!password) return showToast("バックアップパスワードを入力してください。", "error");

    try {
        const wrapper = JSON.parse(await file.text());
        if (wrapper.format !== BACKUP_FORMAT || wrapper.version !== BACKUP_VERSION) throw new Error("対応していないバックアップ形式です。");
        const salt = fromBase64(wrapper.encryption?.salt);
        const iv = fromBase64(wrapper.encryption?.iv);
        const key = await deriveKey(password, salt, ["decrypt"]);
        const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, fromBase64(wrapper.ciphertext));
        const plaintext = new Uint8Array(decrypted);
        const checksum = await sha256Hex(plaintext);
        if (checksum !== wrapper.checksum) throw new Error("ファイルの整合性を確認できませんでした。");

        const payload = JSON.parse(new TextDecoder().decode(plaintext));
        if (payload.format !== BACKUP_FORMAT || !payload.data) throw new Error("バックアップ内容が不正です。");
        decryptedBackup = payload;
        backupFileHash = checksum;
        renderRestorePreview(payload, file.name);
        document.getElementById("restoreSystemBackup").disabled = false;
        showToast("バックアップファイルを確認しました。", "success");
    } catch (error) {
        decryptedBackup = null;
        backupFileHash = "";
        document.getElementById("restoreSystemBackup").disabled = true;
        showError("バックアップファイルを読み込めませんでした。パスワードとファイルを確認してください。", error);
    }
}

function renderRestorePreview(payload, filename) {
    const preview = document.getElementById("restorePreview");
    if (!preview) return;
    const counts = payload.counts || {};
    preview.hidden = false;
    preview.innerHTML = `
        <strong>復旧可能</strong>
        <span>${escapeHtml(filename)}</span>
        <span>作成日時：${formatDateTime(payload.exportedAt)}</span>
        <span>商品 ${Number(counts.products || 0)}件／注文 ${Number(counts.orders || 0)}件／支出 ${Number(counts.expenses || 0)}件／操作ログ ${Number(counts.operationHistory || 0)}件</span>
    `;
}

async function restoreBackup() {
    if (!decryptedBackup) return showToast("先にバックアップファイルを確認してください。", "error");
    const reason = valueOf("restoreReason");
    if (!reason) return showToast("復旧理由を入力してください。", "error");
    if (valueOf("restoreConfirmation") !== "データを復旧する") return showToast("確認文字が一致しません。", "error");

    const confirmed = await showConfirmModal(
        "現在の注文・商品・在庫・支出・操作ログを、選択したバックアップ時点へ全置換します。この操作は取り消せません。",
        { title: "システムデータを復旧しますか？", confirmText: "全置換復旧を実行", tone: "danger", operation: "backup-restore" }
    );
    if (!confirmed) return;

    const { error } = await supabase.rpc("restore_system_backup", {
        p_backup: decryptedBackup,
        p_file_hash: backupFileHash,
        p_reason: reason,
        p_operator_name: getOperatorName(),
        p_terminal: getTerminalId()
    });
    if (error) return showError("データを復旧できませんでした。変更はロールバックされました。", error);

    showToast("バックアップから復旧しました。メンテナンス状態を確認してください。", "success");
    decryptedBackup = null;
    backupFileHash = "";
    document.getElementById("restoreSystemBackup").disabled = true;
    await refreshSuperAdmin();
}

async function runDiagnostics(showCompletion = true) {
    const container = document.getElementById("systemDiagnostics");
    if (!container) return;
    container.innerHTML = loadingText();

    const started = performance.now();
    const { data, error } = await supabase.rpc("get_system_diagnostics");
    if (error) return renderError(container, "システム診断を実行できませんでした。");

    const diagnostics = data || {};
    diagnostics.client = {
        online: navigator.onLine,
        crypto: Boolean(window.crypto?.subtle),
        fileApi: Boolean(window.File && window.FileReader && window.Blob),
        shareApi: Boolean(navigator.share),
        responseMs: Math.round(performance.now() - started),
        userAgent: navigator.userAgent
    };
    window.latestSystemDiagnostics = diagnostics;
    renderDiagnostics(diagnostics);
    document.getElementById("exportDiagnostics").disabled = false;
    if (showCompletion) showToast("システム診断が完了しました。", "success");
}

function renderDiagnostics(data) {
    const container = document.getElementById("systemDiagnostics");
    const badge = document.getElementById("systemOverallBadge");
    if (!container) return;

    const groups = Array.isArray(data.groups) ? data.groups : [];
    const storageGroup = groups.find((group) => group?.key === "database_storage") || null;
    const normalGroups = groups.filter((group) => group?.key !== "database_storage");
    const storage = data.databaseStorage || data.database_storage || storageGroup?.details || storageGroup || null;
    const overall = data.status || "unknown";

    if (badge) {
        badge.className = `system-status-badge is-${overall}`;
        badge.textContent = statusLabel(overall);
    }

    const normalHtml = normalGroups.map((group) => `
        <article class="diagnostic-card is-${escapeHtml(group.status || "unknown")}">
            <div><strong>${escapeHtml(group.label)}</strong><span>${statusLabel(group.status)}</span></div>
            <p>${escapeHtml(group.summary || "")}</p>
            ${(group.issues || []).map((issue) => `<small>${escapeHtml(issue)}</small>`).join("")}
            ${isLoginDiagnosticsGroup(group) && getStalledSessionCount(group) > 0
                ? '<div style="display:flex;justify-content:flex-end;margin-top:6px;"><button type="button" class="secondary-button" data-diagnostic-stalled-sessions="true" style="width:auto;min-width:0;min-height:0;padding:4px 8px;font-size:10px;line-height:1.2;">詳細</button></div>'
                : ""}
        </article>
    `).join("") + `
        <article class="diagnostic-card is-${data.client?.online ? "ok" : "error"}">
            <div><strong>ブラウザ・端末</strong><span>${data.client?.online ? "正常" : "異常"}</span></div>
            <p>応答 ${Number(data.client?.responseMs || 0)}ms／暗号化 ${data.client?.crypto ? "対応" : "非対応"}／ファイル ${data.client?.fileApi ? "対応" : "非対応"}</p>
        </article>
    `;

    container.innerHTML = `
        <div class="diagnostics-grid">
            ${normalHtml}
        </div>
        ${renderDatabaseStorage(storage, storageGroup)}
    `;
}

function isLoginDiagnosticsGroup(group) {
    const key = String(group?.key || "").toLowerCase();
    const label = String(group?.label || "");
    return key.includes("session") || key.includes("login") || label.includes("ログイン");
}

function getStalledSessionCount(group) {
    const values = [
        group?.details?.stalled,
        group?.details?.stalled_count,
        group?.details?.stalledCount,
        group?.stalled,
        group?.stalled_count,
        group?.stalledCount
    ];
    for (const value of values) {
        const count = Number(value);
        if (Number.isFinite(count)) return count;
    }
    const text = [group?.summary || "", ...(Array.isArray(group?.issues) ? group.issues : [])].join(" ");
    const match = text.match(/応答停止(?:端末)?[^0-9]*([0-9]+)/);
    return match ? Number(match[1]) : 0;
}

async function openStalledSessionDetails() {
    const threshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data, error } = await supabase
        .from("login_presence")
        .select("user_id,operator_name,role,terminal,logged_in_at,last_seen_at,is_online,forced_logout_at")
        .eq("is_online", true)
        .lt("last_seen_at", threshold)
        .order("last_seen_at", { ascending: true });

    if (error) {
        showError("応答停止端末の詳細を取得できませんでした。", error);
        return;
    }

    const rows = Array.isArray(data) ? data : [];
    document.getElementById("stalledSessionDetailOverlay")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "stalledSessionDetailOverlay";
    overlay.className = "system-audit-detail-overlay";
    overlay.innerHTML = `
        <div class="system-audit-detail-modal" role="dialog" aria-modal="true" aria-labelledby="stalledSessionDetailTitle">
            <div class="system-audit-detail-header">
                <div>
                    <span class="system-audit-detail-label">ログイン状態</span>
                    <h3 id="stalledSessionDetailTitle">応答停止端末の詳細</h3>
                </div>
                <button type="button" class="system-audit-detail-close" data-close-stalled-session-detail aria-label="閉じる">×</button>
            </div>
            <div class="system-data-list">
                ${rows.length ? rows.map((row) => `
                    <article class="system-data-row">
                        <div>
                            <strong>${escapeHtml(row.operator_name || "不明")}</strong>
                            <span class="system-session-meta">${roleBadge(row.role)}<span>${escapeHtml(row.terminal || "-")}</span></span>
                            <small>ログイン ${formatDateTime(row.logged_in_at)}</small>
                            <small>最終応答 ${formatDateTime(row.last_seen_at)}（${escapeHtml(formatElapsedTime(row.last_seen_at))}前）</small>
                        </div>
                        <span class="system-status-badge is-error">応答停止</span>
                    </article>
                `).join("") : '<div class="system-empty">現在、応答停止端末はありません。</div>'}
            </div>
            <div class="system-audit-detail-actions">
                <button type="button" class="secondary-button" data-close-stalled-session-detail>閉じる</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay || event.target.closest("[data-close-stalled-session-detail]")) overlay.remove();
    });
}

function formatElapsedTime(value) {
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) return "確認不能";
    const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours < 24) return `${hours}時間${minutes}分`;
    const days = Math.floor(hours / 24);
    return `${days}日${hours % 24}時間`;
}

function renderDatabaseStorage(storage, group) {
    if (!storage) return "";

    const usedBytes = diagnosticNumber(storage.usedBytes ?? storage.used_bytes ?? storage.used);
    const limitBytes = diagnosticNumber(storage.limitBytes ?? storage.limit_bytes ?? storage.assumedLimitBytes ?? storage.assumed_limit_bytes ?? storage.limit);
    const remainingBytes = diagnosticNumber(storage.remainingBytes ?? storage.remaining_bytes ?? storage.remaining);
    const suppliedPercent = diagnosticNumber(storage.usagePercent ?? storage.usage_percent ?? storage.percent);
    const usagePercent = Number.isFinite(suppliedPercent)
        ? suppliedPercent
        : (Number.isFinite(usedBytes) && Number.isFinite(limitBytes) && limitBytes > 0
            ? (usedBytes / limitBytes) * 100
            : 0);
    const safePercent = Math.max(0, Math.min(100, usagePercent || 0));
    const status = storage.status || group?.status || "unknown";
    const topTables = Array.isArray(storage.topTables)
        ? storage.topTables
        : Array.isArray(storage.top_tables)
            ? storage.top_tables
            : [];
    const issues = Array.isArray(storage.issues)
        ? storage.issues
        : Array.isArray(group?.issues)
            ? group.issues
            : [];

    return `
        <section class="database-storage-section">
            <div class="database-storage-heading">
                <div>
                    <span class="database-storage-eyebrow">DATABASE</span>
                    <h3>データベース使用状況</h3>
                </div>
                <span class="system-status-badge is-${escapeHtml(status)}">${statusLabel(status)}</span>
            </div>

            <article class="database-storage-card is-${escapeHtml(status)}">
                <div class="database-storage-primary">
                    <span>現在の使用量</span>
                    <strong>${escapeHtml(formatDiagnosticBytes(usedBytes, storage.usedFormatted ?? storage.used_formatted))}</strong>
                    <small>${escapeHtml(formatDiagnosticBytes(limitBytes, storage.limitFormatted ?? storage.limit_formatted))} 中</small>
                </div>

                <div class="database-storage-progress-block">
                    <div class="database-storage-progress-meta">
                        <span>使用率</span>
                        <strong>${escapeHtml(formatDiagnosticPercent(usagePercent))}</strong>
                    </div>
                    <div class="database-storage-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(safePercent)}">
                        <span style="width: ${safePercent}%"></span>
                    </div>
                </div>

                <div class="database-storage-stats">
                    <div>
                        <span>残り容量</span>
                        <strong>${escapeHtml(formatDiagnosticBytes(remainingBytes, storage.remainingFormatted ?? storage.remaining_formatted))}</strong>
                    </div>
                    <div>
                        <span>容量上限</span>
                        <strong>${escapeHtml(formatDiagnosticBytes(limitBytes, storage.limitFormatted ?? storage.limit_formatted))}</strong>
                    </div>
                </div>

                ${topTables.length ? `
                    <div class="database-storage-tables">
                        <div class="database-storage-subheading">容量を多く使用しているデータ</div>
                        <div class="database-storage-table-list">
                            ${topTables.slice(0, 5).map((table) => `
                                <div class="database-storage-table-row">
                                    <span>${escapeHtml(databaseTableLabel(table.name ?? table.table ?? table.table_name ?? ""))}</span>
                                    <strong>${escapeHtml(formatDiagnosticBytes(
                                        diagnosticNumber(table.totalBytes ?? table.total_bytes ?? table.bytes ?? table.size_bytes),
                                        table.totalSize ?? table.total_size ?? table.size
                                    ))}</strong>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                ` : ""}

                ${issues.length ? `
                    <div class="database-storage-issues">
                        ${issues.map((issue) => `<small>${escapeHtml(issue)}</small>`).join("")}
                    </div>
                ` : ""}
            </article>
        </section>
    `;
}

function diagnosticNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
    if (typeof value !== "string") return NaN;
    const normalized = value.replace(/,/g, "").trim();
    const direct = Number(normalized);
    if (Number.isFinite(direct)) return direct;
    const match = normalized.match(/^([0-9.]+)\s*(B|KB|kB|MB|GB|TB)$/i);
    if (!match) return NaN;
    const unit = match[2].toUpperCase();
    const scale = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 }[unit] || 1;
    return Number(match[1]) * scale;
}

function formatDiagnosticBytes(bytes, fallback = "") {
    if (!Number.isFinite(bytes)) return String(fallback || "確認不能");
    if (bytes < 1024) return `${Math.round(bytes)} B`;
    const units = ["kB", "MB", "GB", "TB"];
    let value = bytes / 1024;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
        value /= 1024;
        index += 1;
    }
    const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return `${Number(value.toFixed(digits))} ${units[index]}`;
}

function formatDiagnosticPercent(value) {
    if (!Number.isFinite(value)) return "確認不能";
    return `${Number(value.toFixed(2))}%`;
}

function databaseTableLabel(name) {
    const labels = {
        operation_history: "操作履歴",
        inventory_history: "在庫履歴",
        orders: "注文",
        login_presence: "ログイン端末",
        expenses: "支出",
        order_items: "注文明細",
        inventory: "在庫",
        products: "商品",
        event_days: "開催日",
        profiles: "アカウント",
        system_settings: "システム設定",
        system_access_control: "アクセス制御"
    };
    const key = String(name || "").trim();
    return labels[key] || key || "不明";
}

function exportDiagnostics() {
    const data = window.latestSystemDiagnostics;
    if (!data) return;
    const file = new File([JSON.stringify(data, null, 2)], `法マス喫茶_診断_${Date.now()}.json`, { type: "application/json" });
    void saveFile(file, false);
}

async function saveFile(file, preferShare = true) {
    if (preferShare && navigator.canShare?.({ files: [file] }) && /iPad|iPhone|iPod|Macintosh/i.test(navigator.userAgent)) {
        await navigator.share({ files: [file], title: file.name });
        return;
    }
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function deriveKey(password, salt, usages) {
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
        material,
        { name: "AES-GCM", length: 256 },
        false,
        usages
    );
}

async function sha256Hex(bytes) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function toBase64(bytes) {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return btoa(binary);
}

function fromBase64(value) {
    const binary = atob(String(value || ""));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function showToast(message, tone = "success") {
    const toast = document.getElementById("toast");
    if (!toast) return window.alert(message);
    toast.textContent = message;
    toast.hidden = false;
    toast.className = `toast is-visible is-${tone}`;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
        toast.classList.remove("is-visible");
        toast.hidden = true;
    }, 4000);
}

function showError(message, error) {
    console.error(message, error);
    showToast(error?.message ? `${message} ${error.message}` : message, "error");
}

function requestReasonModal(description) {
    return requestTextModal("復元理由", description, "order-restore-reason");
}

function requestTextModal(title, description, operation) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "custom-confirm-overlay";
        overlay.dataset.operation = operation;
        overlay.innerHTML = `
            <div class="custom-confirm-modal is-warning" role="dialog" aria-modal="true" aria-labelledby="systemTextModalTitle">
                <div class="custom-confirm-heading">
                    <span class="custom-confirm-mark" aria-hidden="true"></span>
                    <h2 id="systemTextModalTitle" class="custom-confirm-title">${escapeHtml(title)}</h2>
                </div>
                <p class="custom-confirm-message">${escapeHtml(description)}</p>
                <label class="system-admin-field">
                    <span>理由</span>
                    <input type="text" class="custom-restore-reason-input" maxlength="200" autocomplete="off">
                </label>
                <p class="custom-confirm-error" role="alert" hidden></p>
                <div class="custom-confirm-actions">
                    <button type="button" class="custom-confirm-button custom-confirm-cancel">キャンセル</button>
                    <button type="button" class="custom-confirm-button custom-confirm-ok">確認へ進む</button>
                </div>
            </div>
        `;
        const input = overlay.querySelector("input");
        const error = overlay.querySelector(".custom-confirm-error");
        const cancel = overlay.querySelector(".custom-confirm-cancel");
        const submit = overlay.querySelector(".custom-confirm-ok");
        const finish = (value) => {
            overlay.remove();
            document.body.classList.remove("is-custom-confirm-open");
            resolve(value);
        };
        cancel.addEventListener("click", () => finish(null));
        submit.addEventListener("click", () => {
            const value = input.value.trim();
            if (!value) {
                error.textContent = "復元理由を入力してください。";
                error.hidden = false;
                input.focus();
                return;
            }
            finish(value);
        });
        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") submit.click();
            if (event.key === "Escape") finish(null);
        });
        document.body.appendChild(overlay);
        document.body.classList.add("is-custom-confirm-open");
        input.focus();
    });
}

function requestPasswordModal(accountName) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "custom-confirm-overlay";
        overlay.dataset.operation = "account-password-change";
        overlay.innerHTML = `
            <div class="custom-confirm-modal is-warning system-password-modal" role="dialog" aria-modal="true" aria-labelledby="systemPasswordModalTitle">
                <div class="custom-confirm-heading">
                    <span class="custom-confirm-mark" aria-hidden="true"></span>
                    <h2 id="systemPasswordModalTitle" class="custom-confirm-title">パスワード変更</h2>
                </div>
                <p class="custom-confirm-message">${escapeHtml(accountName)}の新しいパスワードを入力してください。</p>
                <label class="system-admin-field"><span>新しいパスワード</span><input type="password" data-new-password minlength="8" autocomplete="new-password"></label>
                <label class="system-admin-field"><span>新しいパスワード（確認）</span><input type="password" data-confirm-password minlength="8" autocomplete="new-password"></label>
                <p class="custom-confirm-error" role="alert" hidden></p>
                <div class="custom-confirm-actions">
                    <button type="button" class="custom-confirm-button custom-confirm-cancel">キャンセル</button>
                    <button type="button" class="custom-confirm-button custom-confirm-ok">確認へ進む</button>
                </div>
            </div>
        `;
        const password = overlay.querySelector("[data-new-password]");
        const confirmation = overlay.querySelector("[data-confirm-password]");
        const error = overlay.querySelector(".custom-confirm-error");
        const cancel = overlay.querySelector(".custom-confirm-cancel");
        const submit = overlay.querySelector(".custom-confirm-ok");
        const finish = (value) => {
            overlay.remove();
            document.body.classList.remove("is-custom-confirm-open");
            resolve(value);
        };
        const validate = () => {
            if (password.value.length < 8) return "パスワードは8文字以上で入力してください。";
            if (password.value !== confirmation.value) return "確認用パスワードが一致しません。";
            return "";
        };
        cancel.addEventListener("click", () => finish(null));
        submit.addEventListener("click", () => {
            const message = validate();
            if (message) {
                error.textContent = message;
                error.hidden = false;
                return;
            }
            finish(password.value);
        });
        overlay.addEventListener("keydown", (event) => {
            if (event.key === "Escape") finish(null);
            if (event.key === "Enter") submit.click();
        });
        document.body.appendChild(overlay);
        document.body.classList.add("is-custom-confirm-open");
        password.focus();
    });
}

function loadingText() { return '<div class="loading-message">読み込んでいます</div>'; }
function renderEmpty(element, message) { element.innerHTML = `<div class="system-empty">${escapeHtml(message)}</div>`; }
function renderError(element, message) { element.innerHTML = `<div class="system-error-text">${escapeHtml(message)}</div>`; }
function readChecked(id) { return Boolean(document.getElementById(id)?.checked); }
function setChecked(id, value) { const element = document.getElementById(id); if (element) element.checked = value !== false; }
function valueOf(id) { return document.getElementById(id)?.value?.trim() || ""; }
function setValue(id, value) { const element = document.getElementById(id); if (element) element.value = value; }
function toLocalInput(value) { if (!value) return ""; const date = new Date(value); const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16); }
function formatDateTime(value) { if (!value) return "-"; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date); }
function formatCurrency(value) { return `¥${Number(value || 0).toLocaleString("ja-JP")}`; }
function roleLabel(role) { return ({ super_admin: "最高管理者", admin: "管理者", staff: "スタッフ", viewer: "閲覧者" })[role] || "不明"; }
function roleBadge(role) {
    const safeRole = ["super_admin", "admin", "staff", "viewer"].includes(role) ? role : "unknown";
    return `<span class="system-role-badge is-${safeRole.replace("_", "-")}">${escapeHtml(roleLabel(role))}</span>`;
}
function statusLabel(status) { return ({ ok: "正常", warning: "注意", error: "異常", unknown: "確認不能" })[status] || "確認不能"; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }
