import * as v from 'valibot';

export const PositionDataSchema = v.object({
  x: v.number(),
  y: v.number(),
  z: v.number(),
});
export type PositionData = v.InferOutput<typeof PositionDataSchema>;

export type EmitterData = v.InferOutput<typeof EmitterDataSchema>;
export const EmitterDataSchema = v.object({
  id: v.number(),
  startPoint: PositionDataSchema,
  startTime: v.number(),
  endPoint: v.nullable(PositionDataSchema),
  endTime: v.nullable(v.number()),
  audioFileUri: v.nullable(v.string()),
});

export type ListenerData = v.InferOutput<typeof ListenerDataSchema>;
export const ListenerDataSchema = v.object({
  id: v.number(),
  position: PositionDataSchema,
  rotation: v.number(),
});

export type ScenarioData = v.InferOutput<typeof ScenarioDataSchema>;
export const ScenarioDataSchema = v.object({
  id: v.number(),
  name: v.string(),
  createdAt: v.pipe(v.string()),
  updatedAt: v.pipe(v.string()),

  temperatureCelsius: v.number(),
  humidityPercent: v.number(),
  atmosphericPressurePa: v.number(),

  scenarioStartTime: v.number(),
  scenarioEndTime: v.number(),

  emitters: v.array(EmitterDataSchema),
  listeners: v.array(ListenerDataSchema),
});

export type ListScenarioDataResponse = v.InferOutput<typeof ListScenarioDataResponseSchema>;
export const ListScenarioDataResponseSchema = v.array(ScenarioDataSchema);
