ALTER TYPE "public"."promo_status" ADD VALUE 'scheduled';--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "publish_at" timestamp with time zone;