-- ==============================================================================
-- BARBER SHOP LOYALTY SYSTEM - DATABASE SCHEMA (SUPABASE)
-- Изпълнете този скрипт в Supabase SQL Editor: Dashboard -> SQL Editor -> New Query
-- ==============================================================================

-- 1. Активиране на pgcrypto разширение (за uuid генериране)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Създаване на таблица ShopSettings (Настройки на лоялната програма)
CREATE TABLE IF NOT EXISTS public."ShopSettings" (
    "Id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "RequiredStamps" INTEGER NOT NULL DEFAULT 5,
    "DiscountText" TEXT NOT NULL DEFAULT '-50%',
    "CooldownHours" INTEGER NOT NULL DEFAULT 24,
    "AdminPin" TEXT NOT NULL DEFAULT '1234',
    "UpdatedAt" TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Създаване на таблица Customers (Клиенти и техните активни печати)
CREATE TABLE IF NOT EXISTS public."Customers" (
    "Id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "FullName" TEXT NOT NULL,
    "Phone" TEXT UNIQUE NOT NULL,
    "CurrentStamps" INTEGER NOT NULL DEFAULT 0,
    "TotalVisits" INTEGER NOT NULL DEFAULT 0,
    "HasRewardAvailable" BOOLEAN NOT NULL DEFAULT FALSE,
    "AuthToken" TEXT UNIQUE NOT NULL,
    "LastVisitAt" TIMESTAMPTZ,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Индекси за светкавично бързо търсене по телефон, AuthToken и сортиране по посещение
CREATE INDEX IF NOT EXISTS "idx_customers_phone" ON public."Customers" ("Phone");
CREATE INDEX IF NOT EXISTS "idx_customers_authtoken" ON public."Customers" ("AuthToken");
CREATE INDEX IF NOT EXISTS "idx_customers_lastvisitat" ON public."Customers" ("LastVisitAt" DESC NULLS LAST);

-- 4. Създаване на таблица VisitLogs (Дневник на посещенията и усвоените награди)
CREATE TABLE IF NOT EXISTS public."VisitLogs" (
    "Id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "CustomerId" UUID NOT NULL REFERENCES public."Customers"("Id") ON DELETE CASCADE,
    "ActionType" TEXT NOT NULL CHECK ("ActionType" IN ('StampAdded', 'RewardRedeemed')),
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS "idx_visitlogs_customerid" ON public."VisitLogs" ("CustomerId");
CREATE INDEX IF NOT EXISTS "idx_visitlogs_createdat" ON public."VisitLogs" ("CreatedAt" DESC);

-- 5. По подразбиране запис в ShopSettings (ако няма такъв)
INSERT INTO public."ShopSettings" ("RequiredStamps", "DiscountText", "CooldownHours", "AdminPin")
SELECT 5, '-50%', 24, '1234'
WHERE NOT EXISTS (SELECT 1 FROM public."ShopSettings");

-- 6. Конфигуриране на Row Level Security (RLS)
ALTER TABLE public."ShopSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."VisitLogs" ENABLE ROW LEVEL SECURITY;

-- Публични политики за анонимен достъп (клиентска PWA и админ PIN достъп)
-- ShopSettings
DROP POLICY IF EXISTS "Public select ShopSettings" ON public."ShopSettings";
CREATE POLICY "Public select ShopSettings" ON public."ShopSettings" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public update ShopSettings" ON public."ShopSettings";
CREATE POLICY "Public update ShopSettings" ON public."ShopSettings" FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public insert ShopSettings" ON public."ShopSettings";
CREATE POLICY "Public insert ShopSettings" ON public."ShopSettings" FOR INSERT WITH CHECK (true);

-- Customers
DROP POLICY IF EXISTS "Public select Customers" ON public."Customers";
CREATE POLICY "Public select Customers" ON public."Customers" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert Customers" ON public."Customers";
CREATE POLICY "Public insert Customers" ON public."Customers" FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update Customers" ON public."Customers";
CREATE POLICY "Public update Customers" ON public."Customers" FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public delete Customers" ON public."Customers";
CREATE POLICY "Public delete Customers" ON public."Customers" FOR DELETE USING (true);

-- VisitLogs
DROP POLICY IF EXISTS "Public select VisitLogs" ON public."VisitLogs";
CREATE POLICY "Public select VisitLogs" ON public."VisitLogs" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert VisitLogs" ON public."VisitLogs";
CREATE POLICY "Public insert VisitLogs" ON public."VisitLogs" FOR INSERT WITH CHECK (true);

-- 7. Включване на SUPABASE REALTIME за таблици Customers и ShopSettings
-- Клиентът следи на живо своята карта, а бръснарят следи списъка и настройките
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'Customers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."Customers";
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'ShopSettings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."ShopSettings";
  END IF;
END $$;
