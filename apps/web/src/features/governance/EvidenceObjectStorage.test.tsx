import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppRouter } from "@/app/router";
import { getCsrfToken, setCsrfToken } from "@/services/csrf";
import {
  authenticatedSessionFixture,
  currentUserFixture,
  installApiFetch,
  jsonResponse,
} from "@/test/api-fixtures";
import { renderWithProviders } from "@/test/render";

async function openControls(user: ReturnType<typeof userEvent.setup>) {
  await renderWithProviders(<AppRouter />, { initialEntries: ["/governance"] });
  const page = screen.getByTestId("governance-page");
  await user.click(await within(page).findByRole("tab", { name: "Controls" }));
  expect(await within(page).findByTestId("governance-control-CTRL-0002")).toBeInTheDocument();
  return page;
}

describe("Evidence object storage UI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows upload for evidence.manage and uploads multipart with CSRF", async () => {
    setCsrfToken("gov-csrf");
    const { calls, inits } = installApiFetch();
    const user = userEvent.setup();
    await openControls(user);

    await user.type(screen.getByTestId("evidence-title"), "Export note");
    await user.click(screen.getByTestId("evidence-create"));
    expect(await screen.findByTestId("evidence-created-summary")).toHaveTextContent("EVID-0042");
    expect(screen.getByTestId("evidence-file-upload")).toBeInTheDocument();
    expect(screen.getByTestId("evidence-object-malware-note")).toHaveTextContent(
      /Malware scanning is not enabled/i,
    );

    const file = new File(["hello evidence"], "note.txt", { type: "text/plain" });
    await user.upload(screen.getByTestId("evidence-file-input"), file);
    expect(screen.getByTestId("evidence-file-selected")).toHaveTextContent("note.txt");
    await user.click(screen.getByTestId("evidence-upload"));

    expect(await screen.findByTestId("evidence-object-filename")).toHaveTextContent("note.txt");
    expect(screen.getByTestId("evidence-object-stored-flag")).toHaveTextContent(
      "object_stored=true",
    );
    expect(screen.getByTestId("evidence-object-integrity")).toHaveTextContent(
      "integrity_verified=false",
    );
    expect(screen.getByTestId("evidence-object-sha256")).toHaveTextContent(/^[0-9a-f]{64}$/);
    expect(screen.getByTestId("evidence-object-hash-copy")).toHaveTextContent(
      /calculated by AegisBridge/i,
    );
    expect(screen.queryByTestId("evidence-file-upload")).not.toBeInTheDocument();
    expect(screen.getByTestId("evidence-object-success").textContent).not.toMatch(
      /malware scanned|independently verified|safe|trusted/i,
    );

    const uploadIndex = calls.findIndex(
      (url, index) =>
        url.includes("/api/v1/evidence/EVID-0042/object") && inits[index]?.method === "POST",
    );
    expect(uploadIndex).toBeGreaterThanOrEqual(0);
    expect(inits[uploadIndex]?.credentials).toBe("include");
    expect((inits[uploadIndex]?.headers as Headers).get("X-CSRF-Token")).toBe("gov-csrf");
    expect((inits[uploadIndex]?.headers as Headers).get("Content-Type")).toBeNull();
    expect(inits[uploadIndex]?.body).toBeInstanceOf(FormData);
    const form = inits[uploadIndex]?.body as FormData;
    expect(form.get("file")).toBeInstanceOf(File);
    expect((form.get("file") as File).name).toBe("note.txt");
    expect(calls.some((url) => /s3\.|r2\.|seaweed|8333/i.test(url))).toBe(false);
    expect(getCsrfToken()).toBe("gov-csrf");
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("hides upload for read-only evidence.read users but allows download metadata path", async () => {
    const readOnlyUser = {
      ...currentUserFixture,
      permissions: ["control.read", "evidence.read"],
    };
    installApiFetch(
      (url, init) => {
        if (url.includes("/api/v1/auth/session")) {
          return jsonResponse({ ...authenticatedSessionFixture, user: readOnlyUser });
        }
        if (url.includes("/api/v1/auth/me")) {
          return jsonResponse(readOnlyUser);
        }
        if (url.includes("/api/v1/evidence/EVID-0041") && !url.includes("/object")) {
          return jsonResponse({
            id: "EVID-0041",
            title: "Privileged account export note",
            description: null,
            version_label: "1",
            sha256: "c".repeat(64),
            size_bytes: 12,
            mime_type: "text/plain",
            data_classification: "simulated",
            collected_at: "2026-10-19T21:00:00+00:00",
            collected_by: { id: "USR-0003", display_name: "Priya Shah" },
            control_ids: ["CTRL-0002"],
            updated_at: "2026-10-19T21:00:00+00:00",
            object_stored: true,
            integrity_verified: false,
            original_filename: "seed.txt",
            stored_at: "2026-10-19T21:00:00+00:00",
            storage_provider: "s3_compatible",
            content_type: "text/plain",
            hash_source: "server_calculated_at_ingestion",
            semantics: "Evidence metadata.",
          });
        }
        if (
          url.includes("/api/v1/evidence/EVID-0041/object") &&
          (!init?.method || init.method === "GET")
        ) {
          return {
            ok: true,
            status: 200,
            json: async () => ({}),
            text: async () => "seed-bytes",
            blob: async () => new Blob(["seed-bytes"], { type: "text/plain" }),
            headers: {
              get: (name: string) =>
                name.toLowerCase() === "content-disposition"
                  ? 'attachment; filename="seed.txt"'
                  : name.toLowerCase() === "content-type"
                    ? "text/plain"
                    : null,
            },
          };
        }
        return undefined;
      },
      { authenticated: true, allowAuthOverride: true },
    );

    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:evidence-test");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    const user = userEvent.setup();
    const page = await openControls(user);
    expect(within(page).getByTestId("evidence-create-readonly")).toBeInTheDocument();
    expect(screen.queryByTestId("evidence-file-upload")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("control-evidence-manage-file-EVID-0041"));
    expect(await screen.findByTestId("evidence-object-filename")).toHaveTextContent("seed.txt");
    expect(screen.queryByTestId("evidence-upload")).not.toBeInTheDocument();
    expect(screen.queryByTestId("evidence-object-delete")).not.toBeInTheDocument();
    expect(screen.getByTestId("evidence-download")).toBeInTheDocument();

    await user.click(screen.getByTestId("evidence-download"));
    expect(await screen.findByTestId("evidence-object-success")).toHaveTextContent(
      /Download started/i,
    );
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:evidence-test");
  });

  it("handles 409 already stored without claiming overwrite success", async () => {
    setCsrfToken("gov-csrf");
    installApiFetch((url, init) => {
      if (url.includes("/object") && init?.method === "POST") {
        return jsonResponse(
          {
            code: "conflict",
            message: "This evidence record already has a stored object.",
          },
          409,
        );
      }
      return undefined;
    });
    const user = userEvent.setup();
    await openControls(user);
    await user.type(screen.getByTestId("evidence-title"), "Conflict case");
    await user.click(screen.getByTestId("evidence-create"));
    await screen.findByTestId("evidence-file-upload");
    const file = new File(["x"], "dup.txt", { type: "text/plain" });
    await user.upload(screen.getByTestId("evidence-file-input"), file);
    await user.click(screen.getByTestId("evidence-upload"));
    expect(await screen.findByTestId("evidence-object-error")).toHaveTextContent(
      /already has a stored object/i,
    );
    expect(screen.queryByTestId("evidence-object-success")).not.toBeInTheDocument();
  });

  it("handles oversized and storage failure without false success", async () => {
    setCsrfToken("gov-csrf");
    installApiFetch((url, init) => {
      if (url.includes("/object") && init?.method === "POST") {
        const form = init.body as FormData;
        const file = form.get("file") as File;
        if (file?.name === "huge.bin") {
          return jsonResponse({ code: "payload_too_large", message: "too large" }, 413);
        }
        return jsonResponse({ code: "storage_unavailable", message: "backend storage down" }, 503);
      }
      return undefined;
    });
    const user = userEvent.setup();
    await openControls(user);
    await user.type(screen.getByTestId("evidence-title"), "Size case");
    await user.click(screen.getByTestId("evidence-create"));
    await screen.findByTestId("evidence-file-upload");

    await user.upload(
      screen.getByTestId("evidence-file-input"),
      new File(["abc"], "huge.bin", { type: "application/octet-stream" }),
    );
    await user.click(screen.getByTestId("evidence-upload"));
    expect(await screen.findByTestId("evidence-object-error")).toHaveTextContent(/too large/i);
    expect(screen.queryByTestId("evidence-object-success")).not.toBeInTheDocument();

    await user.upload(
      screen.getByTestId("evidence-file-input"),
      new File(["abc"], "fail.txt", { type: "text/plain" }),
    );
    await user.click(screen.getByTestId("evidence-upload"));
    expect(await screen.findByTestId("evidence-object-error")).toHaveTextContent(
      /temporarily unavailable/i,
    );
    expect(screen.queryByTestId("evidence-object-filename")).not.toBeInTheDocument();
  });

  it("requires confirmation to delete stored file and keeps evidence record", async () => {
    setCsrfToken("gov-csrf");
    const { calls, inits } = installApiFetch();
    const user = userEvent.setup();
    await openControls(user);

    await user.type(screen.getByTestId("evidence-title"), "Delete object case");
    await user.click(screen.getByTestId("evidence-create"));
    await screen.findByTestId("evidence-file-upload");
    await user.upload(
      screen.getByTestId("evidence-file-input"),
      new File(["payload"], "keep-meta.txt", { type: "text/plain" }),
    );
    await user.click(screen.getByTestId("evidence-upload"));
    expect(await screen.findByTestId("evidence-object-filename")).toHaveTextContent(
      "keep-meta.txt",
    );

    await user.click(screen.getByTestId("evidence-link-created"));
    expect(await screen.findByTestId("control-evidence-success")).toHaveTextContent(/linked/i);
    expect(screen.getByTestId("control-evidence-row-EVID-0042")).toBeInTheDocument();
    expect(await screen.findByTestId("evidence-object-filename")).toHaveTextContent(
      "keep-meta.txt",
    );

    await user.click(screen.getByTestId("evidence-object-delete"));
    expect(screen.getByTestId("evidence-object-delete-copy")).toHaveTextContent(
      /does not delete the evidence metadata/i,
    );
    await user.click(screen.getByTestId("evidence-object-delete-confirm"));

    expect(await screen.findByTestId("evidence-object-success")).toHaveTextContent(
      /Stored file deleted/i,
    );
    expect(screen.getByTestId("evidence-object-absent")).toBeInTheDocument();
    expect(screen.getByTestId("evidence-created-summary")).toHaveTextContent("EVID-0042");
    expect(screen.getByTestId("control-evidence-row-EVID-0042")).toBeInTheDocument();
    expect(screen.getByTestId("control-evidence-success").textContent).not.toMatch(
      /control link.*(deleted|removed)/i,
    );

    const deleteIndex = calls.findIndex(
      (url, index) =>
        url.includes("/api/v1/evidence/EVID-0042/object") && inits[index]?.method === "DELETE",
    );
    expect(deleteIndex).toBeGreaterThanOrEqual(0);
    expect((inits[deleteIndex]?.headers as Headers).get("X-CSRF-Token")).toBe("gov-csrf");
    expect(inits[deleteIndex]?.credentials).toBe("include");
  });

  it("surfaces download 403 without exposing storage URLs", async () => {
    setCsrfToken("gov-csrf");
    installApiFetch((url, init) => {
      if (url.includes("/object") && init?.method === "POST") {
        return undefined;
      }
      if (url.includes("/object") && (!init?.method || init.method === "GET")) {
        return jsonResponse({ code: "forbidden", message: "denied" }, 403);
      }
      return undefined;
    });
    const user = userEvent.setup();
    await openControls(user);
    await user.type(screen.getByTestId("evidence-title"), "Download deny");
    await user.click(screen.getByTestId("evidence-create"));
    await screen.findByTestId("evidence-file-upload");
    await user.upload(
      screen.getByTestId("evidence-file-input"),
      new File(["z"], "deny.txt", { type: "text/plain" }),
    );
    await user.click(screen.getByTestId("evidence-upload"));
    expect(await screen.findByTestId("evidence-download")).toBeInTheDocument();
    await user.click(screen.getByTestId("evidence-download"));
    expect(await screen.findByTestId("evidence-object-error")).toHaveTextContent(/permission/i);
    expect(document.body.textContent).not.toMatch(/8333|seaweed|r2\.cloudflare|s3\.amazonaws/i);
  });
});
