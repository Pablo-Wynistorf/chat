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
import { FunctionUrlAuthType, HttpMethod as LambdaHttpMethod, InvokeMode } from 'aws-cdk-lib/aws-lambda';
import { CfnUserPool } from 'aws-cdk-lib/aws-cognito';

const backend = defineBackend({
  auth,
  data,
  chatProxy,
  chatStream,
});

// ── Add custom:roles attribute to User Pool schema so the OIDC IdP can map to it ──
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

// ── HTTP API with Cognito JWT auth for non-streaming requests ──
const apiStack = backend.createStack('ChatApiStack');

const userPool = backend.auth.resources.userPool;
const userPoolClient = backend.auth.resources.userPoolClient;

const jwtAuthorizer = new HttpJwtAuthorizer('CognitoAuthorizer', 
  `https://cognito-idp.${apiStack.region}.amazonaws.com/${userPool.userPoolId}`,
  {
    jwtAudience: [userPoolClient.userPoolClientId],
  }
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

// ── Lambda Function URL for streaming (RESPONSE_STREAM mode) ──
const streamLambda = backend.chatStream.resources.lambda;

const fnUrl = streamLambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE, // Auth handled by checking Cognito token in-function or by frontend
  invokeMode: InvokeMode.RESPONSE_STREAM,
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: [LambdaHttpMethod.POST],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
});

// ── Outputs ──
backend.addOutput({
  custom: {
    API: {
      ChatApi: {
        endpoint: httpApi.url!,
        region: apiStack.region,
      },
    },
    StreamUrl: fnUrl.url,
  },
});
