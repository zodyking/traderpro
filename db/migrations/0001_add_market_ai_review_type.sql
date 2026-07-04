ALTER TABLE "ai_reviews" DROP CONSTRAINT IF EXISTS "ai_reviews_target_type_check";--> statement-breakpoint
ALTER TABLE "ai_reviews" ADD CONSTRAINT "ai_reviews_target_type_check" CHECK ("ai_reviews"."target_type" IN ('strategy', 'trade', 'risk', 'lesson', 'market'));
