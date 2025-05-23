import * as path from 'path';
import { StackManagerProvider, TransformHostProvider } from '@aws-amplify/graphql-transformer-interfaces';
import { LambdaDataSource } from 'aws-cdk-lib/aws-appsync';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import { setResourceName } from '@aws-amplify/graphql-transformer-core';

export const createMappingLambda = (host: TransformHostProvider, stackManager: StackManagerProvider) => {
  const baseName = 'MapsToFieldMapping';

  // check for already existing data source
  const lambdaDataSourceName = `${baseName}LambdaDataSource`;
  const existingLambdaDataSource = host.getDataSource(lambdaDataSourceName);
  if (existingLambdaDataSource) {
    return existingLambdaDataSource as LambdaDataSource;
  }

  // create stack
  const stack = stackManager.createStack(`${baseName}Stack`);

  // create lambda execution role
  const roleName = `${baseName}LambdaRole`;
  const role = new iam.Role(stack, roleName, {
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  });
  setResourceName(role, { name: roleName, setOnDefaultChild: true });

  // create lambda
  const funcLogicalId = `${baseName}LambdaFunction`;
  const lambdaFunc = host.addLambdaFunction(
    funcLogicalId, // function name
    `functions/${funcLogicalId}.zip`, // function key
    'index.handler', // function handler
    path.join(__dirname, 'assets', 'mapping-lambda.zip'),
    lambda.Runtime.NODEJS_20_X,
    undefined, // layers
    role, // execution role,
    undefined, // env vars
    cdk.Duration.seconds(30), // lambda timeout
    stack,
  );

  role.attachInlinePolicy(
    new iam.Policy(stack, `${baseName}CloudWatchLogAccess`, {
      statements: [
        new iam.PolicyStatement({
          actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
          effect: iam.Effect.ALLOW,
          resources: [
            cdk.Fn.sub(`arn:aws:logs:\${AWS::Region}:\${AWS::AccountId}:log-group:/aws/lambda/\${funcName}:log-stream:*`, {
              funcName: lambdaFunc.functionName,
            }),
          ],
        }),
      ],
    }),
  );

  // create lambda datasource
  const lambdaDataSource = host.addLambdaDataSource(lambdaDataSourceName, lambdaFunc, undefined, stack);

  return lambdaDataSource;
};
