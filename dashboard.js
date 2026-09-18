import { supabase } from "./supabase.js";
import {
    APP_CONFIG
} from "./config.js";


let dashboardLoading = false;


/* ========================================
   初期化
======================================== */

export function initializeDashboard() {

    renderDashboardBase();

    loadDashboard();

    document.addEventListener(
        "app:screenchange",
        (event) => {

            if (
                event.detail?.screen ===
                "dashboardScreen"
            ) {

                loadDashboard();

            }

        }
    );

}


/* ========================================
   ダッシュボード本体
======================================== */

function renderDashboardBase() {

    const screen =
        document.getElementById(
            "dashboardScreen"
        );

    if (!screen) {
        return;
    }


    screen.innerHTML = `

        <div class="dashboard-header">

            <div class="dashboard-header-main">

                <div class="dashboard-title">
                    ホーム（総合管理画面）
                </div>

                <div
                    id="dashboardDate"
                    class="dashboard-date"
                >
                </div>

            </div>

            <button
                type="button"
                id="dashboardRefreshButton"
                class="dashboard-refresh-button"
            >
                更新
            </button>

        </div>


        <div class="dashboard-today-card">

            <div class="dashboard-card-label">
                今日の売上
            </div>

            <div
                id="dashboardTodaySales"
                class="dashboard-today-value"
            >
                0円
            </div>

        </div>


        <div class="dashboard-summary-grid">


            <div class="dashboard-summary-card">

                <div class="dashboard-summary-label">
                    累計売上
                </div>

                <div
                    id="dashboardTotalSales"
                    class="dashboard-summary-value"
                >
                    0円
                </div>

            </div>


            <div class="dashboard-summary-card">

                <div class="dashboard-summary-label">
                    累計支出
                </div>

                <div
                    id="dashboardTotalExpenses"
                    class="dashboard-summary-value"
                >
                    0円
                </div>

            </div>


            <div class="dashboard-summary-card">

                <div class="dashboard-summary-label">
                    注文数
                </div>

                <div
                    id="dashboardOrderCount"
                    class="dashboard-summary-value"
                >
                    0
                </div>

            </div>


            <div class="dashboard-summary-card">

                <div class="dashboard-summary-label">
                    来客数
                </div>

                <div
                    id="dashboardVisitorCount"
                    class="dashboard-summary-value"
                >
                    0
                </div>

            </div>


        </div>


        <div class="dashboard-profit-card">

            <div class="dashboard-profit-label">
                累計利益
            </div>

            <div
                id="dashboardTotalProfit"
                class="dashboard-profit-value"
            >
                0円
            </div>

            <div class="dashboard-profit-formula">
                累計売上 − 累計支出
            </div>

        </div>


        <div class="dashboard-break-even-section">


            <div class="dashboard-section-title">
                黒字化まで
            </div>


            <div class="dashboard-break-even-grid">


                <div class="dashboard-break-even-card">

                    <div class="dashboard-break-even-label">
                        黒字化までの不足額
                    </div>

                    <div
                        id="dashboardBreakEvenAmount"
                        class="dashboard-break-even-value"
                    >
                        達成
                    </div>

                </div>


                <div class="dashboard-break-even-card">

                    <div class="dashboard-break-even-label">
                        黒字化までに必要な注文数
                    </div>

                    <div
                        id="dashboardBreakEvenOrders"
                        class="dashboard-break-even-value"
                    >
                        達成
                    </div>

                </div>


            </div>


        </div>


        <div class="dashboard-detail-statistics">

            <button
                type="button"
                id="dashboardStatisticsButton"
                class="dashboard-statistics-button"
            >
                詳細統計
            </button>

        </div>


        <div
            id="dashboardError"
            class="dashboard-error"
            hidden
        >
        </div>

    `;


    const refreshButton =
        document.getElementById(
            "dashboardRefreshButton"
        );


    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            () => {

                loadDashboard();

            }
        );

    }


    const statisticsButton =
        document.getElementById(
            "dashboardStatisticsButton"
        );


    if (statisticsButton) {

        statisticsButton.addEventListener(
            "click",
            () => {

                document.dispatchEvent(
                    new CustomEvent(
                        "app:navigate",
                        {
                            detail: {
                                screen:
                                    "statisticsScreen"
                            }
                        }
                    )
                );

            }
        );

    }

}


/* ========================================
   データ取得
======================================== */

