<?php

namespace Voidhash\Generated\Core\Model;

class PaywallLocationAffectedFlow
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
     * The flow's id, `pw_...`.
     *
     * @var string
     */
    protected $paywallId;
    /**
     * The flow's name.
     *
     * @var string
     */
    protected $name;
    /**
     * What its design uses of a part the change deprecated, each saying where (the layer, the logic and its step). Each blocks a release of the flow until the design no longer uses it.
     *
     * @var list<string>
     */
    protected $problems;
    /**
     * The flow's id, `pw_...`.
     *
     * @return string
     */
    public function getPaywallId(): string
    {
        return $this->paywallId;
    }
    /**
     * The flow's id, `pw_...`.
     *
     * @param string $paywallId
     *
     * @return self
     */
    public function setPaywallId(string $paywallId): self
    {
        $this->initialized['paywallId'] = true;
        $this->paywallId = $paywallId;
        return $this;
    }
    /**
     * The flow's name.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The flow's name.
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
     * What its design uses of a part the change deprecated, each saying where (the layer, the logic and its step). Each blocks a release of the flow until the design no longer uses it.
     *
     * @return list<string>
     */
    public function getProblems(): array
    {
        return $this->problems;
    }
    /**
     * What its design uses of a part the change deprecated, each saying where (the layer, the logic and its step). Each blocks a release of the flow until the design no longer uses it.
     *
     * @param list<string> $problems
     *
     * @return self
     */
    public function setProblems(array $problems): self
    {
        $this->initialized['problems'] = true;
        $this->problems = $problems;
        return $this;
    }
}