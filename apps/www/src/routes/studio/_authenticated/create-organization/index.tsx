"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Button,
  Card,
  CardContent,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Logo,
} from "@voidhash/ui";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v3";

import { redirectToSignOut } from "@/features/auth/lib/sign-out";
import {
  addCreatedOrganizationToCurrentUserCache,
  createOrganizationOptions,
} from "@/features/studio/lib/tanstack-query/organizations";

export const Route = createFileRoute("/studio/_authenticated/create-organization/")({
  component: CreateOrganizationPage,
});

const createOrganizationFormSchema = z.object({
  name: z
    .string()
    .min(3, "Organization name must be at least 3 characters")
    .max(32, "Organization name must be less than 32 characters"),
});

type CreateOrganizationForm = z.infer<typeof createOrganizationFormSchema>;

function CreateOrganizationPage() {
  const navigate = useNavigate();
  const form = useForm<CreateOrganizationForm>({
    defaultValues: {
      name: "",
    },
    resolver: zodResolver(createOrganizationFormSchema),
  });

  const queryClient = useQueryClient();
  const { mutate: createOrganization, status: createOrganizationStatus } = useMutation({
    ...createOrganizationOptions(),
    onSuccess: (data) => {
      toast.success("Organization created successfully");
      addCreatedOrganizationToCurrentUserCache(queryClient, data);
      void navigate({
        params: {
          organizationSlug: data.slug,
        },
        to: "/studio/$organizationSlug",
      });
    },
    onError: () => {
      toast.error("Failed to create organization");
    },
  });

  const onSubmit = (data: CreateOrganizationForm) => {
    createOrganization({ name: data.name });
  };

  const signOut = () => {
    redirectToSignOut("/");
  };

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="flex justify-center">
            <Link to="/">
              <Logo />
            </Link>
          </div>
          <Card className="mt-4 text-center rounded-2xl">
            <CardContent>
              <div className="text-center pb-6 pt-4">
                <h1 className="text-2xl font-medium tracking-tight">Welcome to Voidhash</h1>
                <p className="mt-2 text-muted-foreground">
                  Let's start by creating your organization.
                </p>
              </div>
              <Form {...form}>
                <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Acme Inc." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    className="w-full"
                    disabled={createOrganizationStatus === "pending"}
                    type="submit"
                  >
                    {createOrganizationStatus === "pending"
                      ? "Creating Organization..."
                      : "Create Organization"}
                  </Button>
                </form>
              </Form>
              <div className="mt-6 text-muted-foreground text-sm">
                <p>
                  Already have an organization? Ask your organization administrator to invite you
                  using your email address.
                </p>
              </div>
            </CardContent>
          </Card>
          <div className="text-center text-muted-foreground text-sm">
            Signed in to a wrong account?{" "}
            <button
              className="cursor-pointer text-foreground underline underline-offset-4"
              onClick={signOut}
              type="button"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
