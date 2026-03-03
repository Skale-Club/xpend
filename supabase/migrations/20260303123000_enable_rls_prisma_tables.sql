-- Enable RLS on the Prisma-created tables so the Supabase dashboard no longer
-- marks them as unrestricted. Policies remain permissive for development.

ALTER TABLE public."Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CategorizationRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Statement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Transaction" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dev_full_access" ON public."Account";
CREATE POLICY "dev_full_access"
ON public."Account"
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "dev_full_access" ON public."CategorizationRule";
CREATE POLICY "dev_full_access"
ON public."CategorizationRule"
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "dev_full_access" ON public."Category";
CREATE POLICY "dev_full_access"
ON public."Category"
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "dev_full_access" ON public."Settings";
CREATE POLICY "dev_full_access"
ON public."Settings"
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "dev_full_access" ON public."Statement";
CREATE POLICY "dev_full_access"
ON public."Statement"
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "dev_full_access" ON public."Transaction";
CREATE POLICY "dev_full_access"
ON public."Transaction"
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);
