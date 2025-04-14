"use client";
import { type getApiKeyById } from "@/lib/queries/cached-queries";
import { useState } from "react";

export function ApiKeyRecord({
	apiKey,
}: {
	apiKey: NonNullable<Awaited<ReturnType<typeof getApiKeyById>>>;
}) {
	const [showApiKey, setShowApiKey] = useState(false);

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
	};

	return (
		<div className="relative isolate group hover:bg-accent/30 px-6 py-4">
			<div className="flex flex-row items-center justify-between">
				<div className="flex items-center gap-4 flex-1">
					<div className="flex flex-col">
						{apiKey?.isPublic ? (
							<p>{apiKey.key}</p>
						) : (
							<p>
								{apiKey.prefix}...{apiKey.end}
							</p>
						)}
					</div>
				</div>
				<div className="flex items-center gap-2"></div>
			</div>
		</div>
	);
}
