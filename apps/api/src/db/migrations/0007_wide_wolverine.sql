CREATE TYPE "public"."discussion_report_status" AS ENUM('pending', 'hidden', 'dismissed');--> statement-breakpoint
CREATE TABLE "discussion_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" "discussion_report_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid
);
--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "discussion_reports" ADD CONSTRAINT "discussion_reports_comment_id_discussion_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."discussion_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_reports" ADD CONSTRAINT "discussion_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_reports" ADD CONSTRAINT "discussion_reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "discussion_reports_comment_reporter_idx" ON "discussion_reports" USING btree ("comment_id","reporter_id");--> statement-breakpoint
CREATE INDEX "discussion_reports_queue_idx" ON "discussion_reports" USING btree ("status","created_at");