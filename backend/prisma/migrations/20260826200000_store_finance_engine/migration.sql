-- CreateTable
CREATE TABLE `store_initial_fees` (
    `id` CHAR(36) NOT NULL,
    `store_id` CHAR(36) NOT NULL,
    `initial_amount_snapshot` DECIMAL(14, 2) NOT NULL,
    `plan_type` VARCHAR(24) NOT NULL,
    `installment_count` INTEGER NOT NULL,
    `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,

    UNIQUE INDEX `store_initial_fees_store_id_key`(`store_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_installments` (
    `id` CHAR(36) NOT NULL,
    `store_initial_fee_id` CHAR(36) NOT NULL,
    `installment_number` INTEGER NOT NULL,
    `principal_amount` DECIMAL(14, 2) NOT NULL,
    `due_at` DATETIME(3) NOT NULL,
    `principal_outstanding` DECIMAL(14, 2) NOT NULL,
    `penalty_outstanding` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    `paid_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `store_installments_status_due_at_idx`(`status`, `due_at`),
    UNIQUE INDEX `store_installments_store_initial_fee_id_installment_number_key`(`store_initial_fee_id`, `installment_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_installment_penalties` (
    `id` CHAR(36) NOT NULL,
    `installment_id` CHAR(36) NOT NULL,
    `period_number` INTEGER NOT NULL,
    `percentage_snapshot` DECIMAL(5, 2) NOT NULL,
    `base_outstanding_amount` DECIMAL(14, 2) NOT NULL,
    `penalty_amount` DECIMAL(14, 2) NOT NULL,
    `applied_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `store_installment_penalties_installment_id_period_number_key`(`installment_id`, `period_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_installment_payments` (
    `id` CHAR(36) NOT NULL,
    `installment_id` CHAR(36) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `payment_method` VARCHAR(24) NOT NULL,
    `payment_status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    `provider` VARCHAR(24) NOT NULL,
    `provider_reference` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `paid_at` DATETIME(3) NULL,

    UNIQUE INDEX `store_installment_payments_provider_reference_key`(`provider_reference`),
    INDEX `store_installment_payments_installment_id_payment_status_idx`(`installment_id`, `payment_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_transactions` (
    `id` CHAR(36) NOT NULL,
    `store_id` CHAR(36) NOT NULL,
    `customer_user_id` CHAR(36) NOT NULL,
    `type` VARCHAR(24) NOT NULL,
    `source_entity_id` CHAR(36) NOT NULL,
    `subtotal` DECIMAL(14, 2) NOT NULL,
    `tax_percent_snapshot` DECIMAL(5, 2) NOT NULL,
    `tax_amount` DECIMAL(14, 2) NOT NULL,
    `grand_total` DECIMAL(14, 2) NOT NULL,
    `payment_status` VARCHAR(24) NOT NULL,
    `transaction_status` VARCHAR(24) NOT NULL,
    `completed_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `platform_transactions_source_entity_id_key`(`source_entity_id`),
    INDEX `platform_transactions_store_id_completed_at_idx`(`store_id`, `completed_at`),
    UNIQUE INDEX `platform_transactions_type_source_entity_id_key`(`type`, `source_entity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_fee_obligations` (
    `id` CHAR(36) NOT NULL,
    `platform_transaction_id` CHAR(36) NOT NULL,
    `store_id` CHAR(36) NOT NULL,
    `fee_type_snapshot` VARCHAR(16) NOT NULL,
    `fee_value_snapshot` DECIMAL(14, 2) NOT NULL,
    `base_transaction_amount` DECIMAL(14, 2) NOT NULL,
    `fee_amount` DECIMAL(14, 2) NOT NULL,
    `billing_year` INTEGER NOT NULL,
    `billing_month` INTEGER NOT NULL,
    `cutoff_at` DATETIME(3) NOT NULL,
    `status` VARCHAR(24) NOT NULL DEFAULT 'OUTSTANDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `paid_at` DATETIME(3) NULL,

    UNIQUE INDEX `admin_fee_obligations_platform_transaction_id_key`(`platform_transaction_id`),
    INDEX `admin_fee_obligations_store_id_status_cutoff_at_idx`(`store_id`, `status`, `cutoff_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_fee_settlements` (
    `id` CHAR(36) NOT NULL,
    `store_id` CHAR(36) NOT NULL,
    `merchant_user_id` CHAR(36) NOT NULL,
    `total_amount` DECIMAL(14, 2) NOT NULL,
    `payment_method` VARCHAR(24) NOT NULL,
    `provider` VARCHAR(24) NOT NULL,
    `payment_status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    `provider_reference` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `paid_at` DATETIME(3) NULL,

    UNIQUE INDEX `admin_fee_settlements_provider_reference_key`(`provider_reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_fee_settlement_items` (
    `id` CHAR(36) NOT NULL,
    `settlement_id` CHAR(36) NOT NULL,
    `admin_fee_obligation_id` CHAR(36) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,

    UNIQUE INDEX `admin_fee_settlement_items_admin_fee_obligation_id_key`(`admin_fee_obligation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_status_history` (
    `id` CHAR(36) NOT NULL,
    `store_id` CHAR(36) NOT NULL,
    `old_status` VARCHAR(32) NOT NULL,
    `new_status` VARCHAR(32) NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `changed_by_user_id` CHAR(36) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `store_status_history_store_id_created_at_idx`(`store_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `voluntary_contributions` (
    `id` CHAR(36) NOT NULL,
    `merchant_user_id` CHAR(36) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `payment_method` VARCHAR(24) NOT NULL,
    `provider` VARCHAR(24) NOT NULL,
    `payment_status` VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    `provider_reference` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `paid_at` DATETIME(3) NULL,

    UNIQUE INDEX `voluntary_contributions_provider_reference_key`(`provider_reference`),
    INDEX `voluntary_contributions_merchant_user_id_created_at_idx`(`merchant_user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `store_initial_fees` ADD CONSTRAINT `store_initial_fees_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_installments` ADD CONSTRAINT `store_installments_store_initial_fee_id_fkey` FOREIGN KEY (`store_initial_fee_id`) REFERENCES `store_initial_fees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_installment_penalties` ADD CONSTRAINT `store_installment_penalties_installment_id_fkey` FOREIGN KEY (`installment_id`) REFERENCES `store_installments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_installment_payments` ADD CONSTRAINT `store_installment_payments_installment_id_fkey` FOREIGN KEY (`installment_id`) REFERENCES `store_installments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `platform_transactions` ADD CONSTRAINT `platform_transactions_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `platform_transactions` ADD CONSTRAINT `platform_transactions_customer_user_id_fkey` FOREIGN KEY (`customer_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `platform_transactions` ADD CONSTRAINT `platform_transactions_source_entity_id_fkey` FOREIGN KEY (`source_entity_id`) REFERENCES `commerce_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_fee_obligations` ADD CONSTRAINT `admin_fee_obligations_platform_transaction_id_fkey` FOREIGN KEY (`platform_transaction_id`) REFERENCES `platform_transactions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_fee_obligations` ADD CONSTRAINT `admin_fee_obligations_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_fee_settlements` ADD CONSTRAINT `admin_fee_settlements_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_fee_settlements` ADD CONSTRAINT `admin_fee_settlements_merchant_user_id_fkey` FOREIGN KEY (`merchant_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_fee_settlement_items` ADD CONSTRAINT `admin_fee_settlement_items_settlement_id_fkey` FOREIGN KEY (`settlement_id`) REFERENCES `admin_fee_settlements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_fee_settlement_items` ADD CONSTRAINT `admin_fee_settlement_items_admin_fee_obligation_id_fkey` FOREIGN KEY (`admin_fee_obligation_id`) REFERENCES `admin_fee_obligations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_status_history` ADD CONSTRAINT `store_status_history_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_status_history` ADD CONSTRAINT `store_status_history_changed_by_user_id_fkey` FOREIGN KEY (`changed_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `voluntary_contributions` ADD CONSTRAINT `voluntary_contributions_merchant_user_id_fkey` FOREIGN KEY (`merchant_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
