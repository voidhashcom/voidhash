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
} from "@chiron-standalone/ui";
import { CheckCircle } from "lucide-react";
import { z } from "zod";
import { useState } from "react";
import { authClient } from "src/lib/auth-client";

export function Login({ signup }: { signup?: boolean }) {}
