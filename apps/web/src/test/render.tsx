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
  options?: Omit<RenderOptions, "wrapper"> & { initialEntries?: string[] },
) {
  const { initialEntries, ...rest } = options ?? {};
  const view = render(ui, {
    wrapper: ({ children }) => (
      <TestProviders initialEntries={initialEntries}>{children}</TestProviders>
    ),
    ...rest,
  });

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
