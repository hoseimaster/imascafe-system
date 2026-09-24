/**
 * CSV・PDF出力
 */

import { supabase } from "./supabase.js";
import { APP_CONFIG } from "./config.js";


let outputInitialized = false;


/* ========================================
   初期化
======================================== */

export function initializeOutput() {

    if (outputInitialized) {
        return;
    }

    outputInitialized = true;

    document.addEventListener(
        "click",
        handleOutputClick
    );

}


/* ========================================
   出力ボタン
======================================== */

function handleOutputClick(event) {

    const csvButton =
        event.target.closest(
            "[data-output-csv]"
        );

    if (csvButton) {

        const type =
            csvButton.dataset.outputCsv;

        exportCSV(type);

        return;

    }


    const pdfButton =
        event.target.closest(
            "[data-output-pdf]"
        );

    if (pdfButton) {

        exportPDF();

    }

}


/* ========================================
   CSV出力
======================================== */

export async function exportCSV(
    type
) {

    try {

        let rows = [];
        let filename = "export.csv";

        switch (type) {

            case "orders":

                rows =
                    await getOrdersCSVData();

                filename =
                    createFilename(
                        "注文履歴"
                    );

                break;


            case "order-items":

                rows =
                    await getOrderItemsCSVData();

                filename =
                    createFilename(
                        "注文明細"
                    );

                break;


            case "expenses":

                rows =
                    await getExpensesCSVData();

                filename =
                    createFilename(
                        "支出"
                    );

                break;


            case "inventory":

                rows =
                    await getInventoryCSVData();

                filename =
                    createFilename(
                        "在庫"
                    );

                break;


            case "history":

                rows =
                    await getHistoryCSVData();

                filename =
                    createFilename(
                        "操作履歴"
                    );

                break;


            case "sales":

                rows =
                    await getSalesCSVData();

                filename =
                    createFilename(
                        "売上"
                    );

                break;


            default:

                throw new Error(
                    "出力対象が指定されていません。"
                );

        }


        if (!rows.length) {

            showOutputMessage(
                "出力できるデータがありません。"
            );

            return;

        }


        downloadCSV(
            rows,
            filename
        );


        showOutputMessage(
            "CSVを出力しました。"
        );


    } catch (error) {

        console.error(
            "CSV出力エラー:",
            error
        );

        showOutputError(
            "CSVを出力できませんでした。"
        );

    }

}


/* ========================================
   注文履歴
======================================== */

async function getOrdersCSVData() {

    const {
        data,
        error
    } = await supabase
        .from("orders")
        .select(`
            order_id,
            order_date,
            order_time,
            customer_count,
            status,
            terminal,
            operator_name,
            created_at
        `)
        .order(
            "order_date",
            {
                ascending: false
            }
        )
        .order(
            "order_time",
            {
                ascending: false
            }
        );


    if (error) {
        throw error;
    }


    return [

        [
            "注文番号",
            "営業日",
            "注文時刻",
            "来客数",
            "状態",
            "端末",
            "担当者",
            "登録日時"
        ],

        ...(data || []).map(
            order => [

                order.order_id,
                order.order_date,
                order.order_time,
                order.customer_count,
                order.status,
                order.terminal || "",
                order.operator_name || "",
                order.created_at || ""

            ]
        )

    ];

}


/* ========================================
   注文明細
======================================== */

async function getOrderItemsCSVData() {

    const {
        data,
        error
    } = await supabase
        .from("order_items")
        .select(`
            id,
            order_id,
            product_id,
            quantity,
            unit_price,
            created_at
        `)
        .order(
            "created_at",
            {
                ascending: false
            }
        );


    if (error) {
        throw error;
    }


    return [

        [
            "明細ID",
            "注文ID",
            "商品ID",
            "数量",
            "単価",
            "金額",
            "登録日時"
        ],

        ...(data || []).map(
            item => [

                item.id,
                item.order_id,
                item.product_id,
                item.quantity,
                item.unit_price,
                (
                    Number(item.quantity || 0) *
                    Number(item.unit_price || 0)
                ),
                item.created_at || ""

            ]
        )

    ];

}


/* ========================================
   支出
======================================== */

