-- CreateIndex
CREATE INDEX "tasks_tenant_id_status_idx" ON "tasks"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "units_tenant_id_status_idx" ON "units"("tenant_id", "status");
