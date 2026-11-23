<?php

namespace Voidhash\Generated\Core\Model;

class ExploreCohortDimension
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
     * @var string
     */
    protected $kind;
    /**
     * @var list<string>|null
     */
    protected $cohortIds;
    /**
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * @param string $kind
     *
     * @return self
     */
    public function setKind(string $kind): self
    {
        $this->initialized['kind'] = true;
        $this->kind = $kind;
        return $this;
    }
    /**
     * @return list<string>|null
     */
    public function getCohortIds(): ?array
    {
        return $this->cohortIds;
    }
    /**
     * @param list<string>|null $cohortIds
     *
     * @return self
     */
    public function setCohortIds(?array $cohortIds): self
    {
        $this->initialized['cohortIds'] = true;
        $this->cohortIds = $cohortIds;
        return $this;
    }
}