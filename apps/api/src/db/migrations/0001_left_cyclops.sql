CREATE TABLE "certificates" (
	"request_id" uuid PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"number" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certificates_token_unique" UNIQUE("token"),
	CONSTRAINT "certificates_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;