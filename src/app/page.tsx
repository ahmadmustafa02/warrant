import { LandingPage } from '@/components/landing/LandingPage';
import { getMeasuredComparison } from '@/server/eval/baselineComparison';
import { prisma } from '@/server/db';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let comparison: Awaited<ReturnType<typeof getMeasuredComparison>> = null;
  try {
    comparison = await getMeasuredComparison(prisma);
  } catch {
    comparison = null;
  }

  return <LandingPage comparison={comparison} />;
}
