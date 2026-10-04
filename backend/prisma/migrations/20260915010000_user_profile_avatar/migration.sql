-- Persist one shared profile photo for every account and workspace role.

ALTER TABLE `users`
  ADD COLUMN `avatar_url` VARCHAR(500) NULL;

ALTER TABLE `User`
  ADD COLUMN `avatarUrl` VARCHAR(500) NULL;
