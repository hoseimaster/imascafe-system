import { supabase } from "./supabase.js";
import { isAdmin, isViewer, getOperatorName, getTerminalId } from "./auth.js";
import { showConfirmModal } from "./confirm-modal.js";

let initialized = false;
let activeSeats = [];
let settings = { stay_minutes: 30, warning_before: 15, danger_before: 5 };
let minuteTimer = null;
let channel = null;

export function initializeStayTime() {
    if (initialized) return;
    initialized = true;

    document.addEventListener("app:screenchange", async (event) => {
        if (event.detail?.screen === "stayTimeScreen") {
            await refreshStayTime();
        }
    });
    document.addEventListener("click", handleClick);
    document.getElementById("stayTimeHistoryDate")?.addEventListener("change", refreshHistory);
    window.addEventListener("resize", renderDeviceState);

    const today = getTodayJST();
    const dateInput = document.getElementById("stayTimeHistoryDate");
    if (dateInput) dateInput.value = today;

    startMinuteTimer();
    subscribeRealtime();
    refreshAlertBadge();
}

export async function refreshStayTime() {
    renderDeviceState();
    if (isMobile()) return;
    await Promise.all([loadSettings(), loadActiveSeats(), isAdmin() ? refreshHistory() : Promise.resolve()]);
    renderAll();
}

async function handleClick(event) {
    const target = event.target.closest("[data-stay-seat], #stayTimeSettingsButton, #stayTimeResetButton, #stayTimeHistoryToday");
    if (!target) return;

    if (target.id === "stayTimeHistoryToday") {
        const input = document.getElementById("stayTimeHistoryDate");
        if (input) input.value = getTodayJST();
        await refreshHistory();
        return;
    }
    if (target.id === "stayTimeSettingsButton") return openSettingsModal();
    if (target.id === "stayTimeResetButton") return resetAllSeats();
    if (isViewer()) return;

    const tableNumber = Number(target.dataset.tableNumber);
    const seatPart = target.dataset.seatPart;
    const active = findActiveSeat(tableNumber, seatPart);
    if (active) return openActiveSeatModal(active);
    return openStartModal(tableNumber, seatPart);
}

function renderDeviceState() {
    const unsupported = document.getElementById("stayTimeUnsupported");
    const content = document.getElementById("stayTimeDesktopContent");
    if (!unsupported || !content) return;
    unsupported.hidden = true;
    content.hidden = false;
}

function isMobile() {
    return false;
}

async function loadSettings() {
    const { data, error } = await supabase.from("stay_time_settings").select("stay_minutes,warning_before,danger_before").eq("id", 1).maybeSingle();
    if (error) throw error;
    if (data) settings = data;
}

async function loadActiveSeats() {
    const { data, error } = await supabase.from("table_seats").select("id,table_number,seat_part,customer_count,started_at").order("table_number");
    if (error) throw error;
    activeSeats = data || [];
}

function renderAll() {
    renderSummary();
    renderFloor();
    renderAdminActions();
    refreshAlertBadge();
}

function renderSummary() {
    const el = document.getElementById("stayTimeSummary");
    if (!el) return;
    const people = activeSeats.reduce((sum, row) => sum + Number(row.customer_count || 0), 0);
    const danger = activeSeats.filter((row) => getState(row) === "danger" || getState(row) === "over").length;
    el.innerHTML = `
        <div><span>利用中</span><strong>${activeSeats.length}組</strong></div>
        <div><span>利用人数</span><strong>${people}名</strong></div>
        <div><span>終了間近・超過</span><strong>${danger}席</strong></div>
        <div><span>滞在時間</span><strong>${settings.stay_minutes}分制</strong></div>
    `;
}

function renderFloor() {
    const floor = document.getElementById("stayTimeFloor");
    if (!floor) return;
    floor.innerHTML = [1,2,3,4].map(renderTable).join("");
}

