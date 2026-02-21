import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { chatProxy } from './functions/chat-proxy/resource';
import { chatStream } from './functions/chat-stream/resource';
import {
  HttpApi,
  HttpMethod,
  CorsHttpMethod,
} from 'aws-cdk-lib/aws-apigatewayv2';
import {
  HttpJwtAuthorizer,
} from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import {
  HttpLambdaIntegration,
} from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { CfnUserPool } from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cdk from 'aws-cdk-lib';

const backend = defineBackend({
  auth,
  data,
  chatProxy,
  chatStream,
});

// ── Add custom:roles attribute to User Pool schema ──
const cfnUserPool = backend.auth.resources.userPool.node.defaultChild as CfnUserPool;
const existingSchema = (cfnUserPool.schema as any[]) || [];
cfnUserPool.schema = [
  ...existingSchema,
  {
    name: 'roles',
    attributeDataType: 'String',
    mutable: true,
    stringAttributeConstraints: { maxLength: '2048' },
  },
];

const userPool = backend.auth.resources.userPool;
const userPoolClient = backend.auth.resources.userPoolClient;

// ══════════════════════════════════════════════════════════════════════
// HTTP API v2 — non-streaming requests (fetchModels, non-streaming chat)
// ══════════════════════════════════════════════════════════════════════
const apiStack = backend.createStack('ChatApiStack');

const jwtAuthorizer = new HttpJwtAuthorizer('CognitoAuthorizer',
  `https://cognito-idp.${apiStack.region}.amazonaws.com/${userPool.userPoolId}`,
  { jwtAudience: [userPoolClient.userPoolClientId] },
);

const httpApi = new HttpApi(apiStack, 'ChatHttpApi', {
  apiName: 'ChatApi',
  corsPreflight: {
    allowOrigins: ['*'],
    allowMethods: [CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
    allowHeaders: ['Content-Type', 'Authorization'],
  },
});

const proxyIntegration = new HttpLambdaIntegration(
  'ChatProxyIntegration',
  backend.chatProxy.resources.lambda,
);

httpApi.addRoutes({
  path: '/api/chat',
  methods: [HttpMethod.POST],
  integration: proxyIntegration,
  authorizer: jwtAuthorizer,
});

httpApi.addRoutes({
  path: '/api/models',
  methods: [HttpMethod.POST],
  integration: proxyIntegration,
  authorizer: jwtAuthorizer,
});

// ══════════════════════════════════════════════════════════════════════
// REST API v1 — streaming requests (ResponseTransferMode: STREAM)
// Same pattern as serverless-bedrock-access-gateway:
//   REST API → response-streaming-invocations → awslambda.streamifyResponse
// With Cognito authorizer instead of API key auth.
// ══════════════════════════════════════════════════════════════════════
const streamStack = backend.createStack('ChatStreamApiStack');
const streamLambda = backend.chatStream.resources.lambda;

// REST API — fully L1 to avoid L2 validation requiring L2 methods
const restApi = new apigateway.CfnRestApi(streamStack, 'ChatStreamApi', {
  name: 'ChatStreamApi',
  description: 'Streaming chat API with Cognito auth and response streaming',
  endpointConfiguration: { types: ['REGIONAL'] },
});

// Cognito authorizer (L1)
const cognitoAuthorizer = new apigateway.CfnAuthorizer(streamStack, 'StreamCognitoAuth', {
  restApiId: restApi.ref,
  name: 'CognitoStreamAuth',
  type: 'COGNITO_USER_POOLS',
  identitySource: 'method.request.header.Authorization',
  providerArns: [userPool.userPoolArn],
});

// /stream resource
const streamResource = new apigateway.CfnResource(streamStack, 'StreamResource', {
  restApiId: restApi.ref,
  parentId: restApi.attrRootResourceId,
  pathPart: 'stream',
});

// Streaming integration URI
const streamingUri = `arn:aws:apigateway:${streamStack.region}:lambda:path/2021-11-15/functions/${streamLambda.functionArn}/response-streaming-invocations`;

// POST /stream — Cognito-authorized, streaming proxy integration
const postMethod = new apigateway.CfnMethod(streamStack, 'StreamPostMethod', {
  restApiId: restApi.ref,
  resourceId: streamResource.ref,
  httpMethod: 'POST',
  authorizationType: 'COGNITO_USER_POOLS',
  authorizerId: cognitoAuthorizer.ref,
  integration: {
    type: 'AWS_PROXY',
    integrationHttpMethod: 'POST',
    uri: streamingUri,
    timeoutInMillis: 900000,
    responseTransferMode: 'STREAM',
  },
});

// OPTIONS /stream — CORS preflight (no auth)
const optionsMethod = new apigateway.CfnMethod(streamStack, 'StreamOptionsMethod', {
  restApiId: restApi.ref,
  resourceId: streamResource.ref,
  httpMethod: 'OPTIONS',
  authorizationType: 'NONE',
  integration: {
    type: 'MOCK',
    requestTemplates: {
      'application/json': '{"statusCode": 200}',
    },
    integrationResponses: [
      {
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization'",
          'method.response.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
          'method.response.header.Access-Control-Allow-Origin': "'*'",
        },
      },
    ],
  },
  methodResponses: [
    {
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': true,
        'method.response.header.Access-Control-Allow-Methods': true,
        'method.response.header.Access-Control-Allow-Origin': true,
      },
    },
  ],
});