async function getExpensesCSVData() {

    const {
        data,
        error
    } = await supabase
        .from("expenses")
        .select(`
            id,
            expense_date,
            amount,
            description,
            payment_method,
            operator_name,
            terminal,
            created_at
        `)
        .order(
            "expense_date",
            {
                ascending: false
            }
        );


    if (error) {
        throw error;
    }


    return [

        [
            "ID",
            "日付",
            "金額",
            "内容",
            "支払方法",
            "担当者",
            "端末",
            "登録日時"
        ],

        ...(data || []).map(
            expense => [

                expense.id,
                expense.expense_date,
                expense.amount,
                expense.description || "",
                expense.payment_method || "",
                expense.operator_name || "",
                expense.terminal || "",
                expense.created_at || ""

            ]
        )

    ];

}


/* ========================================
   在庫
======================================== */

async function getInventoryCSVData() {

    const {
        data,
        error
    } = await supabase
        .from("inventory_status")
        .select(`
            product_id,
            name,
            category,
            price,
            quantity,
            updated_at
        `)
        .order(
            "category",
            {
                ascending: true
            }
        )
        .order(
            "name",
            {
                ascending: true
            }
        );


    if (error) {
        throw error;
    }


    return [

        [
            "商品ID",
            "商品名",
            "カテゴリ",
            "価格",
            "在庫数",
            "更新日時"
        ],

        ...(data || []).map(
            item => [

                item.product_id,
                item.name,
                item.category,
                item.price,
                item.quantity,
                item.updated_at || ""

            ]
        )

    ];

}


/* ========================================
   操作履歴
======================================== */

async function getHistoryCSVData() {

    const {
        data,
        error
    } = await supabase
        .from("operation_history")
        .select(`
            id,
            operated_at,
            operator_name,
            terminal,
            operation_type,
            order_id,
            target,
            description,
            before_value,
            after_value,
            event_date
        `)
        .order(
            "operated_at",
            {
                ascending: false
            }
        );


    if (error) {
        throw error;
    }


    return [

        [
            "ID",
            "操作日時",
            "担当者",
            "端末",
            "操作種別",
            "注文番号",
            "対象",
            "内容",
            "変更前",
            "変更後",
            "営業日"
        ],

        ...(data || []).map(
            row => [

                row.id,
                row.operated_at || "",
                row.operator_name || "",
                row.terminal || "",
                row.operation_type || "",
                row.order_id || "",
                row.target || "",
                row.description || "",
                stringifyJSON(
                    row.before_value
                ),
                stringifyJSON(
                    row.after_value
                ),
                row.event_date || ""

            ]
        )

    ];

}


/* ========================================
   売上
======================================== */

async function getSalesCSVData() {

    const {
        data: orders,
        error: ordersError
    } = await supabase
        .from("orders")
        .select(`
            id,
            order_id,
            order_date,
            order_time,
            customer_count,
            status,
            operator_name
        `)
        .order(
            "order_date",
            {
                ascending: true
            }
        )
        .order(
            "order_time",
            {
                ascending: true
            }
        );


    if (ordersError) {
        throw ordersError;
    }


    const activeOrders =
        (orders || []).filter(
            order =>
                order.status !==
                "cancelled"
        );


    const orderIds =
        activeOrders.map(
            order =>
                order.id
        );


    if (!orderIds.length) {

        return [

            [
                "注文番号",
                "営業日",
                "注文時刻",
                "来客数",
                "売上"
            ]

        ];

    }


    const {
        data: items,
        error: itemsError
    } = await supabase
        .from("order_items")
        .select(`
            order_id,
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


    const itemMap =
        new Map();


    (items || []).forEach(
        item => {

            const orderId =
                Number(
                    item.order_id
                );


            const current =
                itemMap.get(
                    orderId
                ) || 0;


            itemMap.set(
                orderId,
                current +
                (
                    Number(
                        item.quantity
                    ) || 0
                ) *
                (
                    Number(
                        item.unit_price
                    ) || 0
                )
            );

        }
    );


    return [

        [
            "注文番号",
            "営業日",
            "注文時刻",
            "来客数",
            "売上"
        ],

        ...activeOrders.map(
            order => [

                order.order_id,
                order.order_date,
                order.order_time,
                order.customer_count,
                itemMap.get(
                    Number(order.id)
                ) || 0

            ]
        )

    ];

}


/* ========================================
   CSVダウンロード
======================================== */

function downloadCSV(
    rows,
    filename
) {

    const csv =
        rows
            .map(
                row =>
                    row
                        .map(
                            value =>
                                escapeCSVValue(
                                    value
                                )
                        )
                        .join(",")
            )
            .join("\r\n");


    const bom =
        "\uFEFF";


    const blob =
        new Blob(
            [
                bom,
                csv
            ],
            {
                type:
                    "text/csv;charset=utf-8;"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href =
        url;

    link.download =
        filename;

    link.style.display =
        "none";


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();


    URL.revokeObjectURL(
        url
    );

}


/* ========================================
   CSVエスケープ
======================================== */

function escapeCSVValue(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    let text;


    if (
        typeof value ===
        "object"
    ) {

        text =
            JSON.stringify(
                value
            );

    } else {

        text =
            String(value);

    }


    return (
        `"${text.replace(
            /"/g,
            '""'
        )}"`
    );

}


