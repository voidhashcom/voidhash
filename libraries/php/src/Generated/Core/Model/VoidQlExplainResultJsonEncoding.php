<?php

namespace Voidhash\Generated\Core\Model;

class VoidQlExplainResultJsonEncoding
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
     * The columns the query would return, in order.
     *
     * @var list<VoidQlExplainResultJsonEncodingColumnsItem>
     */
    protected $columns;
    /**
     * Each relation the query reads.
     *
     * @var list<VoidQlExplainResultJsonEncodingRelationsItem>
     */
    protected $relations;
    /**
     * The projects the query covers; through this API, the project in the path.
     *
     * @var list<string>
     */
    protected $projectIds;
    /**
     * Whether the query reads personal data: people's email, name or traits, or event keys that identify a person.
     *
     * @var bool
     */
    protected $hasPersonalData;
    /**
     * The database's estimate from its indexes of what the query would scan, over every table it reads; null when it cannot estimate.
     *
     * @var VoidQlExplainResultJsonEncodingEstimate|null
     */
    protected $estimate;
    /**
     * The limits the query runs under.
     *
     * @var VoidQlExplainResultJsonEncodingLimits
     */
    protected $limits;
    /**
     * The columns the query would return, in order.
     *
     * @return list<VoidQlExplainResultJsonEncodingColumnsItem>
     */
    public function getColumns(): array
    {
        return $this->columns;
    }
    /**
     * The columns the query would return, in order.
     *
     * @param list<VoidQlExplainResultJsonEncodingColumnsItem> $columns
     *
     * @return self
     */
    public function setColumns(array $columns): self
    {
        $this->initialized['columns'] = true;
        $this->columns = $columns;
        return $this;
    }
    /**
     * Each relation the query reads.
     *
     * @return list<VoidQlExplainResultJsonEncodingRelationsItem>
     */
    public function getRelations(): array
    {
        return $this->relations;
    }
    /**
     * Each relation the query reads.
     *
     * @param list<VoidQlExplainResultJsonEncodingRelationsItem> $relations
     *
     * @return self
     */
    public function setRelations(array $relations): self
    {
        $this->initialized['relations'] = true;
        $this->relations = $relations;
        return $this;
    }
    /**
     * The projects the query covers; through this API, the project in the path.
     *
     * @return list<string>
     */
    public function getProjectIds(): array
    {
        return $this->projectIds;
    }
    /**
     * The projects the query covers; through this API, the project in the path.
     *
     * @param list<string> $projectIds
     *
     * @return self
     */
    public function setProjectIds(array $projectIds): self
    {
        $this->initialized['projectIds'] = true;
        $this->projectIds = $projectIds;
        return $this;
    }
    /**
     * Whether the query reads personal data: people's email, name or traits, or event keys that identify a person.
     *
     * @return bool
     */
    public function getHasPersonalData(): bool
    {
        return $this->hasPersonalData;
    }
    /**
     * Whether the query reads personal data: people's email, name or traits, or event keys that identify a person.
     *
     * @param bool $hasPersonalData
     *
     * @return self
     */
    public function setHasPersonalData(bool $hasPersonalData): self
    {
        $this->initialized['hasPersonalData'] = true;
        $this->hasPersonalData = $hasPersonalData;
        return $this;
    }
    /**
     * The database's estimate from its indexes of what the query would scan, over every table it reads; null when it cannot estimate.
     *
     * @return VoidQlExplainResultJsonEncodingEstimate|null
     */
    public function getEstimate(): ?VoidQlExplainResultJsonEncodingEstimate
    {
        return $this->estimate;
    }
    /**
     * The database's estimate from its indexes of what the query would scan, over every table it reads; null when it cannot estimate.
     *
     * @param VoidQlExplainResultJsonEncodingEstimate|null $estimate
     *
     * @return self
     */
    public function setEstimate(?VoidQlExplainResultJsonEncodingEstimate $estimate): self
    {
        $this->initialized['estimate'] = true;
        $this->estimate = $estimate;
        return $this;
    }
    /**
     * The limits the query runs under.
     *
     * @return VoidQlExplainResultJsonEncodingLimits
     */
    public function getLimits(): VoidQlExplainResultJsonEncodingLimits
    {
        return $this->limits;
    }
    /**
     * The limits the query runs under.
     *
     * @param VoidQlExplainResultJsonEncodingLimits $limits
     *
     * @return self
     */
    public function setLimits(VoidQlExplainResultJsonEncodingLimits $limits): self
    {
        $this->initialized['limits'] = true;
        $this->limits = $limits;
        return $this;
    }
}