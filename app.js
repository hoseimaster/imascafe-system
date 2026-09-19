insert into public.system_settings (key, value, description)
values (
    'order_accepting',
    'true'::jsonb,
    '注文受付状態（true=受付中、false=停止中）'
)
on conflict (key) do nothing;

create or replace function public.enforce_order_accepting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_accepting boolean;
begin
    select case
        when jsonb_typeof(value) = 'boolean' then (value #>> '{}')::boolean
        else false
    end
    into v_accepting
    from public.system_settings
    where key = 'order_accepting';

    if coalesce(v_accepting, false) is not true then
        raise exception '現在、注文受付を停止しています';
    end if;

    new.order_date := coalesce(
        new.order_date,
        (now() at time zone 'Asia/Tokyo')::date
    );
    return new;
end;
$function$;

drop trigger if exists trg_enforce_order_accepting on public.orders;

create trigger trg_enforce_order_accepting
before insert on public.orders
for each row
execute function public.enforce_order_accepting();