// Lambda permissions
new cdk.aws_lambda.CfnPermission(streamStack, 'ApiGwInvokePermission', {
  functionName: streamLambda.functionName,
  action: 'lambda:InvokeFunction',
  principal: 'apigateway.amazonaws.com',
  sourceArn: `arn:aws:execute-api:${streamStack.region}:${streamStack.account}:${restApi.ref}/*/*`,
});

new cdk.aws_lambda.CfnPermission(streamStack, 'ApiGwStreamPermission', {
  functionName: streamLambda.functionName,
  action: 'lambda:InvokeWithResponseStream',
  principal: 'apigateway.amazonaws.com',
  sourceArn: `arn:aws:execute-api:${streamStack.region}:${streamStack.account}:${restApi.ref}/*/*`,
});

// Gateway responses — add CORS headers to API Gateway-level errors (auth failures, etc.)
new apigateway.CfnGatewayResponse(streamStack, 'GatewayDefault4XX', {
  restApiId: restApi.ref,
  responseType: 'DEFAULT_4XX',
  responseParameters: {
    'gatewayresponse.header.Access-Control-Allow-Origin': "'*'",
    'gatewayresponse.header.Access-Control-Allow-Headers': "'Content-Type,Authorization'",
    'gatewayresponse.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
  },
});

new apigateway.CfnGatewayResponse(streamStack, 'GatewayDefault5XX', {
  restApiId: restApi.ref,
  responseType: 'DEFAULT_5XX',
  responseParameters: {
    'gatewayresponse.header.Access-Control-Allow-Origin': "'*'",
    'gatewayresponse.header.Access-Control-Allow-Headers': "'Content-Type,Authorization'",
    'gatewayresponse.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
  },
});

// Deployment + Stage
const deployment = new apigateway.CfnDeployment(streamStack, 'StreamApiDeployment', {
  restApiId: restApi.ref,
  description: 'Streaming API deployment with Cognito auth',
});
deployment.addDependency(postMethod);
deployment.addDependency(optionsMethod);

const _stage = new apigateway.CfnStage(streamStack, 'StreamApiStage', {
  restApiId: restApi.ref,
  deploymentId: deployment.ref,
  stageName: 'v1',
  description: 'Production stage with response streaming',
  tracingEnabled: true,
});

// ══════════════════════════════════════════════════════════════════════
// Outputs
// ══════════════════════════════════════════════════════════════════════
const streamUrl = `https://${restApi.ref}.execute-api.${streamStack.region}.amazonaws.com/v1/stream`;

backend.addOutput({
  custom: {
    API: {
      ChatApi: {
        endpoint: httpApi.url!,
        region: apiStack.region,
      },
    },
    StreamUrl: streamUrl,
  },
});
