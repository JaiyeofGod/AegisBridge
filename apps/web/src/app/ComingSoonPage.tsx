import { Link, useLocation } from "react-router-dom";

import { Button } from "@/components/buttons/Button";
import { AppShell } from "@/components/navigation/AppShell";
import { PageContainer } from "@/components/navigation/PageContainer";
import { PageHeader } from "@/components/navigation/PageHeader";

/** Route foundation stub — not a product page implementation. */
export function ComingSoonPage({ title }: { title: string }) {
  const location = useLocation();
  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title={title}
          description={`${location.pathname} is reserved for a later phase and is not implemented yet.`}
        />
        <Button asChild variant="secondary">
          <Link to="/overview">Return to Overview</Link>
        </Button>
      </PageContainer>
    </AppShell>
  );
}
