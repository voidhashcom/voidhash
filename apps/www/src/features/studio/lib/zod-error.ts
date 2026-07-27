// Credited to https://github.com/unkeyed/unkey
import type { z } from "zod";

export function parseZodErrorMessage(err: z.ZodError): string {
  try {
    const arr = JSON.parse(err.message) as {
      message: string;
      path: string[];
    }[];
    const { path, message } = arr[0] ?? { message: err.message, path: [] };
    return `${path.join(".")}: ${message}`;
  } catch {
    return err.message;
  }
}