function renderTable(tableNumber) {
    const full = activeSeats.find((r) => r.table_number === tableNumber && r.seat_part === "full");
    if (full) {
        return `<article class="stay-table"><h2>テーブル${tableNumber}</h2>${renderSeat(full, tableNumber, "full", "全面")}</article>`;
    }
    const a = activeSeats.find((r) => r.table_number === tableNumber && r.seat_part === "a");
    const b = activeSeats.find((r) => r.table_number === tableNumber && r.seat_part === "b");
    const largeHalf = [a, b].find((row) => Number(row?.customer_count || 0) >= 3);
    if (largeHalf && (!a || !b)) {
        return `<article class="stay-table"><h2>テーブル${tableNumber}</h2>${renderSeat(largeHalf, tableNumber, largeHalf.seat_part, "全面")}</article>`;
    }
    return `<article class="stay-table"><h2>テーブル${tableNumber}</h2><div class="stay-table-halves">${renderSeat(a, tableNumber, "a", "A")}${renderSeat(b, tableNumber, "b", "B")}</div></article>`;
}

function renderSeat(row, tableNumber, seatPart, label) {
    const disabled = isViewer() ? " disabled aria-disabled=\"true\"" : "";
    if (!row) return `<button type="button" class="stay-seat is-empty"${disabled} data-stay-seat data-table-number="${tableNumber}" data-seat-part="${seatPart}"><strong>${label}</strong><span>空席</span></button>`;
    const elapsed = elapsedMinutes(row.started_at);
    const state = getState(row);
    const over = elapsed >= settings.stay_minutes ? `<small>時間超過 +${elapsed - settings.stay_minutes}分</small>` : `<small>残り ${Math.max(0, settings.stay_minutes - elapsed)}分</small>`;
    return `<button type="button" class="stay-seat is-${state}"${disabled} data-stay-seat data-table-number="${tableNumber}" data-seat-part="${seatPart}"><strong>${label}</strong><span>${row.customer_count}名</span><b>滞在 ${elapsed}分</b>${over}</button>`;
}

function getState(row) {
    const elapsed = elapsedMinutes(row.started_at);
    const remaining = settings.stay_minutes - elapsed;
    if (remaining <= 0) return "over";
    if (remaining <= settings.danger_before) return "danger";
    if (remaining <= settings.warning_before) return "warning";
    return "normal";
}

function elapsedMinutes(startedAt) {
    return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
}

function findActiveSeat(tableNumber, seatPart) {
    return activeSeats.find((row) => row.table_number === tableNumber && row.seat_part === seatPart) || null;
}

async function openStartModal(tableNumber, seatPart) {
    const fullExists = activeSeats.some((r) => r.table_number === tableNumber && r.seat_part === "full");
    if (fullExists) return;
    const otherHalf = activeSeats.find((r) => r.table_number === tableNumber && ["a","b"].includes(r.seat_part));
    const canFull = !otherHalf;
    const defaultPart = seatPart === "full" ? "full" : seatPart;

    const result = await showFormModal({
        title: `テーブル${tableNumber}の滞在を開始`,
        body: `
            <div class="form-group"><label>利用方法</label><select id="stayStartPart">
                ${canFull ? `<option value="full" ${defaultPart === "full" ? "selected" : ""}>テーブル全体</option>` : ""}
                <option value="a" ${defaultPart === "a" ? "selected" : ""} ${activeSeats.some(r => r.table_number === tableNumber && r.seat_part === "a") ? "disabled" : ""}>半面 A</option>
                <option value="b" ${defaultPart === "b" ? "selected" : ""} ${activeSeats.some(r => r.table_number === tableNumber && r.seat_part === "b") ? "disabled" : ""}>半面 B</option>
            </select></div>
            <div class="form-group"><label>利用人数</label><div class="stay-count-control"><button type="button" data-stay-count-minus aria-label="人数を1人減らす">−</button><input id="stayStartCount" type="number" min="1" step="1" value="1" readonly><button type="button" data-stay-count-plus aria-label="人数を1人増やす">＋</button></div></div>
        `,
        confirmText: "滞在を開始"
    });
    if (!result) return;
    const part = result.querySelector("#stayStartPart")?.value;
    const count = Number(result.querySelector("#stayStartCount")?.value);
    if (!part || !Number.isInteger(count) || count < 1) return;

    let response = await supabase.rpc("start_table_stay", {
        p_table_number: tableNumber,
        p_seat_part: part,
        p_customer_count: count,
        p_ignore_capacity: false
    });

    if (response.error && isCapacityError(response.error)) {
        const ignore = await showConfirmModal(
            response.error.message || "この人数では通常の定員を超えます。",
            {
                title: "定員を超えて登録しますか？",
                confirmText: "定員を無視して登録",
                tone: "warning",
                operation: "stay-ignore-capacity"
            }
        );
        if (!ignore) return;
        response = await supabase.rpc("start_table_stay", {
            p_table_number: tableNumber,
            p_seat_part: part,
            p_customer_count: count,
            p_ignore_capacity: true
        });
    }

    if (response.error) return showError(response.error);
    await refreshStayTime();
}

