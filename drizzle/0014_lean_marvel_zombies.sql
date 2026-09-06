ALTER TABLE "social_accounts" ADD COLUMN "last_check_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD COLUMN "last_check_ok" boolean;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD COLUMN "last_check_error" text;