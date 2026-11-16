<?php

namespace Voidhash\Generated\Core\Model;

class UpdateWebhookBodyJsonEncoding
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
     * The new name.
     *
     * @var string|null
     */
    protected $name;
    /**
     * The new note; `null` removes it.
     *
     * @var string|null
     */
    protected $description;
    /**
     * The new URL, reachable from the internet.
     *
     * @var string|null
     */
    protected $url;
    /**
     * Every event the webhook receives from now on; at least one.
     *
     * @var list<string>|null
     */
    protected $events;
    /**
     * The purchases an API key or webhook works with: `production` ones, or store sandbox and test ones for `test`.
     *
     * @var string
     */
    protected $environment;
    /**
     * `disabled` stops deliveries; `active` resumes them and clears the failure count of a `failed` webhook.
     *
     * @var string|null
     */
    protected $status;
    /**
     * The new name.
     *
     * @return string|null
     */
    public function getName(): ?string
    {
        return $this->name;
    }
    /**
     * The new name.
     *
     * @param string|null $name
     *
     * @return self
     */
    public function setName(?string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * The new note; `null` removes it.
     *
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
     * The new note; `null` removes it.
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
     * The new URL, reachable from the internet.
     *
     * @return string|null
     */
    public function getUrl(): ?string
    {
        return $this->url;
    }
    /**
     * The new URL, reachable from the internet.
     *
     * @param string|null $url
     *
     * @return self
     */
    public function setUrl(?string $url): self
    {
        $this->initialized['url'] = true;
        $this->url = $url;
        return $this;
    }
    /**
     * Every event the webhook receives from now on; at least one.
     *
     * @return list<string>|null
     */
    public function getEvents(): ?array
    {
        return $this->events;
    }
    /**
     * Every event the webhook receives from now on; at least one.
     *
     * @param list<string>|null $events
     *
     * @return self
     */
    public function setEvents(?array $events): self
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
    /**
     * `disabled` stops deliveries; `active` resumes them and clears the failure count of a `failed` webhook.
     *
     * @return string|null
     */
    public function getStatus(): ?string
    {
        return $this->status;
    }
    /**
     * `disabled` stops deliveries; `active` resumes them and clears the failure count of a `failed` webhook.
     *
     * @param string|null $status
     *
     * @return self
     */
    public function setStatus(?string $status): self
    {
        $this->initialized['status'] = true;
        $this->status = $status;
        return $this;
    }
}