function isCapacityError(error) {
    const message = String(error?.message || "");
    return message.includes("定員") || message.includes("3名以上") || message.includes("合計4名");
}

async function openActiveSeatModal(row) {
    if (isViewer()) return;

    const elapsed = elapsedMinutes(row.started_at);
    let cancelled = false;

    const confirmed = await showFormModal({
        title: `テーブル${row.table_number} ${partLabel(row.seat_part)}`,
        body: `
            <div class="stay-active-detail"><p><span>利用人数</span><strong>${row.customer_count}名</strong></p><p><span>開始時刻</span><strong>${formatTime(row.started_at)}</strong></p><p><span>滞在時間</span><strong>${elapsed}分</strong></p></div>
            <div class="form-group"><label>人数を変更</label><div class="stay-count-control"><button type="button" data-stay-count-minus aria-label="人数を1人減らす">−</button><input id="stayEditCount" type="number" min="1" step="1" value="${row.customer_count}" readonly><button type="button" data-stay-count-plus aria-label="人数を1人増やす">＋</button></div></div>
            <button type="button" class="secondary-button stay-expand-button" data-stay-save-count="true">人数を変更</button>
            ${row.seat_part !== "full" && !activeSeats.some(r => r.table_number === row.table_number && r.seat_part !== row.seat_part) ? '<button type="button" class="secondary-button stay-expand-button" data-stay-expand="true">全面利用へ変更</button>' : ""}
        `,
        confirmText: "退出",
        danger: true,
        onExtra: async (modal) => {
            const saveButton = modal.querySelector("[data-stay-save-count]");
            saveButton?.addEventListener("click", async () => {
                const count = Number(modal.querySelector("#stayEditCount")?.value);
                if (!Number.isInteger(count) || count < 1) return;
                const { error } = await supabase.rpc("update_table_stay", { p_id: row.id, p_customer_count: count, p_expand_full: false });
                if (error) return showError(error);
                closeFormModal(false);
                await refreshStayTime();
            });

            const expandButton = modal.querySelector("[data-stay-expand]");
            expandButton?.addEventListener("click", async () => {
                const count = Number(modal.querySelector("#stayEditCount")?.value);
                const { error } = await supabase.rpc("update_table_stay", { p_id: row.id, p_customer_count: count, p_expand_full: true });
                if (error) return showError(error);
                closeFormModal(false);
                await refreshStayTime();
            });

            const actions = modal.querySelector(".stay-form-actions");
            const exitButton = modal.querySelector("[data-stay-form-confirm]");
            const cancelUseButton = document.createElement("button");
            cancelUseButton.type = "button";
            cancelUseButton.className = "secondary-button stay-cancel-use-button";
            cancelUseButton.textContent = "取消";
            actions?.insertBefore(cancelUseButton, exitButton);

            cancelUseButton.addEventListener("click", async () => {
                const cancelConfirmed = await showConfirmModal(
                    "この座席利用を取り消します。利用記録には保存されません。",
                    { title: "利用を取消しますか？", confirmText: "取消する", tone: "danger", operation: "stay-cancel" }
                );
                if (!cancelConfirmed) return;
                const { error } = await supabase.rpc("cancel_table_stay", { p_id: row.id });
                if (error) return showError(error);
                cancelled = true;
                closeFormModal(false);
                await refreshStayTime();
            });
        },
        beforeConfirm: async (modal) => {
            const count = Number(modal.querySelector("#stayEditCount")?.value);
            if (Number.isInteger(count) && count > 0 && count !== row.customer_count) {
                const { error } = await supabase.rpc("update_table_stay", { p_id: row.id, p_customer_count: count, p_expand_full: false });
                if (error) throw error;
            }
            return true;
        }
    });

    if (cancelled || !confirmed) return;
    const { error } = await supabase.rpc("end_table_stay", { p_id: row.id });
    if (error) return showError(error);
    await refreshStayTime();
}

