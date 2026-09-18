import { supabase } from "./supabase.js";

import {
    APP_CONFIG
} from "./config.js";

import {
    isAdmin,
    getOperatorName,
    getTerminalId
} from "./auth.js";


let initialized = false;
let eventDaysLoading = false;
let eventDays = [];


/* ========================================
   初期化
======================================== */

export function initializeEventDays() {

    if (initialized) {
        return;
    }

    initialized = true;

    setupEventDayEvents();

    loadEventDays();
}


/* ========================================
   開催日取得
======================================== */

export async function loadEventDays() {

    if (eventDaysLoading) {
        return;
    }

    eventDaysLoading = true;

    try {

        const {
            data,
            error
        } = await supabase
            .from("event_days")
            .select(`
                id,
                event_date,
                display_order,
                label,
                active,
                created_at,
                updated_at
            `)
            .order(
                "display_order",
                {
                    ascending: true
                }
            )
            .order(
                "event_date",
                {
                    ascending: true
                }
            );


        if (error) {

            console.error(
                "開催日取得エラー:",
                error
            );

            showToast(
                "開催日情報を取得できませんでした。"
            );

            return;
        }


        eventDays =
            Array.isArray(data)
                ? data
                : [];


        synchronizeCurrentEventDay();

        renderEventDays();

    } finally {

        eventDaysLoading = false;

    }
}


/* ========================================
   現在の営業日同期
======================================== */

function synchronizeCurrentEventDay() {

    const storageKey =
        APP_CONFIG.CURRENT_EVENT_DAY_STORAGE_KEY;


    const storedId =
        String(
            localStorage.getItem(
                storageKey
            ) ||
            ""
        ).trim();


    const storedDay =
        eventDays.find(
            (day) =>
                String(day.id) ===
                    storedId &&
                Boolean(day.active)
        );


    if (storedDay) {
        return;
    }


    const today =
        getTodayJST();


    const todayDay =
        eventDays.find(
            (day) =>
                String(
                    day.event_date
                ) ===
                    today &&
                Boolean(day.active)
        );


    if (todayDay) {

        setCurrentEventDay(
            todayDay,
            false
        );

        return;
    }


    const firstActiveDay =
        eventDays.find(
            (day) =>
                Boolean(day.active)
        );


    if (firstActiveDay) {

        setCurrentEventDay(
            firstActiveDay,
            false
        );

        return;
    }


    localStorage.removeItem(
        storageKey
    );
}


/* ========================================
   現在の営業日取得
======================================== */

export function getCurrentEventDay() {

    const storageKey =
        APP_CONFIG.CURRENT_EVENT_DAY_STORAGE_KEY;


    const storedId =
        String(
            localStorage.getItem(
                storageKey
            ) ||
            ""
        ).trim();


    if (!storedId) {
        return null;
    }


    const day =
        eventDays.find(
            (item) =>
                String(item.id) ===
                storedId &&
                Boolean(item.active)
        );


    return day || null;
}


/* ========================================
   現在の営業日ID
======================================== */

export function getCurrentEventDayId() {

    const day =
        getCurrentEventDay();


    return day
        ? day.id
        : null;
}


/* ========================================
   現在の営業日変更
======================================== */

export function setCurrentEventDayById(
    eventDayId
) {

    const day =
        eventDays.find(
            (item) =>
                String(item.id) ===
                String(eventDayId) &&
                Boolean(item.active)
        );


    if (!day) {

        showToast(
            "指定された営業日を選択できません。"
        );

        return false;
    }


    setCurrentEventDay(
        day,
        true
    );


    renderEventDays();


    return true;
}


/* ========================================
   現在の営業日保存
======================================== */

function setCurrentEventDay(
    day,
    dispatchEvent
) {

    if (!day) {
        return;
    }


    const storageKey =
        APP_CONFIG.CURRENT_EVENT_DAY_STORAGE_KEY;


    localStorage.setItem(
        storageKey,
        String(day.id)
    );


    if (!dispatchEvent) {
        return;
    }


    document.dispatchEvent(
        new CustomEvent(
            "app:eventdaychange",
            {
                detail: {
                    eventDay: day,
                    eventDayId: day.id,
                    eventDate: day.event_date,
                    label: day.label || ""
                }
            }
        )
    );
}


/* ========================================
   有効な営業日一覧
======================================== */

