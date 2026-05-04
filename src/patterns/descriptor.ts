import { z } from "zod";

import { PresetPatternSchema } from "./presets";
import { CustomPatternSchema } from "./track";

export const PatternDescriptorSchema = z.discriminatedUnion("type", [PresetPatternSchema, CustomPatternSchema]);

export type PatternDescriptor = z.infer<typeof PatternDescriptorSchema>;
