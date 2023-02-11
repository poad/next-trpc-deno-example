import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sam from 'aws-cdk-lib/aws-sam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cfOrigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as crypto from 'crypto';

interface ApiStackProps extends cdk.StackProps {
  s3bucketName: string,
  apiEndpointUrlParamName: string,
}

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const {
      s3bucketName,
      apiEndpointUrlParamName,
    } = props;

    const denoRuntime = new sam.CfnApplication(this, 'DenoRuntime', {
      location: {
        applicationId:
          'arn:aws:serverlessrepo:us-east-1:390065572566:applications/deno',
        semanticVersion: '1.30.3',
      },
    });

    // Deno Layer
    const layer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      'denoRuntimeLayer',
      denoRuntime.getAtt('Outputs.LayerArn').toString(),
    );

    const functionName = 'next-trpc-deno-example-api-function';
    new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/aws/lambda/${functionName}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.THREE_DAYS,
    });

    const fn = new lambda.Function(this, 'DenoHandler', {
      functionName,
      runtime: lambda.Runtime.PROVIDED_AL2,
      code: lambda.Code.fromAsset('../lambda'),
      handler: 'index.handler',
      layers: [layer],
      environment: {
        DENO_IMPORTMAP: 'import_map.json',
        DENO_UNSTABLE: '--unstable',
        DENO_PERMISSIONS: '--allow-net --allow-env --allow-read --allow-ffi',
      },
      retryAttempts: 0,
    });

    // API Gateway
    const api = new apigateway.LambdaRestApi(this, 'Endpoint', {
      handler: fn,
      deployOptions: {
        stageName: 'default',
      },
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL],
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: apigateway.Cors.DEFAULT_HEADERS,
        allowCredentials: true,
        disableCache: true,
        statusCode: 204,
      },
    });
    
    // eslint-disable-next-line no-new
    new apigateway.GatewayResponse(this, 'UnauthorizedGatewayResponse', {
      restApi: api,
      type: apigateway.ResponseType.UNAUTHORIZED,
      statusCode: '401',
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
      },
    });

    // eslint-disable-next-line no-new
    new apigateway.GatewayResponse(this, 'ClientErrorGatewayResponse', {
      restApi: api,
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
      },
    });

    // eslint-disable-next-line no-new
    new apigateway.GatewayResponse(this, 'ServerErrorGatewayResponse', {
      restApi: api,
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
      },
    });

    new cdk.CfnOutput(this, 'EndpointOutput', {
      value: api.url,
    });

    new ssm.StringParameter(this, 'ApiEndpointParameter', {
      parameterName: apiEndpointUrlParamName,
      stringValue: api.url,
    });

    const s3bucket = new s3.Bucket(this, 'S3Bucket', {
      bucketName: s3bucketName,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      accessControl: s3.BucketAccessControl.PRIVATE,
      publicReadAccess: false,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    const hash = crypto
      .createHash('md5')
      .update(new Date().getTime().toString())
      .digest('hex');

    s3bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.DENY,
        actions: ['s3:*'],
        principals: [new iam.StarPrincipal()],
        resources: [`${s3bucket.bucketArn}/*`],
        conditions: {
          StringNotLike: {
            'aws:Referer': hash,
          },
          StringNotEquals: {
            's3:ResourceAccount': this.account,
          },
        },
      }),
    );

    s3bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:GetObject'],
        principals: [new iam.StarPrincipal()],
        resources: [`${s3bucket.bucketArn}/*`],
        conditions: {
          StringLike: {
            'aws:Referer': hash,
          },
        },
      }),
    );
    s3bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:*'],
        principals: [new iam.AccountPrincipal(this.account)],
        resources: [`${s3bucket.bucketArn}/*`],
        conditions: {
          StringEquals: {
            's3:ResourceAccount': this.account,
            's3:x-amz-server-side-encryption': 'AES256',
          },
        },
      }),
    );

    const distribution = new cloudfront.Distribution(this, 'CloudFront', {
      defaultBehavior: {
        origin: new cfOrigins.HttpOrigin(
          `${s3bucket.bucketName}.s3-website-${this.region}.amazonaws.com`,
          {
            customHeaders: {
              Referer: hash,
            },
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          },
        ),
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      },
      enableIpv6: false,
      defaultRootObject: 'index.html',
    });

    // eslint-disable-next-line no-new
    new cdk.CfnOutput(this, 'AppURL', {
      value: `https://${distribution.distributionDomainName}/`,
    });
  }
}
