ALTER TABLE "members" ADD COLUMN "cover_url" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "phone" varchar(40);--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "website" varchar(200);--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "postal_code" varchar(20);--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "member_since" integer;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "hours" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "tags" text;