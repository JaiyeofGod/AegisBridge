import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

function TestProviders({
  children,
  initialEntries,
}: {
  children: ReactNode;
  initialEntries?: string[];
}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries ?? ["/"]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

export async function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper"> & {
    initialEntries?: string[];
    /** Wait for session restore (default true). Set false to assert auth-loading. */
    waitForAuth?: boolean;
  },
) {
  const { initialEntries, waitForAuth = true, ...rest } = options ?? {};
  const view = render(ui, {
    wrapper: ({ children }) => (
      <TestProviders initialEntries={initialEntries}>{children}</TestProviders>
    ),
    ...rest,
  });

  if (waitForAuth) {
    await waitFor(
      () => {
        if (view.queryByTestId("auth-loading")) {
          throw new Error("auth still loading");
        }
      },
      { timeout: 10_000 },
    );
  }

  if (view.queryByText(/Loading page/)) {
    await waitFor(
      () => {
        if (view.queryByText(/Loading page/)) {
          throw new Error("route still loading");
        }
      },
      { timeout: 10_000 },
    );
  }

  return view;
}
