-- Keep database defaults aligned with the application default: English and light mode.
-- This changes defaults only; existing user choices are not overwritten.

ALTER TABLE `users`
  MODIFY `language` VARCHAR(2) NOT NULL DEFAULT 'en',
  MODIFY `theme` VARCHAR(5) NOT NULL DEFAULT 'light';

ALTER TABLE `User`
  MODIFY `language` ENUM('id','en') NOT NULL DEFAULT 'en',
  MODIFY `theme` ENUM('light','dark') NOT NULL DEFAULT 'light';
