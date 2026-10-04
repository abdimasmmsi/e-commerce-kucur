-- Account security policy metadata. Existing accounts use createdAt as the
-- password-age fallback until their next successful password change.

ALTER TABLE `users`
  ADD COLUMN `password_changed_at` DATETIME(3) NULL,
  ADD COLUMN `password_reset_required` BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE `User`
  ADD COLUMN `passwordChangedAt` DATETIME(3) NULL,
  ADD COLUMN `passwordResetRequired` BOOLEAN NOT NULL DEFAULT FALSE;
