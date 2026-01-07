// Credits: Inspired by https://github.com/unkeyed/unkey
import type { TaskContext } from "vitest";

import { env } from "./env";
import { Harness } from "./harness";
// import { type StepRequest, type StepResponse, step } from './request';

export class IntegrationHarness extends Harness {
  readonly baseUrl: string;

  private constructor(t: TaskContext) {
    super(t);
    this.baseUrl = env.E2E_BASE_URL;
  }

  static async init(t: TaskContext): Promise<IntegrationHarness> {
    const h = new IntegrationHarness(t);
    await h.initHarness();
    await h.seed();
    return h;
  }

  // do<TRequestBody = unknown, TResponseBody = unknown>(
  //   req: StepRequest<TRequestBody>
  // ): Promise<StepResponse<TResponseBody>> {
  //   const reqWithUrl: StepRequest<TRequestBody> = {
  //     ...req,
  //     url: new URL(this.baseUrl + req.url).toString()
  //   };
  //   return step(reqWithUrl);
  // }
  // get<TRes>(
  //   req: Omit<StepRequest<never>, 'method'>
  // ): Promise<StepResponse<TRes>> {
  //   return this.do<never, TRes>({ method: 'GET', ...req });
  // }
  // post<TReq, TRes>(
  //   req: Omit<StepRequest<TReq>, 'method'>
  // ): Promise<StepResponse<TRes>> {
  //   return this.do<TReq, TRes>({ method: 'POST', ...req });
  // }
  // put<TReq, TRes>(
  //   req: Omit<StepRequest<TReq>, 'method'>
  // ): Promise<StepResponse<TRes>> {
  //   return this.do<TReq, TRes>({ method: 'PUT', ...req });
  // }
  // delete<TRes>(
  //   req: Omit<StepRequest<never>, 'method'>
  // ): Promise<StepResponse<TRes>> {
  //   return this.do<never, TRes>({ method: 'DELETE', ...req });
  // }
}
