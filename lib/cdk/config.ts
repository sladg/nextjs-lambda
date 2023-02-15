import { Runtime } from 'aws-cdk-lib/aws-lambda'
import { bool, cleanEnv, num, str } from 'envalid'
import { DEFAULT_MEMORY as IMAGE_LAMBDA_DEFAULT_MEMORY, DEFAULT_TIMEOUT as IMAGE_LAMBDA_DEFAULT_TIMEOUT } from './utils/imageLambda'
import { DEFAULT_MEMORY as SERVER_LAMBDA_DEFAULT_MEMORY, DEFAULT_TIMEOUT as SERVER_LAMBDA_DEFAULT_TIMEOUT } from './utils/serverLambda'

enum RuntimeEnum {
	NODEJS_14_X = 'node14',
	NODEJS_16_X = 'node16',
	NODEJS_18_X = 'node18',
}

const runtimeMap = {
	[RuntimeEnum.NODEJS_14_X]: Runtime.NODEJS_14_X,
	[RuntimeEnum.NODEJS_16_X]: Runtime.NODEJS_16_X,
	[RuntimeEnum.NODEJS_18_X]: Runtime.NODEJS_18_X,
}

const RawEnvConfig = cleanEnv(process.env, {
	STACK_NAME: str(),
	LAMBDA_TIMEOUT: num({ default: SERVER_LAMBDA_DEFAULT_TIMEOUT }),
	LAMBDA_MEMORY: num({ default: SERVER_LAMBDA_DEFAULT_MEMORY }),
	LAMBDA_RUNTIME: str({ default: RuntimeEnum.NODEJS_16_X, choices: Object.values(RuntimeEnum) }),
	IMAGE_LAMBDA_TIMEOUT: num({ default: IMAGE_LAMBDA_DEFAULT_TIMEOUT }),
	IMAGE_LAMBDA_MEMORY: num({ default: IMAGE_LAMBDA_DEFAULT_MEMORY }),
	HOSTED_ZONE: str({ default: undefined }),
	DNS_PREFIX: str({ default: undefined }),
	CUSTOM_API_DOMAIN: str({ default: undefined }),
	REDIRECT_FROM_APEX: bool({ default: false }),
})

export const envConfig = {
	stackName: RawEnvConfig.STACK_NAME,
	lambdaMemory: RawEnvConfig.LAMBDA_MEMORY,
	lambdaTimeout: RawEnvConfig.LAMBDA_TIMEOUT,
	lambdaRuntime: runtimeMap[RawEnvConfig.LAMBDA_RUNTIME],
	imageLambdaMemory: RawEnvConfig.IMAGE_LAMBDA_MEMORY,
	imageLambdaTimeout: RawEnvConfig.IMAGE_LAMBDA_TIMEOUT,
	hostedZone: RawEnvConfig.HOSTED_ZONE,
	dnsPrefix: RawEnvConfig.DNS_PREFIX,
	customApiDomain: RawEnvConfig.CUSTOM_API_DOMAIN,
	redirectFromApex: RawEnvConfig.REDIRECT_FROM_APEX,
}
