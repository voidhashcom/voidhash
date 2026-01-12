import { NodeSdk } from "@effect/opentelemetry";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";

const axiomToken = process.env.AXIOM_TOKEN;
const axiomDataset = process.env.AXIOM_LOGS_DATASET;
const axiomUrl = process.env.AXIOM_URL;

const axiomHeaders = {
	Authorization: `Bearer ${axiomToken}`,
	"X-Axiom-Dataset": axiomDataset ?? "",
};

const spanExporter = new OTLPTraceExporter({
	url: `${axiomUrl}/v1/traces`,
	headers: axiomHeaders,
});

const logExporter = new OTLPLogExporter({
	url: `${axiomUrl}/v1/logs`,
	headers: axiomHeaders,
});

const AxiomTracingLive = NodeSdk.layer(() => {
	return {
		resource: {
			serviceName: "voidhash-api",
		},
		spanProcessor: new BatchSpanProcessor(spanExporter),
		logRecordProcessor: new BatchLogRecordProcessor(logExporter),
	};
});

export const ObservabilityLive = AxiomTracingLive;
