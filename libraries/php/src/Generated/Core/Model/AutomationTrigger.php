<?php

namespace Voidhash\Generated\Core\Model;

class AutomationTrigger
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
     * The trigger's type: `event`, `person_signed_up`, `schedule` or `manual` (started through the API or an agent).
     *
     * @var string
     */
    protected $type;
    /**
     * The trigger's settings, by the keys its type's catalog `fields` list.
     *
     * @var array<string, mixed>
     */
    protected $config;
    /**
     * The id of the first step; null while there is none.
     *
     * @var string|null
     */
    protected $next;
    /**
     * The trigger's type: `event`, `person_signed_up`, `schedule` or `manual` (started through the API or an agent).
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * The trigger's type: `event`, `person_signed_up`, `schedule` or `manual` (started through the API or an agent).
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
     * The trigger's settings, by the keys its type's catalog `fields` list.
     *
     * @return array<string, mixed>
     */
    public function getConfig(): iterable
    {
        return $this->config;
    }
    /**
     * The trigger's settings, by the keys its type's catalog `fields` list.
     *
     * @param array<string, mixed> $config
     *
     * @return self
     */
    public function setConfig(iterable $config): self
    {
        $this->initialized['config'] = true;
        $this->config = $config;
        return $this;
    }
    /**
     * The id of the first step; null while there is none.
     *
     * @return string|null
     */
    public function getNext(): ?string
    {
        return $this->next;
    }
    /**
     * The id of the first step; null while there is none.
     *
     * @param string|null $next
     *
     * @return self
     */
    public function setNext(?string $next): self
    {
        $this->initialized['next'] = true;
        $this->next = $next;
        return $this;
    }
}