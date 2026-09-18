import { supabase } from "./supabase.js";
import {
    APP_CONFIG
} from "./config.js";


let statisticsInitialized = false;
let statisticsLoading = false;


/* ========================================
   初期化
======================================== */

export function initializeStatistics() {

    if (statisticsInitialized) {
        return;
    }

    statisticsInitialized = true;

    document.addEventListener(
        "app:screenchange",
        (event) => {

            if (
                event.detail?.screen ===
                "statisticsScreen"
            ) {
                loadStatistics();
            }
        }
    );

    loadStatistics();
}


/* ========================================
   統計取得
======================================== */

export async function loadStatistics(
    targetDate = null
) {

    if (statisticsLoading) {
        return;
    }

    statisticsLoading = true;

    try {

        const date =
            targetDate ||
            getTodayJST();

        await Promise.all([
            loadDailySales(date),
            loadHourlySales(date),
            loadProductSales(),
            loadProductDailySales(),
            loadVisitorStatistics(),
            loadKPI()
        ]);

    } catch (error) {

        console.error(
            "統計取得エラー:",
            error
        );

    } finally {

        statisticsLoading = false;

    }
}


/* ========================================
   日別売上
======================================== */

async function loadDailySales(
    targetDate
) {

    const {
        data,
        error
    } = await supabase
        .from("daily_sales_summary")
        .select("*")
        .order(
            "order_date",
            {
                ascending: true
            }
        );


    if (error) {

        console.error(
            "日別売上取得エラー:",
            error
        );

        renderEmpty(
            "dailySalesContainer"
        );

        return;
    }


    const rows =
        data || [];


    renderDailySales(
        rows,
        targetDate
    );
}


/* ========================================
   時間帯別売上
======================================== */

async function loadHourlySales(
    targetDate
) {

    const {
        data,
        error
    } = await supabase
        .from("hourly_sales_summary")
        .select("*")
        .eq(
            "order_date",
            targetDate
        )
        .order(
            "hour",
            {
                ascending: true
            }
        );


    if (error) {

        console.error(
            "時間帯別売上取得エラー:",
            error
        );

        renderEmpty(
            "hourlySalesContainer"
        );

        return;
    }


    renderHourlySales(
        data || []
    );
}


/* ========================================
   商品別売上
======================================== */

async function loadProductSales() {

    const {
        data,
        error
    } = await supabase
        .from("product_sales_summary")
        .select("*")
        .order(
            "sales_amount",
            {
                ascending: false
            }
        );


    if (error) {

        console.error(
            "商品別売上取得エラー:",
            error
        );

        renderEmpty(
            "productSalesContainer"
        );

        return;
    }


    renderProductSales(
        data || []
    );
}


/* ========================================
   商品別日別売上
======================================== */

async function loadProductDailySales() {

    const {
        data,
        error
    } = await supabase
        .from("product_daily_sales_summary")
        .select("*")
        .order(
            "order_date",
            {
                ascending: false
            }
        );


    if (error) {

        console.error(
            "商品別日別売上取得エラー:",
            error
        );

        renderEmpty(
            "productDailySalesContainer"
        );

        return;
    }


    renderProductDailySales(
        data || []
    );
}


/* ========================================
   来客統計
======================================== */

async function loadVisitorStatistics() {

    const [
        dailyResult,
        eventResult
    ] = await Promise.all([

        supabase
            .from("daily_visitor_summary")
            .select("*")
            .order(
                "order_date",
                {
                    ascending: true
                }
            ),

        supabase
            .from("event_visitor_summary")
            .select("*")
            .maybeSingle()
    ]);


    if (dailyResult.error) {

        console.error(
            "日別来客数取得エラー:",
            dailyResult.error
        );

    }


    if (eventResult.error) {

        console.error(
            "全体来客数取得エラー:",
            eventResult.error
        );

    }


    renderVisitorStatistics(
        dailyResult.data || [],
        eventResult.data
    );
}


/* ========================================
   KPI
======================================== */

async function loadKPI() {

    const {
        data,
        error
    } = await supabase
        .from("event_total_summary")
        .select("*")
        .maybeSingle();


    if (error) {

        console.error(
            "KPI取得エラー:",
            error
        );

        renderEmpty(
            "kpiContainer"
        );

        return;
    }


    renderKPI(
        data
    );
}