export async function loadDashboard() {

    if (dashboardLoading) {
        return;
    }


    dashboardLoading = true;

    clearDashboardError();

    setDashboardLoading(true);


    try {

        const today =
            getTodayJST();


        setDashboardDate(
            today
        );


        /* ====================================
           今日の売上
        ==================================== */

        const todayData =
            await getSalesData(
                today
            );


        /* ====================================
           累計売上
        ==================================== */

        const totalData =
            await getTotalSalesData();


        /* ====================================
           累計支出
        ==================================== */

        const expenseData =
            await getExpenseData();


        if (
            expenseData.error
        ) {

            showDashboardError(
                "支出情報を取得できませんでした。"
            );


            updateDashboard({

                todaySales:
                    todayData.sales,

                totalSales:
                    totalData.sales,

                totalExpenses:
                    null,

                orderCount:
                    totalData.orderCount,

                visitorCount:
                    totalData.visitorCount,

                totalProfit:
                    null,

                breakEvenAmount:
                    null,

                breakEvenOrders:
                    null

            });


            return;

        }


        /* ====================================
           累計利益
        ==================================== */

        const totalProfit =
            totalData.sales -
            expenseData.total;


        /* ====================================
           平均注文額
        ==================================== */

        const averageOrderAmount =
            totalData.orderCount > 0
                ? totalData.sales /
                  totalData.orderCount
                : 0;


        /* ====================================
           黒字化までの不足額
        ==================================== */

        const breakEvenAmount =
            totalProfit < 0
                ? Math.abs(
                    totalProfit
                )
                : 0;


        /* ====================================
           必要注文数
        ==================================== */

        let breakEvenOrders = 0;


        if (
            breakEvenAmount > 0 &&
            averageOrderAmount > 0
        ) {

            breakEvenOrders =
                Math.ceil(
                    breakEvenAmount /
                    averageOrderAmount
                );

        }


        /* ====================================
           表示
        ==================================== */

        updateDashboard({

            todaySales:
                todayData.sales,

            totalSales:
                totalData.sales,

            totalExpenses:
                expenseData.total,

            orderCount:
                totalData.orderCount,

            visitorCount:
                totalData.visitorCount,

            totalProfit:
                totalProfit,

            breakEvenAmount:
                breakEvenAmount,

            breakEvenOrders:
                breakEvenOrders

        });


    } catch (error) {

        console.error(
            "ダッシュボード取得エラー:",
            error
        );


        showDashboardError(
            "ダッシュボードの情報を取得できませんでした。"
        );


    } finally {

        dashboardLoading = false;

        setDashboardLoading(false);

    }

}


/* ========================================
   今日の売上取得
======================================== */

async function getSalesData(
    date
) {

    const {
        data: orders,
        error: ordersError
    } = await supabase
        .from("orders")
        .select(`
            id
        `)
        .eq(
            "order_date",
            date
        )
        .neq(
            "status",
            "cancelled"
        );


    if (ordersError) {
        throw ordersError;
    }


    const orderIds =
        (orders || []).map(
            (order) =>
                order.id
        );


    if (
        orderIds.length === 0
    ) {

        return {
            sales: 0
        };

    }


    const {
        data: items,
        error: itemsError
    } = await supabase
        .from("order_items")
        .select(`
            quantity,
            unit_price
        `)
        .in(
            "order_id",
            orderIds
        );


    if (itemsError) {
        throw itemsError;
    }


    return {

        sales:
            calculateSales(
                items
            )

    };

}


/* ========================================
   累計売上取得
======================================== */

async function getTotalSalesData() {

    const {
        data: orders,
        error: ordersError
    } = await supabase
        .from("orders")
        .select(`
            id,
            customer_count
        `)
        .neq(
            "status",
            "cancelled"
        );


    if (ordersError) {
        throw ordersError;
    }


    const activeOrders =
        orders || [];


    const orderIds =
        activeOrders.map(
            (order) =>
                order.id
        );


    let items = [];


    if (
        orderIds.length > 0
    ) {

        const {
            data,
            error
        } = await supabase
            .from("order_items")
            .select(`
                quantity,
                unit_price
            `)
            .in(
                "order_id",
                orderIds
            );


        if (error) {
            throw error;
        }


        items =
            data || [];

    }


    const sales =
        calculateSales(
            items
        );


    const orderCount =
        activeOrders.length;


    const visitorCount =
        activeOrders.reduce(
            (
                total,
                order
            ) => {

                return (
                    total +
                    (
                        Number(
                            order.customer_count
                        ) || 0
                    )
                );

            },
            0
        );


    return {

        sales:
            sales,

        orderCount:
            orderCount,

        visitorCount:
            visitorCount

    };

}


/* ========================================
   支出取得
======================================== */

async function getExpenseData() {

    const {
        data,
        error
    } = await supabase
        .from("expenses")
        .select(`
            id,
            amount
        `);


    if (error) {

        console.error(
            "支出取得エラー:",
            error
        );


        return {

            total: 0,

            error: true

        };

    }


    const total =
        (data || []).reduce(
            (
                sum,
                expense
            ) => {

                return (
                    sum +
                    (
                        Number(
                            expense.amount
                        ) || 0
                    )
                );

            },
            0
        );


    return {

        total:
            total,

        error:
            false

    };

}


/* ========================================
   売上計算
======================================== */