export function getActiveEventDays() {

    return eventDays.filter(
        (day) =>
            Boolean(day.active)
    );
}


/* ========================================
   表示
======================================== */

function renderEventDays() {

    const container =
        document.getElementById(
            "eventDaySettingsList"
        );


    if (!container) {
        return;
    }


    if (!isAdmin()) {

        container.innerHTML = `
            <div class="empty-state">
                開催日の管理権限がありません。
            </div>
        `;

        return;
    }


    container.innerHTML =
        renderEventDayRows();
}


/* ========================================
   開催日一覧
======================================== */

function renderEventDayRows() {

    if (!eventDays.length) {

        return `
            <div class="empty-state">
                開催日が登録されていません
            </div>
        `;
    }


    const currentEventDayId =
        getCurrentEventDayId();


    return eventDays
        .map(
            (day) => {

                const active =
                    Boolean(
                        day.active
                    );


                const current =
                    String(day.id) ===
                    String(currentEventDayId);


                return `
                    <div
                        class="event-day-management-item ${
                            current
                                ? "is-current"
                                : ""
                        } ${
                            active
                                ? "is-active"
                                : "is-stopped"
                        }"
                        data-event-day-id="${escapeHtml(
                            day.id
                        )}"
                    >

                        <div
                            class="event-day-management-main"
                        >

                            <div
                                class="event-day-management-date"
                            >
                                ${formatDate(
                                    day.event_date
                                )}
                            </div>


                            <div
                                class="event-day-management-label"
                            >
                                ${
                                    day.label
                                        ? escapeHtml(
                                            day.label
                                        )
                                        : "名称未設定"
                                }
                            </div>


                            <div
                                class="event-day-management-meta"
                            >
                                表示順：
                                ${formatNumber(
                                    day.display_order
                                )}
                            </div>


                            <div
                                class="event-day-management-status ${
                                    active
                                        ? "is-active"
                                        : "is-stopped"
                                }"
                            >
                                ${
                                    active
                                        ? "有効"
                                        : "無効"
                                }
                            </div>


                            ${
                                current
                                    ? `
                                        <div
                                            class="event-day-management-current"
                                        >
                                            現在の営業日
                                        </div>
                                    `
                                    : ""
                            }

                        </div>


                        <div
                            class="event-day-management-actions"
                        >

                            ${
                                active && !current
                                    ? `
                                        <button
                                            type="button"
                                            class="button button-secondary"
                                            data-event-day-select="${escapeHtml(
                                                day.id
                                            )}"
                                        >
                                            この営業日を選択
                                        </button>
                                    `
                                    : ""
                            }


                            <button
                                type="button"
                                class="button button-secondary"
                                data-event-day-edit="${escapeHtml(
                                    day.id
                                )}"
                            >
                                編集
                            </button>


                            <button
                                type="button"
                                class="button ${
                                    active
                                        ? "button-danger"
                                        : "button-secondary"
                                }"
                                data-event-day-toggle="${escapeHtml(
                                    day.id
                                )}"
                            >
                                ${
                                    active
                                        ? "無効化"
                                        : "有効化"
                                }
                            </button>

                        </div>

                    </div>
                `;
            }
        )
        .join("");
}


/* ========================================
   イベント
======================================== */

function setupEventDayEvents() {

    document.addEventListener(
        "click",
        handleEventDayClick
    );


    const form =
        document.getElementById(
            "eventDayForm"
        );


    if (form) {

        form.addEventListener(
            "submit",
            handleEventDaySubmit
        );

    }
}


/* ========================================
   クリック
======================================== */

