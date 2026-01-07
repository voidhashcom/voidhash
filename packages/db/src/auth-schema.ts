import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  int,
  json,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const user = mysqlTable("user", {
  banExpires: timestamp("ban_expires", { fsp: 3 }),
  banReason: text("ban_reason"),
  banned: boolean("banned").default(false),
  createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  id: varchar("id", { length: 36 }).primaryKey(),
  image: text("image"),
  name: varchar("name", { length: 255 }).notNull(),
  role: text("role"),
  updatedAt: timestamp("updated_at", { fsp: 3 })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = mysqlTable(
  "session",
  {
    activeOrganizationId: text("active_organization_id"),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
    id: varchar("id", { length: 36 }).primaryKey(),
    impersonatedBy: text("impersonated_by"),
    ipAddress: text("ip_address"),
    token: varchar("token", { length: 255 }).notNull().unique(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    userAgent: text("user_agent"),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)]
);

export const account = mysqlTable(
  "account",
  {
    accessToken: text("access_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { fsp: 3 }),
    accountId: text("account_id").notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    id: varchar("id", { length: 36 }).primaryKey(),
    idToken: text("id_token"),
    password: text("password"),
    providerId: text("provider_id").notNull(),
    refreshToken: text("refresh_token"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { fsp: 3 }),
    scope: text("scope"),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("account_userId_idx").on(table.userId)]
);

export const verification = mysqlTable(
  "verification",
  {
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
    id: varchar("id", { length: 36 }).primaryKey(),
    identifier: varchar("identifier", { length: 255 }).notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    value: text("value").notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

export const jwks = mysqlTable("jwks", {
  createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
  expiresAt: timestamp("expires_at", { fsp: 3 }),
  id: varchar("id", { length: 36 }).primaryKey(),
  privateKey: text("private_key").notNull(),
  publicKey: text("public_key").notNull(),
});

export const organization = mysqlTable(
  "organization",
  {
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
    id: varchar("id", { length: 36 }).primaryKey(),
    logo: text("logo"),
    metadata: text("metadata"),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
  },
  (table) => [uniqueIndex("organization_slug_uidx").on(table.slug)]
);

export const member = mysqlTable(
  "member",
  {
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 255 }).default("member").notNull(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId),
  ]
);

export const invitation = mysqlTable(
  "invitation",
  {
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
    id: varchar("id", { length: 36 }).primaryKey(),
    inviterId: varchar("inviter_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 255 }),
    status: varchar("status", { length: 255 }).default("pending").notNull(),
  },
  (table) => [
    index("invitation_organizationId_idx").on(table.organizationId),
    index("invitation_email_idx").on(table.email),
  ]
);

export const apikey = mysqlTable(
  "apikey",
  {
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
    enabled: boolean("enabled").default(true),
    expiresAt: timestamp("expires_at", { fsp: 3 }),
    id: varchar("id", { length: 36 }).primaryKey(),
    key: varchar("key", { length: 255 }).notNull(),
    lastRefillAt: timestamp("last_refill_at", { fsp: 3 }),
    lastRequest: timestamp("last_request", { fsp: 3 }),
    metadata: text("metadata"),
    name: text("name"),
    permissions: text("permissions"),
    prefix: text("prefix"),
    rateLimitEnabled: boolean("rate_limit_enabled").default(true),
    rateLimitMax: int("rate_limit_max").default(10),
    rateLimitTimeWindow: int("rate_limit_time_window").default(86_400_000),
    refillAmount: int("refill_amount"),
    refillInterval: int("refill_interval"),
    remaining: int("remaining"),
    requestCount: int("request_count").default(0),
    start: text("start"),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("apikey_key_idx").on(table.key),
    index("apikey_userId_idx").on(table.userId),
  ]
);

export const oauthClient = mysqlTable("oauth_client", {
  id: varchar("id", { length: 36 }).primaryKey(),
  clientId: varchar("client_id", { length: 255 }).notNull().unique(),
  clientSecret: text("client_secret"),
  disabled: boolean("disabled").default(false),
  skipConsent: boolean("skip_consent"),
  enableEndSession: boolean("enable_end_session"),
  // @ts-expect-error - should be ok
  scopes: text("scopes", { mode: "json" }),
  userId: varchar("user_id", { length: 36 }).references(() => user.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at", { fsp: 3 }),
  updatedAt: timestamp("updated_at", { fsp: 3 }),
  name: text("name"),
  uri: text("uri"),
  icon: text("icon"),
  // @ts-expect-error - should be ok
  contacts: text("contacts", { mode: "json" }),
  tos: text("tos"),
  policy: text("policy"),
  softwareId: text("software_id"),
  softwareVersion: text("software_version"),
  softwareStatement: text("software_statement"),
  // @ts-expect-error - should be ok
  redirectUris: text("redirect_uris", { mode: "json" }).notNull(),
  // @ts-expect-error - should be ok
  postLogoutRedirectUris: text("post_logout_redirect_uris", { mode: "json" }),
  tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
  // @ts-expect-error - should be ok
  grantTypes: text("grant_types", { mode: "json" }),
  // @ts-expect-error - should be ok
  responseTypes: text("response_types", { mode: "json" }),
  public: boolean("public"),
  type: text("type"),
  referenceId: text("reference_id"),
  // @ts-expect-error - should be ok
  metadata: json("metadata", { mode: "json" }),
});

export const oauthRefreshToken = mysqlTable("oauth_refresh_token", {
  id: varchar("id", { length: 36 }).primaryKey(),
  token: text("token").notNull(),
  clientId: varchar("client_id", { length: 36 })
    .notNull()
    .references(() => oauthClient.clientId, { onDelete: "cascade" }),
  sessionId: varchar("session_id", { length: 36 }).references(
    () => session.id,
    { onDelete: "set null" }
  ),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  referenceId: text("reference_id"),
  expiresAt: timestamp("expires_at", { fsp: 3 }),
  createdAt: timestamp("created_at", { fsp: 3 }),
  revoked: timestamp("revoked", { fsp: 3 }),
  // @ts-expect-error - should be ok
  scopes: text("scopes", { mode: "json" }).notNull(),
});

export const oauthAccessToken = mysqlTable("oauth_access_token", {
  id: varchar("id", { length: 36 }).primaryKey(),
  token: varchar("token", { length: 255 }).unique(),
  clientId: varchar("client_id", { length: 36 })
    .notNull()
    .references(() => oauthClient.clientId, { onDelete: "cascade" }),
  sessionId: varchar("session_id", { length: 36 }).references(
    () => session.id,
    { onDelete: "set null" }
  ),
  userId: varchar("user_id", { length: 36 }).references(() => user.id, {
    onDelete: "cascade",
  }),
  referenceId: text("reference_id"),
  refreshId: varchar("refresh_id", { length: 36 }).references(
    () => oauthRefreshToken.id,
    { onDelete: "cascade" }
  ),
  expiresAt: timestamp("expires_at", { fsp: 3 }),
  createdAt: timestamp("created_at", { fsp: 3 }),
  // @ts-expect-error - should be ok
  scopes: text("scopes", { mode: "json" }).notNull(),
});

export const oauthConsent = mysqlTable("oauth_consent", {
  id: varchar("id", { length: 36 }).primaryKey(),
  clientId: varchar("client_id", { length: 36 })
    .notNull()
    .references(() => oauthClient.clientId, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 }).references(() => user.id, {
    onDelete: "cascade",
  }),
  referenceId: text("reference_id"),
  // @ts-expect-error - should be ok
  scopes: text("scopes", { mode: "json" }).notNull(),
  createdAt: timestamp("created_at", { fsp: 3 }),
  updatedAt: timestamp("updated_at", { fsp: 3 }),
});

export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
  apikeys: many(apikey),
  invitations: many(invitation),
  members: many(member),
  oauthAccessTokens: many(oauthAccessToken),
  oauthClients: many(oauthClient),
  oauthConsents: many(oauthConsent),
  oauthRefreshTokens: many(oauthRefreshToken),
  sessions: many(session),
}));

export const sessionRelations = relations(session, ({ one, many }) => ({
  oauthAccessTokens: many(oauthAccessToken),
  oauthRefreshTokens: many(oauthRefreshToken),
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
  invitations: many(invitation),
  members: many(member),
}));

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [member.userId],
    references: [user.id],
  }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [invitation.inviterId],
    references: [user.id],
  }),
}));

