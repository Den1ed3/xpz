CREATE TABLE `matches` (
  `id` text PRIMARY KEY NOT NULL,
  `started` integer NOT NULL,
  `payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text,
  `checked` integer NOT NULL
);
