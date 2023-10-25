import {
  HOLE,
  NAN,
  NEGATIVE_INFINITY,
  NEGATIVE_ZERO,
  POSITIVE_INFINITY,
  TYPE_BIGINT,
  TYPE_DATE,
  TYPE_MAP,
  TYPE_PROMISE,
  TYPE_REGEXP,
  TYPE_SET,
  TYPE_SYMBOL,
  UNDEFINED,
  type ThisEncode,
} from "./utils.js";

export function flatten(this: ThisEncode, input: unknown): number {
  const existing = this.indicies.get(input);
  if (existing) return existing;

  if (input === undefined) return UNDEFINED;
  if (Number.isNaN(input)) return NAN;
  if (input === Infinity) return POSITIVE_INFINITY;
  if (input === -Infinity) return NEGATIVE_INFINITY;
  if (input === 0 && 1 / input < 0) return NEGATIVE_ZERO;

  const index = this.index++;
  this.indicies.set(input, index);
  stringify.call(this, input, index);
  return index;
}

function stringify(this: ThisEncode, input: unknown, index: number) {
  const str = this.stringified;

  switch (typeof input) {
    case "boolean":
    case "number":
    case "string":
      str[index] = JSON.stringify(input);
      break;
    case "bigint":
      str[index] = `["${TYPE_BIGINT}","${input}"]`;
      break;
    case "symbol":
      const keyFor = Symbol.keyFor(input);
      if (!keyFor)
        throw new Error(
          "Cannot encode symbol unless created with Symbol.for()"
        );
      str[index] = `["${TYPE_SYMBOL}",${JSON.stringify(keyFor)}]`;
      break;
    case "object":
      if (!input) {
        str[index] = "null";
        break;
      }

      let result = Array.isArray(input) ? "[" : "{";
      if (Array.isArray(input)) {
        for (let i = 0; i < input.length; i++)
          result +=
            (i ? "," : "") + (i in input ? flatten.call(this, input[i]) : HOLE);
        str[index] = result + "]";
      } else if (input instanceof Date) {
        str[index] = `["${TYPE_DATE}",${input.getTime()}]`;
      } else if (input instanceof RegExp) {
        str[index] = `["${TYPE_REGEXP}",${JSON.stringify(
          input.source
        )},${JSON.stringify(input.flags)}]`;
      } else if (input instanceof Set) {
        str[index] = `["${TYPE_SET}",${[...input]
          .map((val) => flatten.call(this, val))
          .join(",")}]`;
      } else if (input instanceof Map) {
        str[index] = `["${TYPE_MAP}",${[...input]
          .flatMap(([k, v]) => [flatten.call(this, k), flatten.call(this, v)])
          .join(",")}]`;
      } else if (input instanceof Promise) {
        str[index] = `["${TYPE_PROMISE}",${index}]`;
        this.deferred[index] = input;
      } else if (isPlainObject(input)) {
        const parts = [];
        for (const key in input)
          parts.push(
            `${JSON.stringify(key)}:${flatten.call(this, input[key])}`
          );
        str[index] = "{" + parts.join(",") + "}";
      } else {
        throw new Error("Cannot encode object with prototype");
      }
      break;
    default:
      throw new Error("Cannot encode function or unexpected type");
  }
}

const objectProtoNames = Object.getOwnPropertyNames(Object.prototype)
  .sort()
  .join("\0");

function isPlainObject(
  thing: unknown
): thing is Record<string | number | symbol, unknown> {
  const proto = Object.getPrototypeOf(thing);
  return (
    proto === Object.prototype ||
    proto === null ||
    Object.getOwnPropertyNames(proto).sort().join("\0") === objectProtoNames
  );
}
