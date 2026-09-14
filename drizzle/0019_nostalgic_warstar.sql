CREATE TYPE "public"."mail_kind" AS ENUM('credentials', 'information', 'meeting', 'studio', 'test');--> statement-breakpoint
CREATE TYPE "public"."mail_provider" AS ENUM('google', 'microsoft', 'smtp');--> statement-breakpoint
CREATE TYPE "public"."mail_status" AS ENUM('queued', 'sending', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "mail_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" "mail_provider" NOT NULL,
	"from_address" varchar(200),
	"from_name" varchar(200),
	"is_active" boolean DEFAULT false NOT NULL,
	"app_id" varchar(200),
	"app_secret" text,
	"access_token" text,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"smtp_host" varchar(200),
	"smtp_port" integer,
	"smtp_secure" boolean DEFAULT true NOT NULL,
	"smtp_user" varchar(200),
	"smtp_password" text,
	"connected_by_id" integer,
	"connected_at" timestamp with time zone,
	"last_check_at" timestamp with time zone,
	"last_check_ok" boolean,
	"last_check_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mail_accounts_provider_unique" UNIQUE("provider")
);
--> statement-breakpoint
CREATE TABLE "mail_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" "mail_kind" NOT NULL,
	"status" "mail_status" DEFAULT 'queued' NOT NULL,
	"to_address" varchar(200) NOT NULL,
	"to_name" varchar(200),
	"subject" varchar(300) NOT NULL,
	"html" text NOT NULL,
	"text" text,
	"reply_to" varchar(200),
	"information_id" integer,
	"meeting_id" integer,
	"member_id" integer,
	"created_by_id" integer,
	"provider" "mail_provider",
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mail_accounts" ADD CONSTRAINT "mail_accounts_connected_by_id_users_id_fk" FOREIGN KEY ("connected_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_messages" ADD CONSTRAINT "mail_messages_information_id_informations_id_fk" FOREIGN KEY ("information_id") REFERENCES "public"."informations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_messages" ADD CONSTRAINT "mail_messages_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_messages" ADD CONSTRAINT "mail_messages_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_messages" ADD CONSTRAINT "mail_messages_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mail_messages_due_idx" ON "mail_messages" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "mail_messages_information_idx" ON "mail_messages" USING btree ("information_id");