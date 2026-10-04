ALTER TABLE `stores`
  ADD COLUMN `approval_status` VARCHAR(16) NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN `rejection_reason` VARCHAR(500) NULL,
  ADD COLUMN `reviewed_at` DATETIME(3) NULL,
  ADD COLUMN `reviewed_by_user_id` CHAR(36) NULL;
