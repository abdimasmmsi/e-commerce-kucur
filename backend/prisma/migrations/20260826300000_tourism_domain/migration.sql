-- DropForeignKey
ALTER TABLE `platform_transactions` DROP FOREIGN KEY `platform_transactions_source_entity_id_fkey`;

-- AlterTable
ALTER TABLE `payment_attempts` ADD COLUMN `platform_transaction_id` CHAR(36) NULL,
    MODIFY `order_id` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `platform_transactions` ADD COLUMN `commerce_order_id` CHAR(36) NULL;

UPDATE `platform_transactions` SET `commerce_order_id` = `source_entity_id` WHERE `type` = 'COMMERCE';

-- AlterTable
ALTER TABLE `stores` MODIFY `type` ENUM('product', 'educational-tourism', 'tourism', 'live-in') NOT NULL;
UPDATE `stores` SET `type` = 'tourism' WHERE `type` = 'educational-tourism';
ALTER TABLE `stores` MODIFY `type` ENUM('product', 'tourism', 'live-in') NOT NULL;

-- CreateTable
CREATE TABLE `tourism_packages` (
    `id` CHAR(36) NOT NULL,
    `store_id` CHAR(36) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `category` VARCHAR(24) NOT NULL,
    `description` TEXT NOT NULL,
    `duration_minutes` INTEGER NOT NULL,
    `price_per_pax` DECIMAL(14, 2) NOT NULL,
    `sig_location_id` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `tourism_packages_store_id_is_active_idx`(`store_id`, `is_active`),
    INDEX `tourism_packages_category_is_active_idx`(`category`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tourism_schedules` (
    `id` CHAR(36) NOT NULL,
    `tourism_package_id` CHAR(36) NOT NULL,
    `start_at` DATETIME(3) NOT NULL,
    `capacity` INTEGER NOT NULL,
    `reserved_pax` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(24) NOT NULL DEFAULT 'AVAILABLE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `tourism_schedules_tourism_package_id_start_at_idx`(`tourism_package_id`, `start_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tourism_bookings` (
    `id` CHAR(36) NOT NULL,
    `platform_transaction_id` CHAR(36) NOT NULL,
    `customer_user_id` CHAR(36) NOT NULL,
    `tourism_package_id` CHAR(36) NOT NULL,
    `tourism_schedule_id` CHAR(36) NULL,
    `group_request_id` CHAR(36) NULL,
    `booking_code` VARCHAR(40) NOT NULL,
    `booking_type` VARCHAR(24) NOT NULL,
    `pax_count` INTEGER NOT NULL,
    `package_name_snapshot` VARCHAR(180) NOT NULL,
    `category_snapshot` VARCHAR(24) NOT NULL,
    `store_name_snapshot` VARCHAR(180) NOT NULL,
    `duration_minutes_snapshot` INTEGER NOT NULL,
    `schedule_start_at_snapshot` DATETIME(3) NULL,
    `price_per_pax_snapshot` DECIMAL(14, 2) NOT NULL,
    `subtotal` DECIMAL(14, 2) NOT NULL,
    `tax_percent_snapshot` DECIMAL(5, 2) NOT NULL,
    `tax_amount` DECIMAL(14, 2) NOT NULL,
    `grand_total` DECIMAL(14, 2) NOT NULL,
    `booking_name` VARCHAR(160) NOT NULL,
    `customer_note` TEXT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING_APPROVAL',
    `payment_status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    `approval_expires_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `cancelled_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,

    UNIQUE INDEX `tourism_bookings_platform_transaction_id_key`(`platform_transaction_id`),
    UNIQUE INDEX `tourism_bookings_group_request_id_key`(`group_request_id`),
    UNIQUE INDEX `tourism_bookings_booking_code_key`(`booking_code`),
    INDEX `tourism_bookings_customer_user_id_created_at_idx`(`customer_user_id`, `created_at`),
    INDEX `tourism_bookings_tourism_package_id_status_idx`(`tourism_package_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tourism_booking_activities` (
    `id` CHAR(36) NOT NULL,
    `tourism_booking_id` CHAR(36) NOT NULL,
    `actor_user_id` CHAR(36) NULL,
    `old_status` VARCHAR(32) NULL,
    `new_status` VARCHAR(32) NOT NULL,
    `note` TEXT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tourism_booking_activities_tourism_booking_id_created_at_idx`(`tourism_booking_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tourism_group_requests` (
    `id` CHAR(36) NOT NULL,
    `customer_user_id` CHAR(36) NOT NULL,
    `tourism_package_id` CHAR(36) NOT NULL,
    `group_name` VARCHAR(160) NOT NULL,
    `requested_date` DATE NOT NULL,
    `requested_start_time` VARCHAR(5) NULL,
    `pax_count` INTEGER NOT NULL,
    `notes` TEXT NULL,
    `status` VARCHAR(24) NOT NULL DEFAULT 'SUBMITTED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `tourism_group_requests_customer_user_id_created_at_idx`(`customer_user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tourism_group_offers` (
    `id` CHAR(36) NOT NULL,
    `group_request_id` CHAR(36) NOT NULL,
    `merchant_user_id` CHAR(36) NOT NULL,
    `offered_date` DATE NOT NULL,
    `offered_start_time` VARCHAR(5) NOT NULL,
    `offered_pax` INTEGER NOT NULL,
    `offered_price` DECIMAL(14, 2) NOT NULL,
    `notes` TEXT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `status` VARCHAR(24) NOT NULL DEFAULT 'OFFERED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `tourism_group_offers_group_request_id_status_idx`(`group_request_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `payment_attempts_platform_transaction_id_idx` ON `payment_attempts`(`platform_transaction_id`);

-- CreateIndex
CREATE UNIQUE INDEX `platform_transactions_commerce_order_id_key` ON `platform_transactions`(`commerce_order_id`);

-- AddForeignKey
ALTER TABLE `payment_attempts` ADD CONSTRAINT `payment_attempts_platform_transaction_id_fkey` FOREIGN KEY (`platform_transaction_id`) REFERENCES `platform_transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `platform_transactions` ADD CONSTRAINT `platform_transactions_commerce_order_id_fkey` FOREIGN KEY (`commerce_order_id`) REFERENCES `commerce_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tourism_packages` ADD CONSTRAINT `tourism_packages_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tourism_schedules` ADD CONSTRAINT `tourism_schedules_tourism_package_id_fkey` FOREIGN KEY (`tourism_package_id`) REFERENCES `tourism_packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tourism_bookings` ADD CONSTRAINT `tourism_bookings_platform_transaction_id_fkey` FOREIGN KEY (`platform_transaction_id`) REFERENCES `platform_transactions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tourism_bookings` ADD CONSTRAINT `tourism_bookings_customer_user_id_fkey` FOREIGN KEY (`customer_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tourism_bookings` ADD CONSTRAINT `tourism_bookings_tourism_package_id_fkey` FOREIGN KEY (`tourism_package_id`) REFERENCES `tourism_packages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tourism_bookings` ADD CONSTRAINT `tourism_bookings_tourism_schedule_id_fkey` FOREIGN KEY (`tourism_schedule_id`) REFERENCES `tourism_schedules`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tourism_bookings` ADD CONSTRAINT `tourism_bookings_group_request_id_fkey` FOREIGN KEY (`group_request_id`) REFERENCES `tourism_group_requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tourism_booking_activities` ADD CONSTRAINT `tourism_booking_activities_tourism_booking_id_fkey` FOREIGN KEY (`tourism_booking_id`) REFERENCES `tourism_bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tourism_group_requests` ADD CONSTRAINT `tourism_group_requests_customer_user_id_fkey` FOREIGN KEY (`customer_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tourism_group_requests` ADD CONSTRAINT `tourism_group_requests_tourism_package_id_fkey` FOREIGN KEY (`tourism_package_id`) REFERENCES `tourism_packages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tourism_group_offers` ADD CONSTRAINT `tourism_group_offers_group_request_id_fkey` FOREIGN KEY (`group_request_id`) REFERENCES `tourism_group_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tourism_group_offers` ADD CONSTRAINT `tourism_group_offers_merchant_user_id_fkey` FOREIGN KEY (`merchant_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
