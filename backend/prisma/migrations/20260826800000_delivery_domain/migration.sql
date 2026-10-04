CREATE TABLE `courier_profiles` (
  `user_id` CHAR(36) NOT NULL, `max_active_deliveries` INTEGER NOT NULL DEFAULT 30, `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`user_id`), CONSTRAINT `courier_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `courier_availabilities` (
  `id` CHAR(36) NOT NULL, `courier_user_id` CHAR(36) NOT NULL, `start_at` DATETIME(3) NOT NULL, `end_at` DATETIME(3) NULL, `reason` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
  INDEX `courier_availabilities_courier_user_id_start_at_idx` (`courier_user_id`, `start_at`), INDEX `courier_availabilities_courier_user_id_end_at_idx` (`courier_user_id`, `end_at`),
  CONSTRAINT `courier_availabilities_courier_user_id_fkey` FOREIGN KEY (`courier_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `delivery_batches` (
  `id` CHAR(36) NOT NULL, `courier_user_id` CHAR(36) NOT NULL, `delivery_date` DATE NOT NULL, `cutoff_at` DATETIME(3) NOT NULL, `dispatch_at` DATETIME(3) NOT NULL,
  `status` ENUM('PLANNED','READY','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PLANNED', `started_at` DATETIME(3) NULL, `completed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NOT NULL, PRIMARY KEY (`id`),
  INDEX `delivery_batches_courier_user_id_delivery_date_idx` (`courier_user_id`, `delivery_date`), INDEX `delivery_batches_delivery_date_status_idx` (`delivery_date`, `status`),
  CONSTRAINT `delivery_batches_courier_user_id_fkey` FOREIGN KEY (`courier_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `delivery_batch_orders` (
  `id` CHAR(36) NOT NULL, `delivery_batch_id` CHAR(36) NOT NULL, `commerce_order_id` CHAR(36) NOT NULL, `pickup_sequence` INTEGER NULL, `delivery_sequence` INTEGER NULL,
  `status` ENUM('WAITING_PICKUP','PICKED_UP','OUT_FOR_DELIVERY','DELIVERED','FAILED','CANCELLED') NOT NULL DEFAULT 'WAITING_PICKUP',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NOT NULL, PRIMARY KEY (`id`),
  UNIQUE INDEX `delivery_batch_orders_delivery_batch_id_commerce_order_id_key` (`delivery_batch_id`, `commerce_order_id`), INDEX `delivery_batch_orders_commerce_order_id_status_idx` (`commerce_order_id`, `status`), INDEX `delivery_batch_orders_delivery_batch_id_status_idx` (`delivery_batch_id`, `status`),
  CONSTRAINT `delivery_batch_orders_delivery_batch_id_fkey` FOREIGN KEY (`delivery_batch_id`) REFERENCES `delivery_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `delivery_batch_orders_commerce_order_id_fkey` FOREIGN KEY (`commerce_order_id`) REFERENCES `commerce_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `pickup_confirmations` (
  `id` CHAR(36) NOT NULL, `commerce_order_id` CHAR(36) NOT NULL, `merchant_user_id` CHAR(36) NOT NULL, `courier_user_id` CHAR(36) NOT NULL, `is_ready` BOOLEAN NOT NULL, `note` TEXT NULL,
  `confirmed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), INDEX `pickup_confirmations_commerce_order_id_confirmed_at_idx` (`commerce_order_id`, `confirmed_at`), INDEX `pickup_confirmations_courier_user_id_idx` (`courier_user_id`),
  CONSTRAINT `pickup_confirmations_commerce_order_id_fkey` FOREIGN KEY (`commerce_order_id`) REFERENCES `commerce_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `pickup_confirmations_merchant_user_id_fkey` FOREIGN KEY (`merchant_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `pickup_confirmations_courier_user_id_fkey` FOREIGN KEY (`courier_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `delivery_proofs` (
  `id` CHAR(36) NOT NULL, `commerce_order_id` CHAR(36) NOT NULL, `courier_user_id` CHAR(36) NOT NULL, `photo_url` VARCHAR(1000) NOT NULL, `recipient_name` VARCHAR(255) NULL, `note` TEXT NULL,
  `delivered_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), UNIQUE INDEX `delivery_proofs_commerce_order_id_key` (`commerce_order_id`), INDEX `delivery_proofs_courier_user_id_idx` (`courier_user_id`),
  CONSTRAINT `delivery_proofs_commerce_order_id_fkey` FOREIGN KEY (`commerce_order_id`) REFERENCES `commerce_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `delivery_proofs_courier_user_id_fkey` FOREIGN KEY (`courier_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `delivery_activities` (
  `id` CHAR(36) NOT NULL, `commerce_order_id` CHAR(36) NOT NULL, `courier_user_id` CHAR(36) NULL, `status` VARCHAR(50) NOT NULL, `note` TEXT NULL, `metadata` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), INDEX `delivery_activities_commerce_order_id_created_at_idx` (`commerce_order_id`, `created_at`), INDEX `delivery_activities_courier_user_id_idx` (`courier_user_id`),
  CONSTRAINT `delivery_activities_commerce_order_id_fkey` FOREIGN KEY (`commerce_order_id`) REFERENCES `commerce_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `delivery_activities_courier_user_id_fkey` FOREIGN KEY (`courier_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
