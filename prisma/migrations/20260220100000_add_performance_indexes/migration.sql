-- Performance indexes: add missing FK and composite indexes to avoid full table scans

-- Users: index on unitId (resident-unit lookup), email (cross-tenant login), tenant+active filter
CREATE INDEX IF NOT EXISTS "users_unit_id_idx" ON "users" ("unit_id");
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");
CREATE INDEX IF NOT EXISTS "users_tenant_id_is_active_idx" ON "users" ("tenant_id", "is_active");

-- Visitors: index on email (duplicate check / search)
CREATE INDEX IF NOT EXISTS "visitors_email_idx" ON "visitors" ("email");

-- Visits: index on FK columns for JOIN performance
CREATE INDEX IF NOT EXISTS "visits_visitor_id_idx" ON "visits" ("visitor_id");
CREATE INDEX IF NOT EXISTS "visits_host_user_id_idx" ON "visits" ("host_user_id");

-- Staff: composite index for tenant + active filter
CREATE INDEX IF NOT EXISTS "staff_tenant_id_is_active_idx" ON "staff" ("tenant_id", "is_active");

-- Vehicles: index on FK columns
CREATE INDEX IF NOT EXISTS "vehicles_owner_id_idx" ON "vehicles" ("owner_id");
CREATE INDEX IF NOT EXISTS "vehicles_unit_id_idx" ON "vehicles" ("unit_id");

-- Space Assignments: index on assignee lookups
CREATE INDEX IF NOT EXISTS "space_assignments_assignee_id_idx" ON "space_assignments" ("assignee_id");

-- Maintenance: index on FK columns
CREATE INDEX IF NOT EXISTS "maintenance_assigned_to_user_id_idx" ON "maintenance" ("assigned_to_user_id");
CREATE INDEX IF NOT EXISTS "maintenance_unit_id_idx" ON "maintenance" ("unit_id");

-- Tasks: index on assignee
CREATE INDEX IF NOT EXISTS "tasks_assigned_to_user_id_idx" ON "tasks" ("assigned_to_user_id");

-- Calendar Events: composite index for date range queries
CREATE INDEX IF NOT EXISTS "calendar_events_tenant_id_start_at_idx" ON "calendar_events" ("tenant_id", "start_at");

-- Documents: index on uploader FK
CREATE INDEX IF NOT EXISTS "documents_uploaded_by_user_id_idx" ON "documents" ("uploaded_by_user_id");

-- Packages: index on unit FK
CREATE INDEX IF NOT EXISTS "packages_unit_id_idx" ON "packages" ("unit_id");

-- BOLOs: index on creator FK
CREATE INDEX IF NOT EXISTS "bolos_created_by_id_idx" ON "bolos" ("created_by_id");
