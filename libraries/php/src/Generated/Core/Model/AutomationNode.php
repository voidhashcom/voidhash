<?php

namespace Voidhash\Generated\Core\Model;

class AutomationNode
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
     * The step's id, unique in the definition, which `next` and run records name.
     *
     * @var string
     */
    protected $id;
    /**
     * The step's type, one the catalog lists, such as `send_push` or `delay`.
     *
     * @var string
     */
    protected $type;
    /**
     * A name for the step, shown instead of its type's.
     *
     * @var string|null
     */
    protected $name;
    /**
     * The step's settings, by the keys its type's catalog `fields` list.
     *
     * @var array<string, mixed>
     */
    protected $config;
    /**
     * The step that follows each exit, by exit key, such as `{ "out": "wait" }`; an absent exit ends the run there.
     *
     * @var array<string, string>
     */
    protected $next;
    /**
     * The step's id, unique in the definition, which `next` and run records name.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The step's id, unique in the definition, which `next` and run records name.
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
     * The step's type, one the catalog lists, such as `send_push` or `delay`.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * The step's type, one the catalog lists, such as `send_push` or `delay`.
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
     * A name for the step, shown instead of its type's.
     *
     * @return string|null
     */
    public function getName(): ?string
    {
        return $this->name;
    }
    /**
     * A name for the step, shown instead of its type's.
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
     * The step's settings, by the keys its type's catalog `fields` list.
     *
     * @return array<string, mixed>
     */
    public function getConfig(): iterable
    {
        return $this->config;
    }
    /**
     * The step's settings, by the keys its type's catalog `fields` list.
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
     * The step that follows each exit, by exit key, such as `{ "out": "wait" }`; an absent exit ends the run there.
     *
     * @return array<string, string>
     */
    public function getNext(): iterable
    {
        return $this->next;
    }
    /**
     * The step that follows each exit, by exit key, such as `{ "out": "wait" }`; an absent exit ends the run there.
     *
     * @param array<string, string> $next
     *
     * @return self
     */
    public function setNext(iterable $next): self
    {
        $this->initialized['next'] = true;
        $this->next = $next;
        return $this;
    }
}