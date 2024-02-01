#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import "source-map-support/register";
import { ApiStack } from "../lib/api-stack";

const app = new cdk.App();

const apiEndpointUrlParamName = app.node.tryGetContext(
  "apiEndpointUrlParamName",
);
const s3bucketName = app.node.tryGetContext("s3bucketName");

new ApiStack(app, "next-trpc-deno-example-api-stack", {
  s3bucketName,
  apiEndpointUrlParamName,
});
