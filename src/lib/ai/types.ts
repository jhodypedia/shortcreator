import { z } from "zod";

export const AI_ROLES = ["bibleWriter", "characterDesigner", "setDesigner", "scriptwriter", "director", "critic", "editor", "ideaGenerator", "outlineGenerator"] as const;
export const AiRoleSchema = z.enum(AI_ROLES);
export type AiRole = z.infer<typeof AiRoleSchema>;
export const AiRoleSettingsSchema = z.object({ model: z.string().min(1), fallbackModel: z.string().min(1), temperature: z.number().min(0).max(2), maxTokens: z.number().int().positive(), timeoutMs: z.number().int().positive() });
export type AiRoleSettings = z.infer<typeof AiRoleSettingsSchema>;
export const ROLE_DEFAULTS: Record<AiRole, Pick<AiRoleSettings, "temperature" | "maxTokens" | "timeoutMs">> = Object.fromEntries(AI_ROLES.map((role) => [role, { temperature: 0.7, maxTokens: 4096, timeoutMs: 60000 }])) as Record<AiRole, Pick<AiRoleSettings, "temperature" | "maxTokens" | "timeoutMs">>;
