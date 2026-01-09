import { ClusterWorkflowEngine, RunnerAddress } from "@effect/cluster";
import {
	HttpApiScalar,
	HttpLayerRouter,
	HttpServerResponse,
} from "@effect/platform";
import { BunClusterSocket } from "@effect/platform-bun";
import { RpcSerialization, RpcServer } from "@effect/rpc";
import { MysqlClient } from "@effect/sql-mysql2";
import { VoidhashV1Api } from "@voidhash/api-spec";
import { BetterAuth } from "@voidhash/core/better-auth/effect";
import {
	AnalyticsService,
	ApiKeyService,
	AppStoreServerAPIService,
	AppStoreService,
	ChangesetDeploymentService,
	CustomerService,
	OrganizationService,
	PaymentProviderConfigurationService,
	PaymentProviderProductService,
	PaywallService,
	PerkGrantService,
	PerkService,
	PolarBillingProviderLive,
	PolarConfigService,
	ProductPerkService,
	ProductService,
	ProjectService,
	RedisMimicHotStorageLive,
	SdkService,
	UsageService,
	UserService,
} from "@voidhash/core/services";
import { PaywallMimicColdStorageLive } from "@voidhash/core/services/paywall-design";
import { Db } from "@voidhash/db/effect";
import { DOCS_DOMAIN, STUDIO_DOMAIN, WWW_DOMAIN } from "@voidhash/lib";
import { Redis } from "@voidhash/redis";
import { RpcGroups } from "@voidhash/rpc";
import { Duration, Effect, Layer, Option, Redacted, Schedule } from "effect";

import { AuthMiddlewareLive } from "./api-middlewares";
import { JwtAuth } from "./jwt-auth";
import { MimicPaywallEngine, MimicPaywallRoute } from "./routes/mimic-paywall";
import { ApiKeysGroupLive } from "./routes/v1/api-keys";
import { AuthGroupLive } from "./routes/v1/auth";
import { ChangesetsGroupLive } from "./routes/v1/changesets";
import { CustomersGroupLive } from "./routes/v1/customers";
import { OrganizationsGroupLive } from "./routes/v1/organizations";
import { PaymentProviderConfigurationsGroupLive } from "./routes/v1/payment-provider-configurations";
import { PaymentProviderProductsGroupLive } from "./routes/v1/payment-provider-products";
import { PerksGroupLive } from "./routes/v1/perks";
import { ProductPerksGroupLive } from "./routes/v1/product-perks";
import { ProductsGroupLive } from "./routes/v1/products";
import { ProjectsGroupLive } from "./routes/v1/projects";
import { SdkGroupLive } from "./routes/v1/sdk";
import { UsersGroupLive } from "./routes/v1/users";
import { PolarWebhookRouteLayer } from "./routes/webhooks/polar";
import { RpcAuthLive } from "./rpc-middlewares";
import { AnalyticsRpcsLive } from "./rpcs/analytics-rpcs";
import { ApiKeyRpcsLive } from "./rpcs/api-key-rpcs";
import { BillingRpcsLive } from "./rpcs/billing-rpcs";
import { CustomerRpcsLive } from "./rpcs/customer-rpcs";
import { OrganizationRpcsLive } from "./rpcs/organization-rpcs";
import { PaymentProviderConfigurationRpcsLive } from "./rpcs/payment-provider-configuration-rpcs";
import { PaymentProviderProductRpcsLive } from "./rpcs/payment-provider-product-rpcs";
import { PaywallRpcsLive } from "./rpcs/paywall-rpcs";
import { PerkRpcsLive } from "./rpcs/perk-rpcs";
import { ProductPerkRpcsLive } from "./rpcs/product-perk-rpcs";
import { ProductRpcsLive } from "./rpcs/product-rpcs";
import { ProjectRpcsLive } from "./rpcs/project-rpcs";
import { UserRpcsLive } from "./rpcs/user-rpcs";

// ==============================
// 1. INFRASTRUCTURE
// ==============================

const runnerHost = process.env.CLUSTER_RUNNER_HOST ?? "localhost";
const runnerPort = process.env.CLUSTER_RUNNER_PORT
	? Number.parseInt(process.env.CLUSTER_RUNNER_PORT, 10)
	: 50000;

const ClusterInfrastructure = BunClusterSocket.layer({
	storage: "sql",
	shardingConfig: {
		runnerAddress: Option.some(RunnerAddress.make(runnerHost, runnerPort)),
	},
}).pipe(
	Layer.retry(
		Schedule.exponential(Duration.millis(100)).pipe(
			Schedule.intersect(Schedule.recurs(5)),
		),
	),
	Layer.provide(
		MysqlClient.layer({
			database: process.env.DATABASE_NAME,
			host: process.env.DATABASE_HOST,
			password: Redacted.make(process.env.DATABASE_PASSWORD ?? ""),
			poolConfig: {
				ssl: process.env.DATABASE_HOST?.includes("psdb.cloud")
					? { rejectUnauthorized: true }
					: undefined,
			},
			username: process.env.DATABASE_USERNAME,
		}),
	),
);

const RedisLive = Redis.layer({
	host: process.env.REDIS_HOST,
	port: process.env.REDIS_PORT
		? Number.parseInt(process.env.REDIS_PORT, 10)
		: 6379,
});

// ==============================
// 2. STORAGE
// ==============================

