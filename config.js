export const SUPABASE_URL =
    "https://lqxjtgxlohjyjznkewhm.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_hVHD916iPfgOvE62RPmS-w_WM5tCFKn";

export const APP_CONFIG = {
    APP_NAME: "法マス喫茶 総合管理システム",

    TIME_ZONE: "Asia/Tokyo",

    SECURITY: {
        IDLE_LOGOUT_MINUTES: 30
    },

    ORDER_ID_PREFIX: "ORD-",

    ORDER_ID_PAD_LENGTH: 6,

    SESSION_STORAGE_KEY:
        "hoseimaster_cafe_session",

    OPERATOR_NAME_STORAGE_KEY:
        "hoseimaster_cafe_operator_name",

    TERMINAL_STORAGE_KEY:
        "hoseimaster_cafe_terminal",

    CURRENT_EVENT_DAY_STORAGE_KEY:
        "hoseimaster_cafe_current_event_day",

    CURRENT_OPERATOR_STORAGE_KEY:
        "hoseimaster_cafe_current_operator",

    CURRENT_ROLE_STORAGE_KEY:
        "hoseimaster_cafe_current_role",

    ROLES: {
        ADMIN: "admin",
        STAFF: "staff",
        VIEWER: "viewer"
    },

    ROLE_LABELS: {
        admin: "管理者",
        staff: "スタッフ",
        viewer: "閲覧者"
    },

    NAVIGATION: {
        ADMIN: [
            "home",
            "orders",
            "inventory",
            "history",
            "statistics",
            "products",
            "event-days",
            "settings"
        ],

        STAFF: [
            "home",
            "orders",
            "inventory",
            "history",
            "statistics",
            "settings"
        ],

        VIEWER: [
            "home",
            "statistics",
            "settings"
        ]
    },

    FEATURES: {
        INVENTORY_AUTO_DEDUCTION: true,

        SOLD_OUT_CONTROL: true,

        ORDER_CANCEL: true,

        ORDER_RESTORE: true,

        OPERATION_HISTORY: true,

        LOGIN_HISTORY: true,

        EXPENSE_MANAGEMENT: true,

        PROFIT_DISPLAY: true,

        BREAK_EVEN_CALCULATION: true,

        EVENT_DAY_MANAGEMENT: true,

        EVENT_DAY_CLOSING: true,

        REALTIME_UPDATE: true,

        SEARCH: true,

        CSV_EXPORT: true,

        PDF_EXPORT: true,

        BACKUP: true,

        ANOMALY_DETECTION: true,

        DATA_INTEGRITY_CHECK: true
    },

    ANOMALY_DETECTION: {
        ENABLED: true,

        SHOW_IN_SETTINGS: true,

        VIEWER_CAN_VIEW: true,

        STAFF_CAN_VIEW: true,

        ADMIN_CAN_CONFIGURE: true
    },

    INVENTORY: {
        AUTO_DEDUCT_ON_ORDER: true,

        ALLOW_MANUAL_ADJUSTMENT: true,

        ENABLE_STOCK_LEVEL_COLOR: true,

        ENABLE_SOLD_OUT_CONTROL: true,

        STOCK_LEVELS: {
            CRITICAL: 0,
            WARNING: 5
        }
    },

    PRODUCT: {
        REQUIRE_PROVIDED_QUANTITY: true,

        PROVIDED_QUANTITY_DEFAULT: 1,

        PROVIDED_QUANTITY_MIN: 1
    },

    ORDER: {
        LATEST_ORDER_LIMIT: 3,

        ALLOW_CANCEL: true,

        ALLOW_RESTORE: true
    },

    HISTORY: {
        SHOW_OPERATOR_NAME: true,

        SHOW_ROLE: false,

        RECORD_LOGIN_LOGOUT: true,

        RECORD_DATA_CHANGES: true,

        RECORD_BEFORE_AFTER: true
    },

    EXPENSE: {
        ENABLED: true,

        CATEGORIES: [
            "食材費",
            "材料費",
            "備品",
            "印刷費",
            "その他"
        ]
    },

    OUTPUT: {
        CSV_ENABLED: true,

        PDF_ENABLED: true,

        PDF_PAGE_SIZE: "A4"
    },

    UI: {
        MOBILE_BREAKPOINT: 600,

        TABLET_BREAKPOINT: 1023,

        TOUCH_TARGET_MIN_SIZE: 44
    }
};
