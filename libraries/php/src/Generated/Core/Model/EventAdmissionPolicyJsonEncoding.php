<?php

namespace Voidhash\Generated\Core\Model;

class EventAdmissionPolicyJsonEncoding
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
     * @var list<BuiltinEventAdmission>
     */
    protected $builtinEvents;
    /**
     * @var list<string>
     */
    protected $customEventBlocklist;
    /**
     * @return list<BuiltinEventAdmission>
     */
    public function getBuiltinEvents(): array
    {
        return $this->builtinEvents;
    }
    /**
     * @param list<BuiltinEventAdmission> $builtinEvents
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
     * @return list<string>
     */
    public function getCustomEventBlocklist(): array
    {
        return $this->customEventBlocklist;
    }
    /**
     * @param list<string> $customEventBlocklist
     *
     * @return self
     */
    public function setCustomEventBlocklist(array $customEventBlocklist): self
    {
        $this->initialized['customEventBlocklist'] = true;
        $this->customEventBlocklist = $customEventBlocklist;
        return $this;
    }
}