/* ========================================
   日別売上表示
======================================== */

function renderDailySales(
    rows,
    targetDate
) {

    const container =
        document.getElementById(
            "dailySalesContainer"
        );

    if (!container) {
        return;
    }


    if (!rows.length) {

        renderEmpty(
            "dailySalesContainer"
        );

        return;
    }


    let html = "";


    html += `
        <div class="statistics-chart-box">

            <div class="statistics-chart-title">
                日別売上推移
            </div>

            ${createLineChart(
                rows,
                "order_date",
                "sales_amount",
                (value) =>
                    formatYen(value),
                (value) =>
                    formatDateShort(value)
            )}

        </div>
    `;


    html += `
        <div class="statistics-table-wrapper">

            <table class="statistics-table">

                <thead>

                    <tr>
                        <th>日付</th>
                        <th>売上</th>
                        <th>注文数</th>
                        <th>来客数</th>
                    </tr>

                </thead>

                <tbody>
    `;


    rows
        .slice()
        .reverse()
        .forEach((row) => {

            html += `
                <tr>

                    <td>
                        ${formatDate(
                            row.order_date
                        )}
                    </td>

                    <td>
                        ${formatYen(
                            row.sales_amount
                        )}
                    </td>

                    <td>
                        ${formatNumber(
                            row.order_count
                        )}
                    </td>

                    <td>
                        ${formatNumber(
                            row.visitor_count
                        )}
                    </td>

                </tr>
            `;
        });


    html += `
                </tbody>

            </table>

        </div>
    `;


    container.innerHTML = html;
}


/* ========================================
   時間帯別売上表示
======================================== */

function renderHourlySales(
    rows
) {

    const container =
        document.getElementById(
            "hourlySalesContainer"
        );

    if (!container) {
        return;
    }


    if (!rows.length) {

        renderEmpty(
            "hourlySalesContainer"
        );

        return;
    }


    let html = "";


    html += `
        <div class="statistics-chart-box">

            <div class="statistics-chart-title">
                時間帯別売上
            </div>

            ${createBarChart(
                rows,
                "hour",
                "sales_amount",
                (value) =>
                    formatYen(value),
                (value) =>
                    `${String(
                        Number(value) || 0
                    ).padStart(
                        2,
                        "0"
                    )}:00`
            )}

        </div>
    `;


    html += `
        <div class="statistics-table-wrapper">

            <table class="statistics-table">

                <thead>

                    <tr>
                        <th>時間</th>
                        <th>売上</th>
                        <th>注文数</th>
                        <th>来客数</th>
                    </tr>

                </thead>

                <tbody>
    `;


    rows.forEach((row) => {

        const hour =
            Number(row.hour) || 0;


        html += `
            <tr>

                <td>
                    ${String(hour).padStart(
                        2,
                        "0"
                    )}:00
                </td>

                <td>
                    ${formatYen(
                        row.sales_amount
                    )}
                </td>

                <td>
                    ${formatNumber(
                        row.order_count
                    )}
                </td>

                <td>
                    ${formatNumber(
                        row.visitor_count
                    )}
                </td>

            </tr>
        `;
    });


    html += `
                </tbody>

            </table>

        </div>
    `;


    container.innerHTML = html;
}


/* ========================================
   商品別売上表示
======================================== */

