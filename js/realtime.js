import { supabase } from "./supabase.js";


let initialized = false;
let channel = null;
let refreshTimer = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let realtimeSubscribed = false;

const REFRESH_DELAY = 300;
const RECONNECT_DELAY = 3000;


/* ========================================
   初期化
======================================== */

export function initializeRealtime() {

    if (initialized) {
        return;
    }

    initialized = true;

    startRealtime();
}


/* ========================================
   Realtime開始
======================================== */

function startRealtime() {

    if (channel) {
        return;
    }

    console.log(
        "Realtime: 接続開始"
    );


    channel =
        supabase
            .channel(
                "hoseimaster-cafe-realtime",
                {
                    config: {
                        broadcast: {
                            self: false
                        },
                        presence: {
                            key: ""
                        }
                    }
                }
            )


            /* ========================================
               注文
            ======================================== */

            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "orders"
                },
                handleRealtimeChange
            )


            /* ========================================
               注文明細
            ======================================== */

            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "order_items"
                },
                handleRealtimeChange
            )


            /* ========================================
               商品
            ======================================== */

            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "products"
                },
                handleRealtimeChange
            )


            /* ========================================
               在庫
            ======================================== */

            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "inventory"
                },
                handleRealtimeChange
            )


            /* ========================================
               開催日
            ======================================== */

            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "event_days"
                },
                handleRealtimeChange
            )


            /* ========================================
               操作履歴
            ======================================== */

            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "operation_history"
                },
                handleRealtimeChange
            )


            .subscribe(
                handleRealtimeStatus
            );

}


/* ========================================
   Realtime状態
======================================== */

function handleRealtimeStatus(
    status
) {

    console.log(
        "Realtime:",
        status
    );


    if (status === "SUBSCRIBED") {

        realtimeSubscribed = true;

        reconnectAttempts = 0;

        console.log(
            "Realtime: 接続完了"
        );

        return;
    }


    realtimeSubscribed = false;


    if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
    ) {

        console.warn(
            "Realtime: 接続が切断されました"
        );

        scheduleReconnect();
    }

}


/* ========================================
   Realtime変更
======================================== */

function handleRealtimeChange(
    payload
) {

    console.log(
        "Realtime変更:",
        payload.table,
        payload.eventType,
        payload
    );


    /*
     * DB変更を検知したら
     * 現在表示している画面を更新
     */

    scheduleRefresh();

}


/* ========================================
   更新予約
======================================== */

function scheduleRefresh() {

    clearTimeout(
        refreshTimer
    );


    refreshTimer =
        setTimeout(
            () => {

                refreshTimer = null;

                refreshCurrentScreen();

            },
            REFRESH_DELAY
        );

}


/* ========================================
   現在画面を更新
======================================== */

function refreshCurrentScreen() {

    const activeScreen =
        document.querySelector(
            ".app-screen.active-screen"
        );


    if (!activeScreen) {

        console.warn(
            "Realtime: 現在の画面を取得できません"
        );

        return;
    }


    const screenId =
        activeScreen.id;


    console.log(
        "Realtime: 画面更新",
        screenId
    );


    switch (screenId) {

        case "dashboardScreen":

            dispatchRefresh(
                "dashboard"
            );

            break;


        case "statisticsScreen":

            dispatchRefresh(
                "statistics"
            );

            break;


        case "ordersScreen":

            dispatchRefresh(
                "orders"
            );

            break;


        case "orderHistoryScreen":

            dispatchRefresh(
                "order-history"
            );

            break;


        case "inventoryScreen":

            dispatchRefresh(
                "inventory"
            );

            break;


        case "historyScreen":

            dispatchRefresh(
                "history"
            );

            break;


        case "settingsScreen":

            dispatchRefresh(
                "settings"
            );

            break;


        case "productSettingsScreen":

            dispatchRefresh(
                "products"
            );

            break;


        case "eventDaySettingsScreen":

            dispatchRefresh(
                "event-days"
            );

            break;


        case "expensesScreen":

            dispatchRefresh(
                "expenses"
            );

            break;


        case "outputScreen":

            dispatchRefresh(
                "output"
            );

            break;


        default:

            console.warn(
                "Realtime: 未対応の画面:",
                screenId
            );

            break;

    }

}


/* ========================================
   更新イベント
======================================== */

function dispatchRefresh(
    screen
) {

    document.dispatchEvent(
        new CustomEvent(
            "app:realtime-refresh",
            {
                detail: {
                    screen
                }
            }
        )
    );


    window.dispatchEvent(
        new CustomEvent(
            "app:data-updated",
            {
                detail: {
                    screen
                }
            }
        )
    );

}


/* ========================================
   再接続予約
======================================== */

function scheduleReconnect() {

    if (reconnectTimer) {
        return;
    }


    reconnectAttempts++;


    const delay =
        Math.min(
            RECONNECT_DELAY *
            reconnectAttempts,
            30000
        );


    console.log(
        `Realtime: ${delay / 1000}秒後に再接続します`
    );


    reconnectTimer =
        setTimeout(
            async () => {

                reconnectTimer = null;

                await restartRealtime();

            },
            delay
        );

}


/* ========================================
   停止
======================================== */

export async function stopRealtime() {

    clearTimeout(
        refreshTimer
    );

    refreshTimer = null;


    clearTimeout(
        reconnectTimer
    );

    reconnectTimer = null;


    realtimeSubscribed = false;


    if (!channel) {
        return;
    }


    console.log(
        "Realtime: 接続停止"
    );


    const currentChannel =
        channel;


    channel = null;


    try {

        await supabase.removeChannel(
            currentChannel
        );

    } catch (error) {

        console.error(
            "Realtime停止エラー:",
            error
        );

    }

}


/* ========================================
   再接続
======================================== */

export async function restartRealtime() {

    console.log(
        "Realtime: 再接続"
    );


    await stopRealtime();


    startRealtime();

}


/* ========================================
   接続状態
======================================== */

export function isRealtimeConnected() {

    return realtimeSubscribed;

}


/* ========================================
   手動更新
======================================== */

export function refreshNow() {

    console.log(
        "Realtime: 手動更新"
    );


    clearTimeout(
        refreshTimer
    );


    refreshTimer = null;


    refreshCurrentScreen();

}


/* ========================================
   グローバル公開
======================================== */

window.hoseimasterRealtime = {

    refreshNow,

    restartRealtime,

    stopRealtime,

    isRealtimeConnected

};
