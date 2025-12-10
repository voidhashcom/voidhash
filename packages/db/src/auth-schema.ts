import { relations } from "drizzle-orm";
import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  boolean,
  int,
  index,
} from "drizzle-orm/mysql-core";

export const user = mysqlTable("user", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { fsp: 3 })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { fsp: 3 }),
});

export const session = mysqlTable(
  "session",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
    token: varchar("token", { length: 255 }).notNull().unique(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id"),
    impersonatedBy: text("impersonated_by"),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = mysqlTable(
  "account",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { fsp: 3 }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { fsp: 3 }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = mysqlTable(
  "verification",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    identifier: varchar("identifier", { length: 255 }).notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const jwks = mysqlTable("jwks", {
  id: varchar("id", { length: 36 }).primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
  expiresAt: timestamp("expires_at", { fsp: 3 }),
});

export const organization = mysqlTable("organization", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  logo: text("logo"),
  createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
  metadata: text("metadata"),
});

export const member = mysqlTable(
  "member",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 255 }).default("member").notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
  },
  (table) => [
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId),
  ],
);

export const invitation = mysqlTable(
  "invitation",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    role: varchar("role", { length: 255 }),
    status: varchar("status", { length: 255 }).default("pending").notNull(),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    inviterId: varchar("inviter_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("invitation_organizationId_idx").on(table.organizationId),
    index("invitation_email_idx").on(table.email),
  ],
);

export const apikey = mysqlTable(
  "apikey",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: text("name"),
    start: text("start"),
    prefix: text("prefix"),
    key: varchar("key", { length: 255 }).notNull(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    refillInterval: int("refill_interval"),
    refillAmount: int("refill_amount"),
    lastRefillAt: timestamp("last_refill_at", { fsp: 3 }),
    enabled: boolean("enabled").default(true),
    rateLimitEnabled: boolean("rate_limit_enabled").default(true),
    rateLimitTimeWindow: int("rate_limit_time_window").default(86400000),
    rateLimitMax: int("rate_limit_max").default(10),
    requestCount: int("request_count").default(0),
    remaining: int("remaining"),
    lastRequest: timestamp("last_request", { fsp: 3 }),
    expiresAt: timestamp("expires_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).notNull(),
    permissions: text("permissions"),
    metadata: text("metadata"),
  },
  (table) => [
    index("apikey_key_idx").on(table.key),
    index("apikey_userId_idx").on(table.userId),
  ],
);

export const oauthApplication = mysqlTable(
  "oauth_application",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: text("name"),
    icon: text("icon"),
    metadata: text("metadata"),
    clientId: varchar("client_id", { length: 255 }).unique(),
    clientSecret: text("client_secret"),
    redirectUrls: text("redirect_urls"),
    type: text("type"),
    disabled: boolean("disabled").default(false),
    userId: varchar("user_id", { length: 36 }).references(() => user.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { fsp: 3 }),
    updatedAt: timestamp("updated_at", { fsp: 3 }),
  },
  (table) => [index("oauthApplication_userId_idx").on(table.userId)],
);

export const oauthAccessToken = mysqlTable(
  "oauth_access_token",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    accessToken: varchar("access_token", { length: 255 }).unique(),
    refreshToken: varchar("refresh_token", { length: 255 }).unique(),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { fsp: 3 }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { fsp: 3 }),
    clientId: varchar("client_id", { length: 36 }).references(
      () => oauthApplication.clientId,
      { onDelete: "cascade" },
    ),
    userId: varchar("user_id", { length: 36 }).references(() => user.id, {
      onDelete: "cascade",
    }),
    scopes: text("scopes"),
    createdAt: timestamp("created_at", { fsp: 3 }),
    updatedAt: timestamp("updated_at", { fsp: 3 }),
  },
  (table) => [
    index("oauthAccessToken_clientId_idx").on(table.clientId),
    index("oauthAccessToken_userId_idx").on(table.userId),
  ],
);

export const oauthConsent = mysqlTable(
  "oauth_consent",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    clientId: varchar("client_id", { length: 36 }).references(
      () => oauthApplication.clientId,
      { onDelete: "cascade" },
    ),
    userId: varchar("user_id", { length: 36 }).references(() => user.id, {
      onDelete: "cascade",
    }),
    scopes: text("scopes"),
    createdAt: timestamp("created_at", { fsp: 3 }),
    updatedAt: timestamp("updated_at", { fsp: 3 }),
    consentGiven: boolean("consent_given"),
  },
  (table) => [
    index("oauthConsent_clientId_idx").on(table.clientId),
    index("oauthConsent_userId_idx").on(table.userId),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  members: many(member),
  invitations: many(invitation),
  apikeys: many(apikey),
  oauthApplications: many(oauthApplication),
  oauthAccessTokens: many(oauthAccessToken),
  oauthConsents: many(oauthConsent),
}));

export const sessionRelations = relations(session, ({ one }) => ({
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
  members: many(member),
  invitations: many(invitation),
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

export const oauthApplicationRelations = relations(
  oauthApplication,
  ({ one, many }) => ({
    user: one(user, {
      fields: [oauthApplication.userId],
      references: [user.id],
    }),
    oauthAccessTokens: many(oauthAccessToken),
    oauthConsents: many(oauthConsent),
  }),
);

export const oauthAccessTokenRelations = relations(
  oauthAccessToken,
  ({ one }) => ({
    oauthApplication: one(oauthApplication, {
      fields: [oauthAccessToken.clientId],
      references: [oauthApplication.clientId],
    }),
    user: one(user, {
      fields: [oauthAccessToken.userId],
      references: [user.id],
    }),
  }),
);

export const oauthConsentRelations = relations(oauthConsent, ({ one }) => ({
  oauthApplication: one(oauthApplication, {
    fields: [oauthConsent.clientId],
    references: [oauthApplication.clientId],
  }),
  user: one(user, {
    fields: [oauthConsent.userId],
    references: [user.id],
  }),
}));
