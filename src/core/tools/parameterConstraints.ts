import { describeValue } from '../provenance/tainted';
import type { TaintedValue } from '../provenance/types';

export type StringPatternConstraint = {
  readonly kind: 'stringPattern';
  readonly pattern: string;
  readonly flags?: string;
};

export type NumberMaxConstraint = {
  readonly kind: 'numberMax';
  readonly max: number;
};

export type ParameterConstraint = StringPatternConstraint | NumberMaxConstraint;

export type ParameterConstraints = Readonly<Record<string, ParameterConstraint>>;

export type ConstraintViolation = {
  readonly parameter: string;
  readonly reason: string;
};

export function compileParameterConstraint(
  constraint: ParameterConstraint,
): ParameterConstraint {
  if (constraint.kind === 'stringPattern') {
    try {
      RegExp(constraint.pattern, constraint.flags ?? '');
    } catch {
      throw new Error(`invalid stringPattern: ${constraint.pattern}`);
    }
  }
  return constraint;
}

export function findParameterConstraintViolation(
  constraints: ParameterConstraints | undefined,
  args: Readonly<Record<string, TaintedValue<unknown>>>,
): ConstraintViolation | undefined {
  if (constraints === undefined) {
    return undefined;
  }

  for (const [parameter, rule] of Object.entries(constraints)) {
    const supplied = args[parameter];
    if (supplied === undefined) {
      continue;
    }

    if (rule.kind === 'stringPattern') {
      const text =
        typeof supplied.value === 'string'
          ? supplied.value
          : describeValue(supplied.value);
      const re = new RegExp(rule.pattern, rule.flags ?? '');
      if (!re.test(text)) {
        return {
          parameter,
          reason: `${parameter} must match ${rule.pattern} but this call supplies "${text}"`,
        };
      }
      continue;
    }

    const numeric =
      typeof supplied.value === 'number'
        ? supplied.value
        : Number(describeValue(supplied.value));
    if (!Number.isFinite(numeric) || numeric > rule.max) {
      return {
        parameter,
        reason: `${parameter} must be at most ${rule.max} but this call supplies ${describeValue(supplied.value)}`,
      };
    }
  }

  return undefined;
}
