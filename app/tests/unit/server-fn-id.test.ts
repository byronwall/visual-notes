import { describe, expect, it } from "vitest";
import { isServerFn, xxHash32 } from "../e2e/helpers/server-fn-id";

// Name halves read from a SolidStart 2.1 production build. If SolidStart
// changes how it hashes ids, e2e specs stop finding server actions; this
// fails first and says why.
describe("server function ids", () => {
  it("hashes names the way the SolidStart build does", () => {
    expect(xxHash32("magicLogin").toString(16)).toBe("1ff0427d");
    expect(xxHash32("createDoc").toString(16)).toBe("b924e774");
    expect(xxHash32("updateDoc").toString(16)).toBe("4fdbdef7");
    expect(xxHash32("saveDocContent").toString(16)).toBe("98646f06");
    expect(xxHash32("loginWithMagicPassword").toString(16)).toBe("7933032b");
  });

  it("matches production and dev ids by name only", () => {
    expect(isServerFn("84febde5-b924e774", "createDoc")).toBe(true);
    expect(isServerFn("84febde5-b924e774#/docs", "createDoc")).toBe(true);
    expect(isServerFn("84febde5-createDoc", "createDoc")).toBe(true);
    expect(isServerFn("84febde5-4fdbdef7", "createDoc")).toBe(false);
  });
});
