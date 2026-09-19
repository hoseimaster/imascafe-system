CREATE OR REPLACE FUNCTION public.get_reset_event_days()
RETURNS TABLE(
    id bigint,
    event_date date,
    label text,
    display_order integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.active = true
          AND profiles.role IN ('super_admin', 'admin')
    ) THEN
        RAISE EXCEPTION '管理者権限が必要です';
    END IF;


    RETURN QUERY
    SELECT
        MAX(ed.id) AS id,
        o.order_date AS event_date,
        MAX(ed.label) AS label,
        COALESCE(
            MIN(ed.display_order),
            2147483647
        ) AS display_order
    FROM public.orders AS o

    LEFT JOIN public.event_days AS ed
        ON ed.event_date = o.order_date

    WHERE o.order_date IS NOT NULL

    GROUP BY
        o.order_date

    ORDER BY
        COALESCE(
            MIN(ed.display_order),
            2147483647
        ),
        o.order_date;

END;
$function$;
