-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('MODERATOR', 'SUPPORT', 'FINANCE', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "SellerType" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('EMAIL', 'PHONE', 'IDENTITY', 'BUSINESS', 'BENEFICIAL_OWNER');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CheckoutMode" AS ENUM ('INTEGRATED', 'CLASSIFIED_ONLY', 'DISABLED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'RESERVED', 'SOLD', 'SUSPENDED', 'REJECTED', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('NEW_WITH_TAGS', 'NEW_WITHOUT_TAGS', 'VERY_GOOD', 'GOOD', 'FAIR', 'FOR_PARTS');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('HAND_DELIVERY', 'NATIONAL_SHIPPING', 'TAMURT_TRANSPORT');

-- CreateEnum
CREATE TYPE "ParcelSize" AS ENUM ('XS', 'S', 'M', 'L', 'XL');

-- CreateEnum
CREATE TYPE "AttributeType" AS ENUM ('TEXT', 'NUMBER', 'SELECT', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('ALLOWED', 'CONDITIONAL', 'TO_VERIFY', 'PROHIBITED');

-- CreateEnum
CREATE TYPE "ComplianceRecordStatus" AS ENUM ('VALID', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'PAYMENT_PENDING', 'PAID', 'SHIPPING_PENDING', 'READY_TO_SHIP', 'IN_TRANSIT', 'DELIVERED', 'DISPUTE_WINDOW', 'COMPLETED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('REQUIRES_ACTION', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'BLOCKED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "FeeKind" AS ENUM ('BUYER_PROTECTION', 'SELLER_COMMISSION');

-- CreateEnum
CREATE TYPE "TaxStatus" AS ENUM ('NONE', 'INCLUDED', 'ESTIMATED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ShippingProviderKind" AS ENUM ('NATIONAL_CARRIER', 'CROWDSHIPPING', 'HAND_DELIVERY');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'LABEL_CREATED', 'HANDED_OVER', 'IN_TRANSIT', 'CUSTOMS_HOLD', 'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransportReservationStatus" AS ENUM ('HELD', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_MESSAGE', 'NEW_ORDER', 'PAYMENT_CONFIRMED', 'ORDER_SHIPPED', 'ORDER_DELIVERED', 'ORDER_COMPLETED', 'ORDER_CANCELLED', 'REFUND_ISSUED', 'PAYOUT_SENT', 'DISPUTE_OPENED', 'DISPUTE_UPDATED', 'REVIEW_RECEIVED', 'LISTING_APPROVED', 'LISTING_REJECTED', 'LISTING_SUSPENDED', 'SAVED_SEARCH_MATCH', 'ACCOUNT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('LISTING', 'USER', 'MESSAGE', 'REVIEW');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('PROHIBITED_ITEM', 'COUNTERFEIT', 'SCAM', 'MISLEADING', 'OFFENSIVE', 'SPAM', 'WRONG_CATEGORY', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'ACTIONED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('VISIBLE', 'PENDING', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ReviewRole" AS ENUM ('BUYER', 'SELLER');

-- CreateEnum
CREATE TYPE "DisputeReason" AS ENUM ('NOT_RECEIVED', 'DAMAGED', 'NOT_AS_DESCRIBED', 'COUNTERFEIT', 'MISLEADING', 'LOST', 'WRONG_RECIPIENT', 'OTHER');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'AWAITING_SELLER', 'AWAITING_BUYER', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DisputeResolution" AS ENUM ('FULL_REFUND', 'PARTIAL_REFUND', 'NO_REFUND');

-- CreateEnum
CREATE TYPE "DisputeMessageVisibility" AS ENUM ('PARTIES', 'STAFF_ONLY');

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('APPROVE_LISTING', 'REJECT_LISTING', 'SUSPEND_LISTING', 'REINSTATE_LISTING', 'REMOVE_LISTING', 'SUSPEND_USER', 'BAN_USER', 'REINSTATE_USER', 'HIDE_MESSAGE', 'HIDE_REVIEW', 'RESTORE_REVIEW', 'DISMISS_REPORT');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "IntegrationDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "IntegrationEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'DEAD', 'IGNORED');

-- CreateEnum
CREATE TYPE "IntegrationHealthStatus" AS ENUM ('UNKNOWN', 'UP', 'DEGRADED', 'DOWN');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "twoFactorEnabled" BOOLEAN DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "statusReason" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "termsAcceptedAt" TIMESTAMP(3),
    "onboardedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verified" BOOLEAN DEFAULT true,
    "failedVerificationCount" INTEGER DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "twoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "rateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profile" (
    "userId" TEXT NOT NULL,
    "handle" VARCHAR(40) NOT NULL,
    "displayName" VARCHAR(60) NOT NULL,
    "bio" VARCHAR(1000),
    "avatarKey" TEXT,
    "countryCode" CHAR(2),
    "regionId" UUID,
    "cityName" VARCHAR(120),
    "sellerType" "SellerType" NOT NULL DEFAULT 'INDIVIDUAL',
    "ratingSum" INTEGER NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "purchasesCount" INTEGER NOT NULL DEFAULT 0,
    "sellerCancelledCount" INTEGER NOT NULL DEFAULT 0,
    "disputesLostCount" INTEGER NOT NULL DEFAULT 0,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "user_contact" (
    "userId" TEXT NOT NULL,
    "firstName" VARCHAR(80),
    "lastName" VARCHAR(80),
    "phone" VARCHAR(32),
    "phoneVerifiedAt" TIMESTAMP(3),
    "birthYear" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_contact_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "user_role" (
    "userId" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "grantedById" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_role_pkey" PRIMARY KEY ("userId","role")
);

-- CreateTable
CREATE TABLE "user_verification" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "VerificationType" NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerRef" TEXT,
    "failureReason" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_profile" (
    "userId" TEXT NOT NULL,
    "legalName" VARCHAR(200) NOT NULL,
    "tradeName" VARCHAR(200),
    "legalForm" VARCHAR(80),
    "registrationCountry" CHAR(2) NOT NULL,
    "registrationNumber" VARCHAR(64) NOT NULL,
    "vatNumber" VARCHAR(32),
    "addressLine1" VARCHAR(200) NOT NULL,
    "addressLine2" VARCHAR(200),
    "postalCode" VARCHAR(16),
    "city" VARCHAR(120) NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "contactEmail" VARCHAR(200) NOT NULL,
    "contactPhone" VARCHAR(32),
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "verifiedAt" TIMESTAMP(3),
    "traderDeclarationAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_profile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "address" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "label" VARCHAR(60),
    "fullName" VARCHAR(120) NOT NULL,
    "line1" VARCHAR(200) NOT NULL,
    "line2" VARCHAR(200),
    "postalCode" VARCHAR(16),
    "city" VARCHAR(120) NOT NULL,
    "regionId" UUID,
    "countryCode" CHAR(2) NOT NULL,
    "phone" VARCHAR(32),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_block" (
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_block_pkey" PRIMARY KEY ("blockerId","blockedId")
);

-- CreateTable
CREATE TABLE "country" (
    "code" CHAR(2) NOT NULL,
    "name" TEXT NOT NULL,
    "nativeName" TEXT,
    "currency" CHAR(3) NOT NULL,
    "phonePrefix" VARCHAR(6) NOT NULL,
    "regionLabel" TEXT NOT NULL DEFAULT 'Région',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "checkoutMode" "CheckoutMode" NOT NULL DEFAULT 'DISABLED',
    "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "geoDatasetVersion" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "country_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "region" (
    "id" UUID NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "datasetVersion" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "city" (
    "id" UUID NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "regionId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "searchNames" TEXT[],
    "postalCode" VARCHAR(16),
    "isPopular" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "city_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category" (
    "id" UUID NOT NULL,
    "parentId" UUID,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "translations" JSONB NOT NULL DEFAULT '{}',
    "description" VARCHAR(500),
    "icon" VARCHAR(40),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isTransactional" BOOLEAN NOT NULL DEFAULT true,
    "requiresReview" BOOLEAN NOT NULL DEFAULT false,
    "isProhibited" BOOLEAN NOT NULL DEFAULT false,
    "conditionRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_attribute" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "key" VARCHAR(40) NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "type" "AttributeType" NOT NULL,
    "options" JSONB,
    "unit" VARCHAR(16),
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isFilterable" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "category_attribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "normalizedName" VARCHAR(60) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing" (
    "id" UUID NOT NULL,
    "publicId" VARCHAR(12) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "sellerId" TEXT NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "title" VARCHAR(100) NOT NULL,
    "description" VARCHAR(5000) NOT NULL,
    "categoryId" UUID NOT NULL,
    "brandId" UUID,
    "brandName" VARCHAR(60),
    "condition" "ItemCondition",
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "priceAmount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "quantityAvailable" INTEGER NOT NULL DEFAULT 1,
    "countryCode" CHAR(2) NOT NULL,
    "regionId" UUID NOT NULL,
    "cityId" UUID,
    "locality" VARCHAR(120),
    "deliveryMethods" "DeliveryMethod"[],
    "parcelSize" "ParcelSize",
    "weightGrams" INTEGER,
    "acceptsCrossBorder" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "favoriteCount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "moderationNote" VARCHAR(1000),
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "searchVector" tsvector,

    CONSTRAINT "listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_image" (
    "id" UUID NOT NULL,
    "listingId" UUID,
    "ownerId" TEXT NOT NULL,
    "thumbKey" TEXT NOT NULL,
    "largeKey" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "blurDataUrl" VARCHAR(2000),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_revision" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "editorId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedFields" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorite" (
    "userId" TEXT NOT NULL,
    "listingId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_pkey" PRIMARY KEY ("userId","listingId")
);

-- CreateTable
CREATE TABLE "saved_search" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "query" JSONB NOT NULL,
    "queryHash" VARCHAR(64) NOT NULL,
    "notify" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_search_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_rule" (
    "id" UUID NOT NULL,
    "originCountry" CHAR(2),
    "destinationCountry" CHAR(2),
    "categoryId" UUID,
    "paymentProvider" VARCHAR(40),
    "carrier" VARCHAR(40),
    "status" "ComplianceStatus" NOT NULL,
    "conditions" VARCHAR(2000),
    "maxDeclaredValueMinor" INTEGER,
    "legalBasis" VARCHAR(1000),
    "notes" VARCHAR(2000),
    "reviewedAt" TIMESTAMP(3),
    "reviewedByName" VARCHAR(200),
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_record" (
    "id" UUID NOT NULL,
    "subjectType" VARCHAR(40) NOT NULL,
    "subjectRef" VARCHAR(120) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "status" "ComplianceRecordStatus" NOT NULL DEFAULT 'VALID',
    "validatedBy" VARCHAR(200) NOT NULL,
    "validatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "documentRef" VARCHAR(500),
    "notes" VARCHAR(2000),
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "listingId" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'CREATED',
    "deliveryMethod" "DeliveryMethod" NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "itemsSubtotal" INTEGER NOT NULL,
    "buyerFee" INTEGER NOT NULL,
    "shippingAmount" INTEGER NOT NULL,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL,
    "sellerNetAmount" INTEGER NOT NULL,
    "originCountry" CHAR(2) NOT NULL,
    "destinationCountry" CHAR(2) NOT NULL,
    "isCrossBorder" BOOLEAN NOT NULL DEFAULT false,
    "shippingAddress" JSONB,
    "reservationExpiresAt" TIMESTAMP(3),
    "disputeWindowEndsAt" TIMESTAMP(3),
    "handoverCodeHash" TEXT,
    "handoverAttempts" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" VARCHAR(80) NOT NULL,
    "isSimulated" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "categoryId" UUID NOT NULL,
    "condition" "ItemCondition",
    "imageKey" TEXT,

    CONSTRAINT "order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "actorType" VARCHAR(16) NOT NULL,
    "actorId" TEXT,
    "reason" VARCHAR(500),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_snapshot" (
    "orderId" UUID NOT NULL,
    "calculatorVersion" VARCHAR(16) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "itemsSubtotal" INTEGER NOT NULL,
    "buyerFeeRuleId" UUID,
    "buyerFeeRateBps" INTEGER NOT NULL,
    "buyerFeeFixed" INTEGER NOT NULL DEFAULT 0,
    "buyerFee" INTEGER NOT NULL,
    "sellerFeeRuleId" UUID,
    "sellerFeeRateBps" INTEGER NOT NULL DEFAULT 0,
    "sellerFee" INTEGER NOT NULL DEFAULT 0,
    "shippingQuoteId" UUID,
    "shippingProvider" VARCHAR(40),
    "shippingAmount" INTEGER NOT NULL,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "taxStatus" "TaxStatus" NOT NULL DEFAULT 'NONE',
    "taxNote" VARCHAR(500),
    "totalAmount" INTEGER NOT NULL,
    "sellerNetAmount" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_snapshot_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "fee_rule" (
    "id" UUID NOT NULL,
    "kind" "FeeKind" NOT NULL,
    "currency" CHAR(3),
    "countryCode" CHAR(2),
    "sellerType" "SellerType",
    "rateBps" INTEGER NOT NULL,
    "fixedAmount" INTEGER NOT NULL DEFAULT 0,
    "minAmount" INTEGER NOT NULL DEFAULT 0,
    "maxAmount" INTEGER,
    "activeFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeUntil" TIMESTAMP(3),
    "note" VARCHAR(500),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "providerSessionId" TEXT,
    "providerPaymentId" TEXT,
    "idempotencyKey" VARCHAR(120) NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'REQUIRES_ACTION',
    "amountRefunded" INTEGER NOT NULL DEFAULT 0,
    "providerFeeAmount" INTEGER,
    "failureCode" VARCHAR(80),
    "failureMessage" VARCHAR(500),
    "isSimulated" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "succeededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "disputeId" UUID,
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "includesShipping" BOOLEAN NOT NULL DEFAULT false,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "providerRefundId" TEXT,
    "idempotencyKey" VARCHAR(120) NOT NULL,
    "initiatedById" TEXT,
    "failureMessage" VARCHAR(500),
    "succeededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_account" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "requirementsDue" TEXT[],
    "isSimulated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "sellerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "blockedReason" VARCHAR(500),
    "providerTransferId" TEXT,
    "idempotencyKey" VARCHAR(120) NOT NULL,
    "isSimulated" BOOLEAN NOT NULL DEFAULT false,
    "scheduledFor" TIMESTAMP(3),
    "failureMessage" VARCHAR(500),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_transaction" (
    "id" UUID NOT NULL,
    "orderId" UUID,
    "kind" VARCHAR(40) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "idempotencyKey" VARCHAR(160) NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entry" (
    "id" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "account" VARCHAR(60) NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_event" (
    "id" UUID NOT NULL,
    "source" VARCHAR(40) NOT NULL,
    "eventId" VARCHAR(200) NOT NULL,
    "eventType" VARCHAR(120) NOT NULL,
    "payload" JSONB NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "status" "IntegrationEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" VARCHAR(1000),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "webhook_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_record" (
    "scope" VARCHAR(60) NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "userId" TEXT,
    "requestHash" VARCHAR(64) NOT NULL,
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_record_pkey" PRIMARY KEY ("scope","key")
);

-- CreateTable
CREATE TABLE "shipping_provider" (
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "kind" "ShippingProviderKind" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isSandbox" BOOLEAN NOT NULL DEFAULT false,
    "supportedCountries" TEXT[],
    "supportsCrossBorder" BOOLEAN NOT NULL DEFAULT false,
    "capabilities" JSONB NOT NULL DEFAULT '{}',
    "notes" VARCHAR(1000),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_provider_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "shipping_quote" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "buyerId" TEXT,
    "providerCode" VARCHAR(40) NOT NULL,
    "serviceCode" VARCHAR(60) NOT NULL,
    "serviceName" VARCHAR(120) NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "originCountry" CHAR(2) NOT NULL,
    "destinationCountry" CHAR(2) NOT NULL,
    "estimatedDaysMin" INTEGER,
    "estimatedDaysMax" INTEGER,
    "externalQuoteId" VARCHAR(120),
    "details" JSONB,
    "isSimulated" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedByOrderId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipping_quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "providerCode" VARCHAR(40) NOT NULL,
    "serviceCode" VARCHAR(60) NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "trackingNumber" VARCHAR(80),
    "trackingUrl" VARCHAR(500),
    "labelKey" TEXT,
    "externalShipmentId" VARCHAR(120),
    "isSimulated" BOOLEAN NOT NULL DEFAULT false,
    "originCountry" CHAR(2) NOT NULL,
    "destinationCountry" CHAR(2) NOT NULL,
    "handedOverAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_event" (
    "id" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "status" "ShipmentStatus" NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "location" VARCHAR(120),
    "source" VARCHAR(20) NOT NULL,
    "externalEventId" VARCHAR(200),
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_reservation" (
    "id" UUID NOT NULL,
    "orderId" UUID,
    "shippingQuoteId" UUID NOT NULL,
    "externalReservationId" VARCHAR(120) NOT NULL,
    "externalShipmentId" VARCHAR(120),
    "status" "TransportReservationStatus" NOT NULL DEFAULT 'HELD',
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "corridor" VARCHAR(5) NOT NULL,
    "holdExpiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "isSimulated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transport_reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_event" (
    "id" UUID NOT NULL,
    "system" VARCHAR(20) NOT NULL,
    "direction" "IntegrationDirection" NOT NULL,
    "operation" VARCHAR(80) NOT NULL,
    "aggregateType" VARCHAR(40),
    "aggregateId" VARCHAR(80),
    "correlationId" VARCHAR(80),
    "status" "IntegrationEventStatus" NOT NULL,
    "httpStatus" INTEGER,
    "durationMs" INTEGER,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "summary" JSONB,
    "error" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_health" (
    "system" VARCHAR(20) NOT NULL,
    "status" "IntegrationHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "circuitOpenUntil" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastError" VARCHAR(1000),
    "apiVersion" VARCHAR(20),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_health_pkey" PRIMARY KEY ("system")
);

-- CreateTable
CREATE TABLE "conversation" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "orderId" UUID,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessagePreview" VARCHAR(140),
    "buyerLastReadAt" TIMESTAMP(3),
    "sellerLastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "senderId" TEXT,
    "kind" "MessageKind" NOT NULL DEFAULT 'TEXT',
    "body" VARCHAR(2000) NOT NULL,
    "riskFlags" TEXT[],
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "hiddenReason" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_attachment" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" VARCHAR(60) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "body" VARCHAR(600) NOT NULL,
    "link" VARCHAR(300),
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preference" (
    "userId" TEXT NOT NULL,
    "channel" VARCHAR(16) NOT NULL,
    "category" VARCHAR(32) NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preference_pkey" PRIMARY KEY ("userId","channel","category")
);

-- CreateTable
CREATE TABLE "email_message" (
    "id" UUID NOT NULL,
    "to" VARCHAR(320) NOT NULL,
    "subject" VARCHAR(300) NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "template" VARCHAR(60) NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "providerMessageId" VARCHAR(200),
    "status" VARCHAR(16) NOT NULL,
    "error" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "authorId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "authorRole" "ReviewRole" NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(1000),
    "status" "ReviewStatus" NOT NULL DEFAULT 'VISIBLE',
    "replyBody" VARCHAR(1000),
    "contestedAt" TIMESTAMP(3),
    "contestReason" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report" (
    "id" UUID NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" VARCHAR(80) NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" VARCHAR(2000),
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "resolutionNote" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "openedById" TEXT NOT NULL,
    "reason" "DisputeReason" NOT NULL,
    "description" VARCHAR(4000) NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "previousOrderStatus" "OrderStatus" NOT NULL,
    "resolution" "DisputeResolution",
    "refundAmount" INTEGER,
    "resolutionNote" VARCHAR(2000),
    "assignedToId" TEXT,
    "sellerRespondBy" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_evidence" (
    "id" UUID NOT NULL,
    "disputeId" UUID NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" VARCHAR(60) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "fileName" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_message" (
    "id" UUID NOT NULL,
    "disputeId" UUID NOT NULL,
    "authorId" TEXT,
    "authorRole" VARCHAR(16) NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "visibility" "DisputeMessageVisibility" NOT NULL DEFAULT 'PARTIES',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_action" (
    "id" UUID NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetType" VARCHAR(20) NOT NULL,
    "targetId" VARCHAR(80) NOT NULL,
    "action" "ModerationActionType" NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "reportId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "actorId" TEXT,
    "actorRoles" TEXT[],
    "action" VARCHAR(80) NOT NULL,
    "targetType" VARCHAR(40) NOT NULL,
    "targetId" VARCHAR(80),
    "metadata" JSONB,
    "ipHash" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flag" (
    "key" VARCHAR(80) NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flag_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "platform_setting" (
    "key" VARCHAR(80) NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "service_api_client" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "tokenPrefix" VARCHAR(12) NOT NULL,
    "scopes" TEXT[],
    "allowedIps" TEXT[],
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "service_api_client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job" (
    "id" UUID NOT NULL,
    "type" VARCHAR(60) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 6,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastError" VARCHAR(2000),
    "dedupeKey" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_event" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "userId" TEXT,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_bucket" (
    "key" VARCHAR(200) NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rate_limit_bucket_pkey" PRIMARY KEY ("key","windowStart")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_status_idx" ON "user"("status");

-- CreateIndex
CREATE INDEX "user_createdAt_idx" ON "user"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "twoFactor_userId_idx" ON "twoFactor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "rateLimit_key_key" ON "rateLimit"("key");

-- CreateIndex
CREATE UNIQUE INDEX "user_profile_handle_key" ON "user_profile"("handle");

-- CreateIndex
CREATE INDEX "user_profile_countryCode_idx" ON "user_profile"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "user_verification_userId_type_key" ON "user_verification"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "business_profile_registrationCountry_registrationNumber_key" ON "business_profile"("registrationCountry", "registrationNumber");

-- CreateIndex
CREATE INDEX "address_userId_idx" ON "address"("userId");

-- CreateIndex
CREATE INDEX "user_block_blockedId_idx" ON "user_block"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "region_countryCode_code_key" ON "region"("countryCode", "code");

-- CreateIndex
CREATE UNIQUE INDEX "region_countryCode_slug_key" ON "region"("countryCode", "slug");

-- CreateIndex
CREATE INDEX "city_regionId_idx" ON "city"("regionId");

-- CreateIndex
CREATE INDEX "city_searchNames_idx" ON "city" USING GIN ("searchNames");

-- CreateIndex
CREATE UNIQUE INDEX "city_countryCode_slug_key" ON "city"("countryCode", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "category_slug_key" ON "category"("slug");

-- CreateIndex
CREATE INDEX "category_parentId_sortOrder_idx" ON "category"("parentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "category_attribute_categoryId_key_key" ON "category_attribute"("categoryId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "brand_slug_key" ON "brand"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "brand_normalizedName_key" ON "brand"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "listing_publicId_key" ON "listing"("publicId");

-- CreateIndex
CREATE INDEX "listing_status_publishedAt_idx" ON "listing"("status", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "listing_status_categoryId_publishedAt_idx" ON "listing"("status", "categoryId", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "listing_status_countryCode_regionId_idx" ON "listing"("status", "countryCode", "regionId");

-- CreateIndex
CREATE INDEX "listing_status_priceAmount_idx" ON "listing"("status", "priceAmount");

-- CreateIndex
CREATE INDEX "listing_sellerId_status_createdAt_idx" ON "listing"("sellerId", "status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "listing_image_thumbKey_key" ON "listing_image"("thumbKey");

-- CreateIndex
CREATE UNIQUE INDEX "listing_image_largeKey_key" ON "listing_image"("largeKey");

-- CreateIndex
CREATE INDEX "listing_image_listingId_sortOrder_idx" ON "listing_image"("listingId", "sortOrder");

-- CreateIndex
CREATE INDEX "listing_image_ownerId_createdAt_idx" ON "listing_image"("ownerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "listing_revision_listingId_version_key" ON "listing_revision"("listingId", "version");

-- CreateIndex
CREATE INDEX "favorite_listingId_idx" ON "favorite"("listingId");

-- CreateIndex
CREATE INDEX "favorite_userId_createdAt_idx" ON "favorite"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "saved_search_userId_queryHash_key" ON "saved_search"("userId", "queryHash");

-- CreateIndex
CREATE INDEX "compliance_rule_originCountry_destinationCountry_idx" ON "compliance_rule"("originCountry", "destinationCountry");

-- CreateIndex
CREATE INDEX "compliance_record_subjectType_subjectRef_idx" ON "compliance_record"("subjectType", "subjectRef");

-- CreateIndex
CREATE UNIQUE INDEX "orders_reference_key" ON "orders"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotencyKey_key" ON "orders"("idempotencyKey");

-- CreateIndex
CREATE INDEX "orders_buyerId_createdAt_idx" ON "orders"("buyerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "orders_sellerId_createdAt_idx" ON "orders"("sellerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "orders_status_reservationExpiresAt_idx" ON "orders"("status", "reservationExpiresAt");

-- CreateIndex
CREATE INDEX "orders_status_disputeWindowEndsAt_idx" ON "orders"("status", "disputeWindowEndsAt");

-- CreateIndex
CREATE INDEX "orders_listingId_idx" ON "orders"("listingId");

-- CreateIndex
CREATE INDEX "order_item_orderId_idx" ON "order_item"("orderId");

-- CreateIndex
CREATE INDEX "order_status_history_orderId_createdAt_idx" ON "order_status_history"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "fee_rule_kind_activeFrom_idx" ON "fee_rule"("kind", "activeFrom");

-- CreateIndex
CREATE UNIQUE INDEX "payment_providerSessionId_key" ON "payment"("providerSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_providerPaymentId_key" ON "payment"("providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_idempotencyKey_key" ON "payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payment_orderId_idx" ON "payment"("orderId");

-- CreateIndex
CREATE INDEX "payment_status_createdAt_idx" ON "payment"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "refund_providerRefundId_key" ON "refund"("providerRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "refund_idempotencyKey_key" ON "refund"("idempotencyKey");

-- CreateIndex
CREATE INDEX "refund_orderId_idx" ON "refund"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "payout_account_providerAccountId_key" ON "payout_account"("providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "payout_account_userId_provider_key" ON "payout_account"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "payout_orderId_key" ON "payout"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "payout_providerTransferId_key" ON "payout"("providerTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "payout_idempotencyKey_key" ON "payout"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payout_sellerId_status_idx" ON "payout"("sellerId", "status");

-- CreateIndex
CREATE INDEX "payout_status_scheduledFor_idx" ON "payout"("status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_transaction_idempotencyKey_key" ON "ledger_transaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ledger_transaction_orderId_idx" ON "ledger_transaction"("orderId");

-- CreateIndex
CREATE INDEX "ledger_transaction_kind_occurredAt_idx" ON "ledger_transaction"("kind", "occurredAt");

-- CreateIndex
CREATE INDEX "ledger_entry_transactionId_idx" ON "ledger_entry"("transactionId");

-- CreateIndex
CREATE INDEX "ledger_entry_account_currency_idx" ON "ledger_entry"("account", "currency");

-- CreateIndex
CREATE INDEX "webhook_event_status_receivedAt_idx" ON "webhook_event"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_event_source_eventId_key" ON "webhook_event"("source", "eventId");

-- CreateIndex
CREATE INDEX "idempotency_record_expiresAt_idx" ON "idempotency_record"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_quote_usedByOrderId_key" ON "shipping_quote"("usedByOrderId");

-- CreateIndex
CREATE INDEX "shipping_quote_listingId_buyerId_createdAt_idx" ON "shipping_quote"("listingId", "buyerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_orderId_key" ON "shipment"("orderId");

-- CreateIndex
CREATE INDEX "shipment_status_idx" ON "shipment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_providerCode_externalShipmentId_key" ON "shipment"("providerCode", "externalShipmentId");

-- CreateIndex
CREATE INDEX "shipment_event_shipmentId_occurredAt_idx" ON "shipment_event"("shipmentId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_event_shipmentId_externalEventId_key" ON "shipment_event"("shipmentId", "externalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "transport_reservation_shippingQuoteId_key" ON "transport_reservation"("shippingQuoteId");

-- CreateIndex
CREATE UNIQUE INDEX "transport_reservation_externalReservationId_key" ON "transport_reservation"("externalReservationId");

-- CreateIndex
CREATE UNIQUE INDEX "transport_reservation_externalShipmentId_key" ON "transport_reservation"("externalShipmentId");

-- CreateIndex
CREATE INDEX "transport_reservation_orderId_idx" ON "transport_reservation"("orderId");

-- CreateIndex
CREATE INDEX "transport_reservation_status_holdExpiresAt_idx" ON "transport_reservation"("status", "holdExpiresAt");

-- CreateIndex
CREATE INDEX "integration_event_system_createdAt_idx" ON "integration_event"("system", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "integration_event_aggregateType_aggregateId_idx" ON "integration_event"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "conversation_buyerId_lastMessageAt_idx" ON "conversation"("buyerId", "lastMessageAt" DESC);

-- CreateIndex
CREATE INDEX "conversation_sellerId_lastMessageAt_idx" ON "conversation"("sellerId", "lastMessageAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "conversation_listingId_buyerId_key" ON "conversation"("listingId", "buyerId");

-- CreateIndex
CREATE INDEX "message_conversationId_createdAt_idx" ON "message"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "message_attachment_storageKey_key" ON "message_attachment"("storageKey");

-- CreateIndex
CREATE INDEX "notification_userId_readAt_createdAt_idx" ON "notification"("userId", "readAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "email_message_to_createdAt_idx" ON "email_message"("to", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "review_subjectId_status_createdAt_idx" ON "review"("subjectId", "status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "review_orderId_authorId_key" ON "review"("orderId", "authorId");

-- CreateIndex
CREATE INDEX "report_status_createdAt_idx" ON "report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "report_targetType_targetId_idx" ON "report"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "dispute_status_createdAt_idx" ON "dispute"("status", "createdAt");

-- CreateIndex
CREATE INDEX "dispute_orderId_idx" ON "dispute"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "dispute_evidence_storageKey_key" ON "dispute_evidence"("storageKey");

-- CreateIndex
CREATE INDEX "dispute_evidence_disputeId_idx" ON "dispute_evidence"("disputeId");

-- CreateIndex
CREATE INDEX "dispute_message_disputeId_createdAt_idx" ON "dispute_message"("disputeId", "createdAt");

-- CreateIndex
CREATE INDEX "moderation_action_targetType_targetId_idx" ON "moderation_action"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "moderation_action_createdAt_idx" ON "moderation_action"("createdAt");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- CreateIndex
CREATE INDEX "audit_log_targetType_targetId_idx" ON "audit_log"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "audit_log_actorId_createdAt_idx" ON "audit_log"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_action_createdAt_idx" ON "audit_log"("action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "service_api_client_tokenHash_key" ON "service_api_client"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "job_dedupeKey_key" ON "job"("dedupeKey");

-- CreateIndex
CREATE INDEX "job_status_runAt_idx" ON "job"("status", "runAt");

-- CreateIndex
CREATE INDEX "analytics_event_name_createdAt_idx" ON "analytics_event"("name", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_event_userId_createdAt_idx" ON "analytics_event"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "rate_limit_bucket_windowStart_idx" ON "rate_limit_bucket"("windowStart");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "country"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_contact" ADD CONSTRAINT "user_contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_verification" ADD CONSTRAINT "user_verification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_profile" ADD CONSTRAINT "business_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address" ADD CONSTRAINT "address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address" ADD CONSTRAINT "address_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address" ADD CONSTRAINT "address_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "country"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_block" ADD CONSTRAINT "user_block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_block" ADD CONSTRAINT "user_block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "region" ADD CONSTRAINT "region_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "country"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "city" ADD CONSTRAINT "city_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "country"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "city" ADD CONSTRAINT "city_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_attribute" ADD CONSTRAINT "category_attribute_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing" ADD CONSTRAINT "listing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing" ADD CONSTRAINT "listing_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing" ADD CONSTRAINT "listing_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing" ADD CONSTRAINT "listing_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "country"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing" ADD CONSTRAINT "listing_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing" ADD CONSTRAINT "listing_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "city"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_image" ADD CONSTRAINT "listing_image_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_image" ADD CONSTRAINT "listing_image_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_revision" ADD CONSTRAINT "listing_revision_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_search" ADD CONSTRAINT "saved_search_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_rule" ADD CONSTRAINT "compliance_rule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_snapshot" ADD CONSTRAINT "pricing_snapshot_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund" ADD CONSTRAINT "refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund" ADD CONSTRAINT "refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_account" ADD CONSTRAINT "payout_account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout" ADD CONSTRAINT "payout_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout" ADD CONSTRAINT "payout_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transaction" ADD CONSTRAINT "ledger_transaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "ledger_transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_quote" ADD CONSTRAINT "shipping_quote_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_event" ADD CONSTRAINT "shipment_event_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_reservation" ADD CONSTRAINT "transport_reservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_reservation" ADD CONSTRAINT "transport_reservation_shippingQuoteId_fkey" FOREIGN KEY ("shippingQuoteId") REFERENCES "shipping_quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachment" ADD CONSTRAINT "message_attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_message" ADD CONSTRAINT "dispute_message_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- SQL écrit à la main : intégrité, recherche, immuabilité, équilibre comptable
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Contraintes d'intégrité (CHECK) ─────────────────────────────────────────
ALTER TABLE "listing"
  ADD CONSTRAINT "listing_price_positive" CHECK ("priceAmount" > 0 AND "priceAmount" <= 1000000000),
  ADD CONSTRAINT "listing_currency_iso" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "listing_quantity_valid" CHECK ("quantity" >= 1 AND "quantity" <= 10000),
  ADD CONSTRAINT "listing_quantity_available_valid" CHECK ("quantityAvailable" >= 0 AND "quantityAvailable" <= "quantity"),
  ADD CONSTRAINT "listing_weight_positive" CHECK ("weightGrams" IS NULL OR ("weightGrams" > 0 AND "weightGrams" <= 100000)),
  ADD CONSTRAINT "listing_counters_positive" CHECK ("viewCount" >= 0 AND "favoriteCount" >= 0);

ALTER TABLE "category" ADD CONSTRAINT "category_not_own_parent" CHECK ("parentId" IS NULL OR "parentId" <> "id");
ALTER TABLE "user_block" ADD CONSTRAINT "user_block_not_self" CHECK ("blockerId" <> "blockedId");
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_distinct_parties" CHECK ("buyerId" <> "sellerId");

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_distinct_parties" CHECK ("buyerId" <> "sellerId"),
  ADD CONSTRAINT "orders_amounts_positive" CHECK ("itemsSubtotal" > 0 AND "buyerFee" >= 0 AND "shippingAmount" >= 0 AND "taxAmount" >= 0 AND "sellerNetAmount" >= 0),
  ADD CONSTRAINT "orders_total_consistent" CHECK ("totalAmount" = "itemsSubtotal" + "buyerFee" + "shippingAmount" + "taxAmount"),
  ADD CONSTRAINT "orders_seller_net_bounded" CHECK ("sellerNetAmount" <= "itemsSubtotal"),
  ADD CONSTRAINT "orders_currency_iso" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "orders_handover_attempts" CHECK ("handoverAttempts" >= 0);

ALTER TABLE "order_item" ADD CONSTRAINT "order_item_amounts" CHECK ("unitPrice" > 0 AND "quantity" > 0);

ALTER TABLE "pricing_snapshot"
  ADD CONSTRAINT "pricing_subtotal_consistent" CHECK ("itemsSubtotal" = "unitPrice" * "quantity"),
  ADD CONSTRAINT "pricing_total_consistent" CHECK ("totalAmount" = "itemsSubtotal" + "buyerFee" + "shippingAmount" + "taxAmount"),
  ADD CONSTRAINT "pricing_seller_net_consistent" CHECK ("sellerNetAmount" = "itemsSubtotal" - "sellerFee"),
  ADD CONSTRAINT "pricing_rates_bounded" CHECK ("buyerFeeRateBps" BETWEEN 0 AND 5000 AND "sellerFeeRateBps" BETWEEN 0 AND 5000),
  ADD CONSTRAINT "pricing_amounts_positive" CHECK ("buyerFee" >= 0 AND "sellerFee" >= 0 AND "shippingAmount" >= 0 AND "taxAmount" >= 0);

ALTER TABLE "fee_rule"
  ADD CONSTRAINT "fee_rule_rate_bounded" CHECK ("rateBps" BETWEEN 0 AND 5000),
  ADD CONSTRAINT "fee_rule_amounts" CHECK ("fixedAmount" >= 0 AND "minAmount" >= 0 AND ("maxAmount" IS NULL OR "maxAmount" >= "minAmount")),
  ADD CONSTRAINT "fee_rule_period" CHECK ("activeUntil" IS NULL OR "activeUntil" > "activeFrom");

ALTER TABLE "payment" ADD CONSTRAINT "payment_amounts" CHECK ("amount" > 0 AND "amountRefunded" >= 0 AND "amountRefunded" <= "amount");
ALTER TABLE "refund" ADD CONSTRAINT "refund_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "payout" ADD CONSTRAINT "payout_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "shipping_quote" ADD CONSTRAINT "shipping_quote_amount" CHECK ("amount" >= 0);
ALTER TABLE "transport_reservation" ADD CONSTRAINT "transport_reservation_amount" CHECK ("amount" >= 0);
ALTER TABLE "review" ADD CONSTRAINT "review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_refund_positive" CHECK ("refundAmount" IS NULL OR "refundAmount" > 0);
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_handle_format" CHECK ("handle" ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$');
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_counters" CHECK ("ratingSum" >= 0 AND "ratingCount" >= 0 AND "salesCount" >= 0 AND "purchasesCount" >= 0);

-- ── Index partiels d'unicité ─────────────────────────────────────────────────
-- Un seul paiement réussi par commande (un doublon éventuel est remboursé automatiquement).
CREATE UNIQUE INDEX "payment_one_success_per_order" ON "payment" ("orderId") WHERE "status" = 'SUCCEEDED';
-- Un seul litige ouvert par commande.
CREATE UNIQUE INDEX "dispute_one_open_per_order" ON "dispute" ("orderId") WHERE "status" NOT IN ('RESOLVED', 'CLOSED');
-- Une seule réservation Transport active par commande.
CREATE UNIQUE INDEX "transport_reservation_one_active_per_order" ON "transport_reservation" ("orderId") WHERE "orderId" IS NOT NULL AND "status" IN ('HELD', 'CONFIRMED');
-- Un seul signalement en cours par auteur et par cible (anti-spam de signalements).
CREATE UNIQUE INDEX "report_one_open_per_target" ON "report" ("reporterId", "targetType", "targetId") WHERE "status" IN ('OPEN', 'IN_REVIEW');
-- Une seule adresse par défaut par utilisateur.
CREATE UNIQUE INDEX "address_one_default_per_user" ON "address" ("userId") WHERE "isDefault" AND "deletedAt" IS NULL;
-- Une seule règle par combinaison exacte de la matrice de conformité (dimensions nulles = « toutes »).
CREATE UNIQUE INDEX "compliance_rule_unique_combination" ON "compliance_rule"
  ("originCountry", "destinationCountry", "categoryId", "paymentProvider", "carrier") NULLS NOT DISTINCT;
-- Une seule règle de frais active sans fin par type/devise/pays/type de vendeur.
CREATE UNIQUE INDEX "fee_rule_one_open_version" ON "fee_rule" ("kind", "currency", "countryCode", "sellerType") NULLS NOT DISTINCT WHERE "activeUntil" IS NULL;

-- Index de travail pour les jobs de maintenance.
CREATE INDEX "listing_image_orphans" ON "listing_image" ("createdAt") WHERE "listingId" IS NULL;
CREATE INDEX "listing_attributes_gin" ON "listing" USING GIN ("attributes" jsonb_path_ops);

-- ── Recherche plein texte (PostgreSQL FTS) ──────────────────────────────────
-- unaccent n'est pas IMMUTABLE : enveloppe immuable avec dictionnaire explicite.
CREATE OR REPLACE FUNCTION tm_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- Double configuration : 'french' (racinisation) + 'simple' (termes exacts, noms propres,
-- kabyle en graphie latine, marques). Pondération : titre A, marque B, catégorie C, description D.
CREATE OR REPLACE FUNCTION tm_listing_search_vector() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  category_name text;
BEGIN
  SELECT c."name" INTO category_name FROM "category" c WHERE c."id" = NEW."categoryId";
  NEW."searchVector" :=
    setweight(to_tsvector('french', tm_unaccent(coalesce(NEW."title", ''))), 'A') ||
    setweight(to_tsvector('simple', tm_unaccent(coalesce(NEW."title", ''))), 'A') ||
    setweight(to_tsvector('simple', tm_unaccent(coalesce(NEW."brandName", ''))), 'B') ||
    setweight(to_tsvector('french', tm_unaccent(coalesce(category_name, ''))), 'C') ||
    setweight(to_tsvector('french', tm_unaccent(coalesce(NEW."description", ''))), 'D');
  RETURN NEW;
END $$;

CREATE TRIGGER "listing_search_vector_update"
  BEFORE INSERT OR UPDATE OF "title", "description", "brandName", "categoryId" ON "listing"
  FOR EACH ROW EXECUTE FUNCTION tm_listing_search_vector();

CREATE INDEX "listing_search_vector_idx" ON "listing" USING GIN ("searchVector");
-- Similarité trigramme sur le titre (tolérance aux fautes, suggestions).
CREATE INDEX "listing_title_trgm_idx" ON "listing" USING GIN (tm_unaccent(lower("title")) gin_trgm_ops);
CREATE INDEX "brand_name_trgm_idx" ON "brand" USING GIN ("normalizedName" gin_trgm_ops);

-- ── Journaux immuables ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION tm_forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La table % est en ajout seul : % interdit', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE TRIGGER "audit_log_append_only" BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION tm_forbid_mutation();
CREATE TRIGGER "order_status_history_append_only" BEFORE UPDATE OR DELETE ON "order_status_history"
  FOR EACH ROW EXECUTE FUNCTION tm_forbid_mutation();
CREATE TRIGGER "ledger_transaction_append_only" BEFORE UPDATE OR DELETE ON "ledger_transaction"
  FOR EACH ROW EXECUTE FUNCTION tm_forbid_mutation();
CREATE TRIGGER "ledger_entry_append_only" BEFORE UPDATE OR DELETE ON "ledger_entry"
  FOR EACH ROW EXECUTE FUNCTION tm_forbid_mutation();
CREATE TRIGGER "moderation_action_append_only" BEFORE UPDATE OR DELETE ON "moderation_action"
  FOR EACH ROW EXECUTE FUNCTION tm_forbid_mutation();

-- ── Registre en partie double : équilibre vérifié au COMMIT ─────────────────
CREATE OR REPLACE FUNCTION tm_ledger_check_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  tx_id uuid := NEW."transactionId";
  tx_currency char(3);
  imbalance bigint;
  entry_count int;
BEGIN
  SELECT t."currency" INTO tx_currency FROM "ledger_transaction" t WHERE t."id" = tx_id;
  SELECT COALESCE(SUM(CASE WHEN e."direction" = 'DEBIT' THEN e."amount"::bigint ELSE -e."amount"::bigint END), 0), COUNT(*)
    INTO imbalance, entry_count
    FROM "ledger_entry" e WHERE e."transactionId" = tx_id;
  IF entry_count < 2 THEN
    RAISE EXCEPTION 'Transaction comptable % : au moins deux écritures requises', tx_id;
  END IF;
  IF imbalance <> 0 THEN
    RAISE EXCEPTION 'Transaction comptable % déséquilibrée (écart % en unités mineures)', tx_id, imbalance;
  END IF;
  IF EXISTS (SELECT 1 FROM "ledger_entry" e WHERE e."transactionId" = tx_id AND e."currency" <> tx_currency) THEN
    RAISE EXCEPTION 'Transaction comptable % : devises mélangées', tx_id;
  END IF;
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER "ledger_entry_balanced"
  AFTER INSERT ON "ledger_entry"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION tm_ledger_check_balance();

-- Une transaction sans écriture est refusée au COMMIT.
CREATE OR REPLACE FUNCTION tm_ledger_transaction_has_entries() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "ledger_entry" e WHERE e."transactionId" = NEW."id") THEN
    RAISE EXCEPTION 'Transaction comptable % sans écriture', NEW."id";
  END IF;
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER "ledger_transaction_not_empty"
  AFTER INSERT ON "ledger_transaction"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION tm_ledger_transaction_has_entries();
