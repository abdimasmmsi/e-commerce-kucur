-- Additive final E-Commerce 20-table target.
-- Authoritative source SHA-256: 97A704F232D01B78D5F746292EC665B63D22CF06398B6120CC0E1A4CB606C5F9
-- Intentionally contains no legacy DROP, rename, backfill, or business-data statements.

SET NAMES utf8mb4;

-- ============================================================================
-- 1. USER
-- ============================================================================

CREATE TABLE `User` (
  `id` CHAR(36) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `passwordHash` VARCHAR(255) NOT NULL,
  `fullName` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `language` ENUM('id','en') NOT NULL DEFAULT 'id',
  `theme` ENUM('light','dark') NOT NULL DEFAULT 'light',
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_email` (`email`)
) ENGINE=InnoDB;

-- ============================================================================
-- 2. USER ROLE
-- Role name is stored directly because the role set is small and fixed.
-- ============================================================================

CREATE TABLE `UserRole` (
  `userId` CHAR(36) NOT NULL,
  `role` ENUM('CUSTOMER','MERCHANT','COURIER','ADMIN') NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`userId`, `role`),

  CONSTRAINT `fk_user_role_user`
    FOREIGN KEY (`userId`) REFERENCES `User` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
-- 3. SESSION
-- ============================================================================

CREATE TABLE `Session` (
  `id` CHAR(36) NOT NULL,
  `userId` CHAR(36) NOT NULL,
  `tokenHash` VARCHAR(255) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `revokedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_session_token_hash` (`tokenHash`),
  KEY `idx_session_user_expiry` (`userId`, `expiresAt`),

  CONSTRAINT `fk_session_user`
    FOREIGN KEY (`userId`) REFERENCES `User` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
-- 4. PLATFORM SETTINGS
-- One active row is expected at application level.
-- ============================================================================

CREATE TABLE `PlatformSettings` (
  `id` CHAR(36) NOT NULL,

  `taxPercent` DECIMAL(5,2) NOT NULL DEFAULT 0.00,

  `deliveryRatePerKm` DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `orderCutoffTime` TIME NOT NULL DEFAULT '15:00:00',
  `dispatchTime` TIME NOT NULL DEFAULT '08:00:00',
  `maxDailyDeliveries` INT NOT NULL DEFAULT 20,

  `initialStoreFeeAmount` DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `installmentLateInterestPercent` DECIMAL(5,2) NOT NULL DEFAULT 0.00,

  `adminFeeType` ENUM('PERCENTAGE','FIXED') NOT NULL DEFAULT 'PERCENTAGE',
  `adminFeeValue` DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `adminFeeCutoffDay` INT NOT NULL DEFAULT 1,
  `adminFeeGraceTime` TIME NOT NULL DEFAULT '12:00:00',
  `suspendStoreForOutstandingAdminFee` BOOLEAN NOT NULL DEFAULT TRUE,

  `voluntaryContributionEnabled` BOOLEAN NOT NULL DEFAULT TRUE,

  `updatedByUserId` CHAR(36) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),

  CONSTRAINT `chk_settings_tax`
    CHECK (`taxPercent` >= 0),
  CONSTRAINT `chk_settings_delivery_rate`
    CHECK (`deliveryRatePerKm` >= 0),
  CONSTRAINT `chk_settings_max_daily_delivery`
    CHECK (`maxDailyDeliveries` > 0),
  CONSTRAINT `chk_settings_store_fee`
    CHECK (`initialStoreFeeAmount` >= 0),
  CONSTRAINT `chk_settings_late_interest`
    CHECK (`installmentLateInterestPercent` >= 0),
  CONSTRAINT `chk_settings_admin_fee`
    CHECK (`adminFeeValue` >= 0),
  CONSTRAINT `chk_settings_cutoff_day`
    CHECK (`adminFeeCutoffDay` BETWEEN 1 AND 28),

  CONSTRAINT `fk_settings_updated_by`
    FOREIGN KEY (`updatedByUserId`) REFERENCES `User` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================================
-- 5. STORE
-- Store approval/activation state is represented through status.
-- ============================================================================

CREATE TABLE `Store` (
  `id` CHAR(36) NOT NULL,
  `merchantUserId` CHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `phone` VARCHAR(50) NULL,
  `imageUrl` VARCHAR(1000) NULL,
  `address` TEXT NULL,
  `latitude` DECIMAL(10,7) NULL,
  `longitude` DECIMAL(10,7) NULL,
  `status` ENUM(
    'PENDING',
    'PENDING_INITIAL_PAYMENT',
    'ACTIVE',
    'SUSPENDED_ADMIN_FEE',
    'REJECTED',
    'INACTIVE'
  ) NOT NULL DEFAULT 'PENDING',
  `rejectionReason` TEXT NULL,
  `reviewedByUserId` CHAR(36) NULL,
  `reviewedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  KEY `idx_store_merchant` (`merchantUserId`),
  KEY `idx_store_status` (`status`),
  KEY `idx_store_reviewed_by` (`reviewedByUserId`),

  CONSTRAINT `chk_store_coordinates`
    CHECK (
      (`latitude` IS NULL AND `longitude` IS NULL)
      OR
      (`latitude` BETWEEN -90 AND 90 AND `longitude` BETWEEN -180 AND 180)
    ),

  CONSTRAINT `fk_store_merchant`
    FOREIGN KEY (`merchantUserId`) REFERENCES `User` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_store_reviewed_by`
    FOREIGN KEY (`reviewedByUserId`) REFERENCES `User` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================================
-- 6. PRODUCT
-- Images and option definitions are stored as JSON to keep the TA schema compact.
-- ============================================================================

CREATE TABLE `Product` (
  `id` CHAR(36) NOT NULL,
  `storeId` CHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `category` VARCHAR(100) NULL,
  `productType` ENUM('SIMPLE','VARIANT') NOT NULL DEFAULT 'SIMPLE',

  -- Used by SIMPLE products.
  `price` DECIMAL(18,2) NULL,
  `stock` INT NULL,

  -- Example:
  -- images = [{"url":"...","isPrimary":true}]
  -- options = [{"name":"Size","values":["S","M","L"]}]
  `images` JSON NULL,
  `options` JSON NULL,

  `status` ENUM('DRAFT','ACTIVE','INACTIVE','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  KEY `idx_product_store` (`storeId`),
  KEY `idx_product_status` (`status`),
  KEY `idx_product_category` (`category`),

  CONSTRAINT `chk_product_price`
    CHECK (`price` IS NULL OR `price` >= 0),
  CONSTRAINT `chk_product_stock`
    CHECK (`stock` IS NULL OR `stock` >= 0),

  CONSTRAINT `fk_product_store`
    FOREIGN KEY (`storeId`) REFERENCES `Store` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================================
-- 7. PRODUCT VARIANT
-- Variant-level price and stock are authoritative for VARIANT products.
-- ============================================================================

CREATE TABLE `ProductVariant` (
  `id` CHAR(36) NOT NULL,
  `productId` CHAR(36) NOT NULL,
  `sku` VARCHAR(255) NOT NULL,
  `combinationKey` VARCHAR(500) NOT NULL,
  `selectedOptions` JSON NOT NULL,
  `price` DECIMAL(18,2) NOT NULL,
  `stock` INT NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `imageUrl` VARCHAR(2000) NULL,
  `imageStorageKey` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_variant_product_sku` (`productId`, `sku`),
  UNIQUE KEY `uq_variant_product_combination` (`productId`, `combinationKey`),
  KEY `idx_variant_product_active` (`productId`, `isActive`),

  CONSTRAINT `chk_variant_price`
    CHECK (`price` >= 0),
  CONSTRAINT `chk_variant_stock`
    CHECK (`stock` >= 0),

  CONSTRAINT `fk_variant_product`
    FOREIGN KEY (`productId`) REFERENCES `Product` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
-- 8. CART
-- One active cart per customer.
-- ============================================================================

CREATE TABLE `Cart` (
  `id` CHAR(36) NOT NULL,
  `customerUserId` CHAR(36) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cart_customer` (`customerUserId`),

  CONSTRAINT `fk_cart_customer`
    FOREIGN KEY (`customerUserId`) REFERENCES `User` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
-- 9. CART ITEM
-- Cart does not reserve stock.
-- ============================================================================

CREATE TABLE `CartItem` (
  `id` CHAR(36) NOT NULL,
  `cartId` CHAR(36) NOT NULL,
  `productId` CHAR(36) NOT NULL,
  `productVariantId` CHAR(36) NULL,
  `quantity` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  KEY `idx_cart_item_cart` (`cartId`),
  KEY `idx_cart_item_product` (`productId`),
  KEY `idx_cart_item_variant` (`productVariantId`),

  CONSTRAINT `chk_cart_item_quantity`
    CHECK (`quantity` > 0),

  CONSTRAINT `fk_cart_item_cart`
    FOREIGN KEY (`cartId`) REFERENCES `Cart` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_cart_item_product`
    FOREIGN KEY (`productId`) REFERENCES `Product` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_cart_item_variant`
    FOREIGN KEY (`productVariantId`) REFERENCES `ProductVariant` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================================
-- 10. COMMERCE ORDER
--
-- One checkout may create multiple rows, one per Store.
-- All rows created from the same customer checkout share checkoutGroupId.
-- ============================================================================

CREATE TABLE `CommerceOrder` (
  `id` CHAR(36) NOT NULL,
  `checkoutGroupId` CHAR(36) NOT NULL,
  `checkoutIdempotencyKey` VARCHAR(100) NOT NULL,
  `storeId` CHAR(36) NOT NULL,
  `customerUserId` CHAR(36) NOT NULL,
  `orderCode` VARCHAR(100) NOT NULL,

  `fulfillmentStatus` ENUM(
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'READY_FOR_PICKUP',
    'IN_DELIVERY',
    'DELIVERED',
    'COMPLETED',
    'CANCELLED'
  ) NOT NULL DEFAULT 'PENDING',

  `paymentStatus` ENUM(
    'UNPAID',
    'PENDING',
    'PAID',
    'FAILED',
    'EXPIRED',
    'CANCELLED',
    'REFUNDED'
  ) NOT NULL DEFAULT 'UNPAID',

  `subtotal` DECIMAL(18,2) NOT NULL,
  `taxPercentSnapshot` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `taxAmount` DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `deliveryFee` DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `courierTip` DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `grandTotal` DECIMAL(18,2) NOT NULL,

  `deliveryRatePerKmSnapshot` DECIMAL(18,2) NULL,
  `deliveryDistanceKm` DECIMAL(10,2) NULL,
  `deliveryDate` DATE NULL,

  `recipientName` VARCHAR(255) NOT NULL,
  `recipientPhone` VARCHAR(50) NOT NULL,
  `deliveryAddress` TEXT NOT NULL,
  `deliveryLatitude` DECIMAL(10,7) NULL,
  `deliveryLongitude` DECIMAL(10,7) NULL,
  `customerNote` TEXT NULL,
  `activityHistory` JSON NULL,

  `cancelReason` TEXT NULL,
  `cancelledAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_order_code` (`orderCode`),
  UNIQUE KEY `uq_order_checkout_idempotency`
    (`customerUserId`, `checkoutIdempotencyKey`, `storeId`),
  KEY `idx_order_checkout_group` (`checkoutGroupId`),
  KEY `idx_order_store_created` (`storeId`, `createdAt`),
  KEY `idx_order_customer_created` (`customerUserId`, `createdAt`),
  KEY `idx_order_fulfillment` (`fulfillmentStatus`),
  KEY `idx_order_payment` (`paymentStatus`),
  KEY `idx_order_delivery_date` (`deliveryDate`, `fulfillmentStatus`),

  CONSTRAINT `chk_order_financial`
    CHECK (
      `subtotal` >= 0 AND
      `taxPercentSnapshot` >= 0 AND
      `taxAmount` >= 0 AND
      `deliveryFee` >= 0 AND
      `courierTip` >= 0 AND
      `grandTotal` >= 0
    ),

  CONSTRAINT `chk_order_delivery`
    CHECK (
      (`deliveryRatePerKmSnapshot` IS NULL OR `deliveryRatePerKmSnapshot` >= 0)
      AND
      (`deliveryDistanceKm` IS NULL OR `deliveryDistanceKm` >= 0)
    ),

  CONSTRAINT `chk_order_coordinates`
    CHECK (
      (`deliveryLatitude` IS NULL AND `deliveryLongitude` IS NULL)
      OR
      (
        `deliveryLatitude` BETWEEN -90 AND 90
        AND `deliveryLongitude` BETWEEN -180 AND 180
      )
    ),

  CONSTRAINT `fk_order_store`
    FOREIGN KEY (`storeId`) REFERENCES `Store` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_order_customer`
    FOREIGN KEY (`customerUserId`) REFERENCES `User` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================================
-- 11. COMMERCE ORDER ITEM
--
-- Contains immutable product snapshots plus simplified stock commitment fields.
-- ============================================================================

CREATE TABLE `CommerceOrderItem` (
  `id` CHAR(36) NOT NULL,
  `commerceOrderId` CHAR(36) NOT NULL,
  `productId` CHAR(36) NULL,
  `productVariantId` CHAR(36) NULL,

  `productNameSnapshot` VARCHAR(255) NOT NULL,
  `variantSnapshot` JSON NULL,
  `skuSnapshot` VARCHAR(255) NULL,
  `imageSnapshot` VARCHAR(1000) NULL,
  `storeNameSnapshot` VARCHAR(255) NOT NULL,

  `unitPrice` DECIMAL(18,2) NOT NULL,
  `quantity` INT NOT NULL,
  `subtotal` DECIMAL(18,2) NOT NULL,

  -- Stock commitment state is consolidated directly on the order item.
  `stockStatus` ENUM('RESERVED','CONSUMED','RELEASED') NOT NULL DEFAULT 'RESERVED',
  `reservedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `consumedAt` DATETIME(3) NULL,
  `releasedAt` DATETIME(3) NULL,

  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  KEY `idx_order_item_order` (`commerceOrderId`),
  KEY `idx_order_item_product` (`productId`),
  KEY `idx_order_item_variant` (`productVariantId`),
  KEY `idx_order_item_stock_status` (`stockStatus`),

  CONSTRAINT `chk_order_item_price`
    CHECK (`unitPrice` >= 0),
  CONSTRAINT `chk_order_item_quantity`
    CHECK (`quantity` > 0),
  CONSTRAINT `chk_order_item_subtotal`
    CHECK (`subtotal` >= 0),

  CONSTRAINT `fk_order_item_order`
    FOREIGN KEY (`commerceOrderId`) REFERENCES `CommerceOrder` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_order_item_product`
    FOREIGN KEY (`productId`) REFERENCES `Product` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_order_item_variant`
    FOREIGN KEY (`productVariantId`) REFERENCES `ProductVariant` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================================
-- 12. PAYMENT ATTEMPT
-- One CommerceOrder may have multiple payment attempts.
-- ============================================================================

CREATE TABLE `PaymentAttempt` (
  `id` CHAR(36) NOT NULL,
  `commerceOrderId` CHAR(36) NULL,
  `merchantFeeId` CHAR(36) NULL,
  `provider` ENUM('COD','MIDTRANS','MANUAL') NOT NULL,
  `method` VARCHAR(100) NOT NULL,
  `providerReference` VARCHAR(255) NULL,
  `amount` DECIMAL(18,2) NOT NULL,
  `status` ENUM('PENDING','PAID','FAILED','EXPIRED','CANCELLED')
    NOT NULL DEFAULT 'PENDING',
  `providerResponse` JSON NULL,
  `paidAt` DATETIME(3) NULL,
  `expiredAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  KEY `idx_payment_order_created` (`commerceOrderId`, `createdAt`),
  KEY `idx_payment_merchant_fee_created` (`merchantFeeId`, `createdAt`),
  KEY `idx_payment_provider_ref` (`provider`, `providerReference`),
  KEY `idx_payment_status` (`status`),

  CONSTRAINT `chk_payment_amount`
    CHECK (`amount` >= 0),
  CONSTRAINT `chk_payment_target_xor`
    CHECK (
      (`commerceOrderId` IS NOT NULL AND `merchantFeeId` IS NULL)
      OR
      (`commerceOrderId` IS NULL AND `merchantFeeId` IS NOT NULL)
    ),

  CONSTRAINT `fk_payment_order`
    FOREIGN KEY (`commerceOrderId`) REFERENCES `CommerceOrder` (`id`)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================================
-- 13. MERCHANT FEE
--
-- Compact financial table replacing separate initial-fee, installment,
-- penalty, admin-fee, settlement, and contribution tables.
--
-- parentFeeId can group installments/penalties under one initial store fee.
-- commerceOrderId is used for transaction-based ADMIN_FEE.
-- storeId may be NULL for merchant-level VOLUNTARY_CONTRIBUTION.
-- ============================================================================

CREATE TABLE `MerchantFee` (
  `id` CHAR(36) NOT NULL,
  `merchantUserId` CHAR(36) NOT NULL,
  `storeId` CHAR(36) NULL,
  `commerceOrderId` CHAR(36) NULL,
  `parentFeeId` CHAR(36) NULL,

  `feeType` ENUM(
    'INITIAL_STORE_FEE',
    'INITIAL_STORE_INSTALLMENT',
    'LATE_PENALTY',
    'ADMIN_FEE',
    'VOLUNTARY_CONTRIBUTION'
  ) NOT NULL,

  `calculationType` ENUM('FIXED','PERCENTAGE') NULL,
  `rateSnapshot` DECIMAL(18,4) NULL,
  `baseAmountSnapshot` DECIMAL(18,2) NULL,
  `amount` DECIMAL(18,2) NOT NULL,

  `installmentNumber` INT NULL,
  `installmentCount` INT NULL,

  `dueAt` DATETIME(3) NULL,
  `status` ENUM('PENDING','OUTSTANDING','OVERDUE','PAID','CANCELLED')
    NOT NULL DEFAULT 'PENDING',

  `paymentMethod` VARCHAR(100) NULL,
  `provider` VARCHAR(50) NULL,
  `providerReference` VARCHAR(255) NULL,

  `paidAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  KEY `idx_merchant_fee_merchant` (`merchantUserId`, `createdAt`),
  KEY `idx_merchant_fee_store` (`storeId`, `status`, `dueAt`),
  KEY `idx_merchant_fee_order` (`commerceOrderId`),
  KEY `idx_merchant_fee_parent` (`parentFeeId`),
  KEY `idx_merchant_fee_type_status` (`feeType`, `status`),

  CONSTRAINT `chk_merchant_fee_amount`
    CHECK (`amount` >= 0),
  CONSTRAINT `chk_merchant_fee_rate`
    CHECK (`rateSnapshot` IS NULL OR `rateSnapshot` >= 0),
  CONSTRAINT `chk_merchant_fee_base`
    CHECK (`baseAmountSnapshot` IS NULL OR `baseAmountSnapshot` >= 0),
  CONSTRAINT `chk_merchant_fee_installment`
    CHECK (
      (`installmentNumber` IS NULL OR `installmentNumber` > 0)
      AND
      (`installmentCount` IS NULL OR `installmentCount` > 0)
    ),

  CONSTRAINT `fk_merchant_fee_merchant`
    FOREIGN KEY (`merchantUserId`) REFERENCES `User` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_merchant_fee_store`
    FOREIGN KEY (`storeId`) REFERENCES `Store` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_merchant_fee_order`
    FOREIGN KEY (`commerceOrderId`) REFERENCES `CommerceOrder` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_merchant_fee_parent`
    FOREIGN KEY (`parentFeeId`) REFERENCES `MerchantFee` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

ALTER TABLE `PaymentAttempt`
  ADD CONSTRAINT `fk_payment_merchant_fee`
    FOREIGN KEY (`merchantFeeId`) REFERENCES `MerchantFee` (`id`)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

-- ============================================================================
-- 14. COURIER PROFILE
--
-- Current availability is authoritative for assignment. Historical unavailable
-- intervals are consolidated in availabilityHistory for audit purposes.
-- ============================================================================

CREATE TABLE `CourierProfile` (
  `userId` CHAR(36) NOT NULL,
  `maxActiveDeliveries` INT NOT NULL DEFAULT 10,
  `availabilityStatus` ENUM('AVAILABLE','UNAVAILABLE') NOT NULL DEFAULT 'AVAILABLE',
  `unavailableStartAt` DATETIME(3) NULL,
  `unavailableEndAt` DATETIME(3) NULL,
  `unavailableReason` VARCHAR(255) NULL,
  `availabilityHistory` JSON NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`userId`),

  CONSTRAINT `chk_courier_max_delivery`
    CHECK (`maxActiveDeliveries` > 0),
  CONSTRAINT `chk_courier_unavailable_period`
    CHECK (
      `unavailableEndAt` IS NULL
      OR `unavailableStartAt` IS NULL
      OR `unavailableEndAt` > `unavailableStartAt`
    ),

  CONSTRAINT `fk_courier_profile_user`
    FOREIGN KEY (`userId`) REFERENCES `User` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
-- 15. DELIVERY BATCH
-- Daily delivery batch assigned to a courier.
-- ============================================================================

CREATE TABLE `DeliveryBatch` (
  `id` CHAR(36) NOT NULL,
  `courierUserId` CHAR(36) NOT NULL,
  `deliveryDate` DATE NOT NULL,
  `cutoffAt` DATETIME(3) NOT NULL,
  `dispatchAt` DATETIME(3) NOT NULL,
  `status` ENUM('PLANNED','READY','IN_PROGRESS','COMPLETED','CANCELLED')
    NOT NULL DEFAULT 'PLANNED',
  `startedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  KEY `idx_delivery_batch_courier_date` (`courierUserId`, `deliveryDate`),
  KEY `idx_delivery_batch_date_status` (`deliveryDate`, `status`),

  CONSTRAINT `fk_delivery_batch_courier`
    FOREIGN KEY (`courierUserId`) REFERENCES `CourierProfile` (`userId`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================================
-- 16. DELIVERY BATCH ORDER
--
-- Contains pickup state, delivery state, and delivery proof in one table.
-- commerceOrderId is deliberately NOT globally unique so old failed/cancelled
-- assignments may remain as history if an order is rebatched.
-- ============================================================================

CREATE TABLE `DeliveryBatchOrder` (
  `id` CHAR(36) NOT NULL,
  `deliveryBatchId` CHAR(36) NOT NULL,
  `commerceOrderId` CHAR(36) NOT NULL,

  `pickupSequence` INT NULL,
  `deliverySequence` INT NULL,

  `status` ENUM(
    'WAITING_PICKUP',
    'PICKED_UP',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'FAILED',
    'CANCELLED'
  ) NOT NULL DEFAULT 'WAITING_PICKUP',

  `merchantReady` BOOLEAN NULL,
  `merchantReadyNote` TEXT NULL,
  `merchantConfirmedAt` DATETIME(3) NULL,

  `pickedUpAt` DATETIME(3) NULL,
  `outForDeliveryAt` DATETIME(3) NULL,

  `proofPhotoUrl` VARCHAR(1000) NULL,
  `proofRecipientName` VARCHAR(255) NULL,
  `proofNote` TEXT NULL,
  `deliveredAt` DATETIME(3) NULL,

  `failureReason` TEXT NULL,
  `deliveryHistory` JSON NULL,

  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_delivery_batch_order_pair` (`deliveryBatchId`, `commerceOrderId`),
  KEY `idx_delivery_order_order_status` (`commerceOrderId`, `status`),
  KEY `idx_delivery_order_batch_status` (`deliveryBatchId`, `status`),

  CONSTRAINT `chk_pickup_sequence`
    CHECK (`pickupSequence` IS NULL OR `pickupSequence` > 0),
  CONSTRAINT `chk_delivery_sequence`
    CHECK (`deliverySequence` IS NULL OR `deliverySequence` > 0),

  CONSTRAINT `fk_delivery_order_batch`
    FOREIGN KEY (`deliveryBatchId`) REFERENCES `DeliveryBatch` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_delivery_order_order`
    FOREIGN KEY (`commerceOrderId`) REFERENCES `CommerceOrder` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================================
-- 17. REVIEW
--
-- One review per purchased order item.
-- Photos and merchant reply are simplified into the same table.
-- ============================================================================

CREATE TABLE `Review` (
  `id` CHAR(36) NOT NULL,
  `commerceOrderItemId` CHAR(36) NOT NULL,
  `customerUserId` CHAR(36) NOT NULL,
  `storeId` CHAR(36) NOT NULL,

  `rating` TINYINT NOT NULL,
  `comment` TEXT NULL,
  `photoUrls` JSON NULL,

  `merchantReply` TEXT NULL,
  `repliedByUserId` CHAR(36) NULL,
  `repliedAt` DATETIME(3) NULL,

  `visibilityStatus` ENUM('VISIBLE','HIDDEN') NOT NULL DEFAULT 'VISIBLE',
  `moderationReason` TEXT NULL,
  `moderatedByUserId` CHAR(36) NULL,
  `moderatedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_review_order_item` (`commerceOrderItemId`),
  KEY `idx_review_customer` (`customerUserId`, `createdAt`),
  KEY `idx_review_store` (`storeId`, `visibilityStatus`, `createdAt`),
  KEY `idx_review_reply_user` (`repliedByUserId`),
  KEY `idx_review_moderated_by` (`moderatedByUserId`),

  CONSTRAINT `chk_review_rating`
    CHECK (`rating` BETWEEN 1 AND 5),

  CONSTRAINT `fk_review_order_item`
    FOREIGN KEY (`commerceOrderItemId`) REFERENCES `CommerceOrderItem` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_review_customer`
    FOREIGN KEY (`customerUserId`) REFERENCES `User` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_review_store`
    FOREIGN KEY (`storeId`) REFERENCES `Store` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_review_reply_user`
    FOREIGN KEY (`repliedByUserId`) REFERENCES `User` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_review_moderated_by`
    FOREIGN KEY (`moderatedByUserId`) REFERENCES `User` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================================
-- 18. CONVERSATION
--
-- Simplified two-party conversation model.
-- CUSTOMER_MERCHANT: requester = Customer, counterpart = Merchant
-- SUPPORT: requester = Customer/Merchant/Courier, counterpart = Admin
-- ============================================================================

CREATE TABLE `Conversation` (
  `id` CHAR(36) NOT NULL,
  `type` ENUM('CUSTOMER_MERCHANT','SUPPORT') NOT NULL,
  `openKey` VARCHAR(255) NULL,
  `subject` VARCHAR(255) NULL,

  `requesterUserId` CHAR(36) NOT NULL,
  `counterpartUserId` CHAR(36) NOT NULL,

  `storeId` CHAR(36) NULL,
  `productId` CHAR(36) NULL,
  `commerceOrderId` CHAR(36) NULL,

  `status` ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
  `closedByUserId` CHAR(36) NULL,
  `closedAt` DATETIME(3) NULL,

  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_conversation_open_key` (`openKey`),
  KEY `idx_conversation_requester` (`requesterUserId`, `updatedAt`),
  KEY `idx_conversation_counterpart` (`counterpartUserId`, `updatedAt`),
  KEY `idx_conversation_store` (`storeId`),
  KEY `idx_conversation_product` (`productId`),
  KEY `idx_conversation_order` (`commerceOrderId`),
  KEY `idx_conversation_status` (`status`, `updatedAt`),

  CONSTRAINT `chk_conversation_participants`
    CHECK (`requesterUserId` <> `counterpartUserId`),

  CONSTRAINT `fk_conversation_requester`
    FOREIGN KEY (`requesterUserId`) REFERENCES `User` (`id`)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_conversation_counterpart`
    FOREIGN KEY (`counterpartUserId`) REFERENCES `User` (`id`)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_conversation_store`
    FOREIGN KEY (`storeId`) REFERENCES `Store` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_conversation_product`
    FOREIGN KEY (`productId`) REFERENCES `Product` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_conversation_order`
    FOREIGN KEY (`commerceOrderId`) REFERENCES `CommerceOrder` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_conversation_closed_by`
    FOREIGN KEY (`closedByUserId`) REFERENCES `User` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================================
-- 19. MESSAGE
--
-- Two-party conversation allows one recipient read timestamp per message.
-- Socket.IO transports realtime events; MySQL remains source of truth.
-- ============================================================================

CREATE TABLE `Message` (
  `id` CHAR(36) NOT NULL,
  `conversationId` CHAR(36) NOT NULL,
  `senderUserId` CHAR(36) NOT NULL,
  `message` TEXT NOT NULL,
  `attachmentUrl` VARCHAR(1000) NULL,
  `readAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  KEY `idx_message_conversation_created` (`conversationId`, `createdAt`),
  KEY `idx_message_sender_created` (`senderUserId`, `createdAt`),
  KEY `idx_message_read` (`conversationId`, `readAt`),

  CONSTRAINT `fk_message_conversation`
    FOREIGN KEY (`conversationId`) REFERENCES `Conversation` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_message_sender`
    FOREIGN KEY (`senderUserId`) REFERENCES `User` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================================
-- 20. NOTIFICATION
-- entityType/entityId are intentionally loose navigation/event references.
-- ============================================================================

CREATE TABLE `Notification` (
  `id` CHAR(36) NOT NULL,
  `userId` CHAR(36) NOT NULL,
  `type` VARCHAR(100) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `body` TEXT NOT NULL,
  `entityType` VARCHAR(100) NULL,
  `entityId` CHAR(36) NULL,
  `dedupeKey` VARCHAR(255) NULL,
  `metadata` JSON NULL,
  `readAt` DATETIME(3) NULL,
  `expiresAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_notification_dedupe_key` (`dedupeKey`),
  KEY `idx_notification_user_created` (`userId`, `createdAt`),
  KEY `idx_notification_user_read` (`userId`, `readAt`),
  KEY `idx_notification_entity` (`entityType`, `entityId`),

  CONSTRAINT `fk_notification_user`
    FOREIGN KEY (`userId`) REFERENCES `User` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;
