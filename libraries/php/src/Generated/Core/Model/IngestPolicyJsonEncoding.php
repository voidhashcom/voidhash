<?php

namespace Voidhash\Generated\Core\Model;

class IngestPolicyJsonEncoding
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
     * Every built-in event setting.
     *
     * @var list<BuiltinEventSettingJsonEncoding>
     */
    protected $builtinEvents;
    /**
     * Custom event names the project does not store.
     *
     * @var list<string>
     */
    protected $blockedCustomEvents;
    /**
     * Every built-in event setting.
     *
     * @return list<BuiltinEventSettingJsonEncoding>
     */
    public function getBuiltinEvents(): array
    {
        return $this->builtinEvents;
    }
    /**
     * Every built-in event setting.
     *
     * @param list<BuiltinEventSettingJsonEncoding> $builtinEvents
     *
     * @return self
     */
    public function setBuiltinEvents(array $builtinEvents): self
    {
        $this->initialized['builtinEvents'] = true;
        $this->builtinEvents = $builtinEvents;
        return $this;
    }
    /**
     * Custom event names the project does not store.
     *
     * @return list<string>
     */
    public function getBlockedCustomEvents(): array
    {
        return $this->blockedCustomEvents;
    }
    /**
     * Custom event names the project does not store.
     *
     * @param list<string> $blockedCustomEvents
     *
     * @return self
     */
    public function setBlockedCustomEvents(array $blockedCustomEvents): self
    {
        $this->initialized['blockedCustomEvents'] = true;
        $this->blockedCustomEvents = $blockedCustomEvents;
        return $this;
    }
}