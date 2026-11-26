import { z } from "zod";

export const ACTIONS = ["idle", "walk", "talk", "point", "wave", "nod", "shake_head", "surprised", "laugh", "slam_table", "drop_item", "pick_up", "hand_over", "think", "angry", "turn_to"] as const;
export const ACCESSORIES = ["none", "topi", "kacamata", "syal", "mahkota"] as const;
export const SET_OBJECT_TYPES = ["box", "pillar", "roof", "shelf", "display-case", "counter", "block-tree", "fence", "cloud", "sun", "hill", "road", "lamp", "table", "chair", "sign"] as const;
export const LIGHTING_TYPES = ["siang", "senja", "malam", "horror"] as const;
export const ACCESSORY_TYPES = ACCESSORIES;
export const SET_TEMPLATES = ["desa", "hutan", "gua", "rumah", "arena", "pantai", "custom"] as const;
export const BODY_TYPES = ["human", "quadruped", "block-creature"] as const;
export const ActionTypeSchema = z.enum(ACTIONS);
export type ActionType = (typeof ACTIONS)[number];
export const AccessoryTypeSchema = z.enum(ACCESSORIES);
export const SetObjectTypeSchema = z.enum(SET_OBJECT_TYPES);
