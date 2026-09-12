import { describe, expect, it } from 'vitest';
import { taint } from '../provenance/tainted';
import {
  compileParameterConstraint,
  findParameterConstraintViolation,
} from './parameterConstraints';

describe('parameterConstraints', () => {
  it('rejects invalid patterns at compile time', () => {
    expect(() =>
      compileParameterConstraint({
        kind: 'stringPattern',
        pattern: '[',
      }),
    ).toThrow(/invalid stringPattern/);
  });

  it('flags values above a numeric ceiling', () => {
    const violation = findParameterConstraintViolation(
      { amount: { kind: 'numberMax', max: 100 } },
      { amount: taint(101, 'USER') },
    );
    expect(violation?.parameter).toBe('amount');
  });
});
