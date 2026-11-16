<?php

namespace Voidhash\Generated\Core\Model;

class UpdateApiKeyBodyJsonEncoding
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
     * @var list<string>
     */
    protected $scopes;
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
}