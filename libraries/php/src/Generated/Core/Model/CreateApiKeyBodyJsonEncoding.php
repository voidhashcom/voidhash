<?php

namespace Voidhash\Generated\Core\Model;

class CreateApiKeyBodyJsonEncoding
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
     * What the key is for, 1 to 255 characters.
     *
     * @var string
     */
    protected $name;
    /**
     * The purchases an API key or webhook works with: `production` ones, or store sandbox and test ones for `test`.
     *
     * @var string
     */
    protected $environment;
    /**
     * @var list<string>
     */
    protected $scopes;
    /**
     * When the key stops working, an ISO 8601 timestamp in the future. Omit for a key that never expires.
     *
     * @var string|null
     */
    protected $expiresAt;
    /**
     * What the key is for, 1 to 255 characters.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * What the key is for, 1 to 255 characters.
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
     * @return list<string>
     */
    public function getScopes(): array
    {
        return $this->scopes;
    }
    /**
     * @param list<string> $scopes
     *
     * @return self
     */
    public function setScopes(array $scopes): self
    {
        $this->initialized['scopes'] = true;
        $this->scopes = $scopes;
        return $this;
    }
    /**
     * When the key stops working, an ISO 8601 timestamp in the future. Omit for a key that never expires.
     *
     * @return string|null
     */
    public function getExpiresAt(): ?string
    {
        return $this->expiresAt;
    }
    /**
     * When the key stops working, an ISO 8601 timestamp in the future. Omit for a key that never expires.
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
}