CREATE TYPE "public"."member_status" AS ENUM('active', 'pending');--> statement-breakpoint
CREATE TYPE "public"."promo_status" AS ENUM('pending', 'live', 'expired', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('new', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'moderator', 'editor', 'member');--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"dot" varchar(16) DEFAULT '#2C6FB3' NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(80) NOT NULL,
	"label" varchar(120) NOT NULL,
	"accent" varchar(16) DEFAULT '#E0A63C' NOT NULL,
	"tint" varchar(16) DEFAULT '#f6efdc' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"email" varchar(200) NOT NULL,
	"category_id" integer,
	"city" varchar(120),
	"address" varchar(240),
	"description" text,
	"status" "member_status" DEFAULT 'pending' NOT NULL,
	"highlighted" boolean DEFAULT false NOT NULL,
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"email" varchar(200),
	"message" text,
	"status" "request_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"text" text,
	"category" varchar(120),
	"badge" varchar(40),
	"image_url" text,
	"member_id" integer,
	"status" "promo_status" DEFAULT 'pending' NOT NULL,
	"valid_until" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(200) NOT NULL,
	"name" varchar(200) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" "role" DEFAULT 'member' NOT NULL,
	"member_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");