const MimicHotStorageLayer = RedisMimicHotStorageLive({
	keyPrefix: "mimic:paywall",
});

const MimicColdStorageLayer = PaywallMimicColdStorageLive;

// ==============================
// 3. ENGINES
// ==============================

const WorkflowEngineLayer = ClusterWorkflowEngine.layer.pipe(
	Layer.provideMerge(ClusterInfrastructure),
);

const MimicEngineLayer = MimicPaywallEngine.pipe(
	Layer.provide(MimicHotStorageLayer),
	Layer.provide(MimicColdStorageLayer),
);

// ==============================
// 4. BILLING
// ==============================

const PolarBillingProviderConfigLayer = Layer.succeed(PolarConfigService, {
	accessToken: process.env.POLAR_ACCESS_TOKEN ?? "",
	organizationId: process.env.POLAR_ORGANIZATION_ID ?? "",
	sandbox: true,
	tierProductIds: {
		enterprise: "enterprise",
		pro: "pro",
	},
	webhookSecret: process.env.POLAR_WEBHOOK_SECRET ?? "",
});

const PolarBillingProviderLayer = PolarBillingProviderLive.pipe(
	Layer.provideMerge(PolarBillingProviderConfigLayer),
);

// ==============================
// 5. SERVICES
// ==============================

const BusinessServices = Layer.mergeAll(
	AnalyticsService.Default,
	ApiKeyService.Default,
	AppStoreServerAPIService.Default,
	AppStoreService.Default,
	CustomerService.Default,
	OrganizationService.Default,
	PaymentProviderProductService.Default,
	PaymentProviderConfigurationService.Default,
	PerkGrantService.Default,
	PerkService.Default,
	ProductPerkService.Default,
	PaywallService.Default,
	ProductService.Default,
	ProjectService.Default,
	SdkService.Default,
	UserService.Default,
);

const CoreDependencies = Layer.mergeAll(
	BetterAuth.Default,
	Db.Default,
	RedisLive,
	JwtAuth.Default,
);

const ServicesLayer = ChangesetDeploymentService.Default.pipe(
	Layer.provideMerge(BusinessServices),
	Layer.provideMerge(PolarBillingProviderLayer),
	Layer.provideMerge(UsageService.Default),
	Layer.provideMerge(WorkflowEngineLayer),
	Layer.provideMerge(CoreDependencies),
);

// ==============================
// 6. ROUTE HANDLERS
// ==============================

const V1GroupsLayer = Layer.mergeAll(
	ApiKeysGroupLive,
	AuthGroupLive,
	ChangesetsGroupLive,
	CustomersGroupLive,
	OrganizationsGroupLive,
	PaymentProviderConfigurationsGroupLive,
	PaymentProviderProductsGroupLive,
	PerksGroupLive,
	ProductPerksGroupLive,
	ProductsGroupLive,
	ProjectsGroupLive,
	SdkGroupLive,
	UsersGroupLive,
);

const RpcHandlersLayer = Layer.mergeAll(
	AnalyticsRpcsLive,
	ApiKeyRpcsLive,
	BillingRpcsLive,
	CustomerRpcsLive,
	OrganizationRpcsLive,
	PaymentProviderConfigurationRpcsLive,
	PaymentProviderProductRpcsLive,
	PerkRpcsLive,
	ProductPerkRpcsLive,
	ProductRpcsLive,
	ProjectRpcsLive,
	PaywallRpcsLive,
	UserRpcsLive,
);

// ==============================
// 7. ROUTES
// ==============================

const V1ApiRoutes = HttpLayerRouter.addHttpApi(VoidhashV1Api, {
	openapiPath: "/api/docs/openapi.json",
}).pipe(Layer.provide(V1GroupsLayer), Layer.provide(AuthMiddlewareLive));

const ApiDocsLayer = HttpApiScalar.layerHttpLayerRouter({
	api: VoidhashV1Api,
	path: "/api/docs",
});

const RpcRoutesLayer = RpcServer.layerHttpRouter({
	group: RpcGroups,
	path: "/rpc",
	protocol: "http",
}).pipe(
	Layer.provide(RpcSerialization.layerNdjson),
	Layer.provide(RpcAuthLive),
	Layer.provide(RpcHandlersLayer),
	Layer.provide(AuthMiddlewareLive),
);

const MimicPaywallRouteLayer = MimicPaywallRoute.pipe(
	Layer.provideMerge(ClusterInfrastructure),
	Layer.provide(MimicEngineLayer),
);

const HealthCheckRoute = Layer.effectDiscard(
	Effect.gen(function* HealthCheckRoute() {
		const router = yield* HttpLayerRouter.HttpRouter;
		yield* router.add("GET", "/health", HttpServerResponse.text("OK"));
	}),
);

// ==============================
// 8. APPLICATION
// ==============================

const AllRoutes = Layer.mergeAll(
	V1ApiRoutes,
	RpcRoutesLayer,
	MimicPaywallRouteLayer,
	PolarWebhookRouteLayer,
	ApiDocsLayer,
	HealthCheckRoute,
).pipe(
	Layer.provide(
		HttpLayerRouter.cors({
			allowedOrigins: [WWW_DOMAIN, STUDIO_DOMAIN, DOCS_DOMAIN],
			credentials: true,
		}),
	),
);

export const AppLive = HttpLayerRouter.serve(AllRoutes).pipe(
	Layer.provide(ServicesLayer),
);
