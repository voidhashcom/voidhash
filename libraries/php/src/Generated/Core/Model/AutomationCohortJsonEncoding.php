<?php

namespace Voidhash\Generated\Core\Model;

class AutomationCohortJsonEncoding
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
     * The cohort's id, which a schedule's audience names as `cohortId`.
     *
     * @var string
     */
    protected $id;
    /**
     * The cohort's name.
     *
     * @var string
     */
    protected $name;
    /**
     * The cohort's id, which a schedule's audience names as `cohortId`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The cohort's id, which a schedule's audience names as `cohortId`.
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
     * The cohort's name.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The cohort's name.
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
}