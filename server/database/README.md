# Database scripts

## PostgreSQL/Supabase runtime

| Thành phần | Vai trò |
|---|---|
| `postgres/migrations/001_initial_schema.sql` | Schema `app`, constraints/indexes, hàm order và view; không destructive |
| `postgres/migrations/002_runtime_permissions.sql` | Revoke PUBLIC/Data API roles, grant tối thiểu cho `app_runtime` |
| `postgres/apply-schema.js` | Runner `MIGRATION_DATABASE_URL`, advisory lock, transaction/version/checksum |
| `postgres/seed.js` | Validate và seed catalog/promo idempotent; không seed đơn lịch sử |

Chạy theo `server/docs/DATABASE.md`. Runtime không tự gọi migration/seed.

## SQL Server legacy

Các file T-SQL, `bootstrap-ci.js`, `generate-safe-seed.cjs` và `least-privilege.sql` chỉ được giữ để
audit/import. Backend hiện tại không gọi chúng. Workflow GitHub SQL Server cũ nằm ngoài phạm vi task này.