function calculateSales(
    items
) {

    return (
        items || []
    ).reduce(
        (
            total,
            item
        ) => {

            const quantity =
                Number(
                    item.quantity
                ) || 0;


            const unitPrice =
                Number(
                    item.unit_price
                ) || 0;


            return (
                total +
                (
                    quantity *
                    unitPrice
                )
            );

        },
        0
    );

}


/* ========================================
   ダッシュボード表示
======================================== */

function updateDashboard(
    data
) {

    setText(
        "dashboardTodaySales",
        formatYen(
            data.todaySales
        )
    );


    setText(
        "dashboardTotalSales",
        formatYen(
            data.totalSales
        )
    );


    setText(
        "dashboardTotalExpenses",
        data.totalExpenses === null
            ? "—"
            : formatYen(
                data.totalExpenses
            )
    );


    setText(
        "dashboardOrderCount",
        formatNumber(
            data.orderCount
        )
    );


    setText(
        "dashboardVisitorCount",
        formatNumber(
            data.visitorCount
        )
    );


    setText(
        "dashboardTotalProfit",
        data.totalProfit === null
            ? "—"
            : formatYen(
                data.totalProfit
            )
    );


    if (
        data.breakEvenAmount === null
    ) {

        setText(
            "dashboardBreakEvenAmount",
            "—"
        );


        setText(
            "dashboardBreakEvenOrders",
            "—"
        );


        return;

    }


    if (
        Number(
            data.breakEvenAmount
        ) > 0
    ) {

        setText(
            "dashboardBreakEvenAmount",
            formatYen(
                data.breakEvenAmount
            )
        );


        if (
            Number(
                data.breakEvenOrders
            ) > 0
        ) {

            setText(
                "dashboardBreakEvenOrders",
                `${formatNumber(
                    data.breakEvenOrders
                )}注文`
            );

        } else {

            setText(
                "dashboardBreakEvenOrders",
                "—"
            );

        }

    } else {

        setText(
            "dashboardBreakEvenAmount",
            "達成"
        );


        setText(
            "dashboardBreakEvenOrders",
            "達成"
        );

    }


    updateProfitState(
        data.totalProfit
    );

}


/* ========================================
   利益状態
======================================== */

function updateProfitState(
    profit
) {

    const element =
        document.getElementById(
            "dashboardTotalProfit"
        );


    if (!element) {
        return;
    }


    element.classList.remove(
        "is-positive",
        "is-negative",
        "is-zero"
    );


    const value =
        Number(profit);


    if (value > 0) {

        element.classList.add(
            "is-positive"
        );

    } else if (value < 0) {

        element.classList.add(
            "is-negative"
        );

    } else {

        element.classList.add(
            "is-zero"
        );

    }

}


/* ========================================
   日付表示
======================================== */

function setDashboardDate(
    date
) {

    setText(
        "dashboardDate",
        formatDateJapanese(
            date
        )
    );

}


/* ========================================
   ローディング
======================================== */

function setDashboardLoading(
    loading
) {

    const screen =
        document.getElementById(
            "dashboardScreen"
        );


    if (screen) {

        screen.classList.toggle(
            "is-loading",
            loading
        );

    }


    const button =
        document.getElementById(
            "dashboardRefreshButton"
        );


    if (!button) {
        return;
    }


    button.disabled =
        loading;


    button.textContent =
        loading
            ? "更新中…"
            : "更新";

}


/* ========================================
   エラー表示
======================================== */

function showDashboardError(
    message
) {

    const element =
        document.getElementById(
            "dashboardError"
        );


    if (!element) {
        return;
    }


    element.textContent =
        message;


    element.hidden =
        false;

}


/* ========================================
   エラー解除
======================================== */

function clearDashboardError() {

    const element =
        document.getElementById(
            "dashboardError"
        );


    if (!element) {
        return;
    }


    element.textContent =
        "";


    element.hidden =
        true;

}


/* ========================================
   今日の日付
======================================== */

function getTodayJST() {

    const formatter =
        new Intl.DateTimeFormat(
            "en-CA",
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


    return formatter.format(
        new Date()
    );

}


/* ========================================
   日付フォーマット
======================================== */

function formatDateJapanese(
    date
) {

    if (!date) {
        return "";
    }


    const parts =
        String(date).split("-");


    if (
        parts.length !== 3
    ) {

        return String(date);

    }


    return (
        `${parts[0]}年` +
        `${parts[1]}月` +
        `${parts[2]}日`
    );

}


/* ========================================
   金額
======================================== */

function formatYen(
    value
) {

    const number =
        Number(value) || 0;


    return (
        `${number.toLocaleString(
            "ja-JP"
        )}円`
    );

}


/* ========================================
   数値
======================================== */

function formatNumber(
    value
) {

    const number =
        Number(value) || 0;


    return number.toLocaleString(
        "ja-JP"
    );

}


/* ========================================
   テキスト設定
======================================== */

function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (!element) {
        return;
    }


    element.textContent =
        value;

}


/* ========================================
   手動更新
======================================== */

export function refreshDashboard() {

    return loadDashboard();

}