function handleEventDayClick(
    event
) {

    const target =
        event.target instanceof Element
            ? event.target
            : null;


    if (!target) {
        return;
    }


    const addButton =
        target.closest(
            "#addEventDayButton"
        );


    if (addButton) {

        event.preventDefault();
        event.stopPropagation();

        openEventDayCreate();

        return;
    }


    const selectButton =
        target.closest(
            "[data-event-day-select]"
        );


    if (selectButton) {

        event.preventDefault();
        event.stopPropagation();


        const eventDayId =
            selectButton.dataset
                .eventDaySelect;


        if (eventDayId) {

            const changed =
                setCurrentEventDayById(
                    eventDayId
                );


            if (changed) {

                showToast(
                    "営業日を変更しました。"
                );

            }

        }

        return;
    }


    const editButton =
        target.closest(
            "[data-event-day-edit]"
        );


    if (editButton) {

        event.preventDefault();
        event.stopPropagation();

        openEventDayEdit(
            editButton.dataset.eventDayEdit
        );

        return;
    }


    const toggleButton =
        target.closest(
            "[data-event-day-toggle]"
        );


    if (toggleButton) {

        event.preventDefault();
        event.stopPropagation();

        openEventDayToggleConfirm(
            toggleButton.dataset.eventDayToggle
        );

        return;
    }


    const cancelButton =
        target.closest(
            "#eventDayModalCancelButton, #eventDayModalCancel"
        );


    if (cancelButton) {

        event.preventDefault();

        closeEventDayModal();

        return;
    }


    const closeButton =
        target.closest(
            "#eventDayModalCloseButton"
        );


    if (closeButton) {

        event.preventDefault();

        closeEventDayModal();

        return;
    }


    const overlay =
        target.closest(
            "#eventDayModalOverlay"
        );


    if (
        overlay &&
        target === overlay
    ) {

        closeEventDayModal();

    }
}


/* ========================================
   追加
======================================== */

function openEventDayCreate() {

    if (!isAdmin()) {

        showToast(
            "管理者のみ日付を追加できます。"
        );

        return;
    }


    const modal =
        document.getElementById(
            "eventDayModalOverlay"
        );


    const title =
        document.getElementById(
            "eventDayModalTitle"
        );


    const form =
        document.getElementById(
            "eventDayForm"
        );


    const idInput =
        document.getElementById(
            "eventDayId"
        );


    const dateInput =
        document.getElementById(
            "eventDayDate"
        );


    const nameInput =
        document.getElementById(
            "eventDayName"
        );


    if (
        !modal ||
        !title ||
        !form ||
        !dateInput ||
        !nameInput
    ) {

        console.error(
            "日付追加モーダルの要素が見つかりません。"
        );

        return;
    }


    title.textContent =
        "日付を追加";


    form.reset();


    if (idInput) {
        idInput.value = "";
    }


    dateInput.value =
        getTodayJST();


    nameInput.value =
        "";


    const displayOrder =
        getNextDisplayOrder();


    form.dataset.displayOrder =
        String(displayOrder);


    modal.hidden = false;

    modal.classList.add(
        "is-visible"
    );


    document.body.classList.add(
        "modal-open"
    );


    setTimeout(
        () => {

            dateInput.focus();

        },
        50
    );
}


/* ========================================
   編集
======================================== */

function openEventDayEdit(
    eventDayId
) {

    if (!isAdmin()) {
        return;
    }


    const day =
        eventDays.find(
            (item) =>
                String(item.id) ===
                String(eventDayId)
        );


    if (!day) {

        showToast(
            "指定された日付が見つかりません。"
        );

        return;
    }


    const modal =
        document.getElementById(
            "eventDayModalOverlay"
        );


    const title =
        document.getElementById(
            "eventDayModalTitle"
        );


    const idInput =
        document.getElementById(
            "eventDayId"
        );


    const dateInput =
        document.getElementById(
            "eventDayDate"
        );


    const nameInput =
        document.getElementById(
            "eventDayName"
        );


    const form =
        document.getElementById(
            "eventDayForm"
        );


    if (
        !modal ||
        !title ||
        !dateInput ||
        !nameInput
    ) {
        return;
    }


    title.textContent =
        "日付を編集";


    if (idInput) {

        idInput.value =
            day.id;

    }


    dateInput.value =
        day.event_date || "";


    nameInput.value =
        day.label || "";


    if (form) {

        form.dataset.displayOrder =
            String(
                Number(
                    day.display_order
                ) || 1
            );

    }


    modal.hidden = false;

    modal.classList.add(
        "is-visible"
    );


    document.body.classList.add(
        "modal-open"
    );


    setTimeout(
        () => {

            dateInput.focus();

        },
        50
    );
}


/* ========================================
   保存
======================================== */

