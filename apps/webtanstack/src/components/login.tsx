import {
	createFileRoute,
	Link,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import {
	Alert,
	AlertDescription,
	AlertTitle,
	Button,
	cn,
	Input,
	Label,
	Logo,
} from "@voidhash/ui";
import { CheckCircle } from "lucide-react";
import { z } from "zod";
import { useState } from "react";
import { authClient } from "@voidhash/features/auth/lib/client";

export function Login({ signup }: { signup?: boolean }) {}