function renderProductSales(
    rows
) {

    const container =
        document.getElementById(
            "productSalesContainer"
        );

    if (!container) {
        return;
    }


    if (!rows.length) {

        renderEmpty(
            "productSalesContainer"
        );

        return;
    }


    /*
     * カテゴリごとに商品を分類する。
     */

    const categories = [
        "ドリンク",
        "デザート",
        "セット",
        "その他"
    ];


    const grouped = {
        "ドリンク": [],
        "デザート": [],
        "セット": [],
        "その他": []
    };


    rows.forEach((row) => {

        const category =
            normalizeProductCategory(
                row.category
            );


        if (!grouped[category]) {
            grouped["その他"].push(row);
            return;
        }


        grouped[category].push(row);
    });


    let html = "";


    categories.forEach(
        (category) => {

            const categoryRows =
                grouped[category];


            if (!categoryRows.length) {
                return;
            }


            /*
             * 各カテゴリ内でも売上順にする。
             */

            categoryRows.sort(
                (
                    a,
                    b
                ) =>
                    (
                        Number(
                            b.sales_amount
                        ) || 0
                    ) -
                    (
                        Number(
                            a.sales_amount
                        ) || 0
                    )
            );


            html += `
                <div class="statistics-category-group">

                    <div class="statistics-chart-box">

                        <div class="statistics-chart-title">
                            ${escapeHtml(
                                category
                            )}
                        </div>

                        ${createBarChart(
                            categoryRows,
                            "name",
                            "sold_quantity",
                            (value) =>
                                `${formatNumber(
                                    value
                                )}個`,
                            (value) =>
                                String(
                                    value
                                )
                        )}

                    </div>

                </div>
            `;
        }
    );


    /*
     * 商品別一覧表。
     */

    html += `
        <div class="statistics-table-wrapper">

            <table class="statistics-table">

                <thead>

                    <tr>
                        <th>カテゴリ</th>
                        <th>商品</th>
                        <th>数量</th>
                        <th>売上</th>
                    </tr>

                </thead>

                <tbody>
    `;


    rows.forEach((row) => {

        const category =
            normalizeProductCategory(
                row.category
            );


        html += `
            <tr>

                <td>
                    ${escapeHtml(
                        category
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        row.name
                    )}
                </td>

                <td>
                    ${formatNumber(
                        row.sold_quantity
                    )}
                </td>

                <td>
                    ${formatYen(
                        row.sales_amount
                    )}
                </td>

            </tr>
        `;
    });


    html += `
                </tbody>

            </table>

        </div>
    `;


    container.innerHTML = html;
}


/* ========================================
   商品カテゴリ正規化
======================================== */

function normalizeProductCategory(
    value
) {

    const category =
        String(
            value ?? ""
        ).trim();


    if (
        category === "ドリンク" ||
        category === "飲料" ||
        category === "drink" ||
        category === "Drink"
    ) {
        return "ドリンク";
    }


    if (
        category === "デザート" ||
        category === "dessert" ||
        category === "Dessert"
    ) {
        return "デザート";
    }


    if (
        category === "セット" ||
        category === "set" ||
        category === "Set"
    ) {
        return "セット";
    }


    return "その他";
}


/* ========================================
   商品別日別売上表示
======================================== */

function renderProductDailySales(
    rows
) {

    const container =
        document.getElementById(
            "productDailySalesContainer"
        );

    if (!container) {
        return;
    }


    if (!rows.length) {

        renderEmpty(
            "productDailySalesContainer"
        );

        return;
    }


    const grouped = {};


    rows.forEach((row) => {

        const product =
            row.name ||
            "不明な商品";

        const date =
            row.order_date;


        if (!grouped[product]) {
            grouped[product] = {};
        }


        grouped[product][date] = {

            quantity:
                Number(
                    row.sold_quantity
                ) || 0,

            sales:
                Number(
                    row.sales_amount
                ) || 0
        };
    });


    const dates = [
        ...new Set(
            rows.map(
                (row) =>
                    row.order_date
            )
        )
    ].sort();


    let html = `
        <div class="statistics-table-wrapper">

            <table class="statistics-table">

                <thead>

                    <tr>

                        <th>
                            商品
                        </th>
    `;


    dates.forEach((date) => {

        html += `
            <th>
                ${formatDateShort(
                    date
                )}
            </th>
        `;
    });


    html += `
                    </tr>

                </thead>

                <tbody>
    `;


    Object.keys(grouped).forEach(
        (product) => {

            html += `
                <tr>

                    <td>
                        ${escapeHtml(
                            product
                        )}
                    </td>
            `;


            dates.forEach((date) => {

                const value =
                    grouped[
                        product
                    ][date];


                html += `
                    <td>
                        ${
                            value
                                ? formatNumber(
                                    value.quantity
                                )
                                : "0"
                        }
                    </td>
                `;
            });


            html += `
                </tr>
            `;
        }
    );


    html += `
                </tbody>

            </table>

        </div>
    `;


    container.innerHTML = html;
}


/* ========================================
   来客統計表示
======================================== */

