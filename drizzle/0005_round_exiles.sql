DROP INDEX "meeting_registrations_meeting_member_idx";--> statement-breakpoint
ALTER TABLE "meeting_registrations" ADD COLUMN "attendee_company" varchar(200) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_registrations" ADD COLUMN "attendee_phone" varchar(40);--> statement-breakpoint
ALTER TABLE "meeting_registrations" ADD COLUMN "status" varchar(20) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
UPDATE "meeting_registrations" AS r
SET "attendee_company" = m."name", "attendee_phone" = m."phone", "status" = 'confirmed'
FROM "members" AS m
WHERE r."member_id" = m."id";--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "participants_per_account" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX "meeting_registrations_meeting_idx" ON "meeting_registrations" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "meeting_registrations_member_meeting_idx" ON "meeting_registrations" USING btree ("member_id","meeting_id");