/* ========================================
   PDF出力
======================================== */

export async function exportPDF() {

    try {

        const data =
            await getPDFData();

        openPDFPreview(
            createPDFDocument(data)
        );

    } catch (error) {

        console.error(
            "PDF出力エラー:",
            error
        );

        showOutputError(
            "PDFを出力できませんでした。"
        );

    }

}


function openPDFPreview(html) {

    closePDFPreview();

    const overlay = document.createElement("div");
    overlay.className = "operation-guide-preview-overlay";
    overlay.id = "outputPdfPreviewOverlay";

    overlay.innerHTML = `
        <div
            class="operation-guide-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="outputPdfPreviewTitle"
        >
            <div class="operation-guide-preview-header">
                <h2 id="outputPdfPreviewTitle">データ出力</h2>

                <button
                    type="button"
                    class="operation-guide-preview-close"
                    id="outputPdfPreviewClose"
                    aria-label="閉じる"
                >
                    ×
                </button>
            </div>

            <div class="operation-guide-preview-body">
                <iframe
                    class="operation-guide-preview-frame"
                    id="outputPdfPreviewFrame"
                    title="データ出力PDF"
                ></iframe>
            </div>

            <div class="operation-guide-preview-actions" style="gap: 12px;">
                <button
                    type="button"
                    class="secondary-button"
                    id="outputPdfPreviewDownload"
                >
                    ダウンロード
                </button>

                <button
                    type="button"
                    class="primary-button operation-guide-preview-open"
                    id="outputPdfPreviewPrint"
                >
                    出力
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const frame = document.getElementById(
        "outputPdfPreviewFrame"
    );

    const printButton = document.getElementById(
        "outputPdfPreviewPrint"
    );

    const downloadButton = document.getElementById(
        "outputPdfPreviewDownload"
    );

    const closeButton = document.getElementById(
        "outputPdfPreviewClose"
    );

    const frameDocument =
        frame?.contentDocument ||
        frame?.contentWindow?.document;

    if (frameDocument) {
        frameDocument.open();
        frameDocument.write(html);
        frameDocument.close();
    }

    printButton?.addEventListener(
        "click",
        () => {
            frame?.contentWindow?.focus();
            frame?.contentWindow?.print();
        }
    );

    downloadButton?.addEventListener(
        "click",
        async () => {
            await downloadPreviewPDF(
                frame,
                downloadButton
            );
        }
    );

    closeButton?.addEventListener(
        "click",
        closePDFPreview
    );

    overlay.addEventListener(
        "click",
        (event) => {
            if (event.target === overlay) {
                closePDFPreview();
            }
        }
    );

    document.addEventListener(
        "keydown",
        handlePDFPreviewKeydown
    );

    requestAnimationFrame(() => {
        overlay.classList.add("is-visible");
        closeButton?.focus();
    });

}


async function downloadPreviewPDF(frame, button) {

    const frameWindow =
        frame?.contentWindow;

    const frameDocument =
        frame?.contentDocument ||
        frameWindow?.document;

    if (!frameWindow || !frameDocument?.body) {
        showOutputError(
            "PDFをダウンロードできませんでした。"
        );
        return;
    }

    const originalText =
        button?.textContent;

    if (button) {
        button.disabled = true;
        button.textContent = "準備中";
    }

    try {

        await loadHtml2PdfInPreview(
            frameWindow,
            frameDocument
        );

        const target =
            frameDocument.querySelector(
                ".document"
            ) ||
            frameDocument.body;

        const filename =
            `法マス喫茶_売上・運営実績報告書_${getTodayJST()}.pdf`;

        await frameWindow
            .html2pdf()
            .set({
                margin: 14,
                filename,
                image: {
                    type: "jpeg",
                    quality: 0.98
                },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: "#ffffff"
                },
                jsPDF: {
                    unit: "mm",
                    format: "a4",
                    orientation: "portrait"
                },
                pagebreak: {
                    mode: [
                        "css",
                        "legacy"
                    ]
                }
            })
            .from(target)
            .save();

    } catch (error) {

        console.error(
            "PDFダウンロードエラー:",
            error
        );

        showOutputError(
            "PDFをダウンロードできませんでした。"
        );

    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText || "ダウンロード";
        }
    }

}


function loadHtml2PdfInPreview(
    frameWindow,
    frameDocument
) {

    if (
        typeof frameWindow.html2pdf ===
        "function"
    ) {
        return Promise.resolve();
    }

    return new Promise(
        (resolve, reject) => {

            const existing =
                frameDocument.getElementById(
                    "html2pdfBundleScript"
                );

            if (existing) {
                existing.addEventListener(
                    "load",
                    resolve,
                    { once: true }
                );
                existing.addEventListener(
                    "error",
                    reject,
                    { once: true }
                );
                return;
            }

            const script =
                frameDocument.createElement(
                    "script"
                );

            script.id =
                "html2pdfBundleScript";

            script.src =
                "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";

            script.onload =
                () => resolve();

            script.onerror =
                () => reject(
                    new Error(
                        "PDF生成ライブラリを読み込めませんでした。"
                    )
                );

            frameDocument.head.appendChild(
                script
            );

        }
    );

}

function handlePDFPreviewKeydown(event) {
    if (event.key === "Escape") {
        closePDFPreview();
    }
}


function closePDFPreview() {

    const overlay =
        document.getElementById(
            "outputPdfPreviewOverlay"
        );

    if (overlay) {
        const focused = document.activeElement;
        if (focused instanceof HTMLElement) {
            focused.blur();
        }
        overlay.remove();
    }

    document.removeEventListener(
        "keydown",
        handlePDFPreviewKeydown
    );

}


/* ========================================
   PDFデータ
======================================== */

async function getPDFData() {

    const today = getTodayJST();

    const {
        data: orders,
        error: ordersError
    } = await supabase
        .from("orders")
        .select(`
            id,
            order_date,
            customer_count,
            status
        `);

    if (ordersError) {
        throw ordersError;
    }

    const activeOrders =
        (orders || []).filter(
            order =>
                order.status !== "cancelled"
        );

    const orderIds =
        activeOrders.map(
            order => order.id
        );

    let sales = 0;
    let items = [];

    if (orderIds.length) {

        const {
            data: itemData,
            error: itemsError
        } = await supabase
            .from("order_items")
            .select(`
                order_id,
                product_id,
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

        items = itemData || [];

        sales =
            items.reduce(
                (total, item) =>
                    total +
                    (Number(item.quantity) || 0) *
                    (Number(item.unit_price) || 0),
                0
            );
    }

    const productIds =
        [
            ...new Set(
                items
                    .map(item => item.product_id)
                    .filter(value => value !== null && value !== undefined)
            )
        ];

    const productNameMap = new Map();

    if (productIds.length) {

        const {
            data: products,
            error: productsError
        } = await supabase
            .from("products")
            .select(`
                id,
                name
            `)
            .in(
                "id",
                productIds
            );

        if (productsError) {
            throw productsError;
        }

        (products || []).forEach(
            product => {
                productNameMap.set(
                    String(product.id),
                    product.name || `商品ID ${product.id}`
                );
            }
        );
    }

    const productSalesMap = new Map();

    items.forEach(
        item => {

            const key = String(item.product_id ?? "");
            const quantity = Number(item.quantity) || 0;
            const unitPrice = Number(item.unit_price) || 0;
            const amount = quantity * unitPrice;

            const current =
                productSalesMap.get(key) || {
                    productId: item.product_id,
                    name:
                        productNameMap.get(key) ||
                        `商品ID ${item.product_id ?? "-"}`,
                    quantity: 0,
                    sales: 0
                };

            current.quantity += quantity;
            current.sales += amount;

            productSalesMap.set(
                key,
                current
            );
        }
    );

    const productSales =
        [...productSalesMap.values()]
            .sort(
                (a, b) =>
                    b.sales - a.sales ||
                    String(a.name).localeCompare(
                        String(b.name),
                        "ja"
                    )
            );

    const {
        data: expenses,
        error: expensesError
    } = await supabase
        .from("expenses")
        .select("amount");

    if (expensesError) {
        throw expensesError;
    }

    const totalExpenses =
        (expenses || []).reduce(
            (total, expense) =>
                total +
                (Number(expense.amount) || 0),
            0
        );

    const visitorCount =
        activeOrders.reduce(
            (total, order) =>
                total +
                (Number(order.customer_count) || 0),
            0
        );

    const profit =
        sales - totalExpenses;

    const averageOrderAmount =
        activeOrders.length
            ? Math.round(sales / activeOrders.length)
            : 0;

    const averageCustomerAmount =
        visitorCount
            ? Math.round(sales / visitorCount)
            : 0;

    return {
        date: today,
        sales,
        expenses: totalExpenses,
        profit,
        orderCount: activeOrders.length,
        visitorCount,
        averageOrderAmount,
        averageCustomerAmount,
        productSales
    };
}


