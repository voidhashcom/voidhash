"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn,
} from "@voidhash/ui";
import { Check } from "lucide-react";

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier: "free" | "pro" | "enterprise";
  onUpgrade: (tier: "pro" | "enterprise") => void;
  isLoading: boolean;
}

interface PlanFeature {
  name: string;
  free: string | boolean;
  pro: string | boolean;
  enterprise: string | boolean;
}

const planFeatures: PlanFeature[] = [
  {
    enterprise: "Unlimited",
    free: "100/mo",
    name: "Paywall conversions",
    pro: "10,000/mo",
  },
  {
    enterprise: "Unlimited",
    free: "$10,000",
    name: "Monthly tracked revenue",
    pro: "$1,000,000",
  },
  {
    enterprise: "Unlimited",
    free: "10,000/mo",
    name: "API calls",
    pro: "1,000,000/mo",
  },
  {
    enterprise: "Unlimited",
    free: "500",
    name: "Active customers",
    pro: "Unlimited",
  },
  {
    enterprise: true,
    free: false,
    name: "Priority support",
    pro: true,
  },
  {
    enterprise: true,
    free: false,
    name: "Custom integrations",
    pro: false,
  },
];

export function UpgradeDialog({
  open,
  onOpenChange,
  currentTier,
  onUpgrade,
  isLoading,
}: UpgradeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Upgrade Your Plan</DialogTitle>
          <DialogDescription>
            Choose the plan that best fits your needs
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 grid grid-cols-3 gap-4">
          {/* Free Plan */}
          <div
            className={cn(
              "rounded-lg border p-4",
              currentTier === "free" && "border-primary"
            )}
          >
            <h3 className="font-semibold">Free</h3>
            <p className="mt-1 text-muted-foreground text-sm">
              Perfect for getting started
            </p>
            <p className="mt-4 font-bold text-2xl">$0</p>
            <p className="text-muted-foreground text-sm">per month</p>

            <ul className="mt-4 space-y-2">
              {planFeatures.map((feature) => (
                <li
                  key={feature.name}
                  className="flex items-center gap-2 text-sm"
                >
                  {feature.free ? (
                    <>
                      <Check className="h-4 w-4 text-green-500" />
                      <span>
                        {typeof feature.free === "string"
                          ? `${feature.name}: ${feature.free}`
                          : feature.name}
                      </span>
                    </>
                  ) : (
                    <span className="ml-6 text-muted-foreground">
                      {feature.name}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            {currentTier === "free" && (
              <Button className="mt-4 w-full" disabled variant="outline">
                Current Plan
              </Button>
            )}
          </div>

          {/* Pro Plan */}
          <div
            className={cn(
              "rounded-lg border p-4",
              currentTier === "pro" && "border-primary"
            )}
          >
            <h3 className="font-semibold">Pro</h3>
            <p className="mt-1 text-muted-foreground text-sm">
              For growing businesses
            </p>
            <p className="mt-4 font-bold text-2xl">$49</p>
            <p className="text-muted-foreground text-sm">per month</p>

            <ul className="mt-4 space-y-2">
              {planFeatures.map((feature) => (
                <li
                  key={feature.name}
                  className="flex items-center gap-2 text-sm"
                >
                  {feature.pro ? (
                    <>
                      <Check className="h-4 w-4 text-green-500" />
                      <span>
                        {typeof feature.pro === "string"
                          ? `${feature.name}: ${feature.pro}`
                          : feature.name}
                      </span>
                    </>
                  ) : (
                    <span className="ml-6 text-muted-foreground">
                      {feature.name}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            {currentTier === "pro" ? (
              <Button className="mt-4 w-full" disabled variant="outline">
                Current Plan
              </Button>
            ) : (currentTier === "free" ? (
              <Button
                className="mt-4 w-full"
                onClick={() => onUpgrade("pro")}
                disabled={isLoading}
              >
                {isLoading ? "Loading..." : "Upgrade to Pro"}
              </Button>
            ) : null)}
          </div>

          {/* Enterprise Plan */}
          <div
            className={cn(
              "rounded-lg border p-4",
              currentTier === "enterprise" && "border-primary"
            )}
          >
            <h3 className="font-semibold">Enterprise</h3>
            <p className="mt-1 text-muted-foreground text-sm">
              For large organizations
            </p>
            <p className="mt-4 font-bold text-2xl">$299</p>
            <p className="text-muted-foreground text-sm">per month</p>

            <ul className="mt-4 space-y-2">
              {planFeatures.map((feature) => (
                <li
                  key={feature.name}
                  className="flex items-center gap-2 text-sm"
                >
                  <Check className="h-4 w-4 text-green-500" />
                  <span>
                    {typeof feature.enterprise === "string"
                      ? `${feature.name}: ${feature.enterprise}`
                      : feature.name}
                  </span>
                </li>
              ))}
            </ul>

            {currentTier === "enterprise" ? (
              <Button className="mt-4 w-full" disabled variant="outline">
                Current Plan
              </Button>
            ) : (
              <Button
                className="mt-4 w-full"
                onClick={() => onUpgrade("enterprise")}
                disabled={isLoading}
              >
                {isLoading ? "Loading..." : "Upgrade to Enterprise"}
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
