import { type NextRequest, NextResponse } from "next/server";

import { parse } from "./utils/parse";

export default function CheckoutMiddleware(req: NextRequest) {
  const { fullPath } = parse(req);

  return NextResponse.rewrite(
    new URL(`/checkout.voidhash.com${fullPath}`, req.url)
  );
}