async function handleEventDaySubmit(
    event
) {

    event.preventDefault();


    if (!isAdmin()) {

        showToast(
            "管理者のみ日付を変更できます。"
        );

        return;
    }


    const form =
        document.getElementById(
            "eventDayForm"
        );


    const idInput =
        document.getElementById(
            "eventDayId"
        );


    const dateInput =
        document.getElementById(
            "eventDayDate"
        );


    const nameInput =
        document.getElementById(
            "eventDayName"
        );


    if (
        !dateInput ||
        !nameInput
    ) {
        return;
    }


    const eventDayId =
        idInput?.value || "";


    const date =
        dateInput.value.trim();


    const label =
        nameInput.value.trim();


    const displayOrder =
        Number(
            form?.dataset.displayOrder
        ) ||
        getNextDisplayOrder();


    if (!isValidDateString(date)) {

        showToast(
            "日付を正しく入力してください。"
        );

        dateInput.focus();

        return;
    }


    if (!label) {

        showToast(
            "開催日の名称を入力してください。"
        );

        nameInput.focus();

        return;
    }


    const duplicateDate =
        eventDays.find(
            (day) =>
                String(day.event_date) ===
                    String(date) &&
                String(day.id) !==
                    String(eventDayId)
        );


    if (duplicateDate) {

        showToast(
            "同じ開催日がすでに登録されています。"
        );

        dateInput.focus();

        return;
    }


    const duplicateDisplayOrder =
        eventDays.find(
            (day) =>
                Number(day.display_order) ===
                    Number(displayOrder) &&
                String(day.id) !==
                    String(eventDayId)
        );


    if (duplicateDisplayOrder) {

        showToast(
            "同じ表示順がすでに登録されています。"
        );

        return;
    }


    const submitButton =
        document.getElementById(
            "eventDaySaveButton"
        );


    if (submitButton) {

        submitButton.disabled =
            true;

    }


    try {

        if (eventDayId) {

            await updateEventDay(
                eventDayId,
                date,
                label,
                displayOrder
            );

        } else {

            await createEventDay(
                date,
                label,
                displayOrder
            );

        }

    } finally {

        if (submitButton) {

            submitButton.disabled =
                false;

        }

    }
}


/* ========================================
   登録
======================================== */

async function createEventDay(
    date,
    label,
    displayOrder
) {

    const {
        data,
        error
    } = await supabase.rpc(
        "create_event_day",
        {
            p_event_date:
                date,

            p_display_order:
                displayOrder,

            p_label:
                label,

            p_operator_name:
                getOperatorName(),

            p_terminal:
                getTerminalId()
        }
    );


    if (error) {

        console.error(
            "開催日登録エラー:",
            error
        );

        showToast(
            getErrorMessage(error)
        );

        return;
    }


    console.log(
        "開催日登録:",
        data
    );


    closeEventDayModal();


    showToast(
        "開催日を登録しました。"
    );


    await loadEventDays();
}


/* ========================================
   編集
======================================== */

async function updateEventDay(
    eventDayId,
    date,
    label,
    displayOrder
) {

    const {
        data,
        error
    } = await supabase.rpc(
        "update_event_day",
        {
            p_event_day_id:
                eventDayId,

            p_event_date:
                date,

            p_display_order:
                displayOrder,

            p_label:
                label,

            p_operator_name:
                getOperatorName(),

            p_terminal:
                getTerminalId()
        }
    );


    if (error) {

        console.error(
            "開催日変更エラー:",
            error
        );

        showToast(
            getErrorMessage(error)
        );

        return;
    }


    console.log(
        "開催日変更:",
        data
    );


    closeEventDayModal();


    showToast(
        "開催日を変更しました。"
    );


    await loadEventDays();
}


/* ========================================
   有効・無効確認
======================================== */

function openEventDayToggleConfirm(
    eventDayId
) {

    if (!isAdmin()) {
        return;
    }


    const day =
        eventDays.find(
            (item) =>
                String(item.id) ===
                String(eventDayId)
        );


    if (!day) {
        return;
    }


    const nextActive =
        !Boolean(
            day.active
        );


    if (
        !nextActive &&
        String(
            getCurrentEventDayId()
        ) ===
            String(day.id)
    ) {

        const otherActiveDay =
            eventDays.find(
                (item) =>
                    String(item.id) !==
                        String(day.id) &&
                    Boolean(item.active)
            );


        if (!otherActiveDay) {

            showToast(
                "現在の営業日は、別の営業日を選択してから無効化してください。"
            );

            return;
        }

    }


    const action =
        nextActive
            ? "有効化"
            : "無効化";


    const confirmed =
        window.confirm(
            `${formatDate(day.event_date)} を${action}しますか？`
        );


    if (!confirmed) {
        return;
    }


    toggleEventDay(
        day.id,
        nextActive
    );
}