/* ========================================
   PDF HTML
======================================== */

function createPDFDocument(
    data
) {

    const productRows =
        (data.productSales || []).length
            ? data.productSales
                .map(
                    (product, index) => `
                        <tr>
                            <td class="number-cell">${index + 1}</td>
                            <td>${escapeHTML(product.name)}</td>
                            <td class="number-cell">${formatNumber(product.quantity)}</td>
                            <td class="number-cell">${formatYen(product.sales)}</td>
                            <td class="number-cell">${formatPercent(product.sales, data.sales)}</td>
                        </tr>
                    `
                )
                .join("")
            : `
                <tr>
                    <td colspan="5" class="empty-cell">
                        対象となる販売データはありません。
                    </td>
                </tr>
            `;

    return `<!DOCTYPE html>

<html lang="ja">

<head>

<meta charset="UTF-8">

<title>法マス喫茶 売上・運営実績報告書</title>

<style>

@page {
    size: A4 portrait;
    margin: 13mm 14mm 14mm;
}

* {
    box-sizing: border-box;
}

html,
body {
    margin: 0;
    padding: 0;
    font-family:
        "Yu Gothic",
        "Hiragino Kaku Gothic ProN",
        "Meiryo",
        sans-serif;
    color: #20252b;
    background: #ffffff;
    font-size: 10.5px;
    line-height: 1.45;
}

body {
    width: 100%;
}

.document {
    width: 100%;
}

.document-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8mm;
    padding-bottom: 5mm;
    border-bottom: 0.5mm solid #303840;
}

.document-title {
    margin: 0;
    font-size: 19px;
    font-weight: 700;
    letter-spacing: 0.04em;
}

.document-subtitle {
    margin: 1.5mm 0 0;
    color: #66717c;
    font-size: 9.5px;
}

.document-meta {
    min-width: 45mm;
    text-align: right;
    color: #4f5963;
    font-size: 9px;
}

.document-meta div + div {
    margin-top: 1mm;
}

.section {
    margin-top: 7mm;
    break-inside: avoid;
}

.section-title {
    margin: 0 0 3mm;
    padding: 0 0 1.7mm;
    border-bottom: 0.3mm solid #9ca5ad;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.04em;
}

.summary-table,
.detail-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
}

.summary-table th,
.summary-table td,
.detail-table th,
.detail-table td {
    border: 0.25mm solid #c7cdd2;
}

.summary-table th {
    width: 22%;
    padding: 2.6mm 3mm;
    background: #eef1f3;
    color: #3f4952;
    text-align: left;
    font-weight: 600;
}

.summary-table td {
    width: 28%;
    padding: 2.6mm 3mm;
    text-align: right;
    font-size: 12px;
    font-weight: 700;
}

.summary-table .profit-value {
    font-size: 14px;
}

.detail-table thead {
    display: table-header-group;
}

.detail-table tr {
    break-inside: avoid;
}

.detail-table th {
    padding: 2.3mm 2.5mm;
    background: #e7ebee;
    color: #303840;
    text-align: left;
    font-size: 9.5px;
    font-weight: 700;
}

.detail-table td {
    padding: 2.2mm 2.5mm;
    vertical-align: middle;
}

.detail-table th:nth-child(1),
.detail-table td:nth-child(1) {
    width: 9%;
}

.detail-table th:nth-child(2),
.detail-table td:nth-child(2) {
    width: 39%;
}

.detail-table th:nth-child(3),
.detail-table td:nth-child(3) {
    width: 16%;
}

.detail-table th:nth-child(4),
.detail-table td:nth-child(4) {
    width: 20%;
}

.detail-table th:nth-child(5),
.detail-table td:nth-child(5) {
    width: 16%;
}

.number-cell {
    text-align: right;
    font-variant-numeric: tabular-nums;
}

.empty-cell {
    padding: 7mm !important;
    color: #727c85;
    text-align: center;
}

.note {
    margin: 2mm 0 0;
    color: #707981;
    font-size: 8.5px;
}

.document-footer {
    margin-top: 9mm;
    padding-top: 3mm;
    border-top: 0.25mm solid #c7cdd2;
    color: #737d86;
    font-size: 8.5px;
    text-align: right;
}

@media print {
    body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
}

</style>

</head>

<body>

<div class="document">

    <header class="document-header">

        <div>
            <h1 class="document-title">
                法マス喫茶 売上・運営実績報告書
            </h1>

            <p class="document-subtitle">
                売上・支出・来場実績および商品別販売実績
            </p>
        </div>

        <div class="document-meta">
            <div>
                出力日：
                ${escapeHTML(
                    formatDateJapanese(
                        data.date
                    )
                )}
            </div>

            <div>
                法政大学アイドルマスター研究会
            </div>
        </div>

    </header>


    <section class="section">

        <h2 class="section-title">
            1. 集計概要
        </h2>

        <table class="summary-table">
            <tbody>

                <tr>
                    <th>売上高</th>
                    <td>${formatYen(data.sales)}</td>

                    <th>支出額</th>
                    <td>${formatYen(data.expenses)}</td>
                </tr>

                <tr>
                    <th>利益</th>
                    <td class="profit-value">${formatYen(data.profit)}</td>

                    <th>注文件数</th>
                    <td>${formatNumber(data.orderCount)} 件</td>
                </tr>

                <tr>
                    <th>来場者数</th>
                    <td>${formatNumber(data.visitorCount)} 人</td>

                    <th>平均注文額</th>
                    <td>${formatYen(data.averageOrderAmount)}</td>
                </tr>

                <tr>
                    <th>来場者1人当たり売上</th>
                    <td>${formatYen(data.averageCustomerAmount)}</td>

                    <th>商品種類数</th>
                    <td>${formatNumber((data.productSales || []).length)} 種</td>
                </tr>

            </tbody>
        </table>

    </section>


    <section class="section">

        <h2 class="section-title">
            2. 商品別売上実績
        </h2>

        <table class="detail-table">

            <thead>
                <tr>
                    <th>No.</th>
                    <th>商品名</th>
                    <th class="number-cell">販売数</th>
                    <th class="number-cell">売上高</th>
                    <th class="number-cell">売上構成比</th>
                </tr>
            </thead>

            <tbody>
                ${productRows}
            </tbody>

        </table>

        <p class="note">
            ※ キャンセル済み注文は集計対象から除外しています。
        </p>

    </section>


    <footer class="document-footer">
        法マス喫茶 総合管理システム
    </footer>

</div>

</body>

</html>`;

}


