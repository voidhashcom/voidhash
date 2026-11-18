<?php

namespace Voidhash\Generated\Core\Model;

class SchemaNativeComponentJsonEncoding
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
     * The events the view emits, by key.
     *
     * @var list<SchemaNativeEventJsonEncoding>
     */
    protected $events;
    /**
     * The component's id, `native/<name>`, which the app registers its view under.
     *
     * @var string
     */
    protected $id;
    /**
     * The name the designer gave the component's native rendering.
     *
     * @var string
     */
    protected $name;
    /**
     * The paywalls whose deployed release uses this contract, by slug.
     *
     * @var list<SchemaNativeComponentPaywallJsonEncoding>
     */
    protected $paywalls;
    /**
     * The properties the view reads, by key.
     *
     * @var list<SchemaNativePropJsonEncoding>
     */
    protected $props;
    /**
     * 12 hex characters naming the contract; any change to its properties or events changes it, and apps with a view of another version show the designed component instead.
     *
     * @var string
     */
    protected $version;
    /**
     * The events the view emits, by key.
     *
     * @return list<SchemaNativeEventJsonEncoding>
     */
    public function getEvents(): array
    {
        return $this->events;
    }
    /**
     * The events the view emits, by key.
     *
     * @param list<SchemaNativeEventJsonEncoding> $events
     *
     * @return self
     */
    public function setEvents(array $events): self
    {
        $this->initialized['events'] = true;
        $this->events = $events;
        return $this;
    }
    /**
     * The component's id, `native/<name>`, which the app registers its view under.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The component's id, `native/<name>`, which the app registers its view under.
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
     * The name the designer gave the component's native rendering.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The name the designer gave the component's native rendering.
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
     * The paywalls whose deployed release uses this contract, by slug.
     *
     * @return list<SchemaNativeComponentPaywallJsonEncoding>
     */
    public function getPaywalls(): array
    {
        return $this->paywalls;
    }
    /**
     * The paywalls whose deployed release uses this contract, by slug.
     *
     * @param list<SchemaNativeComponentPaywallJsonEncoding> $paywalls
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
     * The properties the view reads, by key.
     *
     * @return list<SchemaNativePropJsonEncoding>
     */
    public function getProps(): array
    {
        return $this->props;
    }
    /**
     * The properties the view reads, by key.
     *
     * @param list<SchemaNativePropJsonEncoding> $props
     *
     * @return self
     */
    public function setProps(array $props): self
    {
        $this->initialized['props'] = true;
        $this->props = $props;
        return $this;
    }
    /**
     * 12 hex characters naming the contract; any change to its properties or events changes it, and apps with a view of another version show the designed component instead.
     *
     * @return string
     */
    public function getVersion(): string
    {
        return $this->version;
    }
    /**
     * 12 hex characters naming the contract; any change to its properties or events changes it, and apps with a view of another version show the designed component instead.
     *
     * @param string $version
     *
     * @return self
     */
    public function setVersion(string $version): self
    {
        $this->initialized['version'] = true;
        $this->version = $version;
        return $this;
    }
}