/* ========================================
   有効・無効
======================================== */

async function toggleEventDay(
    eventDayId,
    nextActive
) {

    const {
        data,
        error
    } = await supabase.rpc(
        "set_event_day_active",
        {
            p_event_day_id:
                eventDayId,

            p_active:
                nextActive,

            p_operator_name:
                getOperatorName(),

            p_terminal:
                getTerminalId()
        }
    );


    if (error) {

        console.error(
            "開催日状態変更エラー:",
            error
        );

        showToast(
            getErrorMessage(error)
        );

        return;
    }


    console.log(
        "開催日状態変更:",
        data
    );


    if (
        !nextActive &&
        String(
            getCurrentEventDayId()
        ) ===
            String(eventDayId)
    ) {

        const replacement =
            eventDays.find(
                (day) =>
                    String(day.id) !==
                        String(eventDayId) &&
                    Boolean(day.active)
            );


        if (replacement) {

            setCurrentEventDay(
                replacement,
                true
            );

        } else {

            localStorage.removeItem(
                APP_CONFIG.CURRENT_EVENT_DAY_STORAGE_KEY
            );

        }

    }


    showToast(
        nextActive
            ? "開催日を有効化しました。"
            : "開催日を無効化しました。"
    );


    await loadEventDays();
}


/* ========================================
   モーダル
======================================== */

function closeEventDayModal() {

    const modal =
        document.getElementById(
            "eventDayModalOverlay"
        );


    if (!modal) {
        return;
    }


    modal.classList.remove(
        "is-visible"
    );


    modal.hidden = true;


    document.body.classList.remove(
        "modal-open"
    );
}


/* ========================================
   次の表示順
======================================== */

function getNextDisplayOrder() {

    if (!eventDays.length) {
        return 1;
    }


    return (
        Math.max(
            ...eventDays.map(
                (day) =>
                    Number(
                        day.display_order
                    ) || 0
            )
        ) + 1
    );
}


/* ========================================
   日付
======================================== */

function formatDate(
    value
) {

    if (!value) {
        return "";
    }


    const parts =
        String(value).split("-");


    if (
        parts.length !== 3
    ) {
        return value;
    }


    return `${parts[0]}年${Number(
        parts[1]
    )}月${Number(
        parts[2]
    )}日`;
}


function isValidDateString(
    value
) {

    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
            value
        )
    ) {
        return false;
    }


    const [
        year,
        month,
        day
    ] =
        value
            .split("-")
            .map(Number);


    const date =
        new Date(
            year,
            month - 1,
            day
        );


    return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
    );
}


function getTodayJST() {

    const formatter =
        new Intl.DateTimeFormat(
            "ja-JP",
            {
                timeZone:
                    APP_CONFIG.TIME_ZONE,

                year:
                    "numeric",

                month:
                    "2-digit",

                day:
                    "2-digit"
            }
        );


    const parts =
        formatter.formatToParts(
            new Date()
        );


    const year =
        parts.find(
            (item) =>
                item.type === "year"
        )?.value;


    const month =
        parts.find(
            (item) =>
                item.type === "month"
        )?.value;


    const day =
        parts.find(
            (item) =>
                item.type === "day"
        )?.value;


    return `${year}-${month}-${day}`;
}


/* ========================================
   数値
======================================== */

function formatNumber(
    value
) {

    return (
        Number(value) || 0
    ).toLocaleString(
        "ja-JP"
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


    const lowerMessage =
        message.toLowerCase();


    if (
        lowerMessage.includes(
            "duplicate"
        ) ||
        lowerMessage.includes(
            "unique"
        ) ||
        error?.code === "23505"
    ) {

        return (
            "同じ開催日または表示順がすでに登録されています。"
        );
    }


    if (
        lowerMessage.includes(
            "permission"
        ) ||
        lowerMessage.includes(
            "not authorized"
        ) ||
        error?.code === "42501"
    ) {

        return (
            "この操作を実行する権限がありません。"
        );
    }


    if (
        lowerMessage.includes(
            "event_days"
        )
    ) {

        return (
            "開催日の登録に失敗しました。データベース設定を確認してください。"
        );
    }


    return (
        message ||
        "開催日の更新に失敗しました。"
    );
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

            },
            3000
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


/* ========================================
   更新
======================================== */

export function refreshEventDays() {

    return loadEventDays();
}
