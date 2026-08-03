import { describe, it, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "./cron-auth";

const ORIGINAL_SECRET = process.env.CRON_SECRET;

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_SECRET;
});

function requestWithAuthHeader(header?: string) {
  return new NextRequest("http://localhost/api/cron/run-pipeline", {
    headers: header ? { authorization: header } : {},
  });
}

describe("isAuthorizedCronRequest", () => {
  it("CRON_SECRET tanımlı değilse (yerel geliştirme) her isteğe izin verir", () => {
    delete process.env.CRON_SECRET;
    expect(isAuthorizedCronRequest(requestWithAuthHeader())).toBe(true);
  });

  it("CRON_SECRET tanımlıyken doğru Bearer token'a izin verir", () => {
    process.env.CRON_SECRET = "gizli-token";
    expect(isAuthorizedCronRequest(requestWithAuthHeader("Bearer gizli-token"))).toBe(true);
  });

  it("CRON_SECRET tanımlıyken yanlış token'ı reddeder", () => {
    process.env.CRON_SECRET = "gizli-token";
    expect(isAuthorizedCronRequest(requestWithAuthHeader("Bearer yanlis-token"))).toBe(false);
  });

  it("CRON_SECRET tanımlıyken header hiç yoksa reddeder", () => {
    process.env.CRON_SECRET = "gizli-token";
    expect(isAuthorizedCronRequest(requestWithAuthHeader())).toBe(false);
  });
});
