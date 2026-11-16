<?php

namespace Voidhash\Generated\Core\Model;

class CreateWebhookBodyJsonEncoding
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
     * What the webhook is for.
     *
     * @var string
     */
    protected $name;
    /**
     * A longer note for the team.
     *
     * @var string|null
     */
    protected $description;
    /**
     * The URL to POST events to, reachable from the internet: Voidhash does not call localhost or private networks.
     *
     * @var string
     */
    protected $url;
    /**
     * The events the webhook receives; at least one.
     *
     * @var list<string>
     */
    protected $events;
    /**
     * The purchases an API key or webhook works with: `production` ones, or store sandbox and test ones for `test`.
     *
     * @var string
     */
    protected $environment;
    /**
     * What the webhook is for.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * What the webhook is for.
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
     * A longer note for the team.
     *
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
     * A longer note for the team.
     *
     * @param string|null $description
     *
     * @return self
     */
    public function setDescription(?string $description): self
    {
        $this->initialized['description'] = true;
        $this->description = $description;
        return $this;
    }
    /**
     * The URL to POST events to, reachable from the internet: Voidhash does not call localhost or private networks.
     *
     * @return string
     */
    public function getUrl(): string
    {
        return $this->url;
    }
    /**
     * The URL to POST events to, reachable from the internet: Voidhash does not call localhost or private networks.
     *
     * @param string $url
     *
     * @return self
     */
    public function setUrl(string $url): self
    {
        $this->initialized['url'] = true;
        $this->url = $url;
        return $this;
    }
    /**
     * The events the webhook receives; at least one.
     *
     * @return list<string>
     */
    public function getEvents(): array
    {
        return $this->events;
    }
    /**
     * The events the webhook receives; at least one.
     *
     * @param list<string> $events
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
}