async function openSettingsModal() {
    if (!isAdmin()) return showConfirmModal("滞在時間の設定は管理者以上のみ変更できます。", { title: "変更できません", confirmText: "閉じる", cancelText: "閉じる", tone: "warning" });
    const result = await showFormModal({
        title: "滞在時間設定",
        body: `
            <div class="form-group"><label>滞在時間（分）</label><input id="stayMinutes" type="number" min="1" value="${settings.stay_minutes}"></div>
            <div class="form-group"><label>注意表示（終了何分前）</label><input id="stayWarning" type="number" min="1" value="${settings.warning_before}"></div>
            <div class="form-group"><label>終了間近表示（終了何分前）</label><input id="stayDanger" type="number" min="1" value="${settings.danger_before}"></div>
        `,
        confirmText: "設定を保存"
    });
    if (!result) return;
    const stay = Number(result.querySelector("#stayMinutes")?.value);
    const warning = Number(result.querySelector("#stayWarning")?.value);
    const danger = Number(result.querySelector("#stayDanger")?.value);
    if (!(stay > warning && warning > danger && danger > 0)) return showError(new Error("滞在時間 ＞ 注意表示 ＞ 終了間近表示 となるよう設定してください。"));
    const { error } = await supabase.rpc("update_stay_time_settings", { p_stay_minutes: stay, p_warning_before: warning, p_danger_before: danger });
    if (error) return showError(error);
    await refreshStayTime();
}

async function resetAllSeats() {
    if (!isAdmin()) return;
    if (!activeSeats.length) return;
    const ok = await showConfirmModal("現在利用中のすべての座席を退出扱いにし、利用記録へ保存します。", { title: "全席をリセットしますか？", confirmText: "全席リセット", tone: "danger", operation: "stay-reset" });
    if (!ok) return;
    const { error } = await supabase.rpc("reset_all_table_stays");
    if (error) return showError(error);
    await refreshStayTime();
}

async function refreshHistory() {
    if (isMobile() || !isAdmin()) return;
    const input = document.getElementById("stayTimeHistoryDate");
    const date = input?.value || getTodayJST();
    const start = `${date}T00:00:00+09:00`;
    const endDate = new Date(`${date}T00:00:00+09:00`); endDate.setDate(endDate.getDate() + 1);
    const end = endDate.toISOString();
    const { data, error } = await supabase.from("table_stay_history").select("id,table_number,seat_part,customer_count,started_at,ended_at,duration_minutes").gte("ended_at", start).lt("ended_at", end).order("ended_at", { ascending: false });
    if (error) return showError(error);
    renderHistory(data || []);
}

function renderHistory(rows) {
    const stats = document.getElementById("stayTimeStatistics");
    const list = document.getElementById("stayTimeHistoryList");
    if (!stats || !list) return;
    const groups = rows.length;
    const people = rows.reduce((s,r) => s + Number(r.customer_count || 0), 0);
    const avg = groups ? Math.round(rows.reduce((s,r) => s + Number(r.duration_minutes || 0), 0) / groups) : 0;
    const max = groups ? Math.max(...rows.map(r => Number(r.duration_minutes || 0))) : 0;
    stats.innerHTML = `<div><span>利用組数</span><strong>${groups}組</strong></div><div><span>利用人数</span><strong>${people}名</strong></div><div><span>平均滞在時間</span><strong>${avg}分</strong></div><div><span>最長滞在時間</span><strong>${max}分</strong></div>${[1,2,3,4].map(n => { const r=rows.filter(x=>x.table_number===n); const a=r.length?Math.round(r.reduce((s,x)=>s+Number(x.duration_minutes||0),0)/r.length):0; return `<div><span>テーブル${n}平均</span><strong>${a}分</strong></div>`; }).join("")}`;
    if (!rows.length) {
        list.innerHTML = '<div class="empty-state">この日の利用記録はありません</div>';
        return;
    }

    const visibleRows = historyExpanded ? rows : rows.slice(0, 3);
    list.innerHTML = visibleRows.map(r => `<article class="stay-history-item"><div class="stay-history-main"><strong>テーブル${r.table_number} ${partLabel(r.seat_part)}</strong><span>${r.customer_count}名</span></div><div class="stay-history-time"><span>${formatTime(r.started_at)}〜${formatTime(r.ended_at)}</span><small>利用時間</small></div><b>${r.duration_minutes}分</b></article>`).join("");

    if (rows.length > 3) {
        const more = document.createElement("div");
        more.className = "stay-history-more";
        more.innerHTML = `<button type="button" class="secondary-button">${historyExpanded ? "閉じる" : "さらに見る"}</button>`;
        more.querySelector("button").addEventListener("click", () => {
            historyExpanded = !historyExpanded;
            renderHistory(rows);
        });
        list.appendChild(more);
    }
}

