"use client";
import { useState } from "react";

export function ApiKeyRecord({
	apiKey,
}: {
	apiKey: string;
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
						<p>{apiKey}</p>
					</div>
				</div>
				<div className="flex items-center gap-2"></div>
			</div>
		</div>
	);
}
