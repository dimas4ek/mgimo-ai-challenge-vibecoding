ALTER TABLE "groups" ADD COLUMN "curator" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "announcements" text[] DEFAULT ARRAY[]::text[] NOT NULL;