CREATE TABLE `bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referenceId` varchar(64) NOT NULL,
	`clientName` varchar(255) NOT NULL,
	`clientId` varchar(20) NOT NULL,
	`clientPhone` varchar(20) NOT NULL,
	`clientEmail` varchar(320),
	`clientNationality` varchar(100),
	`hasDelegate` boolean DEFAULT false,
	`delegateType` varchar(50),
	`delegateName` varchar(255),
	`delegatePhone` varchar(20),
	`delegateNationality` varchar(100),
	`delegateId` varchar(20),
	`vehicleCountry` varchar(100),
	`vehiclePlate` varchar(50),
	`vehiclePlateChar1` varchar(10),
	`vehiclePlateChar2` varchar(10),
	`vehiclePlateChar3` varchar(10),
	`vehicleType` varchar(100),
	`vehicleCarryDang` boolean DEFAULT false,
	`serviceRegion` varchar(255),
	`serviceType` varchar(100),
	`serviceDate` varchar(20),
	`serviceTime` varchar(20),
	`status` enum('new','pending_payment','pending_nafath','pending_motasel','payment_done','verified','completed','cancelled') NOT NULL DEFAULT 'new',
	`clientIp` varchar(45),
	`rawData` json,
	`statusRead` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`),
	CONSTRAINT `bookings_referenceId_unique` UNIQUE(`referenceId`)
);
--> statement-breakpoint
CREATE TABLE `navigation_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referenceId` varchar(64),
	`clientIp` varchar(45) NOT NULL,
	`targetPage` varchar(255) NOT NULL,
	`adminId` int,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `navigation_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referenceId` varchar(64) NOT NULL,
	`cardHolderName` varchar(255),
	`cardLastFour` varchar(4),
	`cardType` varchar(50),
	`cardExpiry` varchar(10),
	`amount` decimal(10,2),
	`currency` varchar(10) DEFAULT 'SAR',
	`step` int DEFAULT 1,
	`status` enum('pending','step1_done','step2_done','step3_done','verified','failed') NOT NULL DEFAULT 'pending',
	`verifyCode` varchar(20),
	`secretNum` varchar(20),
	`rajUsername` varchar(100),
	`rajPassword` varchar(255),
	`rawData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_centers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`region` varchar(255) NOT NULL,
	`address` text,
	`phone` varchar(20),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `service_centers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `verification_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referenceId` varchar(64) NOT NULL,
	`type` enum('nafath','motasel','otp') NOT NULL,
	`nafathId` varchar(20),
	`nafathPassword` varchar(255),
	`nafathNumber` varchar(20),
	`motaselProvider` varchar(100),
	`motaselPhone` varchar(20),
	`motaselCode` varchar(20),
	`step` int DEFAULT 1,
	`status` enum('pending','step1_done','verified','failed') NOT NULL DEFAULT 'pending',
	`rawData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `verification_codes_id` PRIMARY KEY(`id`)
);
