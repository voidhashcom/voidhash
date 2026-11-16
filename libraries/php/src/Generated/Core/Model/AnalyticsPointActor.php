<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsPointActor
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
     * The actor as the point counted it: a person's id, or a visitor's distinct id until identified; a group's key.
     *
     * @var string
     */
    protected $key;
    /**
     * What the actor adds to the point, as `valueKind` says: the people of a count number its value, and what adds up sums to it. Null where nothing is measured.
     *
     * @var float|null
     */
    protected $value;
    /**
     * A person behind a point.
     *
     * @var AnalyticsPointPerson
     */
    protected $person;
    /**
     * A group behind a point.
     *
     * @var AnalyticsPointGroup
     */
    protected $group;
    /**
     * The actor as the point counted it: a person's id, or a visitor's distinct id until identified; a group's key.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The actor as the point counted it: a person's id, or a visitor's distinct id until identified; a group's key.
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
     * What the actor adds to the point, as `valueKind` says: the people of a count number its value, and what adds up sums to it. Null where nothing is measured.
     *
     * @return float|null
     */
    public function getValue(): ?float
    {
        return $this->value;
    }
    /**
     * What the actor adds to the point, as `valueKind` says: the people of a count number its value, and what adds up sums to it. Null where nothing is measured.
     *
     * @param float|null $value
     *
     * @return self
     */
    public function setValue(?float $value): self
    {
        $this->initialized['value'] = true;
        $this->value = $value;
        return $this;
    }
    /**
     * A person behind a point.
     *
     * @return AnalyticsPointPerson
     */
    public function getPerson(): AnalyticsPointPerson
    {
        return $this->person;
    }
    /**
     * A person behind a point.
     *
     * @param AnalyticsPointPerson $person
     *
     * @return self
     */
    public function setPerson(AnalyticsPointPerson $person): self
    {
        $this->initialized['person'] = true;
        $this->person = $person;
        return $this;
    }
    /**
     * A group behind a point.
     *
     * @return AnalyticsPointGroup
     */
    public function getGroup(): AnalyticsPointGroup
    {
        return $this->group;
    }
    /**
     * A group behind a point.
     *
     * @param AnalyticsPointGroup $group
     *
     * @return self
     */
    public function setGroup(AnalyticsPointGroup $group): self
    {
        $this->initialized['group'] = true;
        $this->group = $group;
        return $this;
    }
}