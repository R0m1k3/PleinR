CREATE TABLE "image_consents" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"decision" varchar(20) NOT NULL,
	"scopes" text,
	"signatory_name" varchar(200),
	"signature_png" text,
	"consent_version" varchar(40) NOT NULL,
	"ip" varchar(120),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_id" integer NOT NULL,
	"member_id" integer,
	"attendee_name" varchar(200) NOT NULL,
	"attendee_email" varchar(200),
	"image_consent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"location" varchar(240),
	"description" text,
	"capacity" integer DEFAULT 30 NOT NULL,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "past_meeting_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"past_meeting_id" integer NOT NULL,
	"image_url" text NOT NULL,
	"caption" varchar(200),
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "past_meetings" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"event_date" timestamp with time zone NOT NULL,
	"location" varchar(240),
	"description" text,
	"participants" text,
	"meeting_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" varchar(120) PRIMARY KEY NOT NULL,
	"value" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "image_consents" ADD CONSTRAINT "image_consents_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_registrations" ADD CONSTRAINT "meeting_registrations_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_registrations" ADD CONSTRAINT "meeting_registrations_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "past_meeting_photos" ADD CONSTRAINT "past_meeting_photos_past_meeting_id_past_meetings_id_fk" FOREIGN KEY ("past_meeting_id") REFERENCES "public"."past_meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "past_meetings" ADD CONSTRAINT "past_meetings_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "meeting_registrations_meeting_member_idx" ON "meeting_registrations" USING btree ("meeting_id","member_id");