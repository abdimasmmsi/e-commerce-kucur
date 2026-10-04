CREATE TYPE "ProductStatus" AS ENUM ('active', 'inactive');

CREATE TABLE "products" (
  "id" UUID NOT NULL, "store_id" UUID NOT NULL, "name" VARCHAR(180) NOT NULL,
  "description" TEXT NOT NULL, "category" VARCHAR(100) NOT NULL,
  "status" "ProductStatus" NOT NULL DEFAULT 'active', "has_variants" BOOLEAN NOT NULL DEFAULT false,
  "price" DECIMAL(14,2), "stock" INTEGER, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "products_price_check" CHECK ("price" IS NULL OR "price" >= 0),
  CONSTRAINT "products_stock_check" CHECK ("stock" IS NULL OR "stock" >= 0),
  CONSTRAINT "products_inventory_shape_check" CHECK (("has_variants" = true AND "price" IS NULL AND "stock" IS NULL) OR ("has_variants" = false AND "price" IS NOT NULL AND "stock" IS NOT NULL))
);
CREATE TABLE "product_images" ("id" UUID NOT NULL, "product_id" UUID NOT NULL, "url" VARCHAR(2000) NOT NULL, "storage_key" VARCHAR(500), "position" INTEGER NOT NULL, "is_primary" BOOLEAN NOT NULL DEFAULT false, CONSTRAINT "product_images_pkey" PRIMARY KEY ("id"));
CREATE TABLE "product_options" ("id" UUID NOT NULL, "product_id" UUID NOT NULL, "name" VARCHAR(80) NOT NULL, "values" TEXT[], "position" INTEGER NOT NULL, CONSTRAINT "product_options_pkey" PRIMARY KEY ("id"));
CREATE TABLE "product_variants" ("id" UUID NOT NULL, "product_id" UUID NOT NULL, "sku" VARCHAR(100) NOT NULL, "combination_key" VARCHAR(1000) NOT NULL, "options" JSONB NOT NULL, "price" DECIMAL(14,2) NOT NULL, "stock" INTEGER NOT NULL, "status" "ProductStatus" NOT NULL DEFAULT 'active', "image_url" VARCHAR(2000), "image_storage_key" VARCHAR(500), CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id"), CONSTRAINT "product_variants_price_check" CHECK ("price" >= 0), CONSTRAINT "product_variants_stock_check" CHECK ("stock" >= 0));
CREATE INDEX "products_store_id_idx" ON "products"("store_id");
CREATE INDEX "products_status_idx" ON "products"("status");
CREATE UNIQUE INDEX "product_images_product_id_position_key" ON "product_images"("product_id", "position");
CREATE UNIQUE INDEX "product_images_one_primary_per_product_key" ON "product_images"("product_id") WHERE "is_primary" = true;
CREATE INDEX "product_images_product_id_idx" ON "product_images"("product_id");
CREATE UNIQUE INDEX "product_options_product_id_name_key" ON "product_options"("product_id", "name");
CREATE UNIQUE INDEX "product_options_product_id_position_key" ON "product_options"("product_id", "position");
CREATE UNIQUE INDEX "product_variants_product_id_sku_key" ON "product_variants"("product_id", "sku");
CREATE UNIQUE INDEX "product_variants_product_id_combination_key_key" ON "product_variants"("product_id", "combination_key");
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_options" ADD CONSTRAINT "product_options_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
