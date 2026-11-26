import { describe, expect, it, vi } from "vitest";
import { runAiRole } from "./runner";
import { ROLE_DEFINITIONS } from "./roles";
import { ROLE_DEFAULTS } from "./types";
import { db } from "../db";
import { getAppSettings } from "../settings";

vi.mock("../db", () => ({ db: { aiRun: { create: vi.fn(), update: vi.fn() } } }));
vi.mock("../settings", () => ({ getAppSettings: vi.fn() }));

describe("AI role schemas", () => {
  it("has strict, parseable input and output schemas and defaults for every role", () => {
    for (const [role, definition] of Object.entries(ROLE_DEFINITIONS)) {
      expect(ROLE_DEFAULTS[role as keyof typeof ROLE_DEFAULTS].maxTokens).toBeGreaterThan(0);
      expect(definition.input.safeParse({}).success).toBe(false);
      expect(definition.output.safeParse({}).success).toBe(false);
    }
  });
  it("limits set specs to 150 objects and permits only listed primitives", () => {
    const schema = ROLE_DEFINITIONS.setDesigner.output;
    const item = { type: "box", position: [0, 0, 0], size: [1, 1, 1], color: "green", rotation: [0, 0, 0] };
    const valid = { name: "set", objects: Array.from({ length: 150 }, () => item), timeOfDay: "sore", sky: "biru", fog: false, lighting: {}, stagePoints: {} };
    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse({ ...valid, objects: [...valid.objects, item] }).success).toBe(false);
    expect(schema.safeParse({ ...valid, objects: [{ ...item, type: "custom-mesh" }] }).success).toBe(false);
  });
});

describe("runAiRole", () => {
  it("uses the configured role model and token/timeout settings", async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ publicSettings: { ai: { provider: "9router", baseUrl: "http://ai.test/v1", roles: { bibleWriter: { model: "custom-main", fallbackModel: "custom-fallback", temperature: 0.4, maxTokens: 1234, timeoutMs: 2345 } } } } as never, secrets: { aiApiKey: "", ttsApiKey: "" } });
    vi.mocked(db.aiRun.create).mockResolvedValue({ id: "run-1" } as never);
    vi.mocked(db.aiRun.update).mockResolvedValue({} as never);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ premise: "Premise cukup panjang", world: {}, characters: [], sets: [], visualStyle: {}, continuity: {} }) } }] }), { status: 200 }));
    await expect(runAiRole("bibleWriter", { idea: "test idea" })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(6);
    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(request.model).toBe("custom-main");
    expect(request.max_tokens).toBe(1234);
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    fetchMock.mockRestore();
  });

  it("records terminal validation failure before rejecting", async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ publicSettings: { ai: { provider: "9router", baseUrl: "http://ai.test/v1", roles: { bibleWriter: { model: "m", fallbackModel: "f", temperature: 0.4, maxTokens: 100, timeoutMs: 1000 } } } } as never, secrets: { aiApiKey: "", ttsApiKey: "" } });
    vi.mocked(db.aiRun.create).mockResolvedValue({ id: "run-failed" } as never);
    vi.mocked(db.aiRun.update).mockResolvedValue({} as never);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }));
    await expect(runAiRole("bibleWriter", { idea: "test idea" })).rejects.toThrow("Validasi Zod gagal");
    expect(db.aiRun.update).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: "run-failed" }, data: expect.objectContaining({ status: "failed", error: expect.stringContaining("Validasi Zod gagal") }) }));
    fetchMock.mockRestore();
  });

  it("records invalid role input without contacting the provider", async () => {
    vi.mocked(getAppSettings).mockResolvedValue({ publicSettings: { ai: { roles: { editor: { model: "m", fallbackModel: "f", temperature: 0.4, maxTokens: 100, timeoutMs: 1000 } } } } as never, secrets: { aiApiKey: "", ttsApiKey: "" } });
    vi.mocked(db.aiRun.create).mockResolvedValue({ id: "run-invalid" } as never);
    vi.mocked(db.aiRun.update).mockResolvedValue({} as never);
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(runAiRole("editor", {})).rejects.toThrow("Invalid editor input");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.aiRun.update).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: "run-invalid" }, data: expect.objectContaining({ status: "failed" }) }));
    fetchMock.mockRestore();
  });
});