function renderVisitorStatistics(
    dailyRows,
    eventData
) {

    const container =
        document.getElementById(
            "visitorStatisticsContainer"
        );

    if (!container) {
        return;
    }


    let html = "";


    if (dailyRows.length) {

        html += `
            <div class="statistics-chart-box">

                <div class="statistics-chart-title">
                    日別来客数
                </div>

                ${createLineChart(
                    dailyRows,
                    "order_date",
                    "visitor_count",
                    (value) =>
                        `${formatNumber(
                            value
                        )}人`,
                    (value) =>
                        formatDateShort(
                            value
                        )
                )}

            </div>


            <div class="statistics-table-wrapper">

                <table class="statistics-table">

                    <thead>

                        <tr>
                            <th>日付</th>
                            <th>来客数</th>
                        </tr>

                    </thead>

                    <tbody>
        `;


        dailyRows
            .slice()
            .reverse()
            .forEach((row) => {

                html += `
                    <tr>

                        <td>
                            ${formatDate(
                                row.order_date
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                row.visitor_count
                            )}人
                        </td>

                    </tr>
                `;
            });


        html += `
                    </tbody>

                </table>

            </div>
        `;
    }


    if (eventData) {

        html += `
            <div class="statistics-table-wrapper">

                <table class="statistics-table">

                    <thead>

                        <tr>
                            <th>総注文数</th>
                            <th>総来客数</th>
                        </tr>

                    </thead>

                    <tbody>

                        <tr>

                            <td>
                                ${formatNumber(
                                    eventData.total_orders
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    eventData.total_visitors
                                )}人
                            </td>

                        </tr>

                    </tbody>

                </table>

            </div>
        `;
    }


    if (!html) {

        renderEmpty(
            "visitorStatisticsContainer"
        );

        return;
    }


    container.innerHTML = html;
}


/* ========================================
   KPI表示
======================================== */

function renderKPI(
    data
) {

    const container =
        document.getElementById(
            "kpiContainer"
        );

    if (!container) {
        return;
    }


    if (!data) {

        renderEmpty(
            "kpiContainer"
        );

        return;
    }


    const rows = [

        {
            label: "平均注文額",
            value: formatYen(
                data.average_order_amount
            )
        },

        {
            label: "来客1人あたり売上",
            value: formatYen(
                data.sales_per_visitor
            )
        },

        {
            label: "1注文あたり来客数",
            value:
                formatDecimal(
                    data.visitors_per_order
                ) + "人"
        },

        {
            label: "利益",
            value: formatYen(
                data.total_profit
            )
        }
    ];


    let html = `
        <div class="statistics-table-wrapper">

            <table class="statistics-table statistics-kpi-table">

                <thead>

                    <tr>
                        <th>項目</th>
                        <th>数値</th>
                    </tr>

                </thead>

                <tbody>
    `;


    rows.forEach((row) => {

        html += `
            <tr>

                <th scope="row">
                    ${row.label}
                </th>

                <td>
                    ${row.value}
                </td>

            </tr>
        `;
    });


    html += `
                </tbody>

            </table>

        </div>
    `;


    container.innerHTML = html;
}


/* ========================================
   SVG 折れ線グラフ
======================================== */

