<?php

namespace Voidhash\Generated\Core\Model;

class ApiKeyJsonEncoding
{
    /**
     * @var array
     */
    protected $initialized = [];
    public function isInitialized($property): bool
    {
        return array_key_exists($property, $this->initialized);
    }
    /**
     * The key's id: `api_sk_...` for a secret key, `api_pk_...` for a publishable key.
     *
     * @var string
     */
    protected $id;
    /**
     * The project the key belongs to.
     *
     * @var string
     */
    protected $projectId;
    /**
     * What the key is for.
     *
     * @var string
     */
    protected $name;
    /**
     * `publishable` keys ship inside apps and reach only the SDK client API; `secret` keys stay on servers and reach the management API.
     *
     * @var string
     */
    protected $type;
    /**
     * The purchases an API key or webhook works with: `production` ones, or store sandbox and test ones for `test`.
     *
     * @var string
     */
    protected $environment;
    /**
     * How the key starts: `vh_sk_`, `vh_sk_test_`, `vh_pk_` or `vh_pk_test_`.
     *
     * @var string
     */
    protected $prefix;
    /**
     * The key's last 4 characters, to tell keys apart.
     *
     * @var string
     */
    protected $end;
    /**
     * The full key of a publishable key, which ships inside apps and is not a secret. Null for a secret key, whose key appears only when it is created or rotated.
     *
     * @var string|null
     */
    protected $rawKey;
    /**
     * The project permissions a secret key is limited to, such as `project:read`; a full-access key lists every permission a key may hold. Null for a publishable key.
     *
     * @var list<string>|null
     */
    protected $scopes;
    /**
     * When a secret key stops working; null when it never expires.
     *
     * @var string|null
     */
    protected $expiresAt;
    /**
     * When a secret key last authenticated, to within a minute; null if never.
     *
     * @var string|null
     */
    protected $lastUsedAt;
    /**
     * Until when a rotated key's previous secret keeps working; null when it does not.
     *
     * @var string|null
     */
    protected $previousKeyExpiresAt;
    /**
     * When the key, or its current secret, was issued, as an ISO 8601 timestamp.
     *
     * @var string|null
     */
    protected $createdAt;
    /**
     * The key's id: `api_sk_...` for a secret key, `api_pk_...` for a publishable key.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The key's id: `api_sk_...` for a secret key, `api_pk_...` for a publishable key.
     *
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * The project the key belongs to.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project the key belongs to.
     *
     * @param string $projectId
     *
     * @return self
     */
    public function setProjectId(string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
        return $this;
    }
    /**
     * What the key is for.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * What the key is for.
     *
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * `publishable` keys ship inside apps and reach only the SDK client API; `secret` keys stay on servers and reach the management API.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * `publishable` keys ship inside apps and reach only the SDK client API; `secret` keys stay on servers and reach the management API.
     *
     * @param string $type
     *
     * @return self
     */
    public function setType(string $type): self
    {
        $this->initialized['type'] = true;
        $this->type = $type;
        return $this;
    }
    /**
     * The purchases an API key or webhook works with: `production` ones, or store sandbox and test ones for `test`.
     *
     * @return string
     */
    public function getEnvironment(): string
    {
        return $this->environment;
    }
    /**
     * The purchases an API key or webhook works with: `production` ones, or store sandbox and test ones for `test`.
     *
     * @param string $environment
     *
     * @return self
     */
    public function setEnvironment(string $environment): self
    {
        $this->initialized['environment'] = true;
        $this->environment = $environment;
        return $this;
    }
    /**
     * How the key starts: `vh_sk_`, `vh_sk_test_`, `vh_pk_` or `vh_pk_test_`.
     *
     * @return string
     */
    public function getPrefix(): string
    {
        return $this->prefix;
    }
    /**
     * How the key starts: `vh_sk_`, `vh_sk_test_`, `vh_pk_` or `vh_pk_test_`.
     *
     * @param string $prefix
     *
     * @return self
     */
    public function setPrefix(string $prefix): self
    {
        $this->initialized['prefix'] = true;
        $this->prefix = $prefix;
        return $this;
    }
    /**
     * The key's last 4 characters, to tell keys apart.
     *
     * @return string
     */
    public function getEnd(): string
    {
        return $this->end;
    }
    /**
     * The key's last 4 characters, to tell keys apart.
     *
     * @param string $end
     *
     * @return self
     */
    public function setEnd(string $end): self
    {
        $this->initialized['end'] = true;
        $this->end = $end;
        return $this;
    }
    /**
     * The full key of a publishable key, which ships inside apps and is not a secret. Null for a secret key, whose key appears only when it is created or rotated.
     *
     * @return string|null
     */
    public function getRawKey(): ?string
    {
        return $this->rawKey;
    }
    /**
     * The full key of a publishable key, which ships inside apps and is not a secret. Null for a secret key, whose key appears only when it is created or rotated.
     *
     * @param string|null $rawKey
     *
     * @return self
     */
    public function setRawKey(?string $rawKey): self
    {
        $this->initialized['rawKey'] = true;
        $this->rawKey = $rawKey;
        return $this;
    }
    /**
     * The project permissions a secret key is limited to, such as `project:read`; a full-access key lists every permission a key may hold. Null for a publishable key.
     *
     * @return list<string>|null
     */
    public function getScopes(): ?array
    {
        return $this->scopes;
    }
    /**
     * The project permissions a secret key is limited to, such as `project:read`; a full-access key lists every permission a key may hold. Null for a publishable key.
     *
     * @param list<string>|null $scopes
     *
     * @return self
     */
    public function setScopes(?array $scopes): self
    {
        $this->initialized['scopes'] = true;
        $this->scopes = $scopes;
        return $this;
    }
    /**
     * When a secret key stops working; null when it never expires.
     *
     * @return string|null
     */
    public function getExpiresAt(): ?string
    {
        return $this->expiresAt;
    }
    /**
     * When a secret key stops working; null when it never expires.
     *
     * @param string|null $expiresAt
     *
     * @return self
     */
    public function setExpiresAt(?string $expiresAt): self
    {
        $this->initialized['expiresAt'] = true;
        $this->expiresAt = $expiresAt;
        return $this;
    }
    /**
     * When a secret key last authenticated, to within a minute; null if never.
     *
     * @return string|null
     */
    public function getLastUsedAt(): ?string
    {
        return $this->lastUsedAt;
    }
    /**
     * When a secret key last authenticated, to within a minute; null if never.
     *
     * @param string|null $lastUsedAt
     *
     * @return self
     */
    public function setLastUsedAt(?string $lastUsedAt): self
    {
        $this->initialized['lastUsedAt'] = true;
        $this->lastUsedAt = $lastUsedAt;
        return $this;
    }
    /**
     * Until when a rotated key's previous secret keeps working; null when it does not.
     *
     * @return string|null
     */
    public function getPreviousKeyExpiresAt(): ?string
    {
        return $this->previousKeyExpiresAt;
    }
    /**
     * Until when a rotated key's previous secret keeps working; null when it does not.
     *
     * @param string|null $previousKeyExpiresAt
     *
     * @return self
     */
    public function setPreviousKeyExpiresAt(?string $previousKeyExpiresAt): self
    {
        $this->initialized['previousKeyExpiresAt'] = true;
        $this->previousKeyExpiresAt = $previousKeyExpiresAt;
        return $this;
    }
    /**
     * When the key, or its current secret, was issued, as an ISO 8601 timestamp.
     *
     * @return string|null
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }
    /**
     * When the key, or its current secret, was issued, as an ISO 8601 timestamp.
     *
     * @param string|null $createdAt
     *
     * @return self
     */
    public function setCreatedAt(?string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
}