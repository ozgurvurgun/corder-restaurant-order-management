import { ValueTransformer } from 'typeorm';

export const numericColumnTransformer: ValueTransformer = {
  to: (v?: number | string | null) => v,
  from: (v?: string | number | null) => (v == null ? v : Number(v)),
};

