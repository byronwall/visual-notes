import { describe, expect, it } from "vitest";
import { createBroadcastBus } from "./broadcast-bus";

describe("createBroadcastBus", () => {
  it("delivers each publish once to every listener, across bus handles", () => {
    const publisher = createBroadcastBus<number>("bus-test-once");
    const subscriber = createBroadcastBus<number>("bus-test-once");
    const seen: number[] = [];
    const stop = subscriber.subscribe((n) => seen.push(n));

    publisher.publish(1);
    publisher.publish(2);
    expect(seen).toEqual([1, 2]);

    stop();
    publisher.publish(3);
    expect(seen).toEqual([1, 2]);
  });

  it("keeps a failing listener from blocking the others", () => {
    const bus = createBroadcastBus<string>("bus-test-isolation");
    const seen: string[] = [];
    const stopA = bus.subscribe(() => {
      throw new Error("boom");
    });
    const stopB = bus.subscribe((s) => seen.push(s));
    bus.publish("ok");
    expect(seen).toEqual(["ok"]);
    stopA();
    stopB();
  });
});
