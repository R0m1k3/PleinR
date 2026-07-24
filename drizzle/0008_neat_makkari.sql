CREATE TABLE "social_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"network" "social_network" NOT NULL,
	"app_id" varchar(200) NOT NULL,
	"app_secret" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"target_id" varchar(200),
	"target_name" varchar(200),
	"connected_by_id" integer,
	"connected_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_accounts_network_unique" UNIQUE("network")
);
--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_connected_by_id_users_id_fk" FOREIGN KEY ("connected_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;