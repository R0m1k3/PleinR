CREATE TABLE "home_spotlights" (
	"slot" integer PRIMARY KEY NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"name" varchar(160) DEFAULT '' NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"image_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "home_spotlights_slot_check" CHECK ("home_spotlights"."slot" BETWEEN 1 AND 4)
);
