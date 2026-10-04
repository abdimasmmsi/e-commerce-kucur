-- CreateTable
CREATE TABLE `live_in_profiles` (
    `id` CHAR(36) NOT NULL,
    `store_id` CHAR(36) NOT NULL,
    `description` TEXT NOT NULL,
    `default_meals_per_day` INTEGER NOT NULL DEFAULT 0,
    `check_in_time` VARCHAR(5) NULL,
    `check_out_time` VARCHAR(5) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `live_in_profiles_store_id_key`(`store_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `live_in_meal_plans` (
    `id` CHAR(36) NOT NULL,
    `live_in_profile_id` CHAR(36) NOT NULL,
    `meals_per_day` INTEGER NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `live_in_meal_plans_live_in_profile_id_key`(`live_in_profile_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `live_in_rooms` (
    `id` CHAR(36) NOT NULL,
    `live_in_profile_id` CHAR(36) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `description` TEXT NULL,
    `capacity` INTEGER NOT NULL,
    `price_per_night` DECIMAL(14, 2) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `live_in_rooms_live_in_profile_id_is_active_idx`(`live_in_profile_id`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `live_in_room_meal_overrides` (
    `id` CHAR(36) NOT NULL,
    `room_id` CHAR(36) NOT NULL,
    `meals_per_day` INTEGER NOT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `live_in_room_meal_overrides_room_id_key`(`room_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `live_in_bookings` (
    `id` CHAR(36) NOT NULL,
    `platform_transaction_id` CHAR(36) NOT NULL,
    `customer_user_id` CHAR(36) NOT NULL,
    `live_in_profile_id` CHAR(36) NOT NULL,
    `group_request_id` CHAR(36) NULL,
    `booking_code` VARCHAR(40) NOT NULL,
    `booking_type` VARCHAR(24) NOT NULL,
    `booking_name` VARCHAR(160) NOT NULL,
    `store_name_snapshot` VARCHAR(180) NOT NULL,
    `live_in_name_snapshot` VARCHAR(180) NOT NULL,
    `check_in` DATE NOT NULL,
    `check_out` DATE NOT NULL,
    `night_count` INTEGER NOT NULL,
    `pax_count` INTEGER NULL,
    `meal_notes_snapshot` TEXT NULL,
    `subtotal` DECIMAL(14, 2) NOT NULL,
    `tax_percent_snapshot` DECIMAL(5, 2) NOT NULL,
    `tax_amount` DECIMAL(14, 2) NOT NULL,
    `grand_total` DECIMAL(14, 2) NOT NULL,
    `booking_status` VARCHAR(32) NOT NULL DEFAULT 'PENDING_APPROVAL',
    `payment_status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    `customer_note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `cancelled_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,

    UNIQUE INDEX `live_in_bookings_platform_transaction_id_key`(`platform_transaction_id`),
    UNIQUE INDEX `live_in_bookings_group_request_id_key`(`group_request_id`),
    UNIQUE INDEX `live_in_bookings_booking_code_key`(`booking_code`),
    INDEX `live_in_bookings_customer_user_id_created_at_idx`(`customer_user_id`, `created_at`),
    INDEX `live_in_bookings_live_in_profile_id_booking_status_idx`(`live_in_profile_id`, `booking_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `live_in_booking_rooms` (
    `id` CHAR(36) NOT NULL,
    `live_in_booking_id` CHAR(36) NOT NULL,
    `live_in_room_id` CHAR(36) NOT NULL,
    `room_name_snapshot` VARCHAR(160) NOT NULL,
    `capacity_snapshot` INTEGER NOT NULL,
    `price_per_night_snapshot` DECIMAL(14, 2) NOT NULL,
    `meals_per_day_snapshot` INTEGER NOT NULL,
    `night_count` INTEGER NOT NULL,
    `subtotal` DECIMAL(14, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `live_in_booking_rooms_live_in_booking_id_live_in_room_id_key`(`live_in_booking_id`, `live_in_room_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `live_in_room_night_reservations` (
    `id` CHAR(36) NOT NULL,
    `live_in_room_id` CHAR(36) NOT NULL,
    `live_in_booking_id` CHAR(36) NOT NULL,
    `stay_date` DATE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `live_in_room_night_reservations_live_in_booking_id_idx`(`live_in_booking_id`),
    UNIQUE INDEX `live_in_room_night_reservations_live_in_room_id_stay_date_key`(`live_in_room_id`, `stay_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `live_in_booking_activities` (
    `id` CHAR(36) NOT NULL,
    `live_in_booking_id` CHAR(36) NOT NULL,
    `actor_user_id` CHAR(36) NULL,
    `old_status` VARCHAR(32) NULL,
    `new_status` VARCHAR(32) NOT NULL,
    `note` TEXT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `live_in_booking_activities_live_in_booking_id_created_at_idx`(`live_in_booking_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `live_in_group_requests` (
    `id` CHAR(36) NOT NULL,
    `customer_user_id` CHAR(36) NOT NULL,
    `live_in_profile_id` CHAR(36) NOT NULL,
    `group_name` VARCHAR(160) NOT NULL,
    `requested_check_in` DATE NOT NULL,
    `requested_check_out` DATE NOT NULL,
    `pax_count` INTEGER NOT NULL,
    `notes` TEXT NULL,
    `status` VARCHAR(24) NOT NULL DEFAULT 'SUBMITTED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `live_in_group_requests_customer_user_id_created_at_idx`(`customer_user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `live_in_group_offers` (
    `id` CHAR(36) NOT NULL,
    `group_request_id` CHAR(36) NOT NULL,
    `merchant_user_id` CHAR(36) NOT NULL,
    `offered_check_in` DATE NOT NULL,
    `offered_check_out` DATE NOT NULL,
    `offered_pax` INTEGER NOT NULL,
    `offered_price` DECIMAL(14, 2) NOT NULL,
    `meal_notes` TEXT NULL,
    `notes` TEXT NULL,
    `expires_at` DATETIME(3) NULL,
    `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `live_in_group_offers_group_request_id_status_idx`(`group_request_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `live_in_group_offer_rooms` (
    `id` CHAR(36) NOT NULL,
    `group_offer_id` CHAR(36) NOT NULL,
    `live_in_room_id` CHAR(36) NOT NULL,
    `price_snapshot` DECIMAL(14, 2) NOT NULL,
    `capacity_snapshot` INTEGER NOT NULL,
    `meals_per_day_snapshot` INTEGER NOT NULL,

    UNIQUE INDEX `live_in_group_offer_rooms_group_offer_id_live_in_room_id_key`(`group_offer_id`, `live_in_room_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `live_in_profiles` ADD CONSTRAINT `live_in_profiles_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_in_meal_plans` ADD CONSTRAINT `live_in_meal_plans_live_in_profile_id_fkey` FOREIGN KEY (`live_in_profile_id`) REFERENCES `live_in_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_in_rooms` ADD CONSTRAINT `live_in_rooms_live_in_profile_id_fkey` FOREIGN KEY (`live_in_profile_id`) REFERENCES `live_in_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_in_room_meal_overrides` ADD CONSTRAINT `live_in_room_meal_overrides_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `live_in_rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_in_bookings` ADD CONSTRAINT `live_in_bookings_platform_transaction_id_fkey` FOREIGN KEY (`platform_transaction_id`) REFERENCES `platform_transactions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_in_bookings` ADD CONSTRAINT `live_in_bookings_customer_user_id_fkey` FOREIGN KEY (`customer_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_in_bookings` ADD CONSTRAINT `live_in_bookings_live_in_profile_id_fkey` FOREIGN KEY (`live_in_profile_id`) REFERENCES `live_in_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_in_bookings` ADD CONSTRAINT `live_in_bookings_group_request_id_fkey` FOREIGN KEY (`group_request_id`) REFERENCES `live_in_group_requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_in_booking_rooms` ADD CONSTRAINT `live_in_booking_rooms_live_in_booking_id_fkey` FOREIGN KEY (`live_in_booking_id`) REFERENCES `live_in_bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_in_booking_rooms` ADD CONSTRAINT `live_in_booking_rooms_live_in_room_id_fkey` FOREIGN KEY (`live_in_room_id`) REFERENCES `live_in_rooms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_in_room_night_reservations` ADD CONSTRAINT `live_in_room_night_reservations_live_in_room_id_fkey` FOREIGN KEY (`live_in_room_id`) REFERENCES `live_in_rooms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_in_room_night_reservations` ADD CONSTRAINT `live_in_room_night_reservations_live_in_booking_id_fkey` FOREIGN KEY (`live_in_booking_id`) REFERENCES `live_in_bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_in_booking_activities` ADD CONSTRAINT `live_in_booking_activities_live_in_booking_id_fkey` FOREIGN KEY (`live_in_booking_id`) REFERENCES `live_in_bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_in_group_requests` ADD CONSTRAINT `live_in_group_requests_customer_user_id_fkey` FOREIGN KEY (`customer_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_in_group_requests` ADD CONSTRAINT `live_in_group_requests_live_in_profile_id_fkey` FOREIGN KEY (`live_in_profile_id`) REFERENCES `live_in_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_in_group_offers` ADD CONSTRAINT `live_in_group_offers_group_request_id_fkey` FOREIGN KEY (`group_request_id`) REFERENCES `live_in_group_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_in_group_offers` ADD CONSTRAINT `live_in_group_offers_merchant_user_id_fkey` FOREIGN KEY (`merchant_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_in_group_offer_rooms` ADD CONSTRAINT `live_in_group_offer_rooms_group_offer_id_fkey` FOREIGN KEY (`group_offer_id`) REFERENCES `live_in_group_offers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `live_in_group_offer_rooms` ADD CONSTRAINT `live_in_group_offer_rooms_live_in_room_id_fkey` FOREIGN KEY (`live_in_room_id`) REFERENCES `live_in_rooms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


