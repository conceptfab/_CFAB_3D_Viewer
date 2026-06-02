CREATE TABLE "studio_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"source_blob_url" text NOT NULL,
	"source_file_name" text NOT NULL,
	"source_kind" text NOT NULL,
	"config" jsonb NOT NULL,
	"thumb_blob_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "studio_projects" ADD CONSTRAINT "studio_projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "studio_projects_owner_id_idx" ON "studio_projects" USING btree ("owner_id");