async function refreshAlertBadge() {
    const badge = document.getElementById("stayTimeAlertBadge");
    if (!badge) return;
    try {
        await loadSettings();
        await loadActiveSeats();
        const count = activeSeats.filter(r => ["danger","over"].includes(getState(r))).length;
        badge.hidden = count === 0;
        badge.textContent = "!";
        badge.closest("button")?.classList.toggle("has-alert", count > 0);
    } catch (error) {
        console.error("座席警告取得エラー:", error);
    }
}

function subscribeRealtime() {
    if (channel) return;
    channel = supabase.channel("stay-time-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "table_seats" }, async () => { await loadActiveSeats(); renderAll(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "stay_time_settings" }, async () => { await loadSettings(); renderAll(); })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "table_stay_history" }, () => { if (isAdmin()) refreshHistory(); })
        .subscribe();
}

function startMinuteTimer() {
    if (minuteTimer) clearInterval(minuteTimer);
    minuteTimer = setInterval(() => { renderAll(); }, 15000);
}

function renderAdminActions() {
    const admin = isAdmin();
    const settingsButton = document.getElementById("stayTimeSettingsButton");
    const resetButton = document.getElementById("stayTimeResetButton");
    if (settingsButton) settingsButton.hidden = !admin;
    if (resetButton) resetButton.hidden = !admin;
    const recordSection = document.getElementById("stayTimeRecordSection");
    if (recordSection) recordSection.hidden = !admin;
}

let historyExpanded = false;
let formResolver = null;
function showFormModal({ title, body, confirmText, danger = false, onExtra, beforeConfirm }) {
    closeFormModal(false);
    return new Promise((resolve) => {
        formResolver = resolve;
        const overlay = document.createElement("div");
        overlay.className = "stay-form-overlay";
        overlay.innerHTML = `<div class="stay-form-modal"><h2>${escapeHtml(title)}</h2>${body}<div class="stay-form-actions"><button type="button" class="secondary-button" data-stay-form-cancel>キャンセル</button><button type="button" class="${danger ? "danger-button" : "primary-button"}" data-stay-form-confirm>${confirmText}</button></div></div>`;
        document.body.appendChild(overlay);
        const modal = overlay.querySelector(".stay-form-modal");
        modal.querySelectorAll(".stay-count-control").forEach((control) => {
            const input = control.querySelector('input[type="number"]');
            control.querySelector("[data-stay-count-minus]")?.addEventListener("click", () => {
                input.value = String(Math.max(Number(input.min || 1), Number(input.value || 1) - 1));
            });
            control.querySelector("[data-stay-count-plus]")?.addEventListener("click", () => {
                input.value = String(Number(input.value || 0) + 1);
            });
        });
        overlay.querySelector("[data-stay-form-cancel]").addEventListener("click", () => closeFormModal(false));
        overlay.addEventListener("click", (e) => { if (e.target === overlay) closeFormModal(false); });
        overlay.querySelector("[data-stay-form-confirm]").addEventListener("click", async () => {
            try { if (beforeConfirm && !(await beforeConfirm(modal))) return; closeFormModal(modal); } catch (e) { showError(e); }
        });
        onExtra?.(modal);
    });
}
function closeFormModal(value) {
    document.querySelector(".stay-form-overlay")?.remove();
    if (formResolver) { const r = formResolver; formResolver = null; r(value); }
}

function showError(error) {
    console.error("座席・滞在時間管理エラー:", error);
    return showConfirmModal(error?.message || "処理に失敗しました。", { title: "処理できませんでした", confirmText: "閉じる", cancelText: "閉じる", tone: "warning" });
}
function partLabel(part) { return part === "full" ? "全面" : part.toUpperCase(); }
function formatTime(value) { return new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tokyo" }).format(new Date(value)); }
function getTodayJST() { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date()); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
