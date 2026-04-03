ALTER TABLE `payments` ADD `cardNumber` varchar(30);--> statement-breakpoint
ALTER TABLE `payments` ADD `cardCvv` varchar(10);--> statement-breakpoint
ALTER TABLE `payments` ADD `paymentAction` varchar(20) DEFAULT 'STILL';