export const apikeyRelations = relations(apikey, ({ one }) => ({
  user: one(user, {
    fields: [apikey.userId],
    references: [user.id],
  }),
}));

export const oauthClientRelations = relations(oauthClient, ({ one, many }) => ({
  oauthAccessTokens: many(oauthAccessToken),
  oauthConsents: many(oauthConsent),
  oauthRefreshTokens: many(oauthRefreshToken),
  user: one(user, {
    fields: [oauthClient.userId],
    references: [user.id],
  }),
}));

export const oauthRefreshTokenRelations = relations(
  oauthRefreshToken,
  ({ one, many }) => ({
    oauthAccessTokens: many(oauthAccessToken),
    oauthClient: one(oauthClient, {
      fields: [oauthRefreshToken.clientId],
      references: [oauthClient.clientId],
    }),
    session: one(session, {
      fields: [oauthRefreshToken.sessionId],
      references: [session.id],
    }),
    user: one(user, {
      fields: [oauthRefreshToken.userId],
      references: [user.id],
    }),
  })
);

export const oauthAccessTokenRelations = relations(
  oauthAccessToken,
  ({ one }) => ({
    oauthClient: one(oauthClient, {
      fields: [oauthAccessToken.clientId],
      references: [oauthClient.clientId],
    }),
    oauthRefreshToken: one(oauthRefreshToken, {
      fields: [oauthAccessToken.refreshId],
      references: [oauthRefreshToken.id],
    }),
    session: one(session, {
      fields: [oauthAccessToken.sessionId],
      references: [session.id],
    }),
    user: one(user, {
      fields: [oauthAccessToken.userId],
      references: [user.id],
    }),
  })
);

export const oauthConsentRelations = relations(oauthConsent, ({ one }) => ({
  oauthClient: one(oauthClient, {
    fields: [oauthConsent.clientId],
    references: [oauthClient.clientId],
  }),
  user: one(user, {
    fields: [oauthConsent.userId],
    references: [user.id],
  }),
}));