function createLineChart(
    rows,
    xKey,
    yKey,
    valueFormatter,
    labelFormatter
) {

    if (!rows.length) {
        return `
            <div class="statistics-empty">
                データがありません
            </div>
        `;
    }


    const width = 720;
    const height = 300;

    const paddingLeft = 55;
    const paddingRight = 20;
    const paddingTop = 25;
    const paddingBottom = 55;


    const chartWidth =
        width -
        paddingLeft -
        paddingRight;

    const chartHeight =
        height -
        paddingTop -
        paddingBottom;


    const values =
        rows.map(
            (row) =>
                Number(
                    row[yKey]
                ) || 0
        );


    const maxValue =
        Math.max(
            ...values,
            1
        );


    const minValue = 0;


    const getX = (index) => {

        if (rows.length === 1) {
            return (
                paddingLeft +
                chartWidth / 2
            );
        }

        return (
            paddingLeft +
            (
                index /
                (rows.length - 1)
            ) *
            chartWidth
        );
    };


    const getY = (value) => {

        return (
            paddingTop +
            chartHeight -
            (
                (
                    value -
                    minValue
                ) /
                (
                    maxValue -
                    minValue
                )
            ) *
            chartHeight
        );
    };


    const points =
        rows.map(
            (row, index) => {

                const value =
                    Number(
                        row[yKey]
                    ) || 0;

                return {
                    x: getX(index),
                    y: getY(value),
                    value,
                    label:
                        labelFormatter(
                            row[xKey]
                        )
                };
            }
        );


    const path =
        points
            .map(
                (point, index) =>
                    `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
            )
            .join(" ");


    const gridCount = 4;


    let svg = `
        <div class="statistics-chart-scroll">

            <svg
                viewBox="0 0 ${width} ${height}"
                class="statistics-svg-chart"
                role="img"
                aria-label="統計グラフ"
            >

                <line
                    x1="${paddingLeft}"
                    y1="${paddingTop}"
                    x2="${paddingLeft}"
                    y2="${height - paddingBottom}"
                    stroke="#dddddd"
                    stroke-width="1"
                />

                <line
                    x1="${paddingLeft}"
                    y1="${height - paddingBottom}"
                    x2="${width - paddingRight}"
                    y2="${height - paddingBottom}"
                    stroke="#dddddd"
                    stroke-width="1"
                />
    `;


    for (
        let i = 0;
        i <= gridCount;
        i++
    ) {

        const value =
            maxValue -
            (
                maxValue /
                gridCount
            ) *
            i;


        const y =
            getY(value);


        svg += `
            <line
                x1="${paddingLeft}"
                y1="${y}"
                x2="${width - paddingRight}"
                y2="${y}"
                stroke="#eeeeee"
                stroke-width="1"
            />

            <text
                x="${paddingLeft - 8}"
                y="${y + 4}"
                text-anchor="end"
                font-size="11"
                fill="#777777"
            >
                ${escapeHtml(
                    valueFormatter(value)
                )}
            </text>
        `;
    }


    svg += `
        <path
            d="${path}"
            fill="none"
            stroke="#e98a4a"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
        />
    `;


    points.forEach(
        (point) => {

            svg += `
                <circle
                    cx="${point.x}"
                    cy="${point.y}"
                    r="5"
                    fill="#ffffff"
                    stroke="#e98a4a"
                    stroke-width="3"
                />

                <text
                    x="${point.x}"
                    y="${height - 25}"
                    text-anchor="middle"
                    font-size="10"
                    fill="#777777"
                >
                    ${escapeHtml(
                        point.label
                    )}
                </text>
            `;
        }
    );


    svg += `
            </svg>

        </div>
    `;


    return svg;
}


/* ========================================
   SVG 棒グラフ
======================================== */

function createBarChart(
    rows,
    xKey,
    yKey,
    valueFormatter,
    labelFormatter
) {

    if (!rows.length) {
        return `
            <div class="statistics-empty">
                データがありません
            </div>
        `;
    }


    const baseWidth = 720;
    const itemWidth = 78;


    const width =
        Math.max(
            baseWidth,
            75 +
            rows.length *
            itemWidth
        );


    const height = 335;

    const paddingLeft = 55;
    const paddingRight = 20;
    const paddingTop = 25;
    const paddingBottom = 95;


    const chartWidth =
        width -
        paddingLeft -
        paddingRight;

    const chartHeight =
        height -
        paddingTop -
        paddingBottom;


    const values =
        rows.map(
            (row) =>
                Number(
                    row[yKey]
                ) || 0
        );


    const maxValue =
        Math.max(
            ...values,
            1
        );


    const gridCount = 4;


    const barAreaWidth =
        chartWidth /
        rows.length;


    const barWidth =
        Math.max(
            18,
            Math.min(
                42,
                barAreaWidth *
                0.55
            )
        );


    function createLabelLines(
        label
    ) {

        const text =
            String(
                label ?? ""
            );


        const maxCharacters = 6;

        const lines = [];


        for (
            let i = 0;
            i < text.length;
            i += maxCharacters
        ) {

            lines.push(
                text.substring(
                    i,
                    i + maxCharacters
                )
            );
        }


        if (!lines.length) {
            lines.push("");
        }


        return lines.slice(
            0,
            3
        );
    }


    let svg = `
        <div class="statistics-chart-scroll">

            <svg
                viewBox="0 0 ${width} ${height}"
                width="${width}"
                height="${height}"
                class="statistics-svg-chart"
                role="img"
                aria-label="統計グラフ"
                style="
                    width:${width}px;
                    min-width:${width}px;
                    max-width:none;
                    height:${height}px;
                "
            >

                <line
                    x1="${paddingLeft}"
                    y1="${paddingTop}"
                    x2="${paddingLeft}"
                    y2="${height - paddingBottom}"
                    stroke="#dddddd"
                    stroke-width="1"
                />

                <line
                    x1="${paddingLeft}"
                    y1="${height - paddingBottom}"
                    x2="${width - paddingRight}"
                    y2="${height - paddingBottom}"
                    stroke="#dddddd"
                    stroke-width="1"
                />
    `;


    for (
        let i = 0;
        i <= gridCount;
        i++
    ) {

        const value =
            maxValue -
            (
                maxValue /
                gridCount
            ) *
            i;


        const y =
            paddingTop +
            chartHeight -
            (
                value /
                maxValue
            ) *
            chartHeight;


        svg += `
            <line
                x1="${paddingLeft}"
                y1="${y}"
                x2="${width - paddingRight}"
                y2="${y}"
                stroke="#eeeeee"
                stroke-width="1"
            />

            <text
                x="${paddingLeft - 8}"
                y="${y + 4}"
                text-anchor="end"
                font-size="11"
                fill="#777777"
            >
                ${escapeHtml(
                    valueFormatter(value)
                )}
            </text>
        `;
    }


    rows.forEach(
        (row, index) => {

            const value =
                Number(
                    row[yKey]
                ) || 0;


            const barHeight =
                (
                    value /
                    maxValue
                ) *
                chartHeight;


            const x =
                paddingLeft +
                (
                    index *
                    barAreaWidth
                ) +
                (
                    barAreaWidth -
                    barWidth
                ) / 2;


            const y =
                paddingTop +
                chartHeight -
                barHeight;


            const label =
                labelFormatter(
                    row[xKey]
                );


            const labelLines =
                createLabelLines(
                    label
                );


            svg += `
                <rect
                    x="${x}"
                    y="${y}"
                    width="${barWidth}"
                    height="${Math.max(
                        barHeight,
                        1
                    )}"
                    rx="4"
                    fill="#e98a4a"
                />
            `;


            labelLines.forEach(
                (
                    line,
                    lineIndex
                ) => {

                    svg += `
                        <text
                            x="${x + barWidth / 2}"
                            y="${
                                height -
                                paddingBottom +
                                25 +
                                lineIndex *
                                14
                            }"
                            text-anchor="middle"
                            font-size="10"
                            fill="#777777"
                        >
                            ${escapeHtml(
                                line
                            )}
                        </text>
                    `;
                }
            );

        }
    );


    svg += `
            </svg>

        </div>
    `;


    return svg;
}


/* ========================================
   空表示
======================================== */

function renderEmpty(
    id
) {

    const container =
        document.getElementById(id);

    if (!container) {
        return;
    }


    container.innerHTML = `
        <div class="statistics-empty">
            データがありません
        </div>
    `;
}


/* ========================================
   更新
======================================== */

export function refreshStatistics(
    targetDate = null
) {

    return loadStatistics(
        targetDate
    );
}


/* ========================================
   JST
======================================== */

function getTodayJST() {

    const formatter =
        new Intl.DateTimeFormat(
            "en-CA",
            {
                timeZone:
                    APP_CONFIG.TIME_ZONE,

                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            }
        );


    return formatter.format(
        new Date()
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


    if (parts.length !== 3) {
        return value;
    }


    return `${parts[0]}年${parts[1]}月${parts[2]}日`;
}


function formatDateShort(
    value
) {

    if (!value) {
        return "";
    }


    const parts =
        String(value).split("-");


    if (parts.length !== 3) {
        return value;
    }


    return `${Number(
        parts[1]
    )}/${Number(
        parts[2]
    )}`;
}


/* ========================================
   金額
======================================== */

function formatYen(
    value
) {

    const number =
        Number(value) || 0;


    return `${number.toLocaleString(
        "ja-JP"
    )}円`;
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


function formatDecimal(
    value
) {

    const number =
        Number(value) || 0;


    return number.toLocaleString(
        "ja-JP",
        {
            maximumFractionDigits: 1
        }
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
