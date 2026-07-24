CREATE TYPE "public"."promo_suspended_by" AS ENUM('member', 'staff');--> statement-breakpoint
CREATE TYPE "public"."social_network" AS ENUM('facebook', 'linkedin');--> statement-breakpoint
CREATE TYPE "public"."social_post_status" AS ENUM('posted', 'failed');--> statement-breakpoint
ALTER TYPE "public"."promo_status" ADD VALUE 'suspended';--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"promotion_id" integer NOT NULL,
	"network" "social_network" NOT NULL,
	"status" "social_post_status" NOT NULL,
	"external_id" varchar(200),
	"url" text,
	"error" text,
	"posted_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "suspended_by" "promo_suspended_by";--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "suspended_by_id" integer;--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_posted_by_id_users_id_fk" FOREIGN KEY ("posted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "social_posts_promotion_idx" ON "social_posts" USING btree ("promotion_id");--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_suspended_by_id_users_id_fk" FOREIGN KEY ("suspended_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;