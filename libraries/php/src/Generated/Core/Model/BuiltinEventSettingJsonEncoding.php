<?php

namespace Voidhash\Generated\Core\Model;

class BuiltinEventSettingJsonEncoding
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
     * The setting's key, used in `PUT .../ingest-policy/builtin-events/{key}`: the event name, or `revenue` for the group of revenue events.
     *
     * @var string
     */
    protected $key;
    /**
     * The setting's display name.
     *
     * @var string
     */
    protected $name;
    /**
     * What the events record.
     *
     * @var string
     */
    protected $description;
    /**
     * The events the setting admits; more than one for a group such as `revenue`.
     *
     * @var list<string>
     */
    protected $eventNames;
    /**
     * Whether the project stores the events.
     *
     * @var bool
     */
    protected $isEnabled;
    /**
     * What `isEnabled` is until the project changes it.
     *
     * @var bool
     */
    protected $isDefaultEnabled;
    /**
     * Whether the project changed the setting from its default.
     *
     * @var bool
     */
    protected $isOverridden;
    /**
     * What stops working when the setting is turned off; null when nothing does.
     *
     * @var string|null
     */
    protected $warning;
    /**
     * The setting's key, used in `PUT .../ingest-policy/builtin-events/{key}`: the event name, or `revenue` for the group of revenue events.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The setting's key, used in `PUT .../ingest-policy/builtin-events/{key}`: the event name, or `revenue` for the group of revenue events.
     *
     * @param string $key
     *
     * @return self
     */
    public function setKey(string $key): self
    {
        $this->initialized['key'] = true;
        $this->key = $key;
        return $this;
    }
    /**
     * The setting's display name.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The setting's display name.
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
     * What the events record.
     *
     * @return string
     */
    public function getDescription(): string
    {
        return $this->description;
    }
    /**
     * What the events record.
     *
     * @param string $description
     *
     * @return self
     */
    public function setDescription(string $description): self
    {
        $this->initialized['description'] = true;
        $this->description = $description;
        return $this;
    }
    /**
     * The events the setting admits; more than one for a group such as `revenue`.
     *
     * @return list<string>
     */
    public function getEventNames(): array
    {
        return $this->eventNames;
    }
    /**
     * The events the setting admits; more than one for a group such as `revenue`.
     *
     * @param list<string> $eventNames
     *
     * @return self
     */
    public function setEventNames(array $eventNames): self
    {
        $this->initialized['eventNames'] = true;
        $this->eventNames = $eventNames;
        return $this;
    }
    /**
     * Whether the project stores the events.
     *
     * @return bool
     */
    public function getIsEnabled(): bool
    {
        return $this->isEnabled;
    }
    /**
     * Whether the project stores the events.
     *
     * @param bool $isEnabled
     *
     * @return self
     */
    public function setIsEnabled(bool $isEnabled): self
    {
        $this->initialized['isEnabled'] = true;
        $this->isEnabled = $isEnabled;
        return $this;
    }
    /**
     * What `isEnabled` is until the project changes it.
     *
     * @return bool
     */
    public function getIsDefaultEnabled(): bool
    {
        return $this->isDefaultEnabled;
    }
    /**
     * What `isEnabled` is until the project changes it.
     *
     * @param bool $isDefaultEnabled
     *
     * @return self
     */
    public function setIsDefaultEnabled(bool $isDefaultEnabled): self
    {
        $this->initialized['isDefaultEnabled'] = true;
        $this->isDefaultEnabled = $isDefaultEnabled;
        return $this;
    }
    /**
     * Whether the project changed the setting from its default.
     *
     * @return bool
     */
    public function getIsOverridden(): bool
    {
        return $this->isOverridden;
    }
    /**
     * Whether the project changed the setting from its default.
     *
     * @param bool $isOverridden
     *
     * @return self
     */
    public function setIsOverridden(bool $isOverridden): self
    {
        $this->initialized['isOverridden'] = true;
        $this->isOverridden = $isOverridden;
        return $this;
    }
    /**
     * What stops working when the setting is turned off; null when nothing does.
     *
     * @return string|null
     */
    public function getWarning(): ?string
    {
        return $this->warning;
    }
    /**
     * What stops working when the setting is turned off; null when nothing does.
     *
     * @param string|null $warning
     *
     * @return self
     */
    public function setWarning(?string $warning): self
    {
        $this->initialized['warning'] = true;
        $this->warning = $warning;
        return $this;
    }
}