<?php

namespace Voidhash\Generated\Core\Model;

class SdkPersonJsonEncodingSnapshotContext
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
     * @var list<string>
     */
    protected $includedPersonIds;
    /**
     * @var string|null
     */
    protected $migrationJobId;
    /**
     * @var string
     */
    protected $mode;
    /**
     * @return list<string>
     */
    public function getIncludedPersonIds(): array
    {
        return $this->includedPersonIds;
    }
    /**
     * @param list<string> $includedPersonIds
     *
     * @return self
     */
    public function setIncludedPersonIds(array $includedPersonIds): self
    {
        $this->initialized['includedPersonIds'] = true;
        $this->includedPersonIds = $includedPersonIds;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getMigrationJobId(): ?string
    {
        return $this->migrationJobId;
    }
    /**
     * @param string|null $migrationJobId
     *
     * @return self
     */
    public function setMigrationJobId(?string $migrationJobId): self
    {
        $this->initialized['migrationJobId'] = true;
        $this->migrationJobId = $migrationJobId;
        return $this;
    }
    /**
     * @return string
     */
    public function getMode(): string
    {
        return $this->mode;
    }
    /**
     * @param string $mode
     *
     * @return self
     */
    public function setMode(string $mode): self
    {
        $this->initialized['mode'] = true;
        $this->mode = $mode;
        return $this;
    }
}