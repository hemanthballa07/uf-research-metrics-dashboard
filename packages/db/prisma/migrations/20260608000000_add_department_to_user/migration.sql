-- Add optional department scoping to users.
-- Nullable FK so existing users and global admins have no restriction (NULL = no scope).
-- onDelete: SetNull so deleting a department doesn't cascade-delete its admins.
ALTER TABLE "users" ADD COLUMN "departmentId" INTEGER;
ALTER TABLE "users" ADD CONSTRAINT "users_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "users_departmentId_idx" ON "users"("departmentId");
