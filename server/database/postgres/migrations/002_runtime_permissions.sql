REVOKE ALL ON SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;

DO $block$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'app_runtime') THEN
    RAISE EXCEPTION 'Role app_runtime chưa tồn tại. Tạo login/password ngoài repo trước khi chạy migration 002.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA app FROM anon;
    REVOKE ALL ON ALL TABLES IN SCHEMA app FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA app FROM anon;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON SCHEMA app FROM authenticated;
    REVOKE ALL ON ALL TABLES IN SCHEMA app FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA app FROM authenticated;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM authenticated;
  END IF;
END
$block$;

DO $block$
BEGIN
  EXECUTE pg_catalog.format('GRANT CONNECT ON DATABASE %I TO app_runtime', pg_catalog.current_database());
END
$block$;

GRANT USAGE ON SCHEMA app TO app_runtime;
GRANT USAGE ON SCHEMA extensions TO app_runtime;
GRANT SELECT ON app.categories, app.products, app.product_images, app.product_specs
  TO app_runtime;
GRANT EXECUTE ON FUNCTION extensions.unaccent(text) TO app_runtime;
GRANT EXECUTE ON FUNCTION app.fn_tao_don_hang(text, text, text, text, text, text, text, jsonb)
  TO app_runtime;
