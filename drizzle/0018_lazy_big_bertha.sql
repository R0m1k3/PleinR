CREATE TYPE "public"."info_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "information_reads" (
	"id" serial PRIMARY KEY NOT NULL,
	"information_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "informations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"image_url" text,
	"status" "info_status" DEFAULT 'draft' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"author_id" integer,
	"email_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "information_reads" ADD CONSTRAINT "information_reads_information_id_informations_id_fk" FOREIGN KEY ("information_id") REFERENCES "public"."informations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "information_reads" ADD CONSTRAINT "information_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "informations" ADD CONSTRAINT "informations_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "information_reads_user_info_idx" ON "information_reads" USING btree ("user_id","information_id");--> statement-breakpoint
CREATE INDEX "informations_feed_idx" ON "informations" USING btree ("status","published_at");