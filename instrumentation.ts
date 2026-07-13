import type { Instrumentation } from "next";
import { reportServerError } from "@/lib/server/monitoring";

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  reportServerError(error, {
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
    routerKind: context.routerKind,
  });
};
