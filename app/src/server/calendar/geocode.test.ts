import { describe, expect, it, vi } from "vitest";
import { geocodePlace } from "./geocode";

const reply = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

describe("geocodePlace", () => {
  it("geocodes the street address with a descriptive User-Agent", async () => {
    const fetchImpl = vi.fn(async () =>
      reply([{ lat: "39.85", lon: "-86.14", display_name: "Newfields" }]),
    );
    const result = await geocodePlace(
      {
        name: "Newfields",
        street: "4000 N Michigan Rd",
        city: "Indianapolis",
        state: "IN",
      },
      fetchImpl as unknown as typeof fetch,
    );
    expect(result).toMatchObject({
      ok: true,
      latitude: 39.85,
      longitude: -86.14,
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain(
      "format=json&limit=1&q=4000%20N%20Michigan%20Rd%2C%20Indianapolis%2C%20IN",
    );
    expect((init.headers as Record<string, string>)["User-Agent"]).toMatch(
      /^visual-notes\//,
    );
  });

  it("reports failures instead of throwing and does not retry an HTTP error", async () => {
    const fetchImpl = vi.fn(async () => reply({}, 503));
    const result = await geocodePlace(
      { name: "Nowhere", street: "1 Main St", city: "Indianapolis" },
      fetchImpl as unknown as typeof fetch,
    );
    expect(result).toEqual({
      ok: false,
      reason: "Nominatim returned HTTP 503",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
