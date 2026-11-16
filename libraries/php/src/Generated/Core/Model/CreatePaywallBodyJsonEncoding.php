<?php

namespace Voidhash\Generated\Core\Model;

class CreatePaywallBodyJsonEncoding
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
     * The paywall's name, shown in the dashboard.
     *
     * @var string
     */
    protected $name;
    /**
     * The paywall's slug, unique in the project; it cannot change afterwards, and analytics refer to the paywall by it.
     *
     * @var string
     */
    protected $slug;
    /**
     * What the flow is for: a `paywall`, or an `onboarding` flow.
     *
     * @var string
     */
    protected $kind;
    /**
     * The paywall's name, shown in the dashboard.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The paywall's name, shown in the dashboard.
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
     * The paywall's slug, unique in the project; it cannot change afterwards, and analytics refer to the paywall by it.
     *
     * @return string
     */
    public function getSlug(): string
    {
        return $this->slug;
    }
    /**
     * The paywall's slug, unique in the project; it cannot change afterwards, and analytics refer to the paywall by it.
     *
     * @param string $slug
     *
     * @return self
     */
    public function setSlug(string $slug): self
    {
        $this->initialized['slug'] = true;
        $this->slug = $slug;
        return $this;
    }
    /**
     * What the flow is for: a `paywall`, or an `onboarding` flow.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * What the flow is for: a `paywall`, or an `onboarding` flow.
     *
     * @param string $kind
     *
     * @return self
     */
    public function setKind(string $kind): self
    {
        $this->initialized['kind'] = true;
        $this->kind = $kind;
        return $this;
    }
}