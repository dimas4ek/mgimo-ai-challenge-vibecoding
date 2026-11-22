CREATE TABLE "curriculum" (
	"group_id" uuid NOT NULL,
	"semester_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"control_form" "control_form" NOT NULL,
	"credits" integer NOT NULL,
	"lecture_hours" integer NOT NULL,
	"practice_hours" integer NOT NULL,
	"independent_hours" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "curriculum" ADD CONSTRAINT "curriculum_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum" ADD CONSTRAINT "curriculum_semester_id_semesters_id_fk" FOREIGN KEY ("semester_id") REFERENCES "public"."semesters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum" ADD CONSTRAINT "curriculum_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum" ADD CONSTRAINT "curriculum_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "curriculum_group_semester_subject_idx" ON "curriculum" USING btree ("group_id","semester_id","subject_id");