<?php

namespace Voidhash\Generated\Core\Model;

class FinalizePaywallDeployResponseJsonEncoding
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
     * @var list<FinalizedPaywallDeployComponentJsonEncoding>
     */
    protected $components;
    /**
     * @var string
     */
    protected $deployId;
    /**
     * @var list<FinalizedPaywallDeployPaywallJsonEncoding>
     */
    protected $paywalls;
    /**
     * @var string
     */
    protected $status;
    /**
     * @return list<FinalizedPaywallDeployComponentJsonEncoding>
     */
    public function getComponents(): array
    {
        return $this->components;
    }
    /**
     * @param list<FinalizedPaywallDeployComponentJsonEncoding> $components
     *
     * @return self
     */
    public function setComponents(array $components): self
    {
        $this->initialized['components'] = true;
        $this->components = $components;
        return $this;
    }
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
     * @return list<FinalizedPaywallDeployPaywallJsonEncoding>
     */
    public function getPaywalls(): array
    {
        return $this->paywalls;
    }
    /**
     * @param list<FinalizedPaywallDeployPaywallJsonEncoding> $paywalls
     *
     * @return self
     */
    public function setPaywalls(array $paywalls): self
    {
        $this->initialized['paywalls'] = true;
        $this->paywalls = $paywalls;
        return $this;
    }
    /**
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * @param string $status
     *
     * @return self
     */
    public function setStatus(string $status): self
    {
        $this->initialized['status'] = true;
        $this->status = $status;
        return $this;
    }
}