function formatPercent(
    value,
    total
) {

    const numberValue =
        Number(value) || 0;

    const numberTotal =
        Number(total) || 0;

    if (!numberTotal) {
        return "0.0%";
    }

    return (
        (
            numberValue /
            numberTotal *
            100
        ).toFixed(1) +
        "%"
    );
}


/* ========================================
   日付・表示
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


function formatYen(
    value
) {

    return (
        `¥${(
            Number(value) || 0
        ).toLocaleString(
            "ja-JP"
        )}`
    );

}


function formatNumber(
    value
) {

    return (
        Number(value) || 0
    ).toLocaleString(
        "ja-JP"
    );

}


function stringifyJSON(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    if (
        typeof value ===
        "string"
    ) {

        return value;

    }


    try {

        return JSON.stringify(
            value
        );

    } catch {

        return String(value);

    }

}


/* ========================================
   HTMLエスケープ
======================================== */

function escapeHTML(
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
   ファイル名
======================================== */

function createFilename(
    prefix
) {

    return (
        `${prefix}_` +
        `${getTodayJST()}.csv`
    );

}


/* ========================================
   メッセージ
======================================== */

function showOutputMessage(
    message
) {

    document.dispatchEvent(
        new CustomEvent(
            "app:toast",
            {
                detail: {
                    message:
                        message,
                    type:
                        "success"
                }
            }
        )
    );

}


function showOutputError(
    message
) {

    document.dispatchEvent(
        new CustomEvent(
            "app:toast",
            {
                detail: {
                    message:
                        message,
                    type:
                        "error"
                }
            }
        )
    );

}


/* ========================================
   更新
======================================== */

export function refreshOutput() {
    return true;
}
