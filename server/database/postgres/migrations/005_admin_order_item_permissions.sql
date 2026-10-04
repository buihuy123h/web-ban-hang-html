-- 005: Admin order listings read order item snapshots through the runtime role.
GRANT SELECT ON app.order_items TO app_runtime;