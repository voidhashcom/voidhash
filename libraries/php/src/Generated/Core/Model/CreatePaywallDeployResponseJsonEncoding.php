<?php

namespace Voidhash\Generated\Core\Model;

class CreatePaywallDeployResponseJsonEncoding
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
     * @var string
     */
    protected $deployId;
    /**
     * @var list<string>
     */
    protected $missing;
    /**
     * @return string
     */
    public function getDeployId(): string
    {
        return $this->deployId;
    }
    /**
     * @param string $deployId
     *
     * @return self
     */
    public function setDeployId(string $deployId): self
    {
        $this->initialized['deployId'] = true;
        $this->deployId = $deployId;
        return $this;
    }
    /**
     * @return list<string>
     */
    public function getMissing(): array
    {
        return $this->missing;
    }
    /**
     * @param list<string> $missing
     *
     * @return self
     */
    public function setMissing(array $missing): self
    {
        $this->initialized['missing'] = true;
        $this->missing = $missing;
        return